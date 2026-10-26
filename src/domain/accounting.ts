// Pure Accounting & Personal Finance Business Logic
// Strictly follows AGENTS.md rules:
// - All currency is stored as integer Rupiah
// - No NaN, Infinity, or negative amounts where invalid
// - Format "Rp320.000" or privacy "Rp•••"
// - Savings balance = initial + total in - total out
// - Transfers between accounts are paired and excluded from income/expense statistics
// - Overdrawn warning calculation
// - Debt remaining = principal - total payments (rejects overpayment)

import { DebtStatus, Transaction } from './types';

/**
 * Ensures any number input is safely converted to integer Rupiah
 */
export function toIntegerRupiah(val: number | string | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  const num = typeof val === 'string' ? Number(val.replace(/[^0-9-]/g, '')) : val;
  if (!Number.isFinite(num) || Number.isNaN(num)) return 0;
  return Math.round(num);
}

/**
 * Format integer rupiah to string: "Rp320.000" or "-Rp50.000"
 * With optional privacy mode: "Rp•••"
 */
export function formatRupiah(amount: number, privacyMode: boolean = false): string {
  if (privacyMode) {
    return 'Rp•••';
  }
  const clean = toIntegerRupiah(amount);
  const isNegative = clean < 0;
  const abs = Math.abs(clean);
  const formatted = new Intl.NumberFormat('id-ID').format(abs);
  return isNegative ? `-Rp${formatted}` : `Rp${formatted}`;
}

/**
 * Parse rupiah string (e.g. "Rp 350.000" or "350000") to integer
 */
export function parseRupiah(input: string): number {
  if (!input) return 0;
  const isNegative = input.includes('-');
  const numbersOnly = input.replace(/[^0-9]/g, '');
  const parsed = parseInt(numbersOnly, 10);
  if (isNaN(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}

/**
 * Calculates current balance of a single account based on initial balance and transactions
 */
export function calculateAccountBalance(
  saldoAwal: number,
  transactions: Pick<Transaction, 'tabunganId' | 'targetTabunganId' | 'jenis' | 'nominal' | 'isDeleted'>[],
  accountId: string
): number {
  let balance = toIntegerRupiah(saldoAwal);

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    const nominal = toIntegerRupiah(tx.nominal);

    if (tx.jenis === 'masuk' && tx.tabunganId === accountId) {
      balance += nominal;
    } else if (tx.jenis === 'keluar' && tx.tabunganId === accountId) {
      balance -= nominal;
    } else if (tx.jenis === 'transfer') {
      // Outgoing leg
      if (tx.tabunganId === accountId) {
        balance -= nominal;
      }
      // Incoming leg
      if (tx.targetTabunganId === accountId) {
        balance += nominal;
      }
    } else if (tx.jenis === 'penyesuaian' && tx.tabunganId === accountId) {
      // Penyesuaian can be positive (balance increase) or negative (balance decrease)
      balance += nominal;
    }
  }

  return balance;
}

export interface PeriodTotals {
  totalMasuk: number;
  totalKeluar: number;
  selisih: number; // totalMasuk - totalKeluar
  transactionCount: number;
}

/**
 * Calculate total income and expense within a set of transactions.
 * NOTE: Internal transfers between user accounts are NEVER counted as income or expense!
 */
export function calculatePeriodTotals(
  transactions: Pick<Transaction, 'jenis' | 'nominal' | 'isDeleted'>[]
): PeriodTotals {
  let totalMasuk = 0;
  let totalKeluar = 0;
  let count = 0;

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    const nominal = toIntegerRupiah(tx.nominal);

    if (tx.jenis === 'masuk') {
      totalMasuk += nominal;
      count++;
    } else if (tx.jenis === 'keluar') {
      totalKeluar += nominal;
      count++;
    } else if (tx.jenis === 'penyesuaian') {
      if (nominal > 0) {
        totalMasuk += nominal;
      } else {
        totalKeluar += Math.abs(nominal);
      }
      count++;
    }
    // transfers are ignored in income/expense stats as per rule 6
  }

  return {
    totalMasuk,
    totalKeluar,
    selisih: totalMasuk - totalKeluar,
    transactionCount: count,
  };
}

