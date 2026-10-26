import React, { useState } from 'react';
import {
  Repeat,
  Plus,
  Play,
  Trash2,
  Info,
} from 'lucide-react';
import {
  Account,
  AppSettings,
  Category,
  RecurringFrequency,
  RecurringTransaction,
} from '../../domain/types';
import { formatRupiah } from '../../domain/accounting';
import { SoundButton } from '../../components/SoundButton';
import { Modal } from '../../components/Modal';
import { CurrencyInput } from '../../components/CurrencyInput';
import { repository } from '../../db/repository';
import { useToast } from '../../context/ToastContext';

interface RecurringPageProps {
  settings: AppSettings;
  recurring: RecurringTransaction[];
  accounts: Account[];
  categories: Category[];
  onRefresh: () => void;
}

export const RecurringPage: React.FC<RecurringPageProps> = ({
  settings,
  recurring,
  accounts,
  categories,
  onRefresh,
}) => {
  const { showToast, showUndoToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [jenis, setJenis] = useState<'masuk' | 'keluar'>('keluar');
  const [nominal, setNominal] = useState(0);
  const [frekuensi, setFrekuensi] = useState<RecurringFrequency>('bulanan');
  const [tabunganId, setTabunganId] = useState(accounts[0]?.id || '');
  const [kategoriId] = useState('');
  const [catatan, setCatatan] = useState('');

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nominal <= 0) {
      showToast({ type: 'warning', message: 'Nominal harus lebih dari Rp0' });
      return;
    }
    if (!catatan.trim()) {
      showToast({ type: 'warning', message: 'Catatan template wajib diisi' });
      return;
    }

    await repository.createRecurringTransaction({
      jenis,
      nominal,
      frekuensi,
      tanggalMulai: new Date().toISOString(),
      tabunganId,
      kategoriId: kategoriId || undefined,
      catatan: catatan.trim(),
      aktif: true,
    });

    showToast({ type: 'success', message: 'Template transaksi berulang berhasil dibuat' });
    setModalOpen(false);
    setNominal(0);
    setCatatan('');
    onRefresh();
  };

  /**
   * AGENTS.md Principle: Does NOT record transactions silently in the background!
   * Requires explicit user confirmation button.
   */
  const handleExecuteRecurring = async (item: RecurringTransaction) => {
    const tx = await repository.createTransaction({
      tabunganId: item.tabunganId,
      jenis: item.jenis,
      nominal: item.nominal,
      tanggal: new Date().toISOString(),
      kategoriId: item.kategoriId,
      catatan: `${item.catatan} (Jadwal Berulang: ${item.frekuensi})`,
    });

    showUndoToast(
      `Transaksi ${item.jenis} ${formatRupiah(item.nominal)} berhasil dicatat`,
      async () => {
        await repository.deleteTransaction(tx.id);
        onRefresh();
      }
    );
    onRefresh();
  };

  const handleDelete = async (item: RecurringTransaction) => {
    await repository.deleteRecurringTransaction(item.id);
    showToast({ type: 'info', message: 'Template transaksi berulang dihapus' });
    onRefresh();
  };

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Transaksi Berulang & Jadwal
          </h1>
          <p className="text-xs text-slate-500">
            Template rutin dengan konfirmasi sebelum dicatat (tanpa auto-debet diam-diam)
          </p>
        </div>

        <SoundButton size="sm" sound="click" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Buat Jadwal</span>
        </SoundButton>
      </div>

      {/* Honest Limitation Banner */}
      <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-800 dark:text-sky-200 flex items-start gap-3">
        <Info className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Penjelasan Batasan Notifikasi:</p>
          <p className="leading-relaxed">
            Karena aplikasi ini 100% offline tanpa server, notifikasi lokal browser hanya dapat
            muncul saat aplikasi sedang dibuka atau aktif di latar belakang. Nubung Yuk selalu
            meminta konfirmasi Anda sebelum mencatat transaksi berulang agar saldo Anda tetap akurat.
          </p>
        </div>
      </div>

      {recurring.length > 0 ? (
        <div className="space-y-3">
          {recurring.map((item) => {
            const acc = accMap.get(item.tabunganId);
            const cat = item.kategoriId ? catMap.get(item.kategoriId) : null;

            return (
              <div
                key={item.id}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                      item.jenis === 'masuk'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-rose-500/10 text-rose-600'
                    }`}
                  >
                    <Repeat className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {item.catatan}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 uppercase">
                        {item.frekuensi}
                      </span>
                    </div>

                    <span className="text-xs text-slate-500 block mt-0.5">
                      {acc?.nama} {cat ? `• ${cat.nama}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {formatRupiah(item.nominal, settings.privacyMode)}
                  </span>

                  <SoundButton
                    size="sm"
                    sound="success"
                    onClick={() => handleExecuteRecurring(item)}
                    title="Catat Sekarang"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span className="hidden sm:inline">Catat</span>
                  </SoundButton>

                  <button
                    onClick={() => handleDelete(item)}
                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
          <Repeat className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Belum ada jadwal transaksi berulang
          </p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Buat template untuk gaji bulanan, langganan internet, tagihan listrik, atau uang saku.
          </p>
          <SoundButton size="sm" onClick={() => setModalOpen(true)}>
            Buat Jadwal Baru
          </SoundButton>
        </div>
      )}

      {/* Modal create recurring */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Buat Transaksi Berulang"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Jenis
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setJenis('masuk')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                  jenis === 'masuk'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                    : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                Pemasukan Berulang
              </button>
              <button
                type="button"
                onClick={() => setJenis('keluar')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                  jenis === 'keluar'
                    ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                    : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                Pengeluaran Berulang
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Frekuensi
            </label>
            <select
              value={frekuensi}
              onChange={(e) => setFrekuensi(e.target.value as RecurringFrequency)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
            >
              <option value="harian">Harian</option>
              <option value="mingguan">Mingguan</option>
              <option value="bulanan">Bulanan</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nominal
            </label>
            <CurrencyInput value={nominal} onChange={setNominal} placeholder="Rp0" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Keterangan Template
            </label>
            <input
              type="text"
              placeholder="Contoh: Langganan WiFi, Gaji Bulanan"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
            />
          </div>

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

          <div className="flex gap-2 pt-2">
            <SoundButton
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              className="flex-1"
            >
              Batal
            </SoundButton>
            <SoundButton type="submit" className="flex-1" sound="success">
              Simpan Template
            </SoundButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};
