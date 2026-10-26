import { describe, it, expect } from 'vitest';
import {
  calculateAccountBalance,
  calculateDebtSummary,
  calculatePeriodTotals,
  checkOverdrawnWarning,
  determineDebtStatus,
  formatRupiah,
  parseRupiah,
  toIntegerRupiah,
  validateDebtPayment,
  calculateGoalProgress,
  calculateBudgetStatus,
  calculateSavingsStreak,
  calculatePocketBalance,
  verifyPocketInvariant,
  calculateAutoAllocation,
  checkPocketExpenseOverdraft,
  checkPocketMonthlyLimit,
} from '../src/domain/accounting';
import {
  getPeriodDateRange,
  groupTransactionsByDay,
  aggregateCategoryBreakdown,
} from '../src/domain/statistics';
import { Account, AutoAllocationRule, Pocket, Transaction } from '../src/domain/types';

describe('Domain Accounting Logic', () => {
  it('correctly handles integer rupiah conversions and formatting', () => {
    expect(toIntegerRupiah(123.456)).toBe(123);
    expect(toIntegerRupiah('Rp 500.000')).toBe(500000);
    expect(toIntegerRupiah(NaN)).toBe(0);
    expect(toIntegerRupiah(Infinity)).toBe(0);

    expect(formatRupiah(320000)).toBe('Rp320.000');
    expect(formatRupiah(-50000)).toBe('-Rp50.000');
    expect(formatRupiah(320000, true)).toBe('Rp•••');
    expect(parseRupiah('Rp 320.000')).toBe(320000);
    expect(parseRupiah('-Rp 50.000')).toBe(-50000);
  });

  it('calculates account balance accurately: Saldo = awal + masuk - keluar + transfers', () => {
    const accountA = 'acc-1';
    const accountB = 'acc-2';
    const saldoAwal = 100000;

    const txs: Pick<Transaction, 'tabunganId' | 'targetTabunganId' | 'jenis' | 'nominal' | 'isDeleted'>[] = [
      { tabunganId: accountA, jenis: 'masuk', nominal: 50000, isDeleted: false },
      { tabunganId: accountA, jenis: 'keluar', nominal: 20000, isDeleted: false },
      // Transfer from A to B: 30000
      { tabunganId: accountA, targetTabunganId: accountB, jenis: 'transfer', nominal: 30000, isDeleted: false },
      // Deleted tx shouldn't affect balance
      { tabunganId: accountA, jenis: 'keluar', nominal: 40000, isDeleted: true },
    ];

    // For Account A: 100k + 50k - 20k - 30k = 100000
    const balanceA = calculateAccountBalance(saldoAwal, txs, accountA);
    expect(balanceA).toBe(100000);

    // For Account B: 0 initial + 30k transfer in = 30000
    const balanceB = calculateAccountBalance(0, txs, accountB);
    expect(balanceB).toBe(30000);
  });

  it('excludes paired transfers from period income and expense statistics', () => {
    const txs: Pick<Transaction, 'jenis' | 'nominal' | 'isDeleted'>[] = [
      { jenis: 'masuk', nominal: 100000, isDeleted: false },
      { jenis: 'keluar', nominal: 40000, isDeleted: false },
      { jenis: 'transfer', nominal: 50000, isDeleted: false },
    ];

    const totals = calculatePeriodTotals(txs);
    expect(totals.totalMasuk).toBe(100000);
    expect(totals.totalKeluar).toBe(40000);
    expect(totals.selisih).toBe(60000);
    expect(totals.transactionCount).toBe(2);
  });

  it('triggers warning when expense exceeds account balance', () => {
    const currentBalance = 50000;
    const expense = 70000;
    const check = checkOverdrawnWarning(currentBalance, expense);
    expect(check.isOverdrawn).toBe(true);
    expect(check.projectedBalance).toBe(-20000);

    const safeExpense = 30000;
    const safeCheck = checkOverdrawnWarning(currentBalance, safeExpense);
    expect(safeCheck.isOverdrawn).toBe(false);
    expect(safeCheck.projectedBalance).toBe(20000);
  });

  it('manages debts and installments, rejects overpayment, and auto-detects status', () => {
    const pokok = 1000000;
    const payments = [
      { nominal: 300000, isDeleted: false },
      { nominal: 200000, isDeleted: false },
      { nominal: 50000, isDeleted: true }, // deleted payment ignored
    ];

    const summary = calculateDebtSummary(pokok, payments);
    expect(summary.pokok).toBe(1000000);
    expect(summary.totalDibayar).toBe(500000);
    expect(summary.sisa).toBe(500000);
    expect(summary.persentaseLunas).toBe(50);

    // Overpayment validation
    const invalidPay = validateDebtPayment(summary.sisa, 600000);
    expect(invalidPay.valid).toBe(false);
    expect(invalidPay.suggestedAmount).toBe(500000);

    const validPay = validateDebtPayment(summary.sisa, 500000);
    expect(validPay.valid).toBe(true);

    // Status: partially paid
    const statusDicicil = determineDebtStatus(pokok, payments, '2026-12-31', '2026-10-26');
    expect(statusDicicil).toBe('dicicil');

    // Status: overdue
    const statusOverdue = determineDebtStatus(pokok, payments, '2026-10-01', '2026-10-26');
    expect(statusOverdue).toBe('terlambat');

    // Status: paid in full
    const fullPayments = [...payments, { nominal: 500000, isDeleted: false }];
    const statusLunas = determineDebtStatus(pokok, fullPayments, '2026-12-31', '2026-10-26');
    expect(statusLunas).toBe('lunas');
  });

  it('calculates savings goal progress and timeline status', () => {
    const target = 1000000;
    const current = 750000;
    const dailyRate = 10000;
    const dueDate = '2026-12-31';

    const goal = calculateGoalProgress(target, current, dailyRate, dueDate);
    expect(goal.persen).toBe(75);
    expect(goal.sisaNominal).toBe(250000);
    expect(goal.estimasiHariTercapai).toBe(25);
    expect(goal.statusTenggat).toBe('tepat_waktu');
  });

  it('calculates monthly budget status and warning thresholds', () => {
    const budgetLimit = 500000;
    // Under 80%: safe
    expect(calculateBudgetStatus(budgetLimit, 300000).status).toBe('aman');
    // >= 80%: near limit
    expect(calculateBudgetStatus(budgetLimit, 420000).status).toBe('mendekati');
    // > 100%: exceeded
    expect(calculateBudgetStatus(budgetLimit, 550000).status).toBe('melebihi');
  });

  it('calculates savings streak accurately across days', () => {
    const today = '2026-10-26';
    const txs: Pick<Transaction, 'tanggal' | 'jenis' | 'nominal' | 'isDeleted'>[] = [
      { tanggal: '2026-10-24T10:00:00Z', jenis: 'masuk', nominal: 10000, isDeleted: false },
      { tanggal: '2026-10-25T14:00:00Z', jenis: 'masuk', nominal: 20000, isDeleted: false },
      { tanggal: '2026-10-26T09:00:00Z', jenis: 'masuk', nominal: 15000, isDeleted: false },
    ];

    const streak = calculateSavingsStreak(txs, today);
    expect(streak.currentStreak).toBe(3);
    expect(streak.bestStreak).toBe(3);
  });
});