/**
 * Check if spending will cause the account balance to become negative.
 * Returns true if negative, and the resulting negative balance.
 */
export function checkOverdrawnWarning(
  currentBalance: number,
  expenseAmount: number
): { isOverdrawn: boolean; projectedBalance: number } {
  const projectedBalance = currentBalance - toIntegerRupiah(expenseAmount);
  return {
    isOverdrawn: projectedBalance < 0,
    projectedBalance,
  };
}

/**
 * Calculates remaining debt and total paid
 */
export function calculateDebtSummary(
  pokok: number,
  payments: { nominal: number; isDeleted: boolean }[]
): {
  pokok: number;
  totalDibayar: number;
  sisa: number;
  persentaseLunas: number;
} {
  const cleanPokok = toIntegerRupiah(pokok);
  let totalDibayar = 0;

  for (const p of payments) {
    if (!p.isDeleted) {
      totalDibayar += toIntegerRupiah(p.nominal);
    }
  }

  const sisa = Math.max(0, cleanPokok - totalDibayar);
  const persentaseLunas =
    cleanPokok > 0 ? Math.min(100, Math.round((totalDibayar / cleanPokok) * 100)) : 100;

  return {
    pokok: cleanPokok,
    totalDibayar,
    sisa,
    persentaseLunas,
  };
}

/**
 * Validates a debt payment.
 * Rule 6: Pembayaran tidak boleh melebihi sisa (tolak atau tawarkan sebagai pelunasan).
 */
export function validateDebtPayment(
  sisaUtang: number,
  nominalBayar: number
): { valid: boolean; error?: string; suggestedAmount?: number } {
  const cleanNominal = toIntegerRupiah(nominalBayar);
  if (cleanNominal <= 0) {
    return { valid: false, error: 'Nominal pembayaran harus lebih dari Rp0.' };
  }
  if (cleanNominal > sisaUtang) {
    return {
      valid: false,
      error: `Pembayaran (${formatRupiah(cleanNominal)}) melebihi sisa utang (${formatRupiah(sisaUtang)}).`,
      suggestedAmount: sisaUtang,
    };
  }
  return { valid: true };
}

/**
 * Automatically determine debt status based on principal, payments, and due date
 */
export function determineDebtStatus(
  pokok: number,
  payments: { nominal: number; isDeleted: boolean }[],
  jatuhTempo?: string,
  currentDateIso: string = new Date().toISOString()
): DebtStatus {
  const { sisa, totalDibayar } = calculateDebtSummary(pokok, payments);

  if (sisa <= 0 && pokok > 0) {
    return 'lunas';
  }

  if (jatuhTempo) {
    const todayYmd = currentDateIso.slice(0, 10);
    const dueYmd = jatuhTempo.slice(0, 10);
    if (todayYmd > dueYmd && sisa > 0) {
      return 'terlambat';
    }
  }

  if (totalDibayar > 0) {
    return 'dicicil';
  }

  return 'belum_dibayar';
}

/**
 * Savings Goal progress calculation
 */
