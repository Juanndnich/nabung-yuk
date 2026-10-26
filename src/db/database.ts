import Dexie, { type Table } from 'dexie';
import {
  Account,
  Achievement,
  AppSettings,
  AuditLog,
  Category,
  Debt,
  DebtPayment,
  MonthlyBudget,
  Person,
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
  }
}

export const db = new NubungYukDatabase();