describe('Domain Statistics & Grouping', () => {
  it('groups transactions by day with subtotals', () => {
    const txs: Transaction[] = [
      {
        id: 'tx-1',
        tabunganId: 'acc-1',
        jenis: 'masuk',
        nominal: 50000,
        tanggal: '2026-10-26T09:00:00Z',
        isDeleted: false,
        createdAt: '2026-10-26T09:00:00Z',
        updatedAt: '2026-10-26T09:00:00Z',
      },
      {
        id: 'tx-2',
        tabunganId: 'acc-1',
        jenis: 'keluar',
        nominal: 20000,
        tanggal: '2026-10-26T12:00:00Z',
        isDeleted: false,
        createdAt: '2026-10-26T12:00:00Z',
        updatedAt: '2026-10-26T12:00:00Z',
      },
      {
        id: 'tx-3',
        tabunganId: 'acc-1',
        jenis: 'keluar',
        nominal: 15000,
        tanggal: '2026-10-25T11:00:00Z',
        isDeleted: false,
        createdAt: '2026-10-25T11:00:00Z',
        updatedAt: '2026-10-25T11:00:00Z',
      },
    ];

    const groups = groupTransactionsByDay(txs, '2026-10-26');
    expect(groups.length).toBe(2);
    expect(groups[0].label).toBe('Hari ini');
    expect(groups[0].totalMasuk).toBe(50000);
    expect(groups[0].totalKeluar).toBe(20000);
    expect(groups[0].selisih).toBe(30000);

    expect(groups[1].label).toBe('Kemarin');
    expect(groups[1].totalKeluar).toBe(15000);
  });

  it('aggregates category breakdown percentages', () => {
    const categories = [
      { id: 'cat-food', nama: 'Makanan', jenis: 'keluar' as const, ikon: 'Utensils', warna: '#f97316', isDeleted: false, createdAt: '', updatedAt: '' },
      { id: 'cat-transport', nama: 'Transportasi', jenis: 'keluar' as const, ikon: 'Car', warna: '#3b82f6', isDeleted: false, createdAt: '', updatedAt: '' },
    ];

    const txs: Transaction[] = [
      { id: '1', tabunganId: 'acc', jenis: 'keluar', nominal: 60000, kategoriId: 'cat-food', tanggal: '2026-10-26', isDeleted: false, createdAt: '', updatedAt: '' },
      { id: '2', tabunganId: 'acc', jenis: 'keluar', nominal: 40000, kategoriId: 'cat-transport', tanggal: '2026-10-26', isDeleted: false, createdAt: '', updatedAt: '' },
    ];

    const breakdown = aggregateCategoryBreakdown(txs, categories, 'keluar');
    expect(breakdown.length).toBe(2);
    expect(breakdown[0].nama).toBe('Makanan');
    expect(breakdown[0].total).toBe(60000);
    expect(breakdown[0].persentase).toBe(60);

    expect(breakdown[1].nama).toBe('Transportasi');
    expect(breakdown[1].total).toBe(40000);
    expect(breakdown[1].persentase).toBe(40);
  });

  it('calculates period date ranges correctly', () => {
    const ref = new Date('2026-10-26T12:00:00Z');
    const rangeToday = getPeriodDateRange('hari_ini', ref);
    expect(rangeToday.startDate).toBe('2026-10-26');
    expect(rangeToday.endDate).toBe('2026-10-26');

    const rangeMonth = getPeriodDateRange('bulan_ini', ref);
    expect(rangeMonth.startDate).toBe('2026-10-01');
    expect(rangeMonth.endDate).toBe('2026-10-31');
  });
});