export function calculateGoalProgress(
  targetNominal: number,
  currentBalance: number,
  historicalDailyRate: number = 0,
  tenggat?: string
): {
  persen: number;
  sisaNominal: number;
  estimasiHariTercapai: number | null;
  statusTenggat: 'tepat_waktu' | 'terancam' | 'lewat_tenggat' | 'tidak_ada_tenggat';
} {
  const target = Math.max(1, toIntegerRupiah(targetNominal));
  const current = Math.max(0, toIntegerRupiah(currentBalance));
  const sisa = Math.max(0, target - current);
  const persen = Math.min(100, Math.round((current / target) * 100));

  let estimasiHari: number | null = null;
  if (sisa <= 0) {
    estimasiHari = 0;
  } else if (historicalDailyRate > 0) {
    estimasiHari = Math.ceil(sisa / historicalDailyRate);
  }

  let statusTenggat: 'tepat_waktu' | 'terancam' | 'lewat_tenggat' | 'tidak_ada_tenggat' =
    'tidak_ada_tenggat';

  if (tenggat) {
    const today = new Date().toISOString().slice(0, 10);
    const due = tenggat.slice(0, 10);
    if (today > due && sisa > 0) {
      statusTenggat = 'lewat_tenggat';
    } else if (estimasiHari !== null) {
      const diffDays = Math.ceil(
        (new Date(due).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (estimasiHari > diffDays) {
        statusTenggat = 'terancam';
      } else {
        statusTenggat = 'tepat_waktu';
      }
    } else {
      statusTenggat = 'tepat_waktu';
    }
  }

  return {
    persen,
    sisaNominal: sisa,
    estimasiHariTercapai: estimasiHari,
    statusTenggat,
  };
}

/**
 * Monthly budget status calculation
 */
export function calculateBudgetStatus(
  batasNominal: number,
  currentExpense: number
): {
  batas: number;
  terpakai: number;
  sisa: number;
  persen: number;
  status: 'aman' | 'mendekati' | 'melebihi';
} {
  const batas = toIntegerRupiah(batasNominal);
  const terpakai = toIntegerRupiah(currentExpense);
  const sisa = batas - terpakai;
  const persen = batas > 0 ? Math.round((terpakai / batas) * 100) : 0;

  let status: 'aman' | 'mendekati' | 'melebihi' = 'aman';
  if (persen > 100) {
    status = 'melebihi';
  } else if (persen >= 80) {
    status = 'mendekati';
  }

  return {
    batas,
    terpakai,
    sisa,
    persen,
    status,
  };
}

/**
 * Consecutive savings streak calculation
 * Calculates consecutive active days of savings (income or adjustment > 0)
 */
export function calculateSavingsStreak(
  transactions: Pick<Transaction, 'tanggal' | 'jenis' | 'nominal' | 'isDeleted'>[],
  todayYmd: string = new Date().toISOString().slice(0, 10)
): { currentStreak: number; bestStreak: number } {
  // Extract all distinct dates with positive savings (income / target savings)
  const activeDates = new Set<string>();

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    if (tx.jenis === 'masuk' && tx.nominal > 0) {
      activeDates.add(tx.tanggal.slice(0, 10));
    }
  }

  const sortedDates = Array.from(activeDates).sort();
  if (sortedDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  // Calculate best streak
  let best = 0;
  let currentRun = 0;
  let prevTime: number | null = null;

  for (const d of sortedDates) {
    const time = new Date(d + 'T00:00:00Z').getTime();
    if (prevTime === null) {
      currentRun = 1;
    } else {
      const diffDays = Math.round((time - prevTime) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentRun++;
      } else {
        currentRun = 1;
      }
    }
    prevTime = time;
    if (currentRun > best) best = currentRun;
  }

  // Calculate current streak counting backwards from today or yesterday
  let streak = 0;
  const checkDate = new Date(todayYmd + 'T00:00:00Z');

  // Check if saved today, if not check if saved yesterday
  const todayStr = checkDate.toISOString().slice(0, 10);
  if (!activeDates.has(todayStr)) {
    // maybe user saved yesterday
    checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    const yesterdayStr = checkDate.toISOString().slice(0, 10);
    if (!activeDates.has(yesterdayStr)) {
      return { currentStreak: 0, bestStreak: best };
    }
  }

  // Count backwards day by day
  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (activeDates.has(dateStr)) {
      streak++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return { currentStreak: streak, bestStreak: Math.max(best, streak) };
}
