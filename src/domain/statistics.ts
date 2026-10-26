// Domain Statistics, Periods, and Grouping Logic
import { Account, Category, Pocket, Transaction } from './types';
import { calculatePeriodTotals, calculatePocketBalance, toIntegerRupiah } from './accounting';

export type PeriodFilter =
  | 'hari_ini'
  | 'kemarin'
  | '7_hari'
  | '30_hari'
  | 'bulan_ini'
  | 'bulan_lalu'
  | 'tahun_ini'
  | 'kustom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

/**
 * Returns startDate and endDate strings in YYYY-MM-DD for standard period filters
 */
export function getPeriodDateRange(filter: PeriodFilter, referenceDate: Date = new Date()): DateRange {
  const now = new Date(referenceDate);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (filter) {
    case 'hari_ini': {
      const today = formatYmd(now);
      return { startDate: today, endDate: today };
    }
    case 'kemarin': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = formatYmd(yesterday);
      return { startDate: yStr, endDate: yStr };
    }
    case '7_hari': {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 6);
      return { startDate: formatYmd(past7), endDate: formatYmd(now) };
    }
    case '30_hari': {
      const past30 = new Date(now);
      past30.setDate(past30.getDate() - 29);
      return { startDate: formatYmd(past30), endDate: formatYmd(now) };
    }
    case 'bulan_ini': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { startDate: formatYmd(firstDay), endDate: formatYmd(lastDay) };
    }
    case 'bulan_lalu': {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: formatYmd(firstDay), endDate: formatYmd(lastDay) };
    }
    case 'tahun_ini': {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 11, 31);
      return { startDate: formatYmd(firstDay), endDate: formatYmd(lastDay) };
    }
    case 'kustom':
    default: {
      const today = formatYmd(now);
      return { startDate: today, endDate: today };
    }
  }
}

/**
 * Filter transactions within an inclusive date range
 */
export function filterTransactionsByRange(
  transactions: Transaction[],
  range: DateRange
): Transaction[] {
  return transactions.filter((tx) => {
    if (tx.isDeleted) return false;
    const txDate = tx.tanggal.slice(0, 10);
    return txDate >= range.startDate && txDate <= range.endDate;
  });
}

export interface DayGroup {
  date: string; // YYYY-MM-DD
  label: string; // 'Hari ini', 'Kemarin', or 'Senin, 25 Okt 2026'
  transactions: Transaction[];
  totalMasuk: number;
  totalKeluar: number;
  selisih: number;
}

/**
 * Groups transactions by day, ordered descending by date, with subtotal income/expense/net
 */
export function groupTransactionsByDay(
  transactions: Transaction[],
  todayYmd: string = new Date().toISOString().slice(0, 10)
): DayGroup[] {
  const groupsMap = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    const dateKey = tx.tanggal.slice(0, 10);
    if (!groupsMap.has(dateKey)) {
      groupsMap.set(dateKey, []);
    }
    groupsMap.get(dateKey)!.push(tx);
  }

  // Sort dates descending
  const sortedDates = Array.from(groupsMap.keys()).sort((a, b) => b.localeCompare(a));

  const yesterdayDate = new Date(todayYmd + 'T00:00:00Z');
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayYmd = yesterdayDate.toISOString().slice(0, 10);

  return sortedDates.map((dateStr) => {
    const txList = groupsMap.get(dateStr) || [];
    // Sort transactions within day descending by time
    txList.sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    let label = '';
    if (dateStr === todayYmd) {
      label = 'Hari ini';
    } else if (dateStr === yesterdayYmd) {
      label = 'Kemarin';
    } else {
      const d = new Date(dateStr + 'T00:00:00Z');
      label = new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
      }).format(d);
    }

    const { totalMasuk, totalKeluar, selisih } = calculatePeriodTotals(txList);

    return {
      date: dateStr,
      label,
      transactions: txList,
      totalMasuk,
      totalKeluar,
      selisih,
    };
  });
}

export interface CategoryBreakdown {
  kategoriId: string;
  nama: string;
  ikon: string;
  warna: string;
  total: number;
  persentase: number;
}

