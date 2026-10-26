import React, { useState } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  TrendingUp,
  AlertCircle,
  Clock,
  Target,
  BookmarkCheck,
  ChevronRight,
  Plus,
  Layers,
  PieChart as PieIcon,
  Info,
  Heart,
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
  Pocket,
  SavingsGoal,
  Transaction,
} from '../../domain/types';
import {
  formatRupiah,
  calculateAccountBalance,
  calculatePeriodTotals,
  calculateDebtSummary,
  calculateGoalProgress,
  calculatePocketBalance,
  checkPocketMonthlyLimit,
} from '../../domain/accounting';
import {
  PeriodFilter,
  getPeriodDateRange,
  filterTransactionsByRange,
  generateDailyChartData,
  aggregateCategoryBreakdown,
  aggregatePocketExpenses,
} from '../../domain/statistics';
import { SoundButton } from '../../components/SoundButton';

interface HomePageProps {
  settings: AppSettings;
  accounts: Account[];
  transactions: Transaction[];
  debts: Debt[];
  categories: Category[];
  pockets?: Pocket[];
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
  pockets = [],
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

  // Active pockets calculations
  const activePockets = pockets.filter((p) => !p.isDeleted && !p.diarsipkan);
  const pocketBalanceItems = activePockets
    .map((p) => {
      const acc = accounts.find((a) => a.id === p.tabunganId);
      if (!acc) return null;
      const saldo = calculatePocketBalance(p, acc, transactions);
      return {
        posId: p.id,
        nama: p.nama,
        warna: p.warna || '#0ea5e9',
        saldo: Math.max(0, saldo),
        rawSaldo: saldo,
        isSystem: p.isSystem,
      };
    })
    .filter((it): it is NonNullable<typeof it> => it !== null && it.saldo > 0);

  const totalPocketSaldo = pocketBalanceItems.reduce((s, it) => s + it.saldo, 0);
  const pocketBalanceChartData = pocketBalanceItems.map((it) => ({
    ...it,
    persentase: totalPocketSaldo > 0 ? Math.round((it.saldo / totalPocketSaldo) * 100) : 0,
  }));

  const pocketExpenses = aggregatePocketExpenses(periodTxs, pockets);
  const pocketsWithLimit = activePockets.filter((p) => p.batasBulanan && p.batasBulanan > 0);

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      {/* Total Balance Hero Card - Minimalist Monochrome with Soft Pink Border & Heart Motif */}
      <div className="relative overflow-hidden p-6 md:p-8 rounded-3xl bg-zinc-950 text-white border border-[var(--border-color)] shadow-lg shadow-pink-500/5">
        {/* Subtle Watermark Heart Motif */}
        <Heart className="absolute -right-6 -bottom-6 w-44 h-44 text-pink-500/10 stroke-1 pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Total Saldo Seluruh Tabungan
              </span>
              <Heart className="w-3.5 h-3.5 fill-pink-500/60 text-pink-400" />
            </div>
            <span className="px-3 py-1 rounded-full bg-zinc-900 text-[11px] font-semibold border border-[var(--border-color)] text-zinc-200">
              {accounts.length} Tabungan
            </span>
          </div>

