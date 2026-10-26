import React, { useState } from 'react';
import {
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Edit2,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  Account,
  AppSettings,
  Category,
  Pocket,
  Tag,
  Transaction,
  TransactionType,
} from '../../domain/types';
import {
  formatRupiah,
  calculateAccountBalance,
} from '../../domain/accounting';
import {
  groupTransactionsByDay,
} from '../../domain/statistics';
import { SoundButton } from '../../components/SoundButton';
import { Modal } from '../../components/Modal';
import { BottomSheet } from '../../components/BottomSheet';
import { CurrencyInput } from '../../components/CurrencyInput';
import { repository } from '../../db/repository';
import { useToast } from '../../context/ToastContext';
import { PocketsView } from './PocketsView';

interface AccountsPageProps {
  settings: AppSettings;
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  pockets?: Pocket[];
  tags?: Tag[];
  onRefresh: () => void;
  onOpenQuickAction: (action: 'income' | 'expense' | 'transfer' | 'debt') => void;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({
  settings,
  accounts,
  transactions,
  categories,
  pockets = [],
  tags: _tags,
  onRefresh,
  onOpenQuickAction,
}) => {
  const { showToast, showUndoToast } = useToast();

  const [activeTab, setActiveTab] = useState<'riwayat' | 'pos'>('riwayat');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedPosId, setSelectedPosId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<TransactionType | 'all'>('all');
  const [selectedCategory, _setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'nominal_desc'>('date_desc');
  const [foldedDays, setFoldedDays] = useState<Record<string, boolean>>({});

  // Account creation / edit modal
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountFormName, setAccountFormName] = useState('');
  const [accountFormBalance, setAccountFormBalance] = useState(0);
  const [accountFormColor, setAccountFormColor] = useState('#0d9488');

  // Detail / Adjustment / Edit transaction modal
  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentNominal, setAdjustmentNominal] = useState(0);
  const [adjustmentAlasan, setAdjustmentAlasan] = useState('');

  const posMap = new Map<string, Pocket>(pockets.map((p) => [p.id, p]));

  // Filtered transactions
  let filtered = transactions.filter((tx) => !tx.isDeleted);

  if (selectedAccountId !== 'all') {
    filtered = filtered.filter(
      (tx) => tx.tabunganId === selectedAccountId || tx.targetTabunganId === selectedAccountId
    );
  }

  if (selectedPosId !== 'all') {
    filtered = filtered.filter(
      (tx) => tx.posId === selectedPosId || tx.targetPosId === selectedPosId
    );
  }

  if (selectedType !== 'all') {
    filtered = filtered.filter((tx) => tx.jenis === selectedType);
  }

