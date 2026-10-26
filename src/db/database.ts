import Dexie, { type Table } from 'dexie';
import {
  Account,
  Achievement,
  AppSettings,
  AuditLog,
  AutoAllocationRule,
  Category,
  Debt,
  DebtPayment,
  MonthlyBudget,
  Person,
  Pocket,
  RecurringTransaction,
  Reminder,
  SavingsGoal,
  Tag,
  Transaction,
  TrashItem,
} from '../domain/types';

export class NubungYukDatabase extends Dexie {
  settings!: Table<AppSettings, string>;
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  tags!: Table<Tag, string>;
  transactions!: Table<Transaction, string>;
  people!: Table<Person, string>;
  debts!: Table<Debt, string>;
  debtPayments!: Table<DebtPayment, string>;
  savingsGoals!: Table<SavingsGoal, string>;
  budgets!: Table<MonthlyBudget, string>;
  recurringTransactions!: Table<RecurringTransaction, string>;
  reminders!: Table<Reminder, string>;
  achievements!: Table<Achievement, string>;
  trash!: Table<TrashItem, string>;
  auditLogs!: Table<AuditLog, string>;
  pockets!: Table<Pocket, string>;
  autoAllocationRules!: Table<AutoAllocationRule, string>;

  constructor() {
    super('NubungYukDB');

    // Version 1 Schema
    this.version(1).stores({
      settings: 'id',
      accounts: 'id, nama, diarsipkan, isDeleted, createdAt',
      categories: 'id, nama, jenis, isDeleted, createdAt',
      tags: 'id, nama, isDeleted, createdAt',
      transactions:
        'id, tabunganId, targetTabunganId, jenis, tanggal, kategoriId, debtRefId, isDeleted, createdAt',
      people: 'id, nama, isDeleted, createdAt',
      debts: 'id, orangId, arah, tanggal, jatuhTempo, status, tautanTabunganId, isDeleted, createdAt',
      debtPayments: 'id, utangId, tanggal, tabunganId, isDeleted, createdAt',
      savingsGoals: 'id, tabunganId, tenggat, tercapai, isDeleted, createdAt',
      budgets: 'id, kategoriId, bulan, tahun, isDeleted, [kategoriId+bulan+tahun]',
      recurringTransactions: 'id, tabunganId, frekuensi, aktif, isDeleted, createdAt',
      reminders: 'id, tanggalWaktu, tipe, aktif, sudahDibaca, isDeleted, createdAt',
      achievements: 'id, kode, tanggalTercapai, dilihat',
      trash: 'id, entitasTipe, entitasId, tanggalDihapus',
      auditLogs: 'id, aksi, entitasTipe, entitasId, tanggalWaktu',
    });

    // Version 2 Schema (Pos Tabungan & Aturan Bagi Otomatis)
    this.version(2)
      .stores({
        pockets: 'id, tabunganId, nama, urutan, diarsipkan, isSystem, isDeleted, createdAt',
        autoAllocationRules: 'id, tabunganId, nama, aktif, isDeleted, createdAt',
        transactions:
          'id, tabunganId, posId, targetPosId, targetTabunganId, jenis, tanggal, kategoriId, debtRefId, isDeleted, createdAt',
      })
      .upgrade(async (tx) => {
        // 1. Automatic backup before migration!
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            const existingAccounts = await tx.table('accounts').toArray();
            const existingTransactions = await tx.table('transactions').toArray();
            window.localStorage.setItem(
              'nubung_yuk_pre_migration_backup_v1',
              JSON.stringify({
                timestamp: new Date().toISOString(),
                accounts: existingAccounts,
                transactions: existingTransactions,
              })
            );
          }
        } catch {
          // Silent fallback on quota or storage restriction
        }

        // 2. Create system pocket "Belum dialokasikan" for every existing account
        const accounts = await tx.table('accounts').toArray();
        for (const acc of accounts) {
          const sysId = `pos_sys_${acc.id}`;
          const now = new Date().toISOString();
          await tx.table('pockets').put({
            id: sysId,
            tabunganId: acc.id,
            nama: 'Belum dialokasikan',
            ikon: 'Inbox',
            warna: '#94a3b8',
            urutan: 0,
            diarsipkan: false,
            isSystem: true,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
          });

          // 3. Migrate legacy transactions for this account without posId to system pocket
          await tx
            .table('transactions')
            .where('tabunganId')
            .equals(acc.id)
            .modify((t: { posId?: string }) => {
              if (!t.posId) {
                t.posId = sysId;
              }
            });
        }
      });
  }
}

export const db = new NubungYukDatabase();
