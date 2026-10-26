import React, { useState } from 'react';
import {
  AlertTriangle,
  Upload,
  X,
} from 'lucide-react';
import { Modal } from './Modal';
import { CurrencyInput } from './CurrencyInput';
import { SoundButton } from './SoundButton';
import { Account, Category, Person } from '../domain/types';
import { repository } from '../db/repository';
import { useToast } from '../context/ToastContext';
import { calculateAccountBalance, checkOverdrawnWarning, formatRupiah } from '../domain/accounting';

interface QuickActionModalProps {
  isOpen: boolean;
  actionType: 'income' | 'expense' | 'transfer' | 'debt';
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  people: Person[];
  onSuccess: () => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({
  isOpen,
  actionType,
  onClose,
  accounts,
  categories,
  people,
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

  // For debt
  const [orangId, setOrangId] = useState(people[0]?.id || '');
  const [newPersonName, setNewPersonName] = useState('');
  const [arahUtang, setArahUtang] = useState<'piutang' | 'utang'>('piutang');
  const [jatuhTempo, setJatuhTempo] = useState('');
  const [tautkanTabungan, setTautkanTabungan] = useState(false);

  // Overdrawn warning
  const [overdrawnWarning, setOverdrawnWarning] = useState<string | null>(null);

  const resetForm = () => {
    setNominal(0);
    setCatatan('');
    setFotoStruk(undefined);
    setOverdrawnWarning(null);
    setNewPersonName('');
    setTautkanTabungan(false);
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
        const tx = await repository.createTransaction({
          tabunganId,
          jenis: 'masuk',
          nominal,
          tanggal: `${tanggal}T${new Date().toTimeString().slice(0, 8)}Z`,
          kategoriId: kategoriId || undefined,
          catatan: catatan.trim() || undefined,
          lampiranFoto: fotoStruk,
        });

        showUndoToast(`Berhasil mencatat pemasukan ${formatRupiah(nominal)}`, async () => {
          await repository.deleteTransaction(tx.id);
          onSuccess();
        });
      } else if (actionType === 'expense') {
        // Check overdrawn balance
        if (!overdrawnWarning) {
          const allTxs = await repository.getTransactions();
          const targetAcc = accounts.find((a) => a.id === tabunganId);
          const currentBal = calculateAccountBalance(targetAcc?.saldoAwal || 0, allTxs, tabunganId);
          const check = checkOverdrawnWarning(currentBal, nominal);

          if (check.isOverdrawn) {
            setOverdrawnWarning(
              `Saldo saat ini (${formatRupiah(currentBal)}) tidak mencukupi untuk pengeluaran ${formatRupiah(
                nominal
              )}. Saldo akan menjadi negatif (${formatRupiah(check.projectedBalance)}). Tetap lanjutkan?`
            );
            return;
          }
        }

        const tx = await repository.createTransaction({
          tabunganId,
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
          catatan.trim() || undefined
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

        showUndoToast(`Berhasil mencatat utang ${formatRupiah(nominal)}`, async () => {
          await repository.deleteDebt(debt.id);
          onSuccess();
        });
      }

      resetForm();
      onClose();
      onSuccess();
    } catch (err: unknown) {
      showToast({ type: 'warning', message: (err as Error).message });
    }
  };

  const titleMap = {
    income: 'Catat Saldo Masuk',
    expense: 'Catat Saldo Keluar',
    transfer: 'Transfer Antar Tabungan',
    debt: 'Catat Utang Baru',
  };

  const filteredCategories = categories.filter((c) =>
    actionType === 'income' ? c.jenis === 'masuk' : c.jenis === 'keluar'
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titleMap[actionType]}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nominal input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Nominal
          </label>
          <CurrencyInput
            value={nominal}
            onChange={setNominal}
            placeholder="Rp0"
            autoFocus
          />
        </div>

        {/* Overdrawn warning banner if triggered */}
        {overdrawnWarning && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Peringatan Saldo Negatif</p>
              <p>{overdrawnWarning}</p>
            </div>
          </div>
        )}

        {/* Tabungan selector */}
        {actionType !== 'debt' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tabungan {actionType === 'transfer' ? 'Asal' : ''}
            </label>
            <select
              value={tabunganId}
              onChange={(e) => setTabunganId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.nama}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Transfer destination */}
        {actionType === 'transfer' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tabungan Tujuan
            </label>
            <select
              value={targetTabunganId}
              onChange={(e) => setTargetTabunganId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.nama}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Category selector for income / expense */}
        {(actionType === 'income' || actionType === 'expense') && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Kategori
            </label>
            <select
              value={kategoriId}
              onChange={(e) => setKategoriId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
            >
              <option value="">(Tanpa Kategori / Umum)</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Debt-specific fields */}
        {actionType === 'debt' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Arah Utang
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setArahUtang('piutang')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                    arahUtang === 'piutang'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Orang Berutang ke Saya (Piutang)
                </button>
                <button
                  type="button"
                  onClick={() => setArahUtang('utang')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                    arahUtang === 'utang'
                      ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                      : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Saya Berutang ke Orang (Utang)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kontak / Orang
              </label>
              {people.length > 0 ? (
                <select
                  value={orangId}
                  onChange={(e) => setOrangId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium mb-2"
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Nama kontak baru..."
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium mb-2"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Jatuh Tempo (Opsional)
              </label>
              <input
                type="date"
                value={jatuhTempo}
                onChange={(e) => setJatuhTempo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
              />
            </div>

            {/* Wallet linking toggle */}
            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-medium">
              <input
                type="checkbox"
                checked={tautkanTabungan}
                onChange={(e) => setTautkanTabungan(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-primary)]"
              />
              <span>
                Tautkan transaksi ke tabungan (
                {arahUtang === 'piutang' ? 'potong saldo tabungan' : 'tambah saldo tabungan'})
              </span>
            </label>

            {tautkanTabungan && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tabungan Terkait
                </label>
                <select
                  value={tabunganId}
                  onChange={(e) => setTabunganId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nama}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Tanggal
          </label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
          />
        </div>

        {/* Notes ("dipakai untuk apa") */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Catatan / Keterangan (Dipakai untuk apa)
          </label>
          <input
            type="text"
            placeholder="Contoh: Belanja mingguan, Makan siang, Pinjam modal"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
          />
        </div>

        {/* Photo receipt attachment */}
        {actionType !== 'debt' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Foto Struk / Lampiran (Opsional)
            </label>
            {fotoStruk ? (
              <div className="relative inline-block mt-1">
                <img
                  src={fotoStruk}
                  alt="Struk"
                  className="w-20 h-20 object-cover rounded-xl border border-slate-300 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setFotoStruk(undefined)}
                  className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 text-white rounded-full shadow-md"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-500 hover:border-[var(--color-primary)] cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Upload Foto Struk (Maks 2MB)</span>
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

        <div className="flex gap-2 pt-2">
          <SoundButton
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Batal
          </SoundButton>
          <SoundButton type="submit" className="flex-1" sound="success">
            {overdrawnWarning ? 'Tetap Simpan' : 'Simpan'}
          </SoundButton>
        </div>
      </form>
    </Modal>
  );
};
