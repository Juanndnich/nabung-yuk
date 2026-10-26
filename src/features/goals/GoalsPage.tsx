import React, { useState } from 'react';
import { Target, Plus, CheckCircle, Trash2, Calendar } from 'lucide-react';
import { Account, AppSettings, SavingsGoal, Transaction } from '../../domain/types';
import { calculateGoalProgress, calculateAccountBalance, formatRupiah } from '../../domain/accounting';
import { SoundButton } from '../../components/SoundButton';
import { Modal } from '../../components/Modal';
import { CurrencyInput } from '../../components/CurrencyInput';
import { repository } from '../../db/repository';
import { useToast } from '../../context/ToastContext';

interface GoalsPageProps {
  settings: AppSettings;
  goals: SavingsGoal[];
  accounts: Account[];
  transactions: Transaction[];
  onRefresh: () => void;
}

export const GoalsPage: React.FC<GoalsPageProps> = ({
  settings,
  goals,
  accounts,
  transactions,
  onRefresh,
}) => {
  const { showToast, showUndoToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [namaTarget, setNamaTarget] = useState('');
  const [nominalTarget, setNominalTarget] = useState(0);
  const [tenggat, setTenggat] = useState('');
  const [tabunganId, setTabunganId] = useState(accounts[0]?.id || '');

  const totalCurrentBalance = accounts.reduce((sum, a) => {
    return sum + calculateAccountBalance(a.saldoAwal, transactions, a.id);
  }, 0);

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaTarget.trim()) {
      showToast({ type: 'warning', message: 'Nama target wajib diisi' });
      return;
    }
    if (nominalTarget <= 0) {
      showToast({ type: 'warning', message: 'Nominal target harus lebih dari Rp0' });
      return;
    }

    await repository.createSavingsGoal({
      nama: namaTarget.trim(),
      nominalTarget,
      tenggat: tenggat ? `${tenggat}T23:59:59Z` : undefined,
      tabunganId: tabunganId || undefined,
      ikon: 'Target',
      warna: '#10b981',
      tercapai: false,
    });

    showToast({ type: 'success', message: `Target "${namaTarget}" berhasil dibuat` });
    setModalOpen(false);
    setNamaTarget('');
    setNominalTarget(0);
    setTenggat('');
    onRefresh();
  };

  const handleDeleteGoal = async (g: SavingsGoal) => {
    const trash = await repository.deleteSavingsGoal(g.id);
    showUndoToast(`Target "${g.nama}" dihapus`, async () => {
      await repository.restoreFromTrash(trash.id);
      onRefresh();
    });
    onRefresh();
  };

  const handleToggleComplete = async (g: SavingsGoal) => {
    await repository.updateSavingsGoal(g.id, { tercapai: !g.tercapai });
    showToast({
      type: 'success',
      message: g.tercapai ? 'Target dikembalikan aktif' : 'Selamat! Target berhasil tercapai',
    });
    onRefresh();
  };

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Target Tabungan</h1>
          <p className="text-xs text-slate-500">Wujudkan impian finansial dengan progres terukur</p>
        </div>

        <SoundButton size="sm" sound="click" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Buat Target</span>
        </SoundButton>
      </div>

      {goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const acc = accounts.find((a) => a.id === g.tabunganId);
            const currentSavings = acc
              ? calculateAccountBalance(acc.saldoAwal, transactions, acc.id)
              : totalCurrentBalance;

            const { persen, sisaNominal, estimasiHariTercapai, statusTenggat } =
              calculateGoalProgress(g.nominalTarget, currentSavings, 25000, g.tenggat);

            return (
              <div
                key={g.id}
                className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border transition-all ${
                  g.tercapai
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {g.nama}
                      </h3>
                      <span className="text-xs text-slate-500 block">
                        {acc ? `Dari tabungan: ${acc.nama}` : 'Dari seluruh tabungan'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleComplete(g)}
                      title={g.tercapai ? 'Batal Selesai' : 'Tandai Selesai'}
                      className={`p-2 rounded-xl transition-all cursor-pointer ${
                        g.tercapai
                          ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60'
                          : 'text-slate-400 hover:text-emerald-600'
                      }`}
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(g)}
                      className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Terkumpul:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {formatRupiah(currentSavings, settings.privacyMode)} dari{' '}
                      {formatRupiah(g.nominalTarget, settings.privacyMode)}
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                      style={{ width: `${persen}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Sisa: {formatRupiah(sisaNominal, settings.privacyMode)}</span>
                    <span className="font-semibold text-[var(--color-primary)]">{persen}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{g.tenggat ? `Tenggat: ${g.tenggat.slice(0, 10)}` : 'Tanpa tenggat'}</span>
                  </span>

                  {estimasiHariTercapai !== null && (
                    <span
                      className={`font-semibold ${
                        statusTenggat === 'terancam' || statusTenggat === 'lewat_tenggat'
                          ? 'text-amber-500'
                          : 'text-emerald-600'
                      }`}
                    >
                      {statusTenggat === 'lewat_tenggat'
                        ? 'Lewat Tenggat'
                        : `~${estimasiHariTercapai} hari lagi`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
          <Target className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Belum ada target tabungan
          </p>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Tentukan tujuan menabung Anda (mis. Dana Darurat, Liburan, Beli Laptop).
          </p>
          <SoundButton size="sm" onClick={() => setModalOpen(true)}>
            Buat Target Baru
          </SoundButton>
        </div>
      )}

      {/* Goal Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Buat Target Baru">
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Target
            </label>
            <input
              type="text"
              placeholder="Contoh: Dana Darurat, Servis Kendaraan, Liburan"
              value={namaTarget}
              onChange={(e) => setNamaTarget(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nominal Target
            </label>
            <CurrencyInput value={nominalTarget} onChange={setNominalTarget} placeholder="Rp0" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tenggat Waktu (Opsional)
            </label>
            <input
              type="date"
              value={tenggat}
              onChange={(e) => setTenggat(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Hubungkan ke Tabungan Tertentu
            </label>
            <select
              value={tabunganId}
              onChange={(e) => setTabunganId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
            >
              <option value="">Seluruh Tabungan (Total Akumulasi)</option>
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
              Simpan Target
            </SoundButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};