/**
 * Aggregate expense breakdown by category
 */
export function aggregateCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  type: 'keluar' | 'masuk' = 'keluar'
): CategoryBreakdown[] {
  const catMap = new Map<string, Category>();
  categories.forEach((c) => catMap.set(c.id, c));

  const totals = new Map<string, number>();
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.isDeleted) continue;
    if (tx.jenis === type && tx.nominal > 0) {
      const catId = tx.kategoriId || 'tanpa_kategori';
      const amt = toIntegerRupiah(tx.nominal);
      totals.set(catId, (totals.get(catId) || 0) + amt);
      grandTotal += amt;
    }
  }

  const result: CategoryBreakdown[] = [];
  totals.forEach((total, catId) => {
    const cat = catMap.get(catId);
    result.push({
      kategoriId: catId,
      nama: cat ? cat.nama : 'Lainnya',
      ikon: cat ? cat.ikon : 'HelpCircle',
      warna: cat ? cat.warna : '#6b7280',
      total,
      persentase: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
    });
  });

  return result.sort((a, b) => b.total - a.total);
}

export interface DailyBarChartItem {
  date: string;
  displayDate: string;
  pemasukan: number;
  pengeluaran: number;
  saldo: number;
}

/**
 * Creates daily bar chart data points within a date range
 */
