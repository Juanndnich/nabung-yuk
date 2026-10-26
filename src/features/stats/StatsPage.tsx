import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  AlertOctagon,
  Percent,
  Info,
  Layers,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { AppSettings, Category, Pocket, Transaction } from '../../domain/types';
import {
  calculateAdvancedStats,
  filterTransactionsByRange,
  generateDailyChartData,
  getPeriodDateRange,
  aggregatePocketExpenses,
  PeriodFilter,
} from '../../domain/statistics';
import {
  formatRupiah,
  checkPocketMonthlyLimit,
} from '../../domain/accounting';

interface StatsPageProps {
  settings: AppSettings;
  transactions: Transaction[];
  categories: Category[];
  pockets?: Pocket[];
}

export const StatsPage: React.FC<StatsPageProps> = ({
  settings,
  transactions,
  categories,
  pockets = [],
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('bulan_ini');

  const range = getPeriodDateRange(period);
  const periodTxs = filterTransactionsByRange(transactions, range);
  const stats = calculateAdvancedStats(transactions, categories, range);
  const chartData = generateDailyChartData(transactions, range, 0);

  // Pos Tabungan statistics
  const activePockets = pockets.filter((p) => !p.isDeleted && !p.diarsipkan);
  const pocketExpenses = aggregatePocketExpenses(periodTxs, pockets);
  const pocketsWithLimit = activePockets.filter((p) => p.batasBulanan && p.batasBulanan > 0);

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Statistik
            </h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Analisis pola pengeluaran & rasio menabung
          </p>
        </div>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] cursor-pointer focus:outline-hidden focus:border-pink-400 shadow-2xs"
        >
          <option value="7_hari">7 Hari Terakhir</option>
          <option value="30_hari">30 Hari Terakhir</option>
          <option value="bulan_ini">Bulan Ini</option>
          <option value="bulan_lalu">Bulan Lalu</option>
          <option value="tahun_ini">Tahun Ini</option>
        </select>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-1">
            <Percent className="w-4 h-4 text-emerald-500" />
            <span>Rasio Menabung</span>
          </div>
          <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {stats.rasioMenabung}%
          </span>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1">
            (Pemasukan - Pengeluaran) / Masuk
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-1">
            <DollarSign className="w-4 h-4 text-rose-500" />
            <span>Rata-rata Harian</span>
          </div>
          <span className="text-xl font-extrabold text-[var(--text-primary)] tabular-nums">
            {formatRupiah(stats.rataRataHarian, settings.privacyMode)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1 tabular-nums">
            Total keluar / {stats.diffDays} hari
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-1">
            <AlertOctagon className="w-4 h-4 text-amber-500" />
            <span>Hari Paling Boros</span>
          </div>
          <span className="text-sm font-bold text-[var(--text-primary)] truncate block tabular-nums">
            {stats.hariPalingBoros
              ? formatRupiah(stats.hariPalingBoros.nominal, settings.privacyMode)
              : '-'}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1 tabular-nums">
            {stats.hariPalingBoros ? stats.hariPalingBoros.date : 'Tidak ada transaksi'}
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-1">
            <TrendingUp className="w-4 h-4 text-sky-500" />
            <span>Kategori Terbesar</span>
          </div>
          <span className="text-sm font-bold text-[var(--text-primary)] truncate block">
            {stats.kategoriTerbesar ? stats.kategoriTerbesar.nama : '-'}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] block mt-1 tabular-nums">
            {stats.kategoriTerbesar
              ? `${stats.kategoriTerbesar.persentase}% (${formatRupiah(
                  stats.kategoriTerbesar.total,
                  settings.privacyMode
                )})`
              : 'Belum ada'}
          </span>
        </div>
      </div>

      {/* Balance Trend Line Chart */}
      <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm">
        <h3 className="font-bold text-sm text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
          <span>Grafik Tren Saldo Periode</span>
        </h3>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="displayDate" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(val: any) => formatRupiah(Number(val || 0), settings.privacyMode)}
              />
              <Line
                type="monotone"
                dataKey="saldo"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={{ r: 2 }}
                name="Saldo Kumulatif"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Expense List */}
      <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm space-y-3">
        <h3 className="font-bold text-sm text-[var(--text-primary)]">
          Rincian Pengeluaran per Kategori
        </h3>

        {stats.breakdowns.length > 0 ? (
          <div className="space-y-3">
            {stats.breakdowns.map((item) => (
              <div key={item.kategoriId} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.warna }}
                    />
                    <span className="font-semibold text-[var(--text-secondary)]">
                      {item.nama}
                    </span>
                  </div>
                  <span className="font-bold text-[var(--text-primary)] tabular-nums">
                    {formatRupiah(item.total, settings.privacyMode)} ({item.persentase}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${item.persentase}%`, backgroundColor: item.warna }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic">Tidak ada pengeluaran pada periode ini.</p>
        )}
      </div>

      {/* Pos Tabungan Statistics Section */}
      {activePockets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[var(--color-primary)]" />
            <h3 className="font-bold text-sm text-[var(--text-primary)]">
              Analisis Pos Tabungan (Amplop)
            </h3>
          </div>

          {/* Pocket Expense Bar Chart */}
          {pocketExpenses.length > 0 ? (
            <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm">
              <h4 className="font-bold text-xs text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-rose-500" />
                <span>Pengeluaran per Pos pada Periode Ini</span>
              </h4>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pocketExpenses} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="nama" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(val: any) => formatRupiah(Number(val || 0), settings.privacyMode)}
                    />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                      {pocketExpenses.map((entry, index) => (
                        <Cell key={`bar-stat-pos-${index}`} fill={entry.warna || '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 space-y-2 pt-3 border-t border-[var(--border-color)]">
                {pocketExpenses.map((pe) => (
                  <div key={pe.posId} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pe.warna }} />
                      <span className="font-medium text-[var(--text-secondary)]">{pe.nama}</span>
                    </div>
                    <span className="font-bold text-[var(--text-primary)] tabular-nums">
                      {formatRupiah(pe.total, settings.privacyMode)} ({pe.persentase}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center text-xs text-[var(--text-muted)] shadow-soft-sm">
              Belum ada pengeluaran dari pos tabungan pada periode ini.
            </div>
          )}

          {/* Pocket Limit Status */}
          {pocketsWithLimit.length > 0 && (
            <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm space-y-3">
              <h4 className="font-bold text-xs text-[var(--text-primary)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Status Batas Bulanan Pos</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {pocketsWithLimit.map((pos) => {
                  const limitStatus = checkPocketMonthlyLimit(pos, periodTxs);
                  const isOver = limitStatus.isExceeded;
                  const isNear = limitStatus.isNearLimit;
                  return (
                    <div
                      key={pos.id}
                      className="p-3 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--text-primary)] truncate">
                          {pos.nama}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isOver
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : isNear
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {limitStatus.persen}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isOver ? 'bg-rose-500' : isNear ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(limitStatus.persen, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                        <span className="tabular-nums">{formatRupiah(limitStatus.terpakai, settings.privacyMode)}</span>
                        <span className="tabular-nums">dari {formatRupiah(limitStatus.batas, settings.privacyMode)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calculation Methodology Disclosure Note */}
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
          <Info className="w-4 h-4 text-sky-500" />
          <span>Metode Perhitungan Statistik:</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-[11px] leading-relaxed">
          <li>
            <strong>Rasio Menabung:</strong> Dihitung murni dari (Total Masuk − Total Keluar) dibagi
            Total Masuk.
          </li>
          <li>
            <strong>Transfer Tabungan:</strong> Mutasi internal antar dompet dipasangkan dan tidak
            dihitung sebagai beban maupun penghasilan.
          </li>
          <li>
            <strong>Pindah Dana Antar Pos:</strong> Mutasi saldo antar amplop tabungan dipasangkan dan tidak dihitung sebagai pemasukan atau pengeluaran.
          </li>
          <li>
            <strong>Batas Bulanan Pos & Anggaran:</strong> Batas bulanan pos tabungan menyatu dengan anggaran kategori agar tidak terhitung ganda.
          </li>
          <li>
            <strong>Pembulatan Konsisten:</strong> Semua nilai nominal diproses sebagai bilangan bulat
            rupiah tanpa pembulatan mengambang (floating-point).
          </li>
        </ul>
      </div>
    </div>
  );
};