          <div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight tabular-nums">
              {formatRupiah(totalBalance, settings.privacyMode)}
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-[var(--border-color)] flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="truncate">
                <span className="block text-[11px] text-zinc-400 font-medium">Masuk Periode</span>
                <span className="text-sm md:text-base font-bold truncate tabular-nums text-white">
                  {formatRupiah(totalMasuk, settings.privacyMode)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-zinc-900 border border-[var(--border-color)] flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-4 h-4 text-pink-400" />
              </div>
              <div className="truncate">
                <span className="block text-[11px] text-zinc-400 font-medium">Keluar Periode</span>
                <span className="text-sm md:text-base font-bold truncate tabular-nums text-white">
                  {formatRupiah(totalKeluar, settings.privacyMode)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Grid (Standard Mobile Banking App Style) */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        <button
          onClick={() => onOpenQuickAction('income')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-pink-400 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform mb-1.5 shadow-2xs border border-[var(--border-subtle)]">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold text-[var(--text-primary)]">Masuk</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('expense')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-pink-400 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 flex items-center justify-center group-hover:scale-105 transition-transform mb-1.5 shadow-2xs border border-[var(--border-subtle)]">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold text-[var(--text-primary)]">Keluar</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('transfer')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-pink-400 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform mb-1.5 shadow-2xs border border-[var(--border-subtle)]">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold text-[var(--text-primary)]">Transfer</span>
        </button>

        <button
          onClick={() => onOpenQuickAction('debt')}
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-pink-400 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform mb-1.5 shadow-2xs border border-[var(--border-subtle)]">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold text-[var(--text-primary)]">Utang</span>
        </button>
      </div>

      {/* Period Filter Dropdown Header (Clean & Minimalist) */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-pink-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Ringkasan Aktivitas
          </h2>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] focus:outline-hidden focus:border-pink-400 cursor-pointer shadow-2xs transition-colors"
        >
          <option value="hari_ini">Hari Ini</option>
          <option value="kemarin">Kemarin</option>
          <option value="7_hari">7 Hari Terakhir</option>
          <option value="30_hari">30 Hari Terakhir</option>
          <option value="bulan_ini">Bulan Ini</option>
          <option value="bulan_lalu">Bulan Lalu</option>
          <option value="tahun_ini">Tahun Ini</option>
        </select>
      </div>

      {/* Quick Status Cards: Piutang & Jatuh Tempo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Piutang card */}
        <div
          onClick={() => onNavigate('/utang')}
          className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm flex items-center justify-between cursor-pointer hover:border-[var(--color-primary)] hover:shadow-soft-md transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                Sisa Piutang (Orang Berutang)
              </span>
              <p className="text-base font-bold text-[var(--text-primary)] tabular-nums">
                {formatRupiah(totalPiutangBelumDibayar, settings.privacyMode)}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </div>

        {/* Nearest Due Date */}
        <div
          onClick={() => onNavigate('/utang')}
          className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm flex items-center justify-between cursor-pointer hover:border-[var(--color-primary)] hover:shadow-soft-md transition-all group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-[var(--text-secondary)] font-medium">
                Jatuh Tempo Terdekat
              </span>
              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                {nearestDue?.jatuhTempo ? nearestDue.jatuhTempo.slice(0, 10) : 'Belum ada'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* Target & Anggaran Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Goal progress */}
        <div
          onClick={() => onNavigate('/target')}
          className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm cursor-pointer hover:border-[var(--color-primary)] hover:shadow-soft-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
              <Target className="w-4 h-4 text-purple-500" />
              <span>Target Tabungan</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>

          {activeGoal ? (
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-bold text-[var(--text-primary)]">
                  {activeGoal.nama}
                </span>
                <span className="text-[var(--text-secondary)] tabular-nums">
                  {formatRupiah(activeGoal.nominalTarget, settings.privacyMode)}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-purple-500 to-pink-500 rounded-full"
                  style={{
                    width: `${calculateGoalProgress(activeGoal.nominalTarget, totalBalance).persen}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">Belum ada target yang dibuat.</p>
          )}
        </div>

        {/* Budget progress */}
        <div
          onClick={() => onNavigate('/anggaran')}
          className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm cursor-pointer hover:border-[var(--color-primary)] hover:shadow-soft-md transition-all group"
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
              <BookmarkCheck className="w-4 h-4 text-sky-500" />
              <span>Anggaran Bulan Ini</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>

          {currentBudgets.length > 0 ? (
            <div className="text-xs">
              <span className="font-bold text-[var(--text-primary)]">
                {currentBudgets.length} Kategori Dianggarkan
              </span>
              <p className="text-[var(--text-secondary)] mt-1 tabular-nums">
                Total batas:{' '}
                {formatRupiah(
                  currentBudgets.reduce((s, b) => s + b.batasNominal, 0),
                  settings.privacyMode
                )}
              </p>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] italic">Belum ada batas anggaran bulan ini.</p>
          )}
        </div>
      </div>

      {/* CHARTS SECTION */}
      {periodTxs.length > 0 ? (
        <div className="space-y-6">
          {/* Income vs Expense Bar Chart */}
          <div className="p-5 md:p-6 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm">
            <h3 className="font-bold text-sm text-[var(--text-primary)] mb-4 flex items-center gap-2">
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
                  <Bar dataKey="pemasukan" fill="#2563eb" radius={[6, 6, 0, 0]} name="Masuk" />
                  <Bar dataKey="pengeluaran" fill="#ec4899" radius={[6, 6, 0, 0]} name="Keluar" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart: Expense by Category */}
          {categoryBreakdowns.length > 0 && (
            <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm">
              <h3 className="font-bold text-sm text-[var(--text-primary)] mb-4">
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
                        <span className="font-medium text-[var(--text-secondary)]">
                          {item.nama}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-[var(--text-primary)] block tabular-nums">
                          {formatRupiah(item.total, settings.privacyMode)}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{item.persentase}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* POS TABUNGAN OVERVIEW SECTION */}
          {activePockets.length > 0 && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[var(--color-primary)]" />
                    <span>Pos Tabungan (Amplop)</span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Ringkasan saldo, pengeluaran, dan batas per pos pada tabungan Anda
                  </p>
                </div>
                <SoundButton
                  size="sm"
                  variant="outline"
                  sound="click"
                  onClick={() => onNavigate('/tabungan')}
                >
                  <span>Lihat Semua Pos</span>
                </SoundButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pocket Balance Composition Donut */}
                {pocketBalanceChartData.length > 0 ? (
                  <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm">
                    <h4 className="font-bold text-sm text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <PieIcon className="w-4 h-4 text-emerald-500" />
                      <span>Komposisi Saldo per Pos</span>
                    </h4>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="h-44 w-44 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsPie>
                            <Pie
                              data={pocketBalanceChartData}
                              dataKey="saldo"
                              nameKey="nama"
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={65}
                              paddingAngle={3}
                            >
                              {pocketBalanceChartData.map((entry, index) => (
                                <Cell key={`pos-cell-${index}`} fill={entry.warna || '#0ea5e9'} />
                              ))}
                            </Pie>
                            <Tooltip
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                              formatter={(val: any) => formatRupiah(Number(val || 0), settings.privacyMode)}
                            />
                          </RechartsPie>
                        </ResponsiveContainer>
                      </div>

                      <div className="flex-1 w-full space-y-2 max-h-48 overflow-y-auto pr-1">
                        {pocketBalanceChartData.map((item) => (
                          <div key={item.posId} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 truncate">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: item.warna }}
                              />
                              <span className="font-medium text-[var(--text-secondary)] truncate">
                                {item.nama}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-semibold text-[var(--text-primary)] block tabular-nums">
                                {formatRupiah(item.saldo, settings.privacyMode)}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{item.persentase}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Pocket Expense Bar Chart */}
                {pocketExpenses.length > 0 ? (
                  <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm">
                    <h4 className="font-bold text-sm text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-rose-500" />
                      <span>Pengeluaran per Pos Periode Ini</span>
                    </h4>

                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={pocketExpenses}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <XAxis dataKey="nama" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(val: any) => formatRupiah(Number(val || 0), settings.privacyMode)}
                          />
                          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                            {pocketExpenses.map((entry, index) => (
                              <Cell key={`bar-pos-${index}`} fill={entry.warna || '#f43f5e'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Monthly Limit Status Cards */}
              {pocketsWithLimit.length > 0 && (
                <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm space-y-3">
                  <h4 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>Progres Batas Bulanan Pos Tabungan</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {pocketsWithLimit.map((pos) => {
                      const limitStatus = checkPocketMonthlyLimit(pos, periodTxs);
                      const isOver = limitStatus.isExceeded;
                      const isNear = limitStatus.isNearLimit;
                      return (
                        <div
                          key={pos.id}
                          className="p-3.5 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)] space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                              {pos.nama}
                            </span>
                            {isOver ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                                Lewat Batas
                              </span>
                            ) : isNear ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                                Hampir Habis
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                Aman
                              </span>
                            )}
                          </div>

                          <div className="w-full h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isOver ? 'bg-rose-500' : isNear ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(limitStatus.persen, 100)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                            <span className="tabular-nums">Terpakai: {formatRupiah(limitStatus.terpakai, settings.privacyMode)}</span>
                            <span className="tabular-nums">Batas: {formatRupiah(limitStatus.batas, settings.privacyMode)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Explanatory text for Pos vs Category Budgets */}
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-start gap-3 text-xs text-blue-800 dark:text-blue-300">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-primary)]" />
                <p className="leading-relaxed">
                  <strong>Hubungan Pos dan Anggaran:</strong> Batas bulanan pos tabungan mengontrol pengeluaran langsung per amplop tabungan. Batas pos menyatu dengan anggaran kategori agar tidak terhitung ganda dalam perencanaan keuangan.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Friendly Empty State as strictly required by AGENTS.md Rule 2 */
        <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center flex flex-col items-center shadow-soft-sm">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center mb-3">
            <Wallet className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-[var(--text-primary)] mb-1">
            Belum Ada Transaksi di Periode Ini
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mb-4">
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
