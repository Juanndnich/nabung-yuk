import React, { useState } from 'react';
import { BookmarkCheck, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppSettings, Category, MonthlyBudget, Transaction } from '../../domain/types';
import { calculateBudgetStatus, formatRupiah, toIntegerRupiah } from '../../domain/accounting';
import { SoundButton } from '../../components/SoundButton';
import { Modal } from '../../components/Modal';
import { CurrencyInput } from '../../components/CurrencyInput';
import { repository } from '../../db/repository';
import { useToast } from '../../context/ToastContext';

interface BudgetsPageProps {
  settings: AppSettings;
  budgets: MonthlyBudget[];
  categories: Category[];
  transactions: Transaction[];
  onRefresh: () => void;
}

export const BudgetsPage: React.FC<BudgetsPageProps> = ({
  settings,
  budgets,
  categories,
  transactions,
  onRefresh,
}) => {
  const { showToast } = useToast();

  const curMonth = new Date().getMonth() + 1;
  const curYear = new Date().getFullYear();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [batasNominal, setBatasNominal] = useState(0);

  const expenseCategories = categories.filter((c) => c.jenis === 'keluar');
  const catMap = new Map(categories.map((c) => [c.id, c]));

  // Calculate actual spending per category in current month
  const pad = (n: number) => n.toString().padStart(2, '0');
  const monthPrefix = `${curYear}-${pad(curMonth)}`;

  const expenseByCat = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    if (tx.jenis === 'keluar' && tx.tanggal.startsWith(monthPrefix)) {
      const cId = tx.kategoriId || 'umum';
      expenseByCat.set(cId, (expenseByCat.get(cId) || 0) + toIntegerRupiah(tx.nominal));
    }
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) {
      showToast({ type: 'warning', message: 'Pilih kategori yang ingin dibatasi' });
      return;
    }
    if (batasNominal <= 0) {
      showToast({ type: 'warning', message: 'Batas nominal harus lebih dari Rp0' });
      return;
    }

    await repository.setBudget(selectedCatId, batasNominal, curMonth, curYear);
    showToast({ type: 'success', message: 'Anggaran bulanan berhasil disimpan' });
    setModalOpen(false);
    setSelectedCatId('');
    setBatasNominal(0);
    onRefresh();
  };

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-budgets)] inline-block" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Anggaran Bulanan</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Kendalikan batas pengeluaran per kategori untuk bulan {curMonth}/{curYear}
          </p>
        </div>

        <SoundButton size="sm" sound="click" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Atur Anggaran</span>
        </SoundButton>
      </div>

      {budgets.length > 0 ? (
        <div className="space-y-3">
          {budgets.map((b) => {
            const cat = catMap.get(b.kategoriId);
            const spent = expenseByCat.get(b.kategoriId) || 0;
            const { batas, terpakai, sisa, persen, status } = calculateBudgetStatus(
              b.batasNominal,
              spent
            );

            return (
              <div
                key={b.id}
                className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm hover:border-[var(--accent-budgets)] transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat?.warna || '#64748b' }}
                    />
                    <div>
                      <h3 className="font-bold text-sm text-[var(--text-primary)]">
                        {cat?.nama || 'Kategori Terhapus'}
                      </h3>
                      <span className="text-xs text-[var(--text-muted)] block tabular-nums">
                        Batas: {formatRupiah(batas, settings.privacyMode)}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize flex items-center gap-1 ${
                      status === 'melebihi'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : status === 'mendekati'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {status === 'melebihi' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {status === 'mendekati' && <AlertTriangle className="w-3.5 h-3.5" />}
                    {status === 'aman' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{status === 'melebihi' ? 'Over Budget' : status}</span>
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="w-full h-2.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        status === 'melebihi'
                          ? 'bg-rose-500'
                          : status === 'mendekati'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, persen)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-[var(--text-secondary)] mt-2">
                    <span className="tabular-nums">Terpakai: {formatRupiah(terpakai, settings.privacyMode)} ({persen}%)</span>
                    <span className="tabular-nums">
                      {sisa >= 0
                        ? `Sisa: ${formatRupiah(sisa, settings.privacyMode)}`
                        : `Lebih: ${formatRupiah(Math.abs(sisa), settings.privacyMode)}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center flex flex-col items-center shadow-soft-sm">
          <BookmarkCheck className="w-8 h-8 text-[var(--text-muted)] mb-2" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Belum ada batasan anggaran
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
            Pasang pagu maksimal pengeluaran bulanan agar tidak boros.
          </p>
          <SoundButton size="sm" onClick={() => setModalOpen(true)}>
            Atur Batas Anggaran
          </SoundButton>
        </div>
      )}

      {/* Set Budget Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Atur Batas Anggaran">
        <form onSubmit={handleSaveBudget} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Kategori Pengeluaran
            </label>
            <select
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
            >
              <option value="">Pilih Kategori...</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Batas Maksimal Pengeluaran
            </label>
            <CurrencyInput value={batasNominal} onChange={setBatasNominal} placeholder="Rp0" />
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
              Simpan Batas
            </SoundButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};
