import React, { useState } from 'react';
import { ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { CurrencyInput } from '../../components/CurrencyInput';
import { SoundButton } from '../../components/SoundButton';
import { Account, Pocket, Transaction } from '../../domain/types';
import { calculatePocketBalance, formatRupiah, toIntegerRupiah } from '../../domain/accounting';
import { repository } from '../../db/repository';
import { useToast } from '../../context/ToastContext';

interface MovePocketFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account;
  pockets: Pocket[];
  transactions: Transaction[];
  initialSourcePosId?: string;
  onSuccess: () => void;
}

export const MovePocketFundsModal: React.FC<MovePocketFundsModalProps> = ({
  isOpen,
  onClose,
  account,
  pockets,
  transactions,
  initialSourcePosId,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const accountPockets = pockets.filter((p) => p.tabunganId === account.id && !p.isDeleted);
  const sysPocket = accountPockets.find((p) => p.isSystem) || accountPockets[0];

  const [sourcePosId, setSourcePosId] = useState<string>(
    initialSourcePosId || sysPocket?.id || ''
  );
  const [targetPosId, setTargetPosId] = useState<string>(
    accountPockets.find((p) => p.id !== (initialSourcePosId || sysPocket?.id))?.id || ''
  );
  const [nominal, setNominal] = useState<number>(0);
  const [tanggal, setTanggal] = useState<string>(new Date().toISOString().slice(0, 10));
  const [catatan, setCatatan] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const sourcePocket = accountPockets.find((p) => p.id === sourcePosId);
  const sourceBalance = sourcePocket
    ? calculatePocketBalance(sourcePocket, account, transactions)
    : 0;

  const isOverdrawn = nominal > sourceBalance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourcePosId || !targetPosId) {
      showToast({ type: 'warning', message: 'Pilih pos asal dan pos tujuan.' });
      return;
    }
    if (sourcePosId === targetPosId) {
      showToast({ type: 'warning', message: 'Pos asal dan pos tujuan tidak boleh sama.' });
      return;
    }
    const cleanNominal = toIntegerRupiah(nominal);
    if (cleanNominal <= 0) {
      showToast({ type: 'warning', message: 'Nominal pemindahan harus lebih dari nol.' });
      return;
    }

    try {
      setIsSubmitting(true);
      await repository.moveFundsBetweenPockets(
        account.id,
        sourcePosId,
        targetPosId,
        cleanNominal,
        tanggal,
        catatan.trim() || undefined
      );

      showToast({
        type: 'success',
        message: `Berhasil memindahkan ${formatRupiah(cleanNominal)} antar pos.`,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memindahkan dana.';
      showToast({ type: 'warning', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pindah Dana Antar Pos" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Pemindahan dana antar pos dalam tabungan <strong>{account.nama}</strong>. Transaksi ini netral (tidak dihitung sebagai pemasukan atau pengeluaran).
        </p>

        {/* Source Pocket */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Pos Asal (Sumber Dana)
          </label>
          <select
            value={sourcePosId}
            onChange={(e) => setSourcePosId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {accountPockets.map((p) => {
              const bal = calculatePocketBalance(p, account, transactions);
              return (
                <option key={p.id} value={p.id}>
                  {p.nama} ({formatRupiah(bal)})
                </option>
              );
            })}
          </select>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Saldo tersedia di pos asal: <strong>{formatRupiah(sourceBalance)}</strong>
          </span>
        </div>

        {/* Target Pocket */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Pos Tujuan
          </label>
          <select
            value={targetPosId}
            onChange={(e) => setTargetPosId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {accountPockets
              .filter((p) => p.id !== sourcePosId)
              .map((p) => {
                const bal = calculatePocketBalance(p, account, transactions);
                return (
                  <option key={p.id} value={p.id}>
                    {p.nama} ({formatRupiah(bal)})
                  </option>
                );
              })}
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Nominal Pindah Dana
          </label>
          <CurrencyInput value={nominal} onChange={setNominal} placeholder="Rp0" />
          {isOverdrawn && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1.5 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Nominal pemindahan melebihi saldo saat ini di pos asal. Saldo pos asal akan menjadi minus.</span>
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Tanggal
          </label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Catatan (Opsional)
          </label>
          <input
            type="text"
            placeholder="Alasan pemindahan dana..."
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <SoundButton variant="ghost" onClick={onClose} disabled={isSubmitting}>
            <span>Batal</span>
          </SoundButton>
          <SoundButton type="submit" disabled={isSubmitting || nominal <= 0}>
            <ArrowLeftRight className="w-4 h-4" />
            <span>{isSubmitting ? 'Memproses...' : 'Pindahkan Dana'}</span>
          </SoundButton>
        </div>
      </form>
    </Modal>
  );
};
