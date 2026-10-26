import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/database';
import { repository } from '../src/db/repository';
import { securityService } from '../src/services/security';
import { dataTransferService } from '../src/services/dataTransfer';
import { calculateAccountBalance, calculateDebtSummary } from '../src/domain/accounting';

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
});