describe('Pos Tabungan (Envelope Budgeting) Domain Logic', () => {
  const mockAccount: Account = {
    id: 'acc-main',
    nama: 'BCA Utama',
    ikon: 'Wallet',
    warna: '#0284c7',
    saldoAwal: 500000,
    diarsipkan: false,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const sysPocket: Pocket = {
    id: 'pos_sys_acc-main',
    tabunganId: 'acc-main',
    nama: 'Belum dialokasikan',
    ikon: 'Inbox',
    warna: '#94a3b8',
    urutan: 0,
    diarsipkan: false,
    isSystem: true,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const foodPocket: Pocket = {
    id: 'pos-food',
    tabunganId: 'acc-main',
    nama: 'Makan & Jajan',
    ikon: 'Utensils',
    warna: '#f97316',
    batasBulanan: 400000,
    urutan: 1,
    diarsipkan: false,
    isSystem: false,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const billPocket: Pocket = {
    id: 'pos-bills',
    tabunganId: 'acc-main',
    nama: 'Tagihan Listrik',
    ikon: 'Zap',
    warna: '#eab308',
    target: 200000,
    urutan: 2,
    diarsipkan: false,
    isSystem: false,
    isDeleted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const allPockets = [sysPocket, foodPocket, billPocket];

  it('calculates pocket balances correctly and preserves the strict account invariant', () => {
    // Initial account balance is 500.000. No transactions yet:
    // sysPocket should have 500.000, others 0
    expect(calculatePocketBalance(sysPocket, mockAccount, [])).toBe(500000);
    expect(calculatePocketBalance(foodPocket, mockAccount, [])).toBe(0);

    const invInitial = verifyPocketInvariant(mockAccount, allPockets, []);
    expect(invInitial.isValid).toBe(true);
    expect(invInitial.accountBalance).toBe(500000);
    expect(invInitial.sumPockets).toBe(500000);

    // Move 200.000 from sysPocket to foodPocket
    const txMove: Transaction = {
      id: 'tx-move-1',
      tabunganId: 'acc-main',
      jenis: 'pindah_pos',
      nominal: 200000,
      posId: sysPocket.id,
      targetPosId: foodPocket.id,
      tanggal: '2026-10-26T10:00:00Z',
      isDeleted: false,
      createdAt: '2026-10-26T10:00:00Z',
      updatedAt: '2026-10-26T10:00:00Z',
    };

    // Expense 50.000 from foodPocket
    const txExpense: Transaction = {
      id: 'tx-exp-1',
      tabunganId: 'acc-main',
      jenis: 'keluar',
      nominal: 50000,
      posId: foodPocket.id,
      tanggal: '2026-10-26T12:00:00Z',
      isDeleted: false,
      createdAt: '2026-10-26T12:00:00Z',
      updatedAt: '2026-10-26T12:00:00Z',
    };

    const txs = [txMove, txExpense];

    // Account balance: 500k initial - 50k expense = 450.000
    const accBal = calculateAccountBalance(mockAccount.saldoAwal, txs, mockAccount.id);
    expect(accBal).toBe(450000);

    // sysPocket: 500k - 200k moved = 300.000
    expect(calculatePocketBalance(sysPocket, mockAccount, txs)).toBe(300000);

    // foodPocket: 0 + 200k in - 50k out = 150.000
    expect(calculatePocketBalance(foodPocket, mockAccount, txs)).toBe(150000);

    // Invariant check: 300k + 150k + 0 = 450k === account balance
    const invAfter = verifyPocketInvariant(mockAccount, allPockets, txs);
    expect(invAfter.isValid).toBe(true);
    expect(invAfter.sumPockets).toBe(450000);
  });

  it('calculates auto allocation with percentages, rejects >100%, and allocates remainder to system pocket', () => {
    const percentRule: AutoAllocationRule = {
      id: 'rule-pct',
      nama: 'Gajian 50-30-20',
      tabunganId: 'acc-main',
      aktif: true,
      isDeleted: false,
      items: [
        { posId: foodPocket.id, type: 'persen', value: 50 },
        { posId: billPocket.id, type: 'persen', value: 30 },
      ],
      createdAt: '',
      updatedAt: '',
    };

    // Income of 1.000.000
    // Food: 50% = 500.000
    // Bills: 30% = 300.000
    // Remainder: 20% (200.000) goes to Belum dialokasikan (sysPocket)
    const result = calculateAutoAllocation(1000000, percentRule, allPockets);
    expect(result.isValid).toBe(true);
    expect(result.items.find((i) => i.posId === foodPocket.id)?.nominal).toBe(500000);
    expect(result.items.find((i) => i.posId === billPocket.id)?.nominal).toBe(300000);
    expect(result.sisaBelumDialokasikan).toBe(200000);
    expect(result.totalDialokasikan).toBe(800000);

    // Rejection when percentage > 100%
    const invalidRule: AutoAllocationRule = {
      id: 'rule-invalid',
      nama: 'Aturan Salah',
      tabunganId: 'acc-main',
      aktif: true,
      isDeleted: false,
      items: [
        { posId: foodPocket.id, type: 'persen', value: 70 },
        { posId: billPocket.id, type: 'persen', value: 40 },
      ],
      createdAt: '',
      updatedAt: '',
    };
    const invalidResult = calculateAutoAllocation(1000000, invalidRule, allPockets);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errorMessage).toContain('100%');
  });

  it('calculates auto allocation with exact nominal and allocates remainder', () => {
    const nominalRule: AutoAllocationRule = {
      id: 'rule-nom',
      nama: 'Bagi Nominal',
      tabunganId: 'acc-main',
      aktif: true,
      isDeleted: false,
      items: [
        { posId: foodPocket.id, type: 'nominal', value: 150000 },
        { posId: billPocket.id, type: 'nominal', value: 50000 },
      ],
      createdAt: '',
      updatedAt: '',
    };

    const result = calculateAutoAllocation(300000, nominalRule, allPockets);
    expect(result.isValid).toBe(true);
    expect(result.items.find((i) => i.posId === foodPocket.id)?.nominal).toBe(150000);
    expect(result.items.find((i) => i.posId === billPocket.id)?.nominal).toBe(50000);
    expect(result.sisaBelumDialokasikan).toBe(100000);
    expect(result.totalDialokasikan).toBe(200000);
  });

  it('triggers warnings for pocket expense overdraft and monthly limit', () => {
    // Current pocket balance: 50.000
    const overdraftCheck = checkPocketExpenseOverdraft(50000, 80000);
    expect(overdraftCheck.isOverdrawn).toBe(true);
    expect(overdraftCheck.defisit).toBe(30000);

    const safeOverdraftCheck = checkPocketExpenseOverdraft(50000, 30000);
    expect(safeOverdraftCheck.isOverdrawn).toBe(false);
    expect(safeOverdraftCheck.defisit).toBe(0);

    // Monthly limit check for foodPocket (limit 400.000)
    const txsInMonth: Transaction[] = [
      {
        id: '1',
        tabunganId: 'acc-main',
        posId: foodPocket.id,
        jenis: 'keluar',
        nominal: 350000,
        tanggal: '2026-10-10',
        isDeleted: false,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const limitStatus = checkPocketMonthlyLimit(foodPocket, txsInMonth);
    expect(limitStatus.batas).toBe(400000);
    expect(limitStatus.terpakai).toBe(350000);
    expect(limitStatus.persen).toBe(88);
    expect(limitStatus.isNearLimit).toBe(true);
    expect(limitStatus.isExceeded).toBe(false);

    // Adding more expense to exceed 100%
    txsInMonth.push({
      id: '2',
      tabunganId: 'acc-main',
      posId: foodPocket.id,
      jenis: 'keluar',
      nominal: 100000,
      tanggal: '2026-10-15',
      isDeleted: false,
      createdAt: '',
      updatedAt: '',
    });

    const exceededStatus = checkPocketMonthlyLimit(foodPocket, txsInMonth);
    expect(exceededStatus.terpakai).toBe(450000);
    expect(exceededStatus.persen).toBe(113);
    expect(exceededStatus.isExceeded).toBe(true);
  });
});
