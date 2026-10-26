import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Upload,
  X,
  Split,
  Plus,
  Trash2,
  BookmarkCheck,
} from 'lucide-react';
import { Modal } from './Modal';
import { CurrencyInput } from './CurrencyInput';
import { SoundButton } from './SoundButton';
import { Account, AutoAllocationRule, Category, Person, Pocket, Transaction } from '../domain/types';
import { repository } from '../db/repository';
import { useToast } from '../context/ToastContext';
import {
  calculateAccountBalance,
  calculateAutoAllocation,
  calculatePocketBalance,
  checkOverdrawnWarning,
  checkPocketExpenseOverdraft,
  checkPocketMonthlyLimit,
  formatRupiah,
} from '../domain/accounting';

interface QuickActionModalProps {
  isOpen: boolean;
  actionType: 'income' | 'expense' | 'transfer' | 'debt';
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  people: Person[];
  pockets?: Pocket[];
  autoAllocationRules?: AutoAllocationRule[];
  transactions?: Transaction[];
  onSuccess: () => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  actionType,
  onClose,
  accounts,
  categories,
  people,
  pockets = [],
  autoAllocationRules = [],
  transactions = [],
  onSuccess,
}) => {
  const { showToast, showUndoToast } = useToast();

  const [nominal, setNominal] = useState(0);
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [tabunganId, setTabunganId] = useState(accounts[0]?.id || '');
  const [targetTabunganId, setTargetTabunganId] = useState(accounts[1]?.id || '');
  const [kategoriId, setKategoriId] = useState('');
  const [catatan, setCatatan] = useState('');
  const [fotoStruk, setFotoStruk] = useState<string | undefined>(undefined);

  // Pocket fields
  const [posId, setPosId] = useState<string>('');
  const [targetPosId, setTargetPosId] = useState<string>('');

  // Income allocation mode: 'single' | 'auto' | 'manual'
  const [incomeMode, setIncomeMode] = useState<'single' | 'auto' | 'manual'>('single');
  const [selectedRuleId, setSelectedRuleId] = useState<string>('');
  const [manualSplits, setManualSplits] = useState<{ posId: string; nominal: number }[]>([]);

  // For debt
  const [orangId, setOrangId] = useState(people[0]?.id || '');
  const [newPersonName, setNewPersonName] = useState('');
  const [arahUtang, setArahUtang] = useState<'piutang' | 'utang'>('piutang');
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [tautkanTabungan, setTautkanTabungan] = useState(false);

  // Overdrawn warning
  const [overdrawnWarning, setOverdrawnWarning] = useState<string | null>(null);

  // Pockets for current selected account
  const accountPockets = pockets.filter((p) => p.tabunganId === tabunganId && !p.isDeleted);
  const sysPocket = accountPockets.find((p) => p.isSystem) || accountPockets[0];

  // Pockets for target account in transfer
  const targetAccountPockets = pockets.filter(
    (p) => p.tabunganId === targetTabunganId && !p.isDeleted
  );
  const targetSysPocket = targetAccountPockets.find((p) => p.isSystem) || targetAccountPockets[0];

  // Rules for current selected account
  const accountRules = autoAllocationRules.filter(
    (r) => r.tabunganId === tabunganId && !r.isDeleted && r.aktif
  );

  useEffect(() => {
    if (sysPocket && (!posId || !accountPockets.some((p) => p.id === posId))) {
      setPosId(sysPocket.id);
    }
  }, [tabunganId, pockets]);

  useEffect(() => {
    if (targetSysPocket && (!targetPosId || !targetAccountPockets.some((p) => p.id === targetPosId))) {
      setTargetPosId(targetSysPocket.id);
    }
  }, [targetTabunganId, pockets]);

  useEffect(() => {
    if (accountRules.length > 0 && !selectedRuleId) {
      setSelectedRuleId(accountRules[0].id);
    }
  }, [tabunganId, autoAllocationRules]);

  const resetForm = () => {
    setNominal(0);
    setCatatan('');
    setFotoStruk(undefined);
    setOverdrawnWarning(null);
    setNewPersonName('');
    setTautkanTabungan(false);
    setIncomeMode('single');
    setManualSplits([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast({ type: 'warning', message: 'Ukuran foto maksimal 2MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setFotoStruk(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Pocket status check for expense
  const selectedPocket = accountPockets.find((p) => p.id === posId);
  const currentAcc = accounts.find((a) => a.id === tabunganId) || accounts[0];
  const pocketBal = (selectedPocket && currentAcc)
    ? calculatePocketBalance(selectedPocket, currentAcc, transactions)
    : 0;

  const pocketOverdraft = checkPocketExpenseOverdraft(pocketBal, nominal);
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth() + 1;
  const pocketLimitStatus = selectedPocket
    ? checkPocketMonthlyLimit(selectedPocket, transactions, nowYear, nowMonth)
    : null;

  // Auto-allocation calculation for income preview
  const activeRule = accountRules.find((r) => r.id === selectedRuleId);
  let autoAllocResult = null;
  if (incomeMode === 'auto' && activeRule && sysPocket && nominal > 0) {
    try {
      autoAllocResult = calculateAutoAllocation(nominal, activeRule.items, sysPocket.id);
    } catch {
      autoAllocResult = null;
    }
  }

  // Manual split helpers
  const handleAddManualSplit = () => {
    const unselected = accountPockets.find((p) => !manualSplits.some((s) => s.posId === p.id));
    if (!unselected) {
      showToast({ type: 'info', message: 'Semua pos sudah dipilih' });
      return;
    }
    const currentSum = manualSplits.reduce((sum, s) => sum + s.nominal, 0);
    const rem = Math.max(0, nominal - currentSum);
    setManualSplits((prev) => [...prev, { posId: unselected.id, nominal: rem }]);
  };

  const handleUpdateManualSplit = (index: number, updates: Partial<{ posId: string; nominal: number }>) => {
    setManualSplits((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, ...updates } : it))
    );
  };

  const handleRemoveManualSplit = (index: number) => {
    setManualSplits((prev) => prev.filter((_, idx) => idx !== index));
  };

  const manualSplitSum = manualSplits.reduce((sum, s) => sum + s.nominal, 0);
  const manualSplitRemainder = nominal - manualSplitSum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (nominal <= 0) {
      showToast({ type: 'warning', message: 'Nominal harus lebih dari Rp0' });
      return;
    }

    if (!tabunganId && actionType !== 'debt') {
      showToast({ type: 'warning', message: 'Pilih tabungan terlebih dahulu' });
      return;
    }

    try {
      if (actionType === 'income') {
        const timestamp = `${tanggal}T${new Date().toTimeString().slice(0, 8)}Z`;

        if (incomeMode === 'single') {
          const tx = await repository.createTransaction({
            tabunganId,
            posId: posId || sysPocket?.id,
            jenis: 'masuk',
            nominal,
            tanggal: timestamp,
            kategoriId: kategoriId || undefined,
            catatan: catatan.trim() || undefined,
            lampiranFoto: fotoStruk,
          });

          showUndoToast(`Berhasil mencatat pemasukan ${formatRupiah(nominal)}`, async () => {
            await repository.deleteTransaction(tx.id);
            onSuccess();
          });
        } else if (incomeMode === 'auto') {
          if (!autoAllocResult) {
            showToast({ type: 'warning', message: 'Aturan bagi otomatis tidak valid' });
            return;
          }

          // Create transactions for each allocation
          const createdTxs: Transaction[] = [];
          for (const item of autoAllocResult.allocations) {
            const p = accountPockets.find((pk) => pk.id === item.posId);
            const subTx = await repository.createTransaction({
              tabunganId,
              posId: item.posId,
              jenis: 'masuk',
              nominal: item.nominal,
              tanggal: timestamp,
              kategoriId: kategoriId || undefined,
              catatan: `[Bagi Otomatis: ${activeRule?.nama || 'Aturan'}] ${catatan ? catatan + ' - ' : ''}Pos ${p?.nama || ''}`,
              lampiranFoto: fotoStruk,
            });
            createdTxs.push(subTx);
          }

          if (autoAllocResult.unallocatedNominal > 0 && sysPocket) {
            const unallocTx = await repository.createTransaction({
              tabunganId,
              posId: sysPocket.id,
              jenis: 'masuk',
              nominal: autoAllocResult.unallocatedNominal,
              tanggal: timestamp,
              kategoriId: kategoriId || undefined,
              catatan: `[Bagi Otomatis: Sisa] ${catatan ? catatan + ' - ' : ''}Belum dialokasikan`,
              lampiranFoto: fotoStruk,
            });
            createdTxs.push(unallocTx);
          }

          showToast({
            type: 'success',
            message: `Pemasukan ${formatRupiah(nominal)} berhasil dibagi ke ${createdTxs.length} pos.`,
          });
        } else if (incomeMode === 'manual') {
          if (manualSplits.length === 0) {
            showToast({ type: 'warning', message: 'Tentukan pembagian pos manual terlebih dahulu' });
            return;
          }
          if (manualSplitRemainder !== 0) {
            showToast({
              type: 'warning',
              message: `Total alokasi (${formatRupiah(manualSplitSum)}) harus tepat sama dengan total nominal (${formatRupiah(nominal)}).`,
            });
            return;
          }

          const createdTxs: Transaction[] = [];
          for (const split of manualSplits) {
            const p = accountPockets.find((pk) => pk.id === split.posId);
            const subTx = await repository.createTransaction({
              tabunganId,
              posId: split.posId,
              jenis: 'masuk',
              nominal: split.nominal,
              tanggal: timestamp,
              kategoriId: kategoriId || undefined,
              catatan: `[Bagi Manual] ${catatan ? catatan + ' - ' : ''}Pos ${p?.nama || ''}`,
              lampiranFoto: fotoStruk,
            });
            createdTxs.push(subTx);
          }

          showToast({
            type: 'success',
            message: `Pemasukan ${formatRupiah(nominal)} berhasil dibagi ke ${createdTxs.length} pos.`,
          });
        }
      } else if (actionType === 'expense') {
        // Check overall wallet overdrawn
        if (!overdrawnWarning) {
          const allTxs = await repository.getTransactions();
          const targetAcc = accounts.find((a) => a.id === tabunganId);
          const currentBal = calculateAccountBalance(targetAcc?.saldoAwal || 0, allTxs, tabunganId);
          const check = checkOverdrawnWarning(currentBal, nominal);

          if (check.isOverdrawn) {
            setOverdrawnWarning(
              `Saldo seluruh tabungan (${formatRupiah(currentBal)}) tidak mencukupi untuk pengeluaran ${formatRupiah(
                nominal
              )}. Saldo akan menjadi negatif (${formatRupiah(check.projectedBalance)}). Tetap lanjutkan?`
            );
            return;
          }
        }

        const tx = await repository.createTransaction({
          tabunganId,
          posId: posId || sysPocket?.id,
          jenis: 'keluar',
          nominal,
          tanggal: `${tanggal}T${new Date().toTimeString().slice(0, 8)}Z`,
          kategoriId: kategoriId || undefined,
          catatan: catatan.trim() || undefined,
          lampiranFoto: fotoStruk,
        });

        showUndoToast(`Berhasil mencatat pengeluaran ${formatRupiah(nominal)}`, async () => {
          await repository.deleteTransaction(tx.id);
          onSuccess();
        });
      } else if (actionType === 'transfer') {
        if (tabunganId === targetTabunganId) {
          showToast({ type: 'warning', message: 'Tabungan asal dan tujuan tidak boleh sama' });
          return;
        }

        const tx = await repository.createTransfer(
          tabunganId,
          targetTabunganId,
          nominal,
          `${tanggal}T${new Date().toTimeString().slice(0, 8)}Z`,
          catatan.trim() || undefined,
          posId || sysPocket?.id,
          targetPosId || targetSysPocket?.id
        );

        showUndoToast(`Berhasil transfer ${formatRupiah(nominal)}`, async () => {
          await repository.deleteTransaction(tx.id);
          onSuccess();
        });
      } else if (actionType === 'debt') {
        let finalPersonId = orangId;
        if (!finalPersonId && newPersonName.trim()) {
          const p = await repository.createPerson(newPersonName.trim());
          finalPersonId = p.id;
        }

        if (!finalPersonId) {
          showToast({ type: 'warning', message: 'Tentukan orang / kontak yang berutang' });
          return;
        }

        const walletAcc = tautkanTabungan ? accounts.find((a) => a.id === tabunganId) : undefined;

        const debt = await repository.createDebt(
          {
            orangId: finalPersonId,
            arah: arahUtang,
            pokok: nominal,
            tanggal: `${tanggal}T${new Date().toTimeString().slice(0, 8)}Z`,
            jatuhTempo: jatuhTempo ? `${jatuhTempo}T23:59:59Z` : undefined,
            catatan: catatan.trim() || undefined,
            tautanTabunganId: tautkanTabungan ? tabunganId : undefined,
          },
          walletAcc
        );

        showToast({
          type: 'success',
          message:
            debt.arah === 'piutang'
              ? `Berhasil mencatat piutang ${formatRupiah(nominal)}`
              : `Berhasil mencatat utang ${formatRupiah(nominal)}`,
        });
      }

      resetForm();
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan transaksi';
      showToast({ type: 'warning', message: msg });
    }
  };

  const getTitle = () => {
    switch (actionType) {
      case 'income':
        return 'Catat Saldo Masuk';
      case 'expense':
        return 'Catat Saldo Keluar';
      case 'transfer':
        return 'Transfer Antar Tabungan';
      case 'debt':
        return 'Tambah Catatan Utang / Piutang';
    }
  };

  const pocketMap = new Map<string, Pocket>(pockets.map((p) => [p.id, p]));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nominal Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Nominal Uang
          </label>
          <CurrencyInput value={nominal} onChange={setNominal} autoFocus />
        </div>

        {/* Tabungan / Dompet Selection */}
        {actionType !== 'debt' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {actionType === 'transfer' ? 'Tabungan Asal' : 'Tabungan / Dompet'}
              </label>
              <select
                value={tabunganId}
                onChange={(e) => setTabunganId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Pos Tabungan Selection for Expense or Single Income */}
            {(actionType === 'expense' || (actionType === 'income' && incomeMode === 'single')) && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Pos Tabungan (Amplop)
                </label>
                <select
                  value={posId}
                  onChange={(e) => setPosId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
                >
                  {accountPockets.map((p) => {
                    const b = currentAcc ? calculatePocketBalance(p, currentAcc, transactions) : 0;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.nama} ({formatRupiah(b)})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Transfer target account and pockets */}
            {actionType === 'transfer' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tabungan Tujuan
                </label>
                <select
                  value={targetTabunganId}
                  onChange={(e) => setTargetTabunganId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
                >
                  {accounts
                    .filter((a) => a.id !== tabunganId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nama}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Transfer Pos Asal & Pos Tujuan Rows */}
        {actionType === 'transfer' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pos Asal
              </label>
              <select
                value={posId}
                onChange={(e) => setPosId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs"
              >
                {accountPockets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pos Tujuan
              </label>
              <select
                value={targetPosId}
                onChange={(e) => setTargetPosId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs"
              >
                {targetAccountPockets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* INCOME: Mode Allocation Switcher */}
        {actionType === 'income' && accountPockets.length > 1 && (
          <div className="space-y-3 p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <Split className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Alokasi Pos Tabungan</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
              <button
                type="button"
                onClick={() => setIncomeMode('single')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  incomeMode === 'single'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Satu Pos
              </button>
              <button
                type="button"
                disabled={accountRules.length === 0}
                onClick={() => setIncomeMode('auto')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  incomeMode === 'auto'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40'
                }`}
                title={accountRules.length === 0 ? 'Buat aturan bagi di Pengaturan terlebih dahulu' : ''}
              >
                Bagi Otomatis
              </button>
              <button
                type="button"
                onClick={() => {
                  setIncomeMode('manual');
                  if (manualSplits.length === 0) {
                    setManualSplits([{ posId: sysPocket?.id || accountPockets[0].id, nominal }]);
                  }
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  incomeMode === 'manual'
                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                Bagi Manual
              </button>
            </div>

            {/* Mode Auto: Choose rule and preview */}
            {incomeMode === 'auto' && (
              <div className="space-y-2 pt-1 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pilih Aturan Bagi Otomatis:
                  </label>
                  <select
                    value={selectedRuleId}
                    onChange={(e) => setSelectedRuleId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-medium"
                  >
                    {accountRules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nama} ({r.items.length} Pos)
                      </option>
                    ))}
                  </select>
                </div>

                {autoAllocResult && (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-emerald-200 dark:border-emerald-800/50 space-y-1">
                    <span className="block text-[11px] font-bold text-slate-500 mb-1">
                      Hasil Pembagian ({formatRupiah(nominal)}):
                    </span>
                    {autoAllocResult.allocations.map((a, i) => {
                      const p = pocketMap.get(a.posId);
                      return (
                        <div key={i} className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400">{p?.nama || 'Pos'}</span>
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {formatRupiah(a.nominal)}
                          </strong>
                        </div>
                      );
                    })}
                    {autoAllocResult.unallocatedNominal > 0 && (
                      <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-100 dark:border-slate-700">
                        <span className="text-slate-500">Sisa ke Belum dialokasikan</span>
                        <strong className="text-slate-800 dark:text-slate-200">
                          {formatRupiah(autoAllocResult.unallocatedNominal)}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mode Manual: Add split rows */}
            {incomeMode === 'manual' && (
              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Alokasikan per Pos:
                  </span>
                  <button
                    type="button"
                    onClick={handleAddManualSplit}
                    className="text-[11px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Pos</span>
                  </button>
                </div>

                {manualSplits.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={item.posId}
                      onChange={(e) => handleUpdateManualSplit(idx, { posId: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                    >
                      {accountPockets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama}
                        </option>
                      ))}
                    </select>
                    <div className="w-32">
                      <CurrencyInput
                        value={item.nominal}
                        onChange={(val) => handleUpdateManualSplit(idx, { nominal: val })}
                        placeholder="Rp0"
                      />
                    </div>
                    {manualSplits.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveManualSplit(idx)}
                        className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                <div className="flex justify-between items-center text-[11px] pt-1 text-slate-600 dark:text-slate-400">
                  <span>Total dialokasikan: <strong>{formatRupiah(manualSplitSum)}</strong></span>
                  <span className={manualSplitRemainder === 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                    {manualSplitRemainder === 0
                      ? '✓ Pas Sesuai Nominal'
                      : `Selisih: ${formatRupiah(manualSplitRemainder)}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EXPENSE WARNING: Pocket Overdraft & Monthly Limit */}
        {actionType === 'expense' && selectedPocket && (
          <div className="space-y-1.5 text-xs">
            {pocketOverdraft.isOverdrawn && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Saldo Pos Tidak Mencukupi: </span>
                  <span>
                    Saldo saat ini di pos "{selectedPocket.nama}" ({formatRupiah(pocketBal)}) lebih kecil dari pengeluaran {formatRupiah(nominal)} (kurang {formatRupiah(pocketOverdraft.shortfall)}). Saldo pos akan menjadi minus.
                  </span>
                </div>
              </div>
            )}

            {pocketLimitStatus && pocketLimitStatus.limit > 0 && (
              <div
                className={`flex items-start gap-2 p-2.5 rounded-xl border ${
                  pocketLimitStatus.isOverLimit
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    : pocketLimitStatus.isNearLimit
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                    : 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                }`}
              >
                <BookmarkCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Batas Bulanan Pos: </span>
                  <span>
                    Pengeluaran bulan ini {formatRupiah(pocketLimitStatus.currentExpense)} dari batas {formatRupiah(pocketLimitStatus.limit)} ({pocketLimitStatus.percentUsed}%).
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Category & Date Row */}
        {actionType !== 'debt' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {actionType !== 'transfer' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Kategori
                </label>
                <select
                  value={kategoriId}
                  onChange={(e) => setKategoriId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
                >
                  <option value="">Pilih Kategori (Opsional)</option>
                  {categories
                    .filter((c) => (actionType === 'income' ? c.jenis === 'masuk' : c.jenis === 'keluar'))
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nama}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className={actionType === 'transfer' ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tanggal Transaksi
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* For Debt Section */}
        {actionType === 'debt' && (
          <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Arah Utang
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setArahUtang('piutang')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    arahUtang === 'piutang'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Orang Berutang ke Saya (Piutang)
                </button>
                <button
                  type="button"
                  onClick={() => setArahUtang('utang')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    arahUtang === 'utang'
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Saya Berutang ke Orang
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Nama Orang / Kontak
              </label>
              {people.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={orangId}
                    onChange={(e) => setOrangId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama}
                      </option>
                    ))}
                    <option value="">+ Tambah Orang Baru...</option>
                  </select>

                  {!orangId && (
                    <input
                      type="text"
                      placeholder="Ketik nama orang baru..."
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Ketik nama orang / kontak..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tanggal Pencatatan
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Jatuh Tempo (Opsional)
                </label>
                <input
                  type="date"
                  value={jatuhTempo}
                  onChange={(e) => setJatuhTempo(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm"
                />
              </div>
            </div>

            {/* Wallet linking toggle */}
            {accounts.length > 0 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={tautkanTabungan}
                    onChange={(e) => setTautkanTabungan(e.target.checked)}
                    className="w-4 h-4 accent-[var(--color-primary)] rounded"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tautkan ke Saldo Tabungan (Uang Nyata Berpindah)
                  </span>
                </label>

                {tautkanTabungan && (
                  <select
                    value={tabunganId}
                    onChange={(e) => setTabunganId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nama} ({arahUtang === 'piutang' ? 'Uang keluar dari sini' : 'Uang masuk ke sini'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        {/* Catatan "dipakai untuk apa" */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Catatan / Digunakan Untuk Apa
          </label>
          <input
            type="text"
            placeholder="Contoh: Belanja mingguan, Makan siang kantor, Gaji freelance"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* Lampiran Foto Struk (Opsional) */}
        {actionType !== 'debt' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Lampiran Foto Struk / Bukti (Opsional)
            </label>
            {fotoStruk ? (
              <div className="relative inline-block">
                <img
                  src={fotoStruk}
                  alt="Struk"
                  className="w-24 h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setFotoStruk(undefined)}
                  className="absolute -top-1.5 -right-1.5 p-1 bg-rose-500 text-white rounded-full shadow-md cursor-pointer hover:bg-rose-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Unggah Foto Struk</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}

        {/* Overdrawn confirmation alert */}
        {overdrawnWarning && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Konfirmasi Saldo Minus</span>
            </div>
            <p>{overdrawnWarning}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <SoundButton variant="ghost" onClick={onClose}>
            Batal
          </SoundButton>
          <SoundButton type="submit">
            {overdrawnWarning ? 'Tetap Simpan Transaksi' : 'Simpan Transaksi'}
          </SoundButton>
        </div>
      </form>
    </Modal>
  );
};
