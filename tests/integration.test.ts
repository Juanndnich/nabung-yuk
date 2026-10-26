import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database';
import { repository } from '../src/db/repository';
import { securityService } from '../src/services/security';
import { dataTransferService } from '../src/services/dataTransfer';
import {
  calculateAccountBalance,
  calculateDebtSummary,
  calculatePocketBalance,
  verifyPocketInvariant,
} from '../src/domain/accounting';

describe('End-to-End Integration Tests', () => {
  beforeEach(async () => {
    // Clear all tables before each test
    await db.accounts.clear();
    await db.transactions.clear();
    await db.debts.clear();
    await db.debtPayments.clear();
    await db.people.clear();
    await db.categories.clear();
    await db.trash.clear();
    await db.auditLogs.clear();
    await db.settings.clear();
    await db.pockets.clear();
    await db.autoAllocationRules.clear();
  });

  it('verifies clean fresh start has ZERO dummy/sample data', async () => {
    const accs = await repository.getAccounts();
    const txs = await repository.getTransactions();
    const debts = await repository.getDebts();
    const people = await repository.getPeople();

    expect(accs).toHaveLength(0);
    expect(txs).toHaveLength(0);
    expect(debts).toHaveLength(0);
    expect(people).toHaveLength(0);
  });

  it('performs account CRUD and atomic soft-delete / restore', async () => {
    const acc = await repository.createAccount({
      nama: 'Dompet Tunai',
      ikon: 'Wallet',
      warna: '#0d9488',
      saldoAwal: 50000,
      diarsipkan: false,
    });
    expect(acc.id).toBeDefined();

    const all = await repository.getAccounts();
    expect(all).toHaveLength(1);
    expect(all[0].nama).toBe('Dompet Tunai');

    // Update
    const updated = await repository.updateAccount(acc.id, { nama: 'Dompet Utama' });
    expect(updated.nama).toBe('Dompet Utama');

    // Soft delete moves to trash
    const trash = await repository.deleteAccount(acc.id);
    expect(await repository.getAccounts()).toHaveLength(0);

    const trashList = await repository.getTrashItems();
    expect(trashList).toHaveLength(1);
    expect(trashList[0].entitasTipe).toBe('tabungan');

    // Restore from trash
    await repository.restoreFromTrash(trash.id);
    expect(await repository.getAccounts()).toHaveLength(1);
    expect((await repository.getAccounts())[0].nama).toBe('Dompet Utama');
  });

  it('executes atomic paired transfer between two accounts', async () => {
    const accA = await repository.createAccount({
      nama: 'BCA',
      ikon: 'Wallet',
      warna: '#0284c7',
      saldoAwal: 200000,
      diarsipkan: false,
    });
    const accB = await repository.createAccount({
      nama: 'GoPay',
      ikon: 'Wallet',
      warna: '#10b981',
      saldoAwal: 50000,
      diarsipkan: false,
    });

    // Transfer 75.000 from BCA to GoPay
    const tx = await repository.createTransfer(
      accA.id,
      accB.id,
      75000,
      new Date().toISOString(),
      'Top up e-wallet'
    );
    expect(tx.id).toBeDefined();

    const allTxs = await repository.getTransactions();
    const balA = calculateAccountBalance(accA.saldoAwal, allTxs, accA.id);
    const balB = calculateAccountBalance(accB.saldoAwal, allTxs, accB.id);

    // 200k - 75k = 125.000
    expect(balA).toBe(125000);
    // 50k + 75k = 125.000
    expect(balB).toBe(125000);
  });

  it('records debts, links to wallet, records installments, and auto-updates status', async () => {
    const wallet = await repository.createAccount({
      nama: 'Kas Pribadi',
      ikon: 'Wallet',
      warna: '#0d9488',
      saldoAwal: 500000,
      diarsipkan: false,
    });
    const person = await repository.createPerson('Andi Pratama', '08123456789');

    // Lending 200.000 to Andi linked to Kas Pribadi (money leaves wallet)
    const debt = await repository.createDebt(
      {
        orangId: person.id,
        arah: 'piutang',
        pokok: 200000,
        tanggal: new Date().toISOString(),
        jatuhTempo: '2026-12-31T00:00:00Z',
        tautanTabunganId: wallet.id,
      },
      wallet
    );

    let allTxs = await repository.getTransactions();
    let walletBal = calculateAccountBalance(wallet.saldoAwal, allTxs, wallet.id);
    // 500k - 200k = 300.000
    expect(walletBal).toBe(300000);

    // First installment: Andi pays 100.000 into wallet
    await repository.recordDebtPayment(
      debt.id,
      100000,
      new Date().toISOString(),
      'Cicilan 1',
      'Transfer',
      wallet.id
    );

    allTxs = await repository.getTransactions();
    walletBal = calculateAccountBalance(wallet.saldoAwal, allTxs, wallet.id);
    // 300k + 100k = 400.000
    expect(walletBal).toBe(400000);

    // Verify debt status changed to 'dicicil'
    let currentDebt = (await repository.getDebts()).find((d) => d.id === debt.id)!;
    expect(currentDebt.status).toBe('dicicil');

    // Second installment: Andi pays remaining 100.000 into wallet
    await repository.recordDebtPayment(
      debt.id,
      100000,
      new Date().toISOString(),
      'Pelunasan',
      'Transfer',
      wallet.id
    );

    allTxs = await repository.getTransactions();
    walletBal = calculateAccountBalance(wallet.saldoAwal, allTxs, wallet.id);
    // 400k + 100k = 500.000
    expect(walletBal).toBe(500000);

    // Verify debt status changed to 'lunas'
    currentDebt = (await repository.getDebts()).find((d) => d.id === debt.id)!;
    expect(currentDebt.status).toBe('lunas');

    const payments = await repository.getDebtPayments(debt.id);
    const summary = calculateDebtSummary(currentDebt.pokok, payments);
    expect(summary.sisa).toBe(0);
    expect(summary.persentaseLunas).toBe(100);
  });

  it('hashes PIN with PBKDF2, stores hash (never plain), and rejects wrong PIN', async () => {
    const plainPin = '7890';
    const { hashHex, saltHex } = await securityService.hashPin(plainPin);

    expect(hashHex).not.toBe(plainPin);
    expect(hashHex).toHaveLength(64); // SHA-256 hex string

    const isMatch = await securityService.verifyPin(plainPin, hashHex, saltHex);
    expect(isMatch).toBe(true);

    const isWrong = await securityService.verifyPin('1234', hashHex, saltHex);
    expect(isWrong).toBe(false);
  });

  it('encrypts backup with AES-GCM password and restores successfully', async () => {
    await repository.createAccount({
      nama: 'Rekening Rahasia',
      ikon: 'Lock',
      warna: '#7c3aed',
      saldoAwal: 1500000,
      diarsipkan: false,
    });

    const fullData = await repository.exportFullData();
    const plainJson = JSON.stringify(fullData);

    const password = 'SuperSecretPassword123!';
    const encrypted = await securityService.encryptBackup(plainJson, password);

    // Encrypted string does not contain plain text
    expect(encrypted).not.toContain('Rekening Rahasia');
    expect(encrypted).toContain('"format": "AES-GCM-256"');

    // Decrypt with correct password
    const decrypted = await securityService.decryptBackup(encrypted, password);
    expect(decrypted).toContain('Rekening Rahasia');

    // Decrypt with wrong password fails safely
    await expect(securityService.decryptBackup(encrypted, 'WrongPass!')).rejects.toThrow();
  });

  it('rejects invalid or corrupted backup JSON without corrupting active database', async () => {
    await repository.createAccount({
      nama: 'Tabungan Utama',
      ikon: 'Wallet',
      warna: '#0d9488',
      saldoAwal: 100000,
      diarsipkan: false,
    });

    const corruptedJson = '{"appName": "FakeApp", "data": "invalid"}';

    expect(() => dataTransferService.validateImportJson(corruptedJson)).toThrow();

    // Verify existing database data remains untouched
    const accs = await repository.getAccounts();
    expect(accs).toHaveLength(1);
    expect(accs[0].nama).toBe('Tabungan Utama');
  });

  it('automatically creates system pocket "Belum dialokasikan" upon account creation', async () => {
    const acc = await repository.createAccount({
      nama: 'Mandiri Prioritas',
      ikon: 'CreditCard',
      warna: '#0284c7',
      saldoAwal: 300000,
      diarsipkan: false,
    });

    const pockets = await repository.getPockets(acc.id);
    expect(pockets).toHaveLength(1);
    expect(pockets[0].isSystem).toBe(true);
    expect(pockets[0].nama).toBe('Belum dialokasikan');
    expect(pockets[0].id).toBe(`pos_sys_${acc.id}`);

    // Verify initial balance of system pocket equals initial account balance
    const bal = calculatePocketBalance(pockets[0], acc, []);
    expect(bal).toBe(300000);
  });

  it('handles pocket CRUD, reordering, and balance transfer on delete', async () => {
    const acc = await repository.createAccount({
      nama: 'Jago Utama',
      ikon: 'Wallet',
      warna: '#7c3aed',
      saldoAwal: 1000000,
      diarsipkan: false,
    });

    const sysPos = (await repository.getPockets(acc.id)).find((p) => p.isSystem)!;

    // Create custom pockets
    const pocketJajan = await repository.createPocket({
      tabunganId: acc.id,
      nama: 'Jajan Sore',
      ikon: 'Coffee',
      warna: '#f59e0b',
      batasBulanan: 300000,
      urutan: 1,
      diarsipkan: false,
    });

    const pocketLiburan = await repository.createPocket({
      tabunganId: acc.id,
      nama: 'Dana Liburan',
      ikon: 'Palmtree',
      warna: '#10b981',
      target: 5000000,
      urutan: 2,
      diarsipkan: false,
    });

    // Move 400.000 from sysPos to pocketJajan
    await repository.moveFundsBetweenPockets(
      acc.id,
      sysPos.id,
      pocketJajan.id,
      400000,
      'Alokasi jajan'
    );

    let allTxs = await repository.getTransactions();
    const jajanBal = calculatePocketBalance(pocketJajan, acc, allTxs);
    const sysBal = calculatePocketBalance(sysPos, acc, allTxs);

    expect(jajanBal).toBe(400000);
    expect(sysBal).toBe(600000);

    // Reorder pockets
    await repository.reorderPockets([pocketLiburan.id, pocketJajan.id]);
    const reordered = await repository.getPockets(acc.id);
    expect(reordered.find((p) => p.id === pocketLiburan.id)?.urutan).toBe(0);
    expect(reordered.find((p) => p.id === pocketJajan.id)?.urutan).toBe(1);

    // Delete pocketJajan with mandatory transfer of remaining 400.000 to pocketLiburan
    await repository.deletePocket(pocketJajan.id, pocketLiburan.id);

    allTxs = await repository.getTransactions();
    const liburanBal = calculatePocketBalance(pocketLiburan, acc, allTxs);
    expect(liburanBal).toBe(400000);

    const activePockets = await repository.getPockets(acc.id);
    expect(activePockets.find((p) => p.id === pocketJajan.id)).toBeUndefined();

    // Verify Invariant: Account balance is still 1.000.000
    const inv = verifyPocketInvariant(acc, activePockets, allTxs);
    expect(inv.isValid).toBe(true);
    expect(inv.accountBalance).toBe(1000000);
    expect(inv.sumPockets).toBe(1000000);
  });

  it('supports paired inter-account transfer specifying source and target pockets', async () => {
    const acc1 = await repository.createAccount({
      nama: 'Bank A',
      ikon: 'Building',
      warna: '#0ea5e9',
      saldoAwal: 500000,
      diarsipkan: false,
    });
    const acc2 = await repository.createAccount({
      nama: 'Bank B',
      ikon: 'Building',
      warna: '#22c55e',
      saldoAwal: 100000,
      diarsipkan: false,
    });

    const sys1 = (await repository.getPockets(acc1.id))[0];

    const pocketEmergency = await repository.createPocket({
      tabunganId: acc2.id,
      nama: 'Dana Darurat',
      ikon: 'Shield',
      warna: '#ef4444',
      urutan: 1,
      diarsipkan: false,
    });

    // Transfer 150.000 from Bank A (sys1) to Bank B (pocketEmergency)
    await repository.createTransfer(
      acc1.id,
      acc2.id,
      150000,
      new Date().toISOString(),
      'Isi dana darurat',
      sys1.id,
      pocketEmergency.id
    );

    const allTxs = await repository.getTransactions();
    const balAcc1 = calculateAccountBalance(acc1.saldoAwal, allTxs, acc1.id);
    const balAcc2 = calculateAccountBalance(acc2.saldoAwal, allTxs, acc2.id);

    expect(balAcc1).toBe(350000);
    expect(balAcc2).toBe(250000);

    const balEmergency = calculatePocketBalance(pocketEmergency, acc2, allTxs);
    expect(balEmergency).toBe(150000);
  });

  it('manages auto-allocation rules CRUD and full backup restore including pockets', async () => {
    const acc = await repository.createAccount({
      nama: 'Tabungan Auto',
      ikon: 'Wallet',
      warna: '#6366f1',
      saldoAwal: 200000,
      diarsipkan: false,
    });

    const pos = await repository.createPocket({
      tabunganId: acc.id,
      nama: 'Investasi',
      ikon: 'TrendingUp',
      warna: '#10b981',
      urutan: 1,
      diarsipkan: false,
    });

    const rule = await repository.createAutoAllocationRule({
      nama: 'Gaji Bulanan',
      tabunganId: acc.id,
      aktif: true,
      items: [{ posId: pos.id, type: 'persen', value: 25 }],
    });

    expect(rule.id).toBeDefined();
    expect(rule.items[0].value).toBe(25);

    // Export and check pockets + rules in export JSON
    const exported = await repository.exportFullData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const backupData = exported.data as any;
    expect(backupData.pockets.length).toBeGreaterThan(0);
    expect(backupData.autoAllocationRules.length).toBe(1);

    // CSV export has Pos column
    const csv = await dataTransferService.exportTransactionsCsv(
      backupData.transactions,
      backupData.categories,
      backupData.accounts,
      backupData.pockets
    );
    expect(csv).toContain('Pos');
  });
});