export function generateDailyChartData(
  transactions: Transaction[],
  range: DateRange,
  startingBalance: number = 0
): DailyBarChartItem[] {
  const txFiltered = filterTransactionsByRange(transactions, range);
  const byDay = new Map<string, { masuk: number; keluar: number }>();

  // Initialize all days in range
  const cur = new Date(range.startDate + 'T00:00:00Z');
  const end = new Date(range.endDate + 'T00:00:00Z');
  const pad = (n: number) => n.toString().padStart(2, '0');

  while (cur <= end) {
    const key = `${cur.getUTCFullYear()}-${pad(cur.getUTCMonth() + 1)}-${pad(cur.getUTCDate())}`;
    byDay.set(key, { masuk: 0, keluar: 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  for (const tx of txFiltered) {
    const key = tx.tanggal.slice(0, 10);
    const day = byDay.get(key);
    if (!day) continue;
    const nominal = toIntegerRupiah(tx.nominal);
    if (tx.jenis === 'masuk') {
      day.masuk += nominal;
    } else if (tx.jenis === 'keluar') {
      day.keluar += nominal;
    } else if (tx.jenis === 'penyesuaian') {
      if (nominal > 0) day.masuk += nominal;
      else day.keluar += Math.abs(nominal);
    }
  }

  let runningBalance = startingBalance;
  const result: DailyBarChartItem[] = [];

  const sortedKeys = Array.from(byDay.keys()).sort();
  for (const dateKey of sortedKeys) {
    const val = byDay.get(dateKey)!;
    runningBalance += val.masuk - val.keluar;
    const [_, month, day] = dateKey.split('-');
    result.push({
      date: dateKey,
      displayDate: `${day}/${month}`,
      pemasukan: val.masuk,
      pengeluaran: val.keluar,
      saldo: runningBalance,
    });
  }

  return result;
}

/**
 * Calculates advanced statistics:
 * - savings ratio = (income - expense) / income * 100
 * - daily average expense
 * - most expensive day
 * - top category
 */
export function calculateAdvancedStats(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange
) {
  const filtered = filterTransactionsByRange(transactions, range);
  const { totalMasuk, totalKeluar, selisih } = calculatePeriodTotals(filtered);

  // Number of days in range
  const start = new Date(range.startDate + 'T00:00:00Z').getTime();
  const end = new Date(range.endDate + 'T00:00:00Z').getTime();
  const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);

  const rataRataHarian = Math.round(totalKeluar / diffDays);
  const rasioMenabung =
    totalMasuk > 0 ? Math.max(0, Math.round((selisih / totalMasuk) * 100)) : 0;

  // Find most expensive day
  const expenseByDay = new Map<string, number>();
  for (const tx of filtered) {
    if (tx.jenis === 'keluar' || (tx.jenis === 'penyesuaian' && tx.nominal < 0)) {
      const d = tx.tanggal.slice(0, 10);
      const amt = Math.abs(toIntegerRupiah(tx.nominal));
      expenseByDay.set(d, (expenseByDay.get(d) || 0) + amt);
    }
  }

  let hariPalingBoros: { date: string; nominal: number } | null = null;
  for (const [d, nom] of expenseByDay.entries()) {
    if (!hariPalingBoros || nom > hariPalingBoros.nominal) {
      hariPalingBoros = { date: d, nominal: nom };
    }
  }

  const breakdowns = aggregateCategoryBreakdown(filtered, categories, 'keluar');
  const kategoriTerbesar = breakdowns.length > 0 ? breakdowns[0] : null;

  return {
    totalMasuk,
    totalKeluar,
    selisih,
    diffDays,
    rataRataHarian,
    rasioMenabung,
    hariPalingBoros,
    kategoriTerbesar,
    breakdowns,
  };
}

export interface PocketBalanceItem {
  posId: string;
  nama: string;
  warna: string;
  ikon: string;
  saldo: number;
  isSystem: boolean;
  persentase: number; // percentage of total account balance
}

/**
 * Aggregates current balance per pocket for an account
 */
export function aggregatePocketBalances(
  account: Account,
  pockets: Pocket[],
  transactions: Transaction[]
): PocketBalanceItem[] {
  const accountPockets = pockets.filter((p) => p.tabunganId === account.id && !p.isDeleted);
  const items = accountPockets.map((p) => {
    const saldo = calculatePocketBalance(p, account, transactions);
    return {
      posId: p.id,
      nama: p.nama,
      warna: p.warna || '#64748b',
      ikon: p.ikon,
      saldo,
      isSystem: p.isSystem,
      persentase: 0,
    };
  });

  const totalPositive = items.reduce((sum, it) => sum + (it.saldo > 0 ? it.saldo : 0), 0);
  if (totalPositive > 0) {
    items.forEach((it) => {
      it.persentase = it.saldo > 0 ? Math.round((it.saldo / totalPositive) * 100) : 0;
    });
  }

  return items;
}

export interface PocketExpenseItem {
  posId: string;
  nama: string;
  warna: string;
  ikon: string;
  total: number;
  persentase: number;
}

/**
 * Aggregates expenses per pocket for a given set of transactions (or filtered range).
 * Note: 'pindah_pos' and 'transfer' are completely excluded!
 */
export function aggregatePocketExpenses(
  transactions: Transaction[],
  pockets: Pocket[],
  dateRange?: DateRange,
  tabunganId?: string
): PocketExpenseItem[] {
  let list = transactions.filter((t) => !t.isDeleted);
  if (tabunganId) {
    list = list.filter((t) => t.tabunganId === tabunganId);
  }
  if (dateRange) {
    list = filterTransactionsByRange(list, dateRange);
  }

  const pocketMap = new Map<string, Pocket>(pockets.map((p) => [p.id, p]));
  const totals = new Map<string, number>();

  for (const tx of list) {
    if (tx.jenis === 'keluar') {
      const pId = tx.posId || 'unassigned';
      totals.set(pId, (totals.get(pId) || 0) + toIntegerRupiah(tx.nominal));
    }
  }

  let grandTotal = 0;
  const result: PocketExpenseItem[] = [];

  totals.forEach((val, pId) => {
    grandTotal += val;
    const p = pocketMap.get(pId);
    result.push({
      posId: pId,
      nama: p ? p.nama : 'Belum dialokasikan',
      warna: p ? p.warna : '#94a3b8',
      ikon: p ? p.ikon : 'Inbox',
      total: val,
      persentase: 0,
    });
  });

  if (grandTotal > 0) {
    result.forEach((r) => {
      r.persentase = Math.round((r.total / grandTotal) * 100);
    });
  }

  return result.sort((a, b) => b.total - a.total);
}

