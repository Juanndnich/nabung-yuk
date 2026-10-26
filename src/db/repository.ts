// Complete Database Repository Layer
// Following AGENTS.md rules:
// - Atomic transactions for multi-table updates
// - Soft-delete with TrashItem & AuditLog
// - UI components interact ONLY via this repository
// - ZERO mock/dummy data on fresh install

import { db } from './database';
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
  SavingsGoal,
  Tag,
  Transaction,
  TrashItem,
} from '../domain/types';
import { generateId } from '../utils/id';
import {
  calculatePocketBalance,
  determineDebtStatus,
  validateDebtPayment,
} from '../domain/accounting';

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'current',
  theme: 'system',
  colorPreset: 'teal',
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 'medium',
  density: 'comfortable',
  reducedMotion: false,

  soundVolume: 75,
  soundMuted: false,
  soundStyle: 'modern',
  hapticsEnabled: true,

  pinEnabled: false,
  pinFailedAttempts: 0,
  autoLockMinutes: 3,
  privacyMode: false,

  hasCompletedOnboarding: false,
  dateFormat: 'dd/MM/yyyy',
  backupReminderDays: 7,
  motivationEnabled: true,

  updatedAt: new Date().toISOString(),
};

export const repository = {
  // ===================== SETTINGS =====================
  async getSettings(): Promise<AppSettings> {
    const s = await db.settings.get('current');
    if (!s) {
      await db.settings.put(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    return s;
  },

  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated: AppSettings = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await db.settings.put(updated);
    return updated;
  },

  // ===================== AUDIT LOG =====================
  async logAudit(
    aksi: AuditLog['aksi'],
    entitasTipe: string,
    entitasId: string,
    ringkasan: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const log: AuditLog = {
      id: generateId(),
      aksi,
      entitasTipe,
      entitasId,
      ringkasan,
      tanggalWaktu: new Date().toISOString(),
      metadataJson: metadata ? JSON.stringify(metadata) : undefined,
    };
    await db.auditLogs.add(log);
  },

  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return db.auditLogs.orderBy('tanggalWaktu').reverse().limit(limit).toArray();
  },

  // ===================== TRASH & RESTORE =====================
  async getTrashItems(): Promise<TrashItem[]> {
    return db.trash.orderBy('tanggalDihapus').reverse().toArray();
  },

  async restoreFromTrash(trashId: string): Promise<boolean> {
    return db.transaction(
      'rw',
      [
        db.trash,
        db.accounts,
        db.categories,
        db.tags,
        db.transactions,
        db.people,
        db.debts,
        db.debtPayments,
        db.savingsGoals,
        db.budgets,
        db.recurringTransactions,
        db.pockets,
        db.autoAllocationRules,
        db.auditLogs,
      ],
      async () => {
        const item = await db.trash.get(trashId);
        if (!item) return false;

        const now = new Date().toISOString();
        const data = JSON.parse(item.dataJson);
        data.isDeleted = false;
        data.updatedAt = now;

        switch (item.entitasTipe) {
          case 'tabungan':
            await db.accounts.put(data);
            break;
          case 'kategori':
            await db.categories.put(data);
            break;
          case 'tag':
            await db.tags.put(data);
            break;
          case 'transaksi':
            await db.transactions.put(data);
            break;
          case 'orang':
            await db.people.put(data);
            break;
          case 'utang':
            await db.debts.put(data);
            break;
          case 'pembayaran':
            await db.debtPayments.put(data);
            break;
          case 'target':
            await db.savingsGoals.put(data);
            break;
          case 'anggaran':
            await db.budgets.put(data);
            break;
          case 'berulang':
            await db.recurringTransactions.put(data);
            break;
          case 'pos':
            await db.pockets.put(data);
            break;
          case 'aturan_bagi':
            await db.autoAllocationRules.put(data);
            break;
        }

        await db.trash.delete(trashId);
        await this.logAudit('restore', item.entitasTipe, item.entitasId, `Memulihkan ${item.judul}`);
        return true;
      }
    );
  },

  async emptyTrash(): Promise<void> {
    await db.transaction('rw', [db.trash, db.auditLogs], async () => {
      await db.trash.clear();
      await this.logAudit('delete', 'trash', 'all', 'Mengosongkan tempat sampah permanen');
    });
  },

  async deletePermanent(trashId: string): Promise<void> {
    await db.transaction('rw', [db.trash, db.auditLogs], async () => {
      const item = await db.trash.get(trashId);
      if (item) {
        await db.trash.delete(trashId);
        await this.logAudit('delete', item.entitasTipe, item.entitasId, `Hapus permanen ${item.judul}`);
      }
    });
  },

  // ===================== ACCOUNTS (TABUNGAN) =====================
  async getAccounts(): Promise<Account[]> {
    return db.accounts.filter((a) => !a.isDeleted).toArray();
  },

  async getAccountById(id: string): Promise<Account | undefined> {
    const acc = await db.accounts.get(id);
    return acc && !acc.isDeleted ? acc : undefined;
  },

  async createAccount(data: Omit<Account, 'id' | 'isDeleted' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    const now = new Date().toISOString();
    const account: Account = {
      ...data,
      id: generateId(),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', [db.accounts, db.pockets, db.auditLogs], async () => {
      await db.accounts.add(account);
      const systemPocket: Pocket = {
        id: `pos_sys_${account.id}`,
        tabunganId: account.id,
        nama: 'Belum dialokasikan',
        ikon: 'Inbox',
        warna: '#94a3b8',
        urutan: 0,
        diarsipkan: false,
        isSystem: true,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.pockets.put(systemPocket);
      await this.logAudit('create', 'tabungan', account.id, `Membuat tabungan "${account.nama}"`);
    });

    return account;
  },

  async updateAccount(id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>): Promise<Account> {
    const now = new Date().toISOString();
    return db.transaction('rw', [db.accounts, db.auditLogs], async () => {
      const existing = await db.accounts.get(id);
      if (!existing) throw new Error('Tabungan tidak ditemukan');
      const updated: Account = { ...existing, ...updates, updatedAt: now };
      await db.accounts.put(updated);
      await this.logAudit('update', 'tabungan', id, `Mengubah tabungan "${updated.nama}"`);
      return updated;
    });
  },

  async deleteAccount(id: string): Promise<TrashItem> {
    return db.transaction('rw', [db.accounts, db.trash, db.auditLogs], async () => {
      const acc = await db.accounts.get(id);
      if (!acc) throw new Error('Tabungan tidak ditemukan');

      acc.isDeleted = true;
      acc.updatedAt = new Date().toISOString();
      await db.accounts.put(acc);

      const trashItem: TrashItem = {
        id: generateId(),
        entitasTipe: 'tabungan',
        entitasId: id,
        judul: `Tabungan: ${acc.nama}`,
        dataJson: JSON.stringify(acc),
        tanggalDihapus: new Date().toISOString(),
      };
      await db.trash.add(trashItem);
      await this.logAudit('delete', 'tabungan', id, `Menghapus tabungan "${acc.nama}" ke tempat sampah`);
      return trashItem;
    });
  },

  // ===================== CATEGORIES & TAGS =====================
  async getCategories(): Promise<Category[]> {
    return db.categories.filter((c) => !c.isDeleted).toArray();
  },

  async createCategory(data: Omit<Category, 'id' | 'isDeleted' | 'createdAt' | 'updatedAt'>): Promise<Category> {
    const now = new Date().toISOString();
    const cat: Category = {
      ...data,
      id: generateId(),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.categories.add(cat);
    await this.logAudit('create', 'kategori', cat.id, `Membuat kategori "${cat.nama}"`);
    return cat;
  },

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const now = new Date().toISOString();
    const existing = await db.categories.get(id);
    if (!existing) throw new Error('Kategori tidak ditemukan');
    const updated: Category = { ...existing, ...updates, updatedAt: now };
    await db.categories.put(updated);
    await this.logAudit('update', 'kategori', id, `Mengubah kategori "${updated.nama}"`);
    return updated;
  },

  async deleteCategory(id: string): Promise<TrashItem> {
    return db.transaction('rw', [db.categories, db.trash, db.auditLogs], async () => {
      const cat = await db.categories.get(id);
      if (!cat) throw new Error('Kategori tidak ditemukan');
      cat.isDeleted = true;
      cat.updatedAt = new Date().toISOString();
      await db.categories.put(cat);

      const trashItem: TrashItem = {
        id: generateId(),
        entitasTipe: 'kategori',
        entitasId: id,
        judul: `Kategori: ${cat.nama}`,
        dataJson: JSON.stringify(cat),
        tanggalDihapus: new Date().toISOString(),
      };
      await db.trash.add(trashItem);
      await this.logAudit('delete', 'kategori', id, `Menghapus kategori "${cat.nama}"`);
      return trashItem;
    });
  },

  async getTags(): Promise<Tag[]> {
    return db.tags.filter((t) => !t.isDeleted).toArray();
  },

  async createTag(nama: string, warna: string): Promise<Tag> {
    const now = new Date().toISOString();
    const tag: Tag = {
      id: generateId(),
      nama,
      warna,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.tags.add(tag);
    return tag;
  },

  // ===================== TRANSACTIONS =====================
  async getTransactions(): Promise<Transaction[]> {
    return db.transactions.filter((tx) => !tx.isDeleted).reverse().sortBy('tanggal');
  },

  async createTransaction(
    data: Omit<Transaction, 'id' | 'isDeleted' | 'createdAt' | 'updatedAt'>
  ): Promise<Transaction> {
    const now = new Date().toISOString();
    const tx: Transaction = {
      ...data,
      id: generateId(),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', [db.transactions, db.auditLogs], async () => {
      await db.transactions.add(tx);
      await this.logAudit('create', 'transaksi', tx.id, `Catat ${tx.jenis} sebesar Rp${tx.nominal}`);
    });
    return tx;
  },

  /**
   * Atomic paired transfer creation between two accounts
   */
  async createTransfer(
    fromAccountId: string,
    toAccountId: string,
    nominal: number,
    tanggal: string,
    catatan?: string,
    fromPosId?: string,
    toPosId?: string
  ): Promise<Transaction> {
    const now = new Date().toISOString();
    const transferId = generateId();

    const tx: Transaction = {
      id: transferId,
      tabunganId: fromAccountId,
      targetTabunganId: toAccountId,
      posId: fromPosId || `pos_sys_${fromAccountId}`,
      targetPosId: toPosId || `pos_sys_${toAccountId}`,
      jenis: 'transfer',
      nominal,
      tanggal,
      catatan: catatan || 'Transfer tabungan',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', [db.transactions, db.auditLogs], async () => {
      await db.transactions.add(tx);
      await this.logAudit('create', 'transaksi', tx.id, `Transfer Rp${nominal} antar tabungan`);
    });

    return tx;
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const now = new Date().toISOString();
    return db.transaction('rw', [db.transactions, db.auditLogs], async () => {
      const existing = await db.transactions.get(id);
      if (!existing) throw new Error('Transaksi tidak ditemukan');
      const updated: Transaction = { ...existing, ...updates, updatedAt: now };
      await db.transactions.put(updated);
      await this.logAudit('update', 'transaksi', id, `Mengubah transaksi Rp${updated.nominal}`);
      return updated;
    });
  },

  async deleteTransaction(id: string): Promise<TrashItem> {
    return db.transaction('rw', [db.transactions, db.trash, db.auditLogs], async () => {
      const tx = await db.transactions.get(id);
      if (!tx) throw new Error('Transaksi tidak ditemukan');
      tx.isDeleted = true;
      tx.updatedAt = new Date().toISOString();
      await db.transactions.put(tx);

      const trashItem: TrashItem = {
        id: generateId(),
        entitasTipe: 'transaksi',
        entitasId: id,
        judul: `Transaksi ${tx.jenis}: Rp${tx.nominal}`,
        dataJson: JSON.stringify(tx),
        tanggalDihapus: new Date().toISOString(),
      };
      await db.trash.add(trashItem);
      await this.logAudit('delete', 'transaksi', id, `Menghapus transaksi Rp${tx.nominal}`);
      return trashItem;
    });
  },

  /**
   * Move funds between pockets within the same account.
   * Atomic, recorded as 'pindah_pos', does NOT affect overall income/expense stats.
   */
  async moveFundsBetweenPockets(
    tabunganId: string,
    sourcePosId: string,
    targetPosId: string,
    nominal: number,
    tanggal: string,
    catatan?: string
  ): Promise<Transaction> {
    if (sourcePosId === targetPosId) {
      throw new Error('Pos asal dan pos tujuan tidak boleh sama.');
    }
    const cleanNominal = Math.round(Number(nominal));
    if (cleanNominal <= 0) {
      throw new Error('Nominal pemindahan dana harus lebih dari nol.');
    }

    const now = new Date().toISOString();
    const txId = generateId();

    const tx: Transaction = {
      id: txId,
      tabunganId,
      posId: sourcePosId,
      targetPosId,
      jenis: 'pindah_pos',
      nominal: cleanNominal,
      tanggal,
      catatan: catatan || 'Pindah dana antar pos',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', [db.transactions, db.auditLogs], async () => {
      await db.transactions.add(tx);
      await this.logAudit(
        'create',
        'transaksi',
        tx.id,
        `Pindah dana Rp${cleanNominal} antar pos`
      );
    });

    return tx;
  },

  // ===================== POCKETS (POS TABUNGAN) =====================
  async getPockets(tabunganId?: string): Promise<Pocket[]> {
    if (tabunganId) {
      return db.pockets
        .filter((p) => p.tabunganId === tabunganId && !p.isDeleted)
        .sortBy('urutan');
    }
    return db.pockets.filter((p) => !p.isDeleted).sortBy('urutan');
  },

  async getPocketById(id: string): Promise<Pocket | undefined> {
    const p = await db.pockets.get(id);
    return p && !p.isDeleted ? p : undefined;
  },

  /**
   * Ensures the system pocket "Belum dialokasikan" exists for a savings account
   */
  async getSystemPocket(tabunganId: string): Promise<Pocket> {
    const sysId = `pos_sys_${tabunganId}`;
    let p = await db.pockets.get(sysId);
    if (!p || p.isDeleted) {
      const now = new Date().toISOString();
      p = {
        id: sysId,
        tabunganId,
        nama: 'Belum dialokasikan',
        ikon: 'Inbox',
        warna: '#94a3b8',
        urutan: 0,
        diarsipkan: false,
        isSystem: true,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.pockets.put(p);
    }
    return p;
  },

  async createPocket(
    data: Omit<Pocket, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'isSystem'>
  ): Promise<Pocket> {
    const now = new Date().toISOString();
    const existing = await this.getPockets(data.tabunganId);
    const maxUrutan = existing.reduce((max, p) => Math.max(max, p.urutan), 0);

    const pocket: Pocket = {
      ...data,
      id: generateId(),
      urutan: maxUrutan + 1,
      isSystem: false,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', [db.pockets, db.auditLogs], async () => {
      await db.pockets.add(pocket);
      await this.logAudit('create', 'pos', pocket.id, `Membuat pos "${pocket.nama}"`);
    });

    return pocket;
  },

  async updatePocket(id: string, updates: Partial<Pocket>): Promise<Pocket> {
    const now = new Date().toISOString();
    return db.transaction('rw', [db.pockets, db.auditLogs], async () => {
      const existing = await db.pockets.get(id);
      if (!existing) throw new Error('Pos tidak ditemukan');
      if (existing.isSystem && updates.nama && updates.nama !== 'Belum dialokasikan') {
        throw new Error('Pos sistem tidak dapat diubah namanya');
      }

      const updated: Pocket = { ...existing, ...updates, updatedAt: now };
      await db.pockets.put(updated);
      await this.logAudit('update', 'pos', id, `Mengubah pos "${updated.nama}"`);
      return updated;
    });
  },

  async reorderPockets(tabunganIdOrOrderedIds: string | string[], maybeOrderedIds?: string[]): Promise<void> {
    const orderedIds = Array.isArray(tabunganIdOrOrderedIds)
      ? tabunganIdOrOrderedIds
      : maybeOrderedIds || [];
    const tabunganId = typeof tabunganIdOrOrderedIds === 'string' ? tabunganIdOrOrderedIds : undefined;

    const now = new Date().toISOString();
    await db.transaction('rw', [db.pockets], async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        const p = await db.pockets.get(id);
        if (p && (!tabunganId || p.tabunganId === tabunganId)) {
          p.urutan = i;
          p.updatedAt = now;
          await db.pockets.put(p);
        }
      }
    });
  },

  async archivePocket(
    id: string,
    currentBalanceOrTargetPosId?: number | string,
    maybeTargetPosId?: string
  ): Promise<Pocket> {
    const now = new Date().toISOString();
    return db.transaction('rw', [db.pockets, db.accounts, db.transactions, db.auditLogs], async () => {
      const pocket = await db.pockets.get(id);
      if (!pocket) throw new Error('Pos tidak ditemukan');
      if (pocket.isSystem) throw new Error('Pos sistem tidak dapat diarsipkan');

      let currentBalance: number;
      let targetId: string;

      if (typeof currentBalanceOrTargetPosId === 'string') {
        targetId = currentBalanceOrTargetPosId;
        const acc = await db.accounts.get(pocket.tabunganId);
        const allTxs = await db.transactions.where('tabunganId').equals(pocket.tabunganId).toArray();
        currentBalance = acc ? calculatePocketBalance(pocket, acc, allTxs) : 0;
      } else {
        currentBalance = typeof currentBalanceOrTargetPosId === 'number' ? currentBalanceOrTargetPosId : 0;
        targetId = maybeTargetPosId || `pos_sys_${pocket.tabunganId}`;
      }

      // If pocket has balance, transfer it to targetPos or system pocket
      if (currentBalance > 0) {
        const tx: Transaction = {
          id: generateId(),
          tabunganId: pocket.tabunganId,
          posId: pocket.id,
          targetPosId: targetId,
          jenis: 'pindah_pos',
          nominal: currentBalance,
          tanggal: now.slice(0, 10),
          catatan: `Pemindahan sisa saldo karena pos "${pocket.nama}" diarsipkan`,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        };
        await db.transactions.add(tx);
      }

      pocket.diarsipkan = !pocket.diarsipkan;
      pocket.updatedAt = now;
      await db.pockets.put(pocket);
      await this.logAudit('update', 'pos', id, `Mengarsipkan pos "${pocket.nama}"`);
      return pocket;
    });
  },

  async deletePocket(
    id: string,
    currentBalanceOrTargetPosId?: number | string,
    maybeTargetPosId?: string
  ): Promise<TrashItem> {
    const now = new Date().toISOString();
    return db.transaction('rw', [db.pockets, db.accounts, db.transactions, db.trash, db.auditLogs], async () => {
      const pocket = await db.pockets.get(id);
      if (!pocket) throw new Error('Pos tidak ditemukan');
      if (pocket.isSystem) throw new Error('Pos sistem tidak dapat dihapus');

      let currentBalance: number;
      let targetPosId: string;

      if (typeof currentBalanceOrTargetPosId === 'string') {
        targetPosId = currentBalanceOrTargetPosId;
        const acc = await db.accounts.get(pocket.tabunganId);
        const allTxs = await db.transactions.where('tabunganId').equals(pocket.tabunganId).toArray();
        currentBalance = acc ? calculatePocketBalance(pocket, acc, allTxs) : 0;
      } else {
        currentBalance = typeof currentBalanceOrTargetPosId === 'number' ? currentBalanceOrTargetPosId : 0;
        targetPosId = maybeTargetPosId || `pos_sys_${pocket.tabunganId}`;
      }

      // Remaining balance must be moved before deletion
      if (currentBalance > 0) {
        const tx: Transaction = {
          id: generateId(),
          tabunganId: pocket.tabunganId,
          posId: pocket.id,
          targetPosId: targetPosId,
          jenis: 'pindah_pos',
          nominal: currentBalance,
          tanggal: now.slice(0, 10),
          catatan: `Pemindahan sisa saldo karena pos "${pocket.nama}" dihapus`,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        };
        await db.transactions.add(tx);
      }

      pocket.isDeleted = true;
      pocket.updatedAt = now;
      await db.pockets.put(pocket);

      const trashItem: TrashItem = {
        id: generateId(),
        entitasTipe: 'pos',
        entitasId: id,
        judul: `Pos Tabungan: ${pocket.nama}`,
        dataJson: JSON.stringify(pocket),
        tanggalDihapus: now,
      };
      await db.trash.add(trashItem);
      await this.logAudit('delete', 'pos', id, `Menghapus pos "${pocket.nama}"`);
      return trashItem;
    });
  },

  // ===================== ATURAN BAGI OTOMATIS =====================
  async getAutoAllocationRules(tabunganId?: string): Promise<AutoAllocationRule[]> {
    if (tabunganId) {
      return db.autoAllocationRules
        .filter((r) => r.tabunganId === tabunganId && !r.isDeleted)
        .toArray();
    }
    return db.autoAllocationRules.filter((r) => !r.isDeleted).toArray();
  },

  async createAutoAllocationRule(
    data: Omit<AutoAllocationRule, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>
  ): Promise<AutoAllocationRule> {
    const now = new Date().toISOString();
    const rule: AutoAllocationRule = {
      ...data,
      id: generateId(),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', [db.autoAllocationRules, db.auditLogs], async () => {
      await db.autoAllocationRules.add(rule);
      await this.logAudit('create', 'aturan_bagi', rule.id, `Membuat aturan bagi "${rule.nama}"`);
    });

    return rule;
  },

  async updateAutoAllocationRule(
    id: string,
    updates: Partial<AutoAllocationRule>
  ): Promise<AutoAllocationRule> {
    const now = new Date().toISOString();
    return db.transaction('rw', [db.autoAllocationRules, db.auditLogs], async () => {
      const existing = await db.autoAllocationRules.get(id);
      if (!existing) throw new Error('Aturan bagi tidak ditemukan');
      const updated: AutoAllocationRule = { ...existing, ...updates, updatedAt: now };
      await db.autoAllocationRules.put(updated);
      await this.logAudit('update', 'aturan_bagi', id, `Mengubah aturan bagi "${updated.nama}"`);
      return updated;
    });
  },

  async deleteAutoAllocationRule(id: string): Promise<TrashItem> {
    const now = new Date().toISOString();
    return db.transaction('rw', [db.autoAllocationRules, db.trash, db.auditLogs], async () => {
      const rule = await db.autoAllocationRules.get(id);
      if (!rule) throw new Error('Aturan bagi tidak ditemukan');
      rule.isDeleted = true;
      rule.updatedAt = now;
      await db.autoAllocationRules.put(rule);

      const trashItem: TrashItem = {
        id: generateId(),
        entitasTipe: 'aturan_bagi',
        entitasId: id,
        judul: `Aturan Bagi: ${rule.nama}`,
        dataJson: JSON.stringify(rule),
        tanggalDihapus: now,
      };
      await db.trash.add(trashItem);
      await this.logAudit('delete', 'aturan_bagi', id, `Menghapus aturan bagi "${rule.nama}"`);
      return trashItem;
    });
  },

  // ===================== PEOPLE & DEBTS =====================
  async getPeople(): Promise<Person[]> {
    return db.people.filter((p) => !p.isDeleted).toArray();
  },

  async createPerson(nama: string, kontak?: string, foto?: string, catatan?: string): Promise<Person> {
    const now = new Date().toISOString();
    const person: Person = {
      id: generateId(),
      nama,
      kontak,
      foto,
      catatan,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.people.add(person);
    await this.logAudit('create', 'orang', person.id, `Menambah kontak "${person.nama}"`);
    return person;
  },

  async updatePerson(id: string, updates: Partial<Person>): Promise<Person> {
    const now = new Date().toISOString();
    const existing = await db.people.get(id);
    if (!existing) throw new Error('Kontak tidak ditemukan');
    const updated: Person = { ...existing, ...updates, updatedAt: now };
    await db.people.put(updated);
    return updated;
  },

  async deletePerson(id: string): Promise<TrashItem> {
    return db.transaction('rw', [db.people, db.trash, db.auditLogs], async () => {
      const p = await db.people.get(id);
      if (!p) throw new Error('Kontak tidak ditemukan');
      p.isDeleted = true;
      p.updatedAt = new Date().toISOString();
      await db.people.put(p);

      const trashItem: TrashItem = {
        id: generateId(),
        entitasTipe: 'orang',
        entitasId: id,
        judul: `Kontak: ${p.nama}`,
        dataJson: JSON.stringify(p),
        tanggalDihapus: new Date().toISOString(),
      };
      await db.trash.add(trashItem);
      return trashItem;
    });
  },

  async getDebts(): Promise<Debt[]> {
    return db.debts.filter((d) => !d.isDeleted).reverse().sortBy('tanggal');
  },

  async getDebtPayments(debtId?: string): Promise<DebtPayment[]> {
    if (debtId) {
      return db.debtPayments
        .filter((dp) => !dp.isDeleted && dp.utangId === debtId)
        .reverse()
        .sortBy('tanggal');
    }
    return db.debtPayments.filter((dp) => !dp.isDeleted).reverse().sortBy('tanggal');
  },

  /**
   * Atomic Debt creation with optional wallet linking
   */
  async createDebt(
    data: Omit<Debt, 'id' | 'status' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'initialTransactionId'>,
    linkWalletAccount?: Account
  ): Promise<Debt> {
    const now = new Date().toISOString();
    const debtId = generateId();

    return db.transaction('rw', [db.debts, db.transactions, db.auditLogs], async () => {
      let initialTxId: string | undefined = undefined;

      // If linked to wallet account:
      // - piutang (lending to other): money leaves user wallet -> 'keluar'
      // - utang (borrowing from other): money enters user wallet -> 'masuk'
      if (linkWalletAccount && data.tautanTabunganId) {
        initialTxId = generateId();
        const tx: Transaction = {
          id: initialTxId,
          tabunganId: data.tautanTabunganId,
          jenis: data.arah === 'piutang' ? 'keluar' : 'masuk',
          nominal: data.pokok,
          tanggal: data.tanggal,
          debtRefId: debtId,
          catatan:
            data.arah === 'piutang'
              ? `Pinjaman diberikan (${data.catatan || 'Utang baru'})`
              : `Pinjaman diterima (${data.catatan || 'Utang baru'})`,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        };
        await db.transactions.add(tx);
      }

      const debt: Debt = {
        ...data,
        id: debtId,
        initialTransactionId: initialTxId,
        status: determineDebtStatus(data.pokok, [], data.jatuhTempo),
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      await db.debts.add(debt);
      await this.logAudit('create', 'utang', debt.id, `Catat utang Rp${debt.pokok}`);
      return debt;
    });
  },

  /**
   * Atomic Debt Payment (Cicilan) with overpayment validation & wallet linking
   */
  async recordDebtPayment(
    debtId: string,
    nominal: number,
    tanggal: string,
    catatan?: string,
    metode?: string,
    linkTabunganId?: string
  ): Promise<DebtPayment> {
    const now = new Date().toISOString();

    return db.transaction(
      'rw',
      [db.debts, db.debtPayments, db.transactions, db.auditLogs],
      async () => {
        const debt = await db.debts.get(debtId);
        if (!debt || debt.isDeleted) throw new Error('Data utang tidak ditemukan');

        const existingPayments = await db.debtPayments
          .filter((p) => !p.isDeleted && p.utangId === debtId)
          .toArray();

        // Calculate remaining
        let totalPaid = 0;
        for (const p of existingPayments) totalPaid += p.nominal;
        const remaining = Math.max(0, debt.pokok - totalPaid);

        // Validation
        const validCheck = validateDebtPayment(remaining, nominal);
        if (!validCheck.valid) {
          throw new Error(validCheck.error || 'Pembayaran tidak valid');
        }

        const paymentId = generateId();
        let linkedTxId: string | undefined = undefined;

        // If linked to wallet:
        // - piutang paid back to me: money enters wallet -> 'masuk'
        // - utang paid by me to other: money leaves wallet -> 'keluar'
        if (linkTabunganId) {
          linkedTxId = generateId();
          const tx: Transaction = {
            id: linkedTxId,
            tabunganId: linkTabunganId,
            jenis: debt.arah === 'piutang' ? 'masuk' : 'keluar',
            nominal,
            tanggal,
            debtRefId: debtId,
            catatan: `Cicilan utang (${catatan || 'Pembayaran'})`,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
          };
          await db.transactions.add(tx);
        }

        const payment: DebtPayment = {
          id: paymentId,
          utangId: debtId,
          nominal,
          tanggal,
          catatan,
          metode,
          tabunganId: linkTabunganId,
          transactionId: linkedTxId,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        };

        await db.debtPayments.add(payment);

        // Update debt status automatically
        const allPayments = [...existingPayments, payment];
        debt.status = determineDebtStatus(debt.pokok, allPayments, debt.jatuhTempo);
        debt.updatedAt = now;
        await db.debts.put(debt);

        await this.logAudit('create', 'pembayaran', paymentId, `Bayar cicilan Rp${nominal}`);
        return payment;
      }
    );
  },

  async deleteDebt(id: string): Promise<TrashItem> {
    return db.transaction(
      'rw',
      [db.debts, db.debtPayments, db.transactions, db.trash, db.auditLogs],
      async () => {
        const debt = await db.debts.get(id);
        if (!debt) throw new Error('Data utang tidak ditemukan');

        debt.isDeleted = true;
        debt.updatedAt = new Date().toISOString();
        await db.debts.put(debt);

        // Also soft-delete linked initial transaction if exists
        if (debt.initialTransactionId) {
          const initTx = await db.transactions.get(debt.initialTransactionId);
          if (initTx) {
            initTx.isDeleted = true;
            await db.transactions.put(initTx);
          }
        }

        const trashItem: TrashItem = {
          id: generateId(),
          entitasTipe: 'utang',
          entitasId: id,
          judul: `Utang: Rp${debt.pokok}`,
          dataJson: JSON.stringify(debt),
          tanggalDihapus: new Date().toISOString(),
        };
        await db.trash.add(trashItem);
        await this.logAudit('delete', 'utang', id, `Menghapus catatan utang Rp${debt.pokok}`);
        return trashItem;
      }
    );
  },

  // ===================== SAVINGS GOALS (TARGET) =====================
  async getSavingsGoals(): Promise<SavingsGoal[]> {
    return db.savingsGoals.filter((g) => !g.isDeleted).toArray();
  },

  async createSavingsGoal(
    data: Omit<SavingsGoal, 'id' | 'isDeleted' | 'createdAt' | 'updatedAt'>
  ): Promise<SavingsGoal> {
    const now = new Date().toISOString();
    const goal: SavingsGoal = {
      ...data,
      id: generateId(),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.savingsGoals.add(goal);
    await this.logAudit('create', 'target', goal.id, `Membuat target tabungan "${goal.nama}"`);
    return goal;
  },

  async updateSavingsGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const now = new Date().toISOString();
    const existing = await db.savingsGoals.get(id);
    if (!existing) throw new Error('Target tidak ditemukan');
    const updated: SavingsGoal = { ...existing, ...updates, updatedAt: now };
    await db.savingsGoals.put(updated);
    return updated;
  },

  async deleteSavingsGoal(id: string): Promise<TrashItem> {
    return db.transaction('rw', [db.savingsGoals, db.trash, db.auditLogs], async () => {
      const goal = await db.savingsGoals.get(id);
      if (!goal) throw new Error('Target tidak ditemukan');
      goal.isDeleted = true;
      goal.updatedAt = new Date().toISOString();
      await db.savingsGoals.put(goal);

      const trashItem: TrashItem = {
        id: generateId(),
        entitasTipe: 'target',
        entitasId: id,
        judul: `Target: ${goal.nama}`,
        dataJson: JSON.stringify(goal),
        tanggalDihapus: new Date().toISOString(),
      };
      await db.trash.add(trashItem);
      return trashItem;
    });
  },

  // ===================== MONTHLY BUDGETS =====================
  async getBudgets(month?: number, year?: number): Promise<MonthlyBudget[]> {
    if (month && year) {
      return db.budgets
        .filter((b) => !b.isDeleted && b.bulan === month && b.tahun === year)
        .toArray();
    }
    return db.budgets.filter((b) => !b.isDeleted).toArray();
  },

  async setBudget(
    kategoriId: string,
    batasNominal: number,
    bulan: number,
    tahun: number
  ): Promise<MonthlyBudget> {
    const now = new Date().toISOString();
    return db.transaction('rw', [db.budgets, db.auditLogs], async () => {
      const existing = await db.budgets
        .filter((b) => !b.isDeleted && b.kategoriId === kategoriId && b.bulan === bulan && b.tahun === tahun)
        .first();

      if (existing) {
        existing.batasNominal = batasNominal;
        existing.updatedAt = now;
        await db.budgets.put(existing);
        return existing;
      }

      const budget: MonthlyBudget = {
        id: generateId(),
        kategoriId,
        batasNominal,
        bulan,
        tahun,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.budgets.add(budget);
      return budget;
    });
  },

  // ===================== RECURRING TRANSACTIONS =====================
  async getRecurringTransactions(): Promise<RecurringTransaction[]> {
    return db.recurringTransactions.filter((r) => !r.isDeleted).toArray();
  },

  async createRecurringTransaction(
    data: Omit<RecurringTransaction, 'id' | 'isDeleted' | 'createdAt' | 'updatedAt'>
  ): Promise<RecurringTransaction> {
    const now = new Date().toISOString();
    const item: RecurringTransaction = {
      ...data,
      id: generateId(),
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.recurringTransactions.add(item);
    return item;
  },

  async deleteRecurringTransaction(id: string): Promise<void> {
    const item = await db.recurringTransactions.get(id);
    if (item) {
      item.isDeleted = true;
      item.updatedAt = new Date().toISOString();
      await db.recurringTransactions.put(item);
    }
  },

  // ===================== ACHIEVEMENTS =====================
  async getAchievements(): Promise<Achievement[]> {
    return db.achievements.toArray();
  },

  async unlockAchievement(kode: string, nama: string, deskripsi: string, ikon: string): Promise<boolean> {
    const existing = await db.achievements.get(kode);
    if (existing && existing.tanggalTercapai) return false;

    const ach: Achievement = {
      id: kode,
      kode,
      nama,
      deskripsi,
      ikon,
      tanggalTercapai: new Date().toISOString(),
      dilihat: false,
    };
    await db.achievements.put(ach);
    return true;
  },

  // ===================== BACKUP & RESTORE & WIPE =====================
  async exportFullData(): Promise<Record<string, unknown>> {
    const [
      settings,
      accounts,
      categories,
      tags,
      transactions,
      people,
      debts,
      debtPayments,
      savingsGoals,
      budgets,
      recurringTransactions,
      achievements,
      trash,
      auditLogs,
      pockets,
      autoAllocationRules,
    ] = await Promise.all([
      db.settings.toArray(),
      db.accounts.toArray(),
      db.categories.toArray(),
      db.tags.toArray(),
      db.transactions.toArray(),
      db.people.toArray(),
      db.debts.toArray(),
      db.debtPayments.toArray(),
      db.savingsGoals.toArray(),
      db.budgets.toArray(),
      db.recurringTransactions.toArray(),
      db.achievements.toArray(),
      db.trash.toArray(),
      db.auditLogs.toArray(),
      db.pockets.toArray(),
      db.autoAllocationRules.toArray(),
    ]);

    return {
      version: 2,
      appName: 'Nubung Yuk',
      exportedAt: new Date().toISOString(),
      data: {
        settings,
        accounts,
        categories,
        tags,
        transactions,
        people,
        debts,
        debtPayments,
        savingsGoals,
        budgets,
        recurringTransactions,
        achievements,
        trash,
        auditLogs,
        pockets,
        autoAllocationRules,
      },
    };
  },

  async importFullData(exportedJson: Record<string, unknown>): Promise<void> {
    if (!exportedJson || exportedJson.appName !== 'Nubung Yuk') {
      throw new Error('Format file backup tidak valid untuk Nubung Yuk.');
    }
    const data = exportedJson.data as Record<string, unknown[]>;
    if (!data) throw new Error('Data backup kosong atau rusak.');

    await db.transaction(
      'rw',
      [
        db.settings,
        db.accounts,
        db.categories,
        db.tags,
        db.transactions,
        db.people,
        db.debts,
        db.debtPayments,
        db.savingsGoals,
        db.budgets,
        db.recurringTransactions,
        db.achievements,
        db.trash,
        db.auditLogs,
        db.pockets,
        db.autoAllocationRules,
      ],
      async () => {
        // Clear all tables safely
        await Promise.all([
          db.settings.clear(),
          db.accounts.clear(),
          db.categories.clear(),
          db.tags.clear(),
          db.transactions.clear(),
          db.people.clear(),
          db.debts.clear(),
          db.debtPayments.clear(),
          db.savingsGoals.clear(),
          db.budgets.clear(),
          db.recurringTransactions.clear(),
          db.achievements.clear(),
          db.trash.clear(),
          db.auditLogs.clear(),
          db.pockets.clear(),
          db.autoAllocationRules.clear(),
        ]);

        if (Array.isArray(data.settings)) await db.settings.bulkPut(data.settings as AppSettings[]);
        if (Array.isArray(data.accounts)) await db.accounts.bulkPut(data.accounts as Account[]);
        if (Array.isArray(data.categories)) await db.categories.bulkPut(data.categories as Category[]);
        if (Array.isArray(data.tags)) await db.tags.bulkPut(data.tags as Tag[]);
        if (Array.isArray(data.transactions)) await db.transactions.bulkPut(data.transactions as Transaction[]);
        if (Array.isArray(data.people)) await db.people.bulkPut(data.people as Person[]);
        if (Array.isArray(data.debts)) await db.debts.bulkPut(data.debts as Debt[]);
        if (Array.isArray(data.debtPayments)) await db.debtPayments.bulkPut(data.debtPayments as DebtPayment[]);
        if (Array.isArray(data.savingsGoals)) await db.savingsGoals.bulkPut(data.savingsGoals as SavingsGoal[]);
        if (Array.isArray(data.budgets)) await db.budgets.bulkPut(data.budgets as MonthlyBudget[]);
        if (Array.isArray(data.recurringTransactions))
          await db.recurringTransactions.bulkPut(data.recurringTransactions as RecurringTransaction[]);
        if (Array.isArray(data.achievements)) await db.achievements.bulkPut(data.achievements as Achievement[]);
        if (Array.isArray(data.trash)) await db.trash.bulkPut(data.trash as TrashItem[]);
        if (Array.isArray(data.auditLogs)) await db.auditLogs.bulkPut(data.auditLogs as AuditLog[]);
        if (Array.isArray(data.pockets)) await db.pockets.bulkPut(data.pockets as Pocket[]);
        if (Array.isArray(data.autoAllocationRules))
          await db.autoAllocationRules.bulkPut(data.autoAllocationRules as AutoAllocationRule[]);
      }
    );
  },

  async wipeAllData(): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.settings,
        db.accounts,
        db.categories,
        db.tags,
        db.transactions,
        db.people,
        db.debts,
        db.debtPayments,
        db.savingsGoals,
        db.budgets,
        db.recurringTransactions,
        db.achievements,
        db.trash,
        db.auditLogs,
        db.pockets,
        db.autoAllocationRules,
      ],
      async () => {
        await Promise.all([
          db.settings.clear(),
          db.accounts.clear(),
          db.categories.clear(),
          db.tags.clear(),
          db.transactions.clear(),
          db.people.clear(),
          db.debts.clear(),
          db.debtPayments.clear(),
          db.savingsGoals.clear(),
          db.budgets.clear(),
          db.recurringTransactions.clear(),
          db.achievements.clear(),
          db.trash.clear(),
          db.auditLogs.clear(),
          db.pockets.clear(),
          db.autoAllocationRules.clear(),
        ]);
        await db.settings.put(DEFAULT_SETTINGS);
      }
    );
  },
};
