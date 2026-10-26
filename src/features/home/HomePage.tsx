import React, { useState } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  Clock,
  Target,
  BookmarkCheck,
  ChevronRight,
  Plus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  Account,
  AppSettings,
  Category,
  Debt,
  MonthlyBudget,
  SavingsGoal,
  Transaction,
} from '../../domain/types';
import {
  formatRupiah,
  calculateAccountBalance,
  calculatePeriodTotals,
  calculateDebtSummary,
  calculateGoalProgress,
} from '../../domain/accounting';
import {
  PeriodFilter,
  getPeriodDateRange,
  filterTransactionsByRange,
  generateDailyChartData,
  aggregateCategoryBreakdown,
} from '../../domain/statistics';
import { SoundButton } from '../../components/SoundButton';

interface HomePageProps {
  settings: AppSettings;
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
  categories: Category[];
  savingsGoals: SavingsGoal[];
  budgets: MonthlyBudget[];
  onOpenQuickAction: (action: 'income' | 'expense' | 'transfer' | 'debt') => void;
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  settings,
  accounts,
  transactions,
  debts,
  categories,
  savingsGoals,
  budgets,
  onOpenQuickAction,
  onNavigate,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('bulan_ini');

  // Filtered transactions by period
  const dateRange = getPeriodDateRange(period);
  const periodTxs = filterTransactionsByRange(transactions, dateRange);

  // Total balance of all active accounts
  const totalBalance = accounts.reduce((sum, acc) => {
    return sum + calculateAccountBalance(acc.saldoAwal, transactions, acc.id);
  }, 0);

  // Totals for the selected period
  const { totalMasuk, totalKeluar } = calculatePeriodTotals(periodTxs);

  // Unpaid debts owed TO user (piutang)
  const totalPiutangBelumDibayar = debts
    .filter((d) => !d.isDeleted && d.arah === 'piutang')
    .reduce((sum, d) => {
      const summary = calculateDebtSummary(d.pokok, []);
      return sum + summary.sisa;
    }, 0);

  // Nearest upcoming due date
  const upcomingDebts = debts
    .filter((d) => !d.isDeleted && d.status !== 'lunas' && d.jatuhTempo)
    .sort((a, b) => (a.jatuhTempo! > b.jatuhTempo! ? 1 : -1));
  const nearestDue = upcomingDebts[0];

  // Chart data
  const chartData = generateDailyChartData(transactions, dateRange, 0);
  const categoryBreakdowns = aggregateCategoryBreakdown(periodTxs, categories, 'keluar');

  // Active savings goals
  const activeGoal = savingsGoals.find((g) => !g.isDeleted && !g.tercapai);

