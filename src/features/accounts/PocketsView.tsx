import React, { useState } from 'react';
import {
  Layers,
  Plus,
  ArrowLeftRight,
  Edit2,
  Trash2,
  ArchiveRestore,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Info,
  Sparkles,
  Inbox,
  Target,
  BookmarkCheck,
  Check,
} from 'lucide-react';
import { Account, AppSettings, Pocket, Transaction } from '../../domain/types';
import {
  calculatePocketBalance,
  checkPocketMonthlyLimit,
  formatRupiah,
  verifyPocketInvariant,
} from '../../domain/accounting';
import { SoundButton } from '../../components/SoundButton';
import { Modal } from '../../components/Modal';
import { CurrencyInput } from '../../components/CurrencyInput';
import { MovePocketFundsModal } from './MovePocketFundsModal';
import { repository } from '../../db/repository';
import { useToast } from '../../context/ToastContext';

interface PocketsViewProps {
  settings: AppSettings;
  accounts: Account[];
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
  pockets: Pocket[];
  transactions: Transaction[];
  onRefresh: () => void;
}

export const PocketsView: React.FC<PocketsViewProps> = ({
  settings,
  accounts,
  selectedAccountId,
  onSelectAccount,
  pockets,
  transactions,
  onRefresh,
}) => {
  const { showToast, showUndoToast } = useToast();

  const currentAccount =
    accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  // Modals state
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [selectedSourcePosId, setSelectedSourcePosId] = useState<string | undefined>(undefined);

  // Pocket form modal (add/edit)
  const [pocketModalOpen, setPocketModalOpen] = useState(false);
  const [editingPocket, setEditingPocket] = useState<Pocket | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#0d9488');
  const [formMonthlyLimit, setFormMonthlyLimit] = useState<number>(0);
  const [formTarget, setFormTarget] = useState<number>(0);

  // Delete pocket with balance transfer modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pocketToDelete, setPocketToDelete] = useState<Pocket | null>(null);
  const [transferTargetPosId, setTransferTargetPosId] = useState<string>('');

  if (!currentAccount) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
        <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Belum ada tabungan aktif</p>
        <p className="text-xs text-slate-500 mt-1">Buat tabungan terlebih dahulu untuk mulai membagi saldo ke pos amplop.</p>
      </div>
    );
  }

  const accountPockets = pockets
    .filter((p) => p.tabunganId === currentAccount.id && !p.isDeleted)
    .sort((a, b) => a.urutan - b.urutan);

  const sysPocket = accountPockets.find((p) => p.isSystem);
  const userPockets = accountPockets.filter((p) => !p.isSystem);

  const unallocatedBalance = sysPocket
    ? calculatePocketBalance(sysPocket, currentAccount, transactions)
    : 0;

  // Invariant check
  const invariant = verifyPocketInvariant(currentAccount, accountPockets, transactions);

  const openAddPocket = () => {
    setEditingPocket(null);
    setFormName('');
    setFormColor('#0d9488');
    setFormMonthlyLimit(0);
    setFormTarget(0);
    setPocketModalOpen(true);
  };

  const openEditPocket = (pocket: Pocket) => {
    setEditingPocket(pocket);
    setFormName(pocket.nama);
    setFormColor(pocket.warna || '#0d9488');
    setFormMonthlyLimit(pocket.batasBulanan || 0);
    setFormTarget(pocket.target || 0);
    setPocketModalOpen(true);
  };

  const handleSavePocket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast({ type: 'warning', message: 'Nama pos tidak boleh kosong' });
      return;
    }

    try {
      if (editingPocket) {
        await repository.updatePocket(editingPocket.id, {
          nama: formName.trim(),
          warna: formColor,
          batasBulanan: formMonthlyLimit > 0 ? formMonthlyLimit : undefined,
          target: formTarget > 0 ? formTarget : undefined,
        });
        showToast({ type: 'success', message: `Pos "${formName}" berhasil diperbarui.` });
      } else {
        await repository.createPocket({
          tabunganId: currentAccount.id,
          nama: formName.trim(),
          ikon: 'Layers',
          warna: formColor,
          batasBulanan: formMonthlyLimit > 0 ? formMonthlyLimit : undefined,
          target: formTarget > 0 ? formTarget : undefined,
          urutan: userPockets.length + 1,
          diarsipkan: false,
        });
        showToast({ type: 'success', message: `Pos "${formName}" berhasil dibuat.` });
      }
      setPocketModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pos.';
      showToast({ type: 'warning', message: msg });
    }
  };

  const handleReorder = async (pocketId: string, direction: 'up' | 'down') => {
    const ids = userPockets.map((p) => p.id);
    const idx = ids.indexOf(pocketId);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      const temp = ids[idx];
      ids[idx] = ids[idx - 1];
      ids[idx - 1] = temp;
    } else if (direction === 'down' && idx < ids.length - 1) {
      const temp = ids[idx];
      ids[idx] = ids[idx + 1];
      ids[idx + 1] = temp;
    } else {
      return;
    }

    await repository.reorderPockets(currentAccount.id, ids);
    onRefresh();
  };

  const handleToggleArchive = async (pocket: Pocket) => {
    const bal = calculatePocketBalance(pocket, currentAccount, transactions);
    try {
      await repository.archivePocket(pocket.id, bal);
      showToast({
        type: 'info',
        message: pocket.diarsipkan
          ? `Pos "${pocket.nama}" diaktifkan kembali.`
          : `Pos "${pocket.nama}" diarsipkan.${bal > 0 ? ' Sisa saldo dialihkan ke Belum dialokasikan.' : ''}`,
      });
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengarsipkan pos.';
      showToast({ type: 'warning', message: msg });
    }
  };

  const promptDeletePocket = (pocket: Pocket) => {
    const bal = calculatePocketBalance(pocket, currentAccount, transactions);
    setPocketToDelete(pocket);
    // Default transfer target: system pocket or another pocket
    setTransferTargetPosId(sysPocket?.id || '');
    if (bal > 0) {
      setDeleteModalOpen(true);
    } else {
      // Direct confirm if balance is 0
      executeDeletePocket(pocket, '');
    }
  };

  const executeDeletePocket = async (pocket: Pocket, targetPosId: string) => {
    const bal = calculatePocketBalance(pocket, currentAccount, transactions);
    try {
      const trashItem = await repository.deletePocket(pocket.id, bal, targetPosId);
      showUndoToast(`Pos "${pocket.nama}" dihapus.`, async () => {
        await repository.restoreFromTrash(trashItem.id);
        onRefresh();
      });
      setDeleteModalOpen(false);
      setPocketToDelete(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus pos.';
      showToast({ type: 'warning', message: msg });
    }
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="space-y-6">
      {/* Account Switcher Bar */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-2">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => onSelectAccount(acc.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                acc.id === currentAccount.id
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {acc.nama}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SoundButton
            variant="outline"
            size="sm"
            sound="click"
            onClick={() => {
              setSelectedSourcePosId(undefined);
              setMoveModalOpen(true);
            }}
          >
            <ArrowLeftRight className="w-4 h-4 text-sky-500" />
            <span>Pindah Dana</span>
          </SoundButton>

          <SoundButton size="sm" sound="click" onClick={openAddPocket}>
            <Plus className="w-4 h-4" />
            <span>Tambah Pos</span>
          </SoundButton>
        </div>
      </div>

      {/* Hero: Belum Dialokasikan Banner */}
      <div className="p-5 rounded-3xl bg-linear-to-br from-blue-700 via-indigo-700 to-pink-600 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-100 text-xs font-semibold mb-1">
              <Inbox className="w-4 h-4 text-pink-300" />
              <span>Pos Sistem: Belum Dialokasikan</span>
            </div>
            <div className="text-2xl md:text-3xl font-extrabold tracking-tight tabular-nums">
              {formatRupiah(unallocatedBalance, settings.privacyMode)}
            </div>
            <p className="text-xs text-blue-100 mt-1 max-w-md">
              Sisa saldo dari tabungan <strong>{currentAccount.nama}</strong> yang belum disisihkan ke pos kebutuhan mana pun.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {unallocatedBalance > 0 && userPockets.length > 0 && (
              <SoundButton
                variant="secondary"
                size="sm"
                sound="click"
                onClick={() => {
                  setSelectedSourcePosId(sysPocket?.id);
                  setMoveModalOpen(true);
                }}
                className="bg-white/20 text-white border border-white/30 hover:bg-white/30 backdrop-blur-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Bagi ke Pos Kebutuhan</span>
              </SoundButton>
            )}
          </div>
        </div>

        {/* Suggestion pill if unallocated balance is high */}
        {unallocatedBalance > 500000 && userPockets.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center gap-2 text-xs text-blue-100">
            <Sparkles className="w-4 h-4 shrink-0 text-pink-300" />
            <span>
              Saldo belum dialokasikan terkumpul cukup banyak. Pertimbangkan untuk membaginya ke pos target atau pos belanja Anda.
            </span>
          </div>
        )}
      </div>

      {/* Transparent Info Alert: Pos vs Anggaran Bulanan */}
      <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200/80 dark:border-sky-800/40 text-xs text-sky-800 dark:text-sky-300 leading-relaxed flex items-start gap-2.5">
        <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Hubungan Pos Tabungan dengan Anggaran: </span>
          <span>
            Pos Tabungan adalah uang riil yang disisihkan di dompet ini. Batas bulanan pos membantu mengontrol belanja langsung dari amplop tersebut tanpa menghitung saldo dua kali.
          </span>
        </div>
      </div>

      {/* Pockets Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--color-primary)]" />
            <span>Daftar Pos Kebutuhan ({userPockets.length})</span>
          </h3>

          <span className="text-[11px] text-slate-400">
            Total Pos + Belum Dialokasikan:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {formatRupiah(invariant.accountBalance, settings.privacyMode)}
            </strong>
          </span>
        </div>

        {userPockets.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Belum ada pos di tabungan ini</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
              Buat pos amplop (seperti Jajan, Transport, Darurat, atau Belanja) untuk memisahkan saldo Anda dengan rapi.
            </p>
            <SoundButton size="sm" sound="click" onClick={openAddPocket}>
              <Plus className="w-4 h-4" />
              <span>Buat Pos Pertama</span>
            </SoundButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userPockets.map((pocket, index) => {
              const balance = calculatePocketBalance(pocket, currentAccount, transactions);
              const limitStatus = checkPocketMonthlyLimit(
                pocket,
                transactions,
                currentYear,
                currentMonth
              );

              const hasTarget = pocket.target && pocket.target > 0;
              const targetProgress = hasTarget
                ? Math.min(100, Math.round((balance / pocket.target!) * 100))
                : 0;

              return (
                <div
                  key={pocket.id}
                  className={`p-4 rounded-3xl bg-white dark:bg-slate-900 border transition-all flex flex-col justify-between ${
                    pocket.diarsipkan
                      ? 'opacity-60 border-dashed border-slate-300 dark:border-slate-800'
                      : 'border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Header: Title + Reorder buttons */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: pocket.warna || '#0d9488' }}
                        />
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">
                            {pocket.nama}
                          </h4>
                          {pocket.diarsipkan && (
                            <span className="text-[10px] font-semibold text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md mt-0.5 inline-block">
                              Diarsipkan
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Up/Down buttons */}
                      <div className="flex items-center gap-0.5">
                        <button
                          disabled={index === 0}
                          onClick={() => handleReorder(pocket.id, 'up')}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                          title="Naikkan urutan"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          disabled={index === userPockets.length - 1}
                          onClick={() => handleReorder(pocket.id, 'down')}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                          title="Turunkan urutan"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="my-2">
                      <span className="block text-[11px] text-slate-400">Saldo Pos</span>
                      <span
                        className={`text-xl font-extrabold ${
                          balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {formatRupiah(balance, settings.privacyMode)}
                      </span>
                    </div>

                    {/* Monthly Limit Progress */}
                    {pocket.batasBulanan && pocket.batasBulanan > 0 && (
                      <div className="mt-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between text-[11px] mb-1 font-medium">
                          <span className="flex items-center gap-1 text-slate-500">
                            <BookmarkCheck className="w-3.5 h-3.5 text-purple-500" />
                            <span>Batas Bulan Ini</span>
                          </span>
                          <span
                            className={`font-bold ${
                              limitStatus.isOverLimit
                                ? 'text-rose-600'
                                : limitStatus.isNearLimit
                                ? 'text-amber-600'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {limitStatus.percentUsed}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              limitStatus.isOverLimit
                                ? 'bg-rose-500'
                                : limitStatus.isNearLimit
                                ? 'bg-amber-500'
                                : 'bg-purple-500'
                            }`}
                            style={{ width: `${Math.min(100, limitStatus.percentUsed)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>Keluar: {formatRupiah(limitStatus.currentExpense, settings.privacyMode)}</span>
                          <span>Batas: {formatRupiah(limitStatus.limit, settings.privacyMode)}</span>
                        </div>
                      </div>
                    )}

                    {/* Target Progress */}
                    {hasTarget && (
                      <div className="mt-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between text-[11px] mb-1 font-medium">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Target className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Target Pos</span>
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {targetProgress}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${targetProgress}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>Terkumpul: {formatRupiah(balance, settings.privacyMode)}</span>
                          <span>Target: {formatRupiah(pocket.target!, settings.privacyMode)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between gap-1 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                    <SoundButton
                      variant="ghost"
                      size="sm"
                      sound="click"
                      onClick={() => {
                        setSelectedSourcePosId(pocket.id);
                        setMoveModalOpen(true);
                      }}
                      className="text-sky-600 dark:text-sky-400 text-xs px-2"
                      title="Pindah dana dari pos ini"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>Pindah</span>
                    </SoundButton>

                    <div className="flex items-center gap-1">
                      <SoundButton
                        variant="ghost"
                        size="icon"
                        sound="click"
                        onClick={() => openEditPocket(pocket)}
                        title="Edit Pos"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                      </SoundButton>

                      <SoundButton
                        variant="ghost"
                        size="icon"
                        sound="panel"
                        onClick={() => handleToggleArchive(pocket)}
                        title={pocket.diarsipkan ? 'Buka Arsip' : 'Arsipkan Pos'}
                      >
                        <ArchiveRestore className="w-3.5 h-3.5 text-slate-500" />
                      </SoundButton>

                      <SoundButton
                        variant="ghost"
                        size="icon"
                        sound="delete"
                        onClick={() => promptDeletePocket(pocket)}
                        className="text-rose-500"
                        title="Hapus Pos"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </SoundButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pocket Create / Edit Modal */}
      <Modal
        isOpen={pocketModalOpen}
        onClose={() => setPocketModalOpen(false)}
        title={editingPocket ? 'Ubah Pos Tabungan' : 'Tambah Pos Tabungan'}
        size="md"
      >
        <form onSubmit={handleSavePocket} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Pos
            </label>
            <input
              type="text"
              placeholder="Contoh: Jajan Santai, Transportasi, Dana Darurat"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Warna Pos
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 dark:border-slate-700"
              />
              <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{formColor}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Batas Pengeluaran Bulanan (Opsional)
            </label>
            <CurrencyInput
              value={formMonthlyLimit}
              onChange={setFormMonthlyLimit}
              placeholder="Rp0 (Tidak dibatasi)"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Batas pengeluaran dari pos ini per bulan kalender.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Saldo Pos (Opsional)
            </label>
            <CurrencyInput
              value={formTarget}
              onChange={setFormTarget}
              placeholder="Rp0 (Tanpa target)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <SoundButton variant="ghost" onClick={() => setPocketModalOpen(false)}>
              <span>Batal</span>
            </SoundButton>
            <SoundButton type="submit">
              <Check className="w-4 h-4" />
              <span>{editingPocket ? 'Perbarui Pos' : 'Simpan Pos'}</span>
            </SoundButton>
          </div>
        </form>
      </Modal>

      {/* Delete Pocket Confirmation & Balance Transfer Modal */}
      {pocketToDelete && (
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          title="Konfirmasi Hapus Pos"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Pos Masih Memiliki Saldo Tersisa</span>
              </div>
              Pos <strong>"{pocketToDelete.nama}"</strong> masih memiliki sisa saldo sebesar{' '}
              <strong>
                {formatRupiah(
                  calculatePocketBalance(pocketToDelete, currentAccount, transactions),
                  settings.privacyMode
                )}
              </strong>
              . Sesuai aturan akuntansi, sisa saldo wajib dipindahkan terlebih dahulu ke pos lain atau ke "Belum dialokasikan".
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Pindahkan Sisa Saldo Ke:
              </label>
              <select
                value={transferTargetPosId}
                onChange={(e) => setTransferTargetPosId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                {accountPockets
                  .filter((p) => p.id !== pocketToDelete.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} {p.isSystem ? '(Pos Belum Dialokasikan)' : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <SoundButton variant="ghost" onClick={() => setDeleteModalOpen(false)}>
                <span>Batal</span>
              </SoundButton>
              <SoundButton
                variant="danger"
                onClick={() => executeDeletePocket(pocketToDelete, transferTargetPosId)}
              >
                <Trash2 className="w-4 h-4" />
                <span>Pindahkan Saldo & Hapus Pos</span>
              </SoundButton>
            </div>
          </div>
        </Modal>
      )}

      {/* Move Pocket Funds Modal */}
      {moveModalOpen && (
        <MovePocketFundsModal
          isOpen={moveModalOpen}
          onClose={() => setMoveModalOpen(false)}
          account={currentAccount}
          pockets={accountPockets}
          transactions={transactions}
          initialSourcePosId={selectedSourcePosId}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
};