  if (selectedCategory !== 'all') {
    filtered = filtered.filter((tx) => tx.kategoriId === selectedCategory);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (tx) =>
        (tx.catatan && tx.catatan.toLowerCase().includes(q)) ||
        tx.nominal.toString().includes(q)
    );
  }

  // Sorting
  if (sortBy === 'date_desc') {
    filtered.sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  } else if (sortBy === 'date_asc') {
    filtered.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  } else if (sortBy === 'nominal_desc') {
    filtered.sort((a, b) => b.nominal - a.nominal);
  }

  // Daily grouped transactions
  const dayGroups = groupTransactionsByDay(filtered);

  const toggleFold = (date: string) => {
    setFoldedDays((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountFormName.trim()) {
      showToast({ type: 'warning', message: 'Nama tabungan tidak boleh kosong' });
      return;
    }

    if (editingAccount) {
      await repository.updateAccount(editingAccount.id, {
        nama: accountFormName.trim(),
        warna: accountFormColor,
      });
      showToast({ type: 'success', message: 'Tabungan berhasil diubah' });
    } else {
      await repository.createAccount({
        nama: accountFormName.trim(),
        ikon: 'Wallet',
        warna: accountFormColor,
        saldoAwal: accountFormBalance,
        diarsipkan: false,
      });
      showToast({ type: 'success', message: 'Tabungan baru berhasil dibuat' });
    }

    setAccountModalOpen(false);
    setEditingAccount(null);
    setAccountFormName('');
    setAccountFormBalance(0);
    onRefresh();
  };

  const handleDeleteAccount = async (acc: Account) => {
    const trash = await repository.deleteAccount(acc.id);
    showUndoToast(`Tabungan "${acc.nama}" dihapus`, async () => {
      await repository.restoreFromTrash(trash.id);
      onRefresh();
    });
    onRefresh();
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    const trash = await repository.deleteTransaction(tx.id);
    setActiveTx(null);
    showUndoToast(`Transaksi ${formatRupiah(tx.nominal)} dihapus`, async () => {
      await repository.restoreFromTrash(trash.id);
      onRefresh();
    });
    onRefresh();
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustmentNominal === 0) {
      showToast({ type: 'warning', message: 'Nominal penyesuaian tidak boleh nol' });
      return;
    }
    if (!adjustmentAlasan.trim()) {
      showToast({ type: 'warning', message: 'Alasan penyesuaian saldo wajib diisi' });
      return;
    }

    const accId = selectedAccountId !== 'all' ? selectedAccountId : accounts[0]?.id;
    if (!accId) {
      showToast({ type: 'warning', message: 'Pilih tabungan yang ingin disesuaikan' });
      return;
    }

    await repository.createTransaction({
      tabunganId: accId,
      jenis: 'penyesuaian',
      nominal: adjustmentNominal,
      tanggal: new Date().toISOString(),
      alasanPenyesuaian: adjustmentAlasan.trim(),
      catatan: `Penyesuaian Saldo: ${adjustmentAlasan.trim()}`,
    });

    showToast({ type: 'success', message: 'Penyesuaian saldo berhasil dicatat' });
    setAdjustmentModalOpen(false);
    setAdjustmentNominal(0);
    setAdjustmentAlasan('');
    onRefresh();
  };

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      {/* Header & Wallet Cards */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-accounts)] inline-block" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Buku Tabungan</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Kelola dompet ganda, pos amplop & riwayat saldo Anda</p>
        </div>

        <SoundButton
          size="sm"
          sound="click"
          onClick={() => {
            setEditingAccount(null);
            setAccountFormName('');
            setAccountFormBalance(0);
            setAccountModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Dompet</span>
        </SoundButton>
      </div>

      {/* Tab Switcher: Riwayat vs Pos Tabungan */}
      <div className="flex rounded-2xl bg-[var(--bg-subtle)] p-1 border border-[var(--border-color)] max-w-sm">
        <button
          onClick={() => setActiveTab('riwayat')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'riwayat'
              ? 'bg-[var(--bg-card)] text-[var(--accent-accounts)] shadow-soft-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Riwayat Transaksi
        </button>
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'pos'
              ? 'bg-[var(--bg-card)] text-[var(--accent-accounts)] shadow-soft-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>Pos Tabungan (Amplop)</span>
          {pockets.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--accent-accounts)]/15 text-[var(--accent-accounts)] font-bold">
              {pockets.filter((p) => !p.isDeleted && !p.isSystem).length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'pos' ? (
        <PocketsView
          settings={settings}
          accounts={accounts}
          selectedAccountId={selectedAccountId === 'all' ? accounts[0]?.id || '' : selectedAccountId}
          onSelectAccount={(id) => setSelectedAccountId(id)}
          pockets={pockets}
          transactions={transactions}
          onRefresh={onRefresh}
        />
      ) : (
        <>

      {/* Account Horizontal Cards */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
        {/* 'All' Tab Button */}
        <button
          onClick={() => setSelectedAccountId('all')}
          className={`flex flex-col p-4 rounded-3xl border min-w-[150px] text-left transition-all cursor-pointer ${
            selectedAccountId === 'all'
              ? 'border-[var(--accent-accounts)] bg-[var(--accent-accounts)]/10 ring-2 ring-[var(--accent-accounts)] shadow-soft-sm'
              : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--accent-accounts)]'
          }`}
        >
          <span className="text-xs font-semibold text-[var(--text-secondary)]">Semua Tabungan</span>
          <span className="text-base font-bold text-[var(--text-primary)] mt-1 tabular-nums">
            {formatRupiah(
              accounts.reduce(
                (sum, a) => sum + calculateAccountBalance(a.saldoAwal, transactions, a.id),
                0
              ),
              settings.privacyMode
            )}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] mt-1">{accounts.length} dompet aktif</span>
        </button>

        {accounts.map((acc) => {
          const bal = calculateAccountBalance(acc.saldoAwal, transactions, acc.id);
          const isSelected = selectedAccountId === acc.id;

          return (
            <div
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              className={`flex flex-col p-4 rounded-3xl border min-w-[170px] relative transition-all cursor-pointer ${
                isSelected
                  ? 'border-[var(--accent-accounts)] bg-[var(--accent-accounts)]/10 ring-2 ring-[var(--accent-accounts)] shadow-soft-sm'
                  : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--accent-accounts)]'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: acc.warna }}
                  />
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[100px]">
                    {acc.nama}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingAccount(acc);
                    setAccountFormName(acc.nama);
                    setAccountFormBalance(acc.saldoAwal);
                    setAccountFormColor(acc.warna);
                    setAccountModalOpen(true);
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <span className="text-base font-bold text-[var(--text-primary)] mt-1 tabular-nums">
                {formatRupiah(bal, settings.privacyMode)}
              </span>

              <div className="flex items-center justify-between mt-2 pt-1 border-t border-[var(--border-color)] text-[10px] text-[var(--text-muted)]">
                <span className="tabular-nums">Awal: {formatRupiah(acc.saldoAwal, settings.privacyMode)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action shortcuts under accounts */}
      <div className="flex items-center justify-between bg-[var(--bg-subtle)] p-3 rounded-2xl border border-[var(--border-color)] gap-2">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          Aksi Tabungan Terpilih:
        </span>
        <div className="flex gap-2">
          <SoundButton
            size="sm"
            variant="outline"
            sound="click"
            onClick={() => setAdjustmentModalOpen(true)}
          >
            <span>Koreksi / Penyesuaian Saldo</span>
          </SoundButton>
          <SoundButton
            size="sm"
            variant="secondary"
            sound="click"
            onClick={() => onOpenQuickAction('transfer')}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Transfer</span>
          </SoundButton>
        </div>
      </div>

      {/* Search & Filters in Compact Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        <div className="relative sm:col-span-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Cari transaksi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] focus:outline-hidden focus:border-pink-400"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as TransactionType | 'all')}
          className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] cursor-pointer focus:outline-hidden focus:border-pink-400"
        >
          <option value="all">Semua Jenis Transaksi</option>
          <option value="masuk">Pemasukan (Masuk)</option>
          <option value="keluar">Pengeluaran (Keluar)</option>
          <option value="transfer">Transfer Antar Dompet</option>
          <option value="penyesuaian">Penyesuaian Saldo</option>
        </select>

        {pockets.length > 0 ? (
          <select
            value={selectedPosId}
            onChange={(e) => setSelectedPosId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] cursor-pointer focus:outline-hidden focus:border-pink-400"
          >
            <option value="all">Semua Pos (Amplop)</option>
            {pockets.filter((p) => !p.isDeleted).map((pos) => (
              <option key={pos.id} value={pos.id}>
                Pos: {pos.nama}
              </option>
            ))}
          </select>
        ) : (
          <div className="hidden sm:block" />
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date_desc' | 'date_asc' | 'nominal_desc')}
          className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] cursor-pointer focus:outline-hidden focus:border-pink-400"
        >
          <option value="date_desc">Urutkan: Tanggal Terbaru</option>
          <option value="date_asc">Urutkan: Tanggal Terlama</option>
          <option value="nominal_desc">Urutkan: Nominal Terbesar</option>
        </select>
      </div>

      {/* Transactions List Grouped by Day */}
      {dayGroups.length > 0 ? (
        <div className="space-y-4">
          {dayGroups.map((group) => {
            const isFolded = foldedDays[group.date];

            return (
              <div
                key={group.date}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl overflow-hidden shadow-soft-sm"
              >
                {/* Daily Subtotal Sticky Header (Clickable to fold/unfold) */}
                <div
                  onClick={() => toggleFold(group.date)}
                  className="sticky top-0 z-10 flex items-center justify-between p-4 bg-[var(--bg-card)]/95 backdrop-blur-md border-b border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--text-primary)]">
                      {group.label}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                      ({group.transactions.length})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold mr-2 tabular-nums">
                        +{formatRupiah(group.totalMasuk, settings.privacyMode)}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400 font-semibold mr-2 tabular-nums">
                        -{formatRupiah(group.totalKeluar, settings.privacyMode)}
                      </span>
                      <span className="text-[var(--text-secondary)] font-bold tabular-nums">
                        Selisih: {formatRupiah(group.selisih, settings.privacyMode)}
                      </span>
                    </div>

                    {isFolded ? (
                      <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                  </div>
                </div>

                {/* List of transactions for this day */}
                {!isFolded && (
                  <div className="divide-y divide-[var(--border-color)]">
                    {group.transactions.map((tx) => {
                      const cat = tx.kategoriId ? catMap.get(tx.kategoriId) : null;
                      const acc = accMap.get(tx.tabunganId);
                      const isExpense =
                        tx.jenis === 'keluar' || (tx.jenis === 'penyesuaian' && tx.nominal < 0);
                      const isIncome =
                        tx.jenis === 'masuk' || (tx.jenis === 'penyesuaian' && tx.nominal > 0);

                      return (
                        <div
                          key={tx.id}
                          onClick={() => setActiveTx(tx)}
                          className="flex items-center justify-between p-4 hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                tx.jenis === 'masuk'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : tx.jenis === 'keluar'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  : tx.jenis === 'transfer'
                                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                                  : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              }`}
                            >
                              {tx.jenis === 'masuk' && <ArrowDownLeft className="w-5 h-5" />}
                              {tx.jenis === 'keluar' && <ArrowUpRight className="w-5 h-5" />}
                              {tx.jenis === 'transfer' && <ArrowLeftRight className="w-5 h-5" />}
                              {tx.jenis === 'pindah_pos' && <ArrowLeftRight className="w-5 h-5 text-indigo-500" />}
                              {tx.jenis === 'penyesuaian' && <Wallet className="w-5 h-5" />}
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-sm text-[var(--text-primary)]">
                                  {tx.catatan || (cat ? cat.nama : tx.jenis === 'pindah_pos' ? 'Pindah Dana Pos' : 'Tanpa Keterangan')}
                                </span>
                                {cat && (
                                  <span
                                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-white shadow-2xs"
                                    style={{ backgroundColor: cat.warna }}
                                  >
                                    {cat.nama}
                                  </span>
                                )}
                                {tx.posId && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: posMap.get(tx.posId)?.warna || '#64748b' }}
                                    />
                                    <span>{posMap.get(tx.posId)?.nama || 'Belum dialokasikan'}</span>
                                    {tx.jenis === 'pindah_pos' && tx.targetPosId && (
                                      <span className="text-indigo-500 font-bold ml-0.5">
                                        &rarr; {posMap.get(tx.targetPosId)?.nama || 'Pos'}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                                {acc?.nama} • {tx.tanggal.slice(11, 16) || 'Hari ini'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-sm font-bold block tabular-nums ${
                                isExpense
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : isIncome
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-sky-600 dark:text-sky-400'
                              }`}
                            >
                              {isExpense ? '-' : isIncome ? '+' : ''}
                              {formatRupiah(tx.nominal, settings.privacyMode)}
                            </span>
                            {tx.lampiranFoto && (
                              <span className="text-[10px] text-[var(--text-muted)]">Ada foto</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center flex flex-col items-center shadow-soft-sm">
          <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-muted)] flex items-center justify-center mb-3">
            <Wallet className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1">
            Belum Ada Transaksi Ditemukan
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mb-4">
            Catat pengeluaran atau pemasukan pertama Anda di tabungan ini.
          </p>
        </div>
      )}
      </>
      )}

      {/* Transaction Detail BottomSheet */}
      {activeTx && (
        <BottomSheet
          isOpen={!!activeTx}
          onClose={() => setActiveTx(null)}
          title="Detail Transaksi"
        >
          <div className="space-y-4">
            <div className="text-center py-2">
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                Nominal Transaksi
              </span>
              <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mt-1 tabular-nums">
                {formatRupiah(activeTx.nominal, settings.privacyMode)}
              </h2>
              <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold capitalize bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                {activeTx.jenis}
              </span>
            </div>

            <div className="bg-[var(--bg-subtle)] p-4 rounded-2xl space-y-2.5 text-xs border border-[var(--border-color)]">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Tabungan</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {accMap.get(activeTx.tabunganId)?.nama || '-'}
                </span>
              </div>

              {activeTx.targetTabunganId && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Tabungan Tujuan</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {accMap.get(activeTx.targetTabunganId)?.nama || '-'}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Pos Tabungan</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {posMap.get(activeTx.posId || '')?.nama || 'Belum dialokasikan'}
                  {activeTx.jenis === 'pindah_pos' && activeTx.targetPosId && (
                    <span className="text-indigo-500 font-bold ml-1">
                      &rarr; {posMap.get(activeTx.targetPosId)?.nama || 'Pos'}
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Kategori</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {activeTx.kategoriId ? catMap.get(activeTx.kategoriId)?.nama : 'Umum'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Tanggal & Waktu</span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {activeTx.tanggal.slice(0, 10)} {activeTx.tanggal.slice(11, 16)}
                </span>
              </div>

              {activeTx.catatan && (
                <div className="pt-2 border-t border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)] block mb-1">Catatan "Dipakai Untuk Apa":</span>
                  <p className="font-medium text-[var(--text-primary)]">
                    {activeTx.catatan}
                  </p>
                </div>
              )}

              {activeTx.alasanPenyesuaian && (
                <div className="pt-2 border-t border-[var(--border-color)]">
                  <span className="text-[var(--text-secondary)] block mb-1">Alasan Penyesuaian Saldo:</span>
                  <p className="font-medium text-[var(--text-primary)]">
                    {activeTx.alasanPenyesuaian}
                  </p>
                </div>
              )}
            </div>

            {/* Photo Attachment Preview */}
            {activeTx.lampiranFoto && (
              <div>
                <span className="text-xs font-semibold text-[var(--text-primary)] block mb-1.5">
                  Foto Struk / Bukti:
                </span>
                <img
                  src={activeTx.lampiranFoto}
                  alt="Bukti Struk"
                  className="w-full max-h-60 object-contain rounded-2xl border border-[var(--border-color)] bg-black/5"
                />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <SoundButton
                variant="danger"
                className="w-full"
                sound="delete"
                onClick={() => handleDeleteTransaction(activeTx)}
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Transaksi (Ke Tempat Sampah)</span>
              </SoundButton>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Account Creation / Edit Modal */}
      <Modal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        title={editingAccount ? 'Ubah Tabungan' : 'Buat Tabungan Baru'}
      >
        <form onSubmit={handleSaveAccount} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Tabungan / Dompet
            </label>
            <input
              type="text"
              placeholder="Contoh: Tabungan Utama, Dompet Saku"
              value={accountFormName}
              onChange={(e) => setAccountFormName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {!editingAccount && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Saldo Awal
              </label>
              <CurrencyInput
                value={accountFormBalance}
                onChange={setAccountFormBalance}
                placeholder="Rp0"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Warna Kartu
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accountFormColor}
                onChange={(e) => setAccountFormColor(e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
              />
              <span className="text-xs font-mono">{accountFormColor}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {editingAccount && (
              <SoundButton
                type="button"
                variant="danger"
                sound="delete"
                onClick={() => {
                  handleDeleteAccount(editingAccount);
                  setAccountModalOpen(false);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </SoundButton>
            )}
            <SoundButton
              type="button"
              variant="secondary"
              onClick={() => setAccountModalOpen(false)}
              className="flex-1"
            >
              Batal
            </SoundButton>
            <SoundButton type="submit" className="flex-1" sound="success">
              Simpan
            </SoundButton>
          </div>
        </form>
      </Modal>

      {/* Balance Adjustment Modal */}
      <Modal
        isOpen={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        title="Koreksi / Penyesuaian Saldo"
      >
        <form onSubmit={handleCreateAdjustment} className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Sesuai aturan akuntansi, saldo tidak diubah diam-diam melainkan dicatat sebagai transaksi
            penyesuaian bersama alasannya.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nominal Penyesuaian (+ untuk menambah, - untuk mengurangi)
            </label>
            <CurrencyInput
              value={adjustmentNominal}
              onChange={setAdjustmentNominal}
              placeholder="Rp0"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Alasan Penyesuaian (Wajib)
            </label>
            <input
              type="text"
              placeholder="Contoh: Koreksi selisih hitung, Uang kembalian lupa dicatat"
              value={adjustmentAlasan}
              onChange={(e) => setAdjustmentAlasan(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <SoundButton
              type="button"
              variant="secondary"
              onClick={() => setAdjustmentModalOpen(false)}
              className="flex-1"
            >
              Batal
            </SoundButton>
            <SoundButton type="submit" className="flex-1" sound="success">
              Simpan Penyesuaian
            </SoundButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};