  // Current active budget
  const curMonth = new Date().getMonth() + 1;
  const curYear = new Date().getFullYear();
  const currentBudgets = budgets.filter((b) => !b.isDeleted && b.bulan === curMonth && b.tahun === curYear);

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      {/* Total Balance Card */}
      <div className="relative overflow-hidden p-6 rounded-3xl bg-linear-to-br from-[var(--color-primary)] to-emerald-800 text-white shadow-xl">
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-100">
              Total Saldo Seluruh Tabungan
            </span>
            <span className="px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-medium backdrop-blur-xs">
              {accounts.length} Tabungan
            </span>
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              {formatRupiah(totalBalance, settings.privacyMode)}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/20">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-4 h-4 text-emerald-200" />
              </div>
              <div className="truncate">
                <span className="block text-[11px] text-emerald-100 font-medium">Masuk Periode</span>
                <span className="text-sm font-bold truncate">
                  {formatRupiah(totalMasuk, settings.privacyMode)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-4 h-4 text-rose-200" />
              </div>
              <div className="truncate">
                <span className="block text-[11px] text-emerald-100 font-medium">Keluar Periode</span>
                <span className="text-sm font-bold truncate">
                  {formatRupiah(totalKeluar, settings.privacyMode)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Period Filter Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { id: 'hari_ini', label: 'Hari Ini' },
            { id: 'kemarin', label: 'Kemarin' },
            { id: '7_hari', label: '7 Hari' },
            { id: '30_hari', label: '30 Hari' },
            { id: 'bulan_ini', label: 'Bulan Ini' },
            { id: 'bulan_lalu', label: 'Bulan Lalu' },
            { id: 'tahun_ini', label: 'Tahun Ini' },
          ] as const
        ).map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              period === p.id
                ? 'bg-[var(--color-primary)] text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Quick Status Cards: Piutang & Jatuh Tempo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Piutang card */}
        <div
          onClick={() => onNavigate('/utang')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between cursor-pointer hover:border-[var(--color-primary)] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Sisa Piutang (Orang Berutang)
              </span>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                {formatRupiah(totalPiutangBelumDibayar, settings.privacyMode)}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </div>

        {/* Nearest Due Date */}
        <div
          onClick={() => onNavigate('/utang')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between cursor-pointer hover:border-[var(--color-primary)] transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Jatuh Tempo Terdekat
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {nearestDue?.jatuhTempo ? nearestDue.jatuhTempo.slice(0, 10) : 'Belum ada'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </div>
      </div>

      {/* Target & Anggaran Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Goal progress */}
        <div
          onClick={() => onNavigate('/target')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-[var(--color-primary)] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Target className="w-4 h-4 text-emerald-500" />
              <span>Target Tabungan</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>

          {activeGoal ? (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {activeGoal.nama}
                </span>
                <span className="text-slate-500">
                  {formatRupiah(activeGoal.nominalTarget, settings.privacyMode)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${calculateGoalProgress(activeGoal.nominalTarget, totalBalance).persen}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Belum ada target yang dibuat.</p>
          )}
        </div>

        {/* Budget progress */}
        <div
          onClick={() => onNavigate('/anggaran')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-[var(--color-primary)] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <BookmarkCheck className="w-4 h-4 text-sky-500" />
              <span>Anggaran Bulan Ini</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </div>

          {currentBudgets.length > 0 ? (
            <div className="text-xs">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {currentBudgets.length} Kategori Dianggarkan
              </span>
              <p className="text-slate-500 mt-1">
                Total batas:{' '}
                {formatRupiah(
                  currentBudgets.reduce((s, b) => s + b.batasNominal, 0),
                  settings.privacyMode
                )}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Belum ada batas anggaran bulan ini.</p>
          )}
        </div>
      </div>

      {/* CHARTS SECTION */}
      {periodTxs.length > 0 ? (
        <div className="space-y-6">
          {/* Income vs Expense Bar Chart */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Pemasukan vs Pengeluaran Harian</span>
            </h3>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(val: any) => formatRupiah(Number(val || 0), settings.privacyMode)}
                  />
                  <Bar dataKey="pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} name="Masuk" />
                  <Bar dataKey="pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Keluar" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart: Expense by Category */}
          {categoryBreakdowns.length > 0 && (
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-4">
                Komposisi Pengeluaran per Kategori
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={categoryBreakdowns}
                        dataKey="total"
                        nameKey="nama"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {categoryBreakdowns.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.warna || '#64748b'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(val: any) => formatRupiah(Number(val || 0), settings.privacyMode)}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>

                <div className="flex-1 w-full space-y-2">
                  {categoryBreakdowns.slice(0, 5).map((item) => (
                    <div key={item.kategoriId} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.warna }}
                        />
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {item.nama}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                          {formatRupiah(item.total, settings.privacyMode)}
                        </span>
                        <span className="text-[10px] text-slate-400">{item.persentase}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Friendly Empty State as strictly required by AGENTS.md Rule 2 */
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center mb-3">
            <Wallet className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
            Belum Ada Transaksi di Periode Ini
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
            Mulai catat transaksi pertama Anda dengan menekan tombol tambah cepat di bawah.
          </p>
          <div className="flex gap-2">
            <SoundButton
              size="sm"
              sound="click"
              onClick={() => onOpenQuickAction('income')}
            >
              <Plus className="w-4 h-4" />
              <span>Catat Masuk</span>
            </SoundButton>
            <SoundButton
              variant="outline"
              size="sm"
              sound="click"
              onClick={() => onOpenQuickAction('expense')}
            >
              <Plus className="w-4 h-4" />
              <span>Catat Keluar</span>
            </SoundButton>
          </div>
        </div>
      )}
    </div>
  );
};
