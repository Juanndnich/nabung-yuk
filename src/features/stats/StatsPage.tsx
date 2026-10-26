import React, { useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  AlertOctagon,
  Percent,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { AppSettings, Category, Transaction } from '../../domain/types';
import {
  calculateAdvancedStats,
  generateDailyChartData,
  getPeriodDateRange,
  PeriodFilter,
} from '../../domain/statistics';
import { formatRupiah } from '../../domain/accounting';

interface StatsPageProps {
  settings: AppSettings;
  transactions: Transaction[];
  categories: Category[];
}

export const StatsPage: React.FC<StatsPageProps> = ({
  settings,
  transactions,
  categories,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('bulan_ini');

  const range = getPeriodDateRange(period);
  const stats = calculateAdvancedStats(transactions, categories, range);
  const chartData = generateDailyChartData(transactions, range, 0);

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Analisis Statistik Keuangan
        </h1>
        <p className="text-xs text-slate-500">
          Wawasan komprehensif pola pengeluaran, rasio tabungan, dan hari paling boros
        </p>
      </div>

      {/* Period Filter Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { id: '7_hari', label: '7 Hari Terakhir' },
            { id: '30_hari', label: '30 Hari Terakhir' },
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
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Percent className="w-4 h-4 text-emerald-500" />
            <span>Rasio Menabung</span>
          </div>
          <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {stats.rasioMenabung}%
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">
            (Pemasukan - Pengeluaran) / Masuk
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <DollarSign className="w-4 h-4 text-rose-500" />
            <span>Rata-rata Harian</span>
          </div>
          <span className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {formatRupiah(stats.rataRataHarian, settings.privacyMode)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">
            Total keluar / {stats.diffDays} hari
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <AlertOctagon className="w-4 h-4 text-amber-500" />
            <span>Hari Paling Boros</span>
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate block">
            {stats.hariPalingBoros
              ? formatRupiah(stats.hariPalingBoros.nominal, settings.privacyMode)
              : '-'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">
            {stats.hariPalingBoros ? stats.hariPalingBoros.date : 'Tidak ada transaksi'}
          </span>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <TrendingUp className="w-4 h-4 text-sky-500" />
            <span>Kategori Terbesar</span>
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate block">
            {stats.kategoriTerbesar ? stats.kategoriTerbesar.nama : '-'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">
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
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
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
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
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
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.nama}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatRupiah(item.total, settings.privacyMode)} ({item.persentase}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${item.persentase}%`, backgroundColor: item.warna }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Tidak ada pengeluaran pada periode ini.</p>
        )}
      </div>

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
            <strong>Pembulatan Konsisten:</strong> Semua nilai nominal diproses sebagai bilangan bulat
            rupiah tanpa pembulatan mengambang (floating-point).
          </li>
        </ul>
      </div>
    </div>
  );
};
