// Data Export, Import, CSV and Print Service
import { z } from 'zod';
import { formatRupiah } from '../domain/accounting';
import { Account, Category, Debt, DebtPayment, Person, Transaction } from '../domain/types';

export const BackupSchema = z.object({
  version: z.number(),
  appName: z.literal('Nubung Yuk'),
  exportedAt: z.string(),
  data: z.object({
    settings: z.array(z.any()).optional(),
    accounts: z.array(z.any()).optional(),
    categories: z.array(z.any()).optional(),
    tags: z.array(z.any()).optional(),
    transactions: z.array(z.any()).optional(),
    people: z.array(z.any()).optional(),
    debts: z.array(z.any()).optional(),
    debtPayments: z.array(z.any()).optional(),
    savingsGoals: z.array(z.any()).optional(),
    budgets: z.array(z.any()).optional(),
    recurringTransactions: z.array(z.any()).optional(),
    achievements: z.array(z.any()).optional(),
    trash: z.array(z.any()).optional(),
    auditLogs: z.array(z.any()).optional(),
  }),
});

export const dataTransferService = {
  /**
   * Triggers download of JSON file in browser
   */
  downloadJson(data: Record<string, unknown> | string, filename: string) {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Generates CSV for Transactions with UTF-8 BOM
   */
  generateTransactionsCsv(
    transactions: Transaction[],
    accounts: Account[],
    categories: Category[]
  ): string {
    const accMap = new Map(accounts.map((a) => [a.id, a.nama]));
    const catMap = new Map(categories.map((c) => [c.id, c.nama]));

    const headers = [
      'ID',
      'Tanggal',
      'Jenis',
      'Tabungan',
      'Kategori',
      'Nominal (Rp)',
      'Catatan',
    ];

    const rows = transactions
      .filter((t) => !t.isDeleted)
      .map((t) => [
        t.id,
        t.tanggal.slice(0, 10),
        t.jenis,
        `"${accMap.get(t.tabunganId) || 'Tidak diketahui'}"`,
        `"${catMap.get(t.kategoriId || '') || 'Lainnya'}"`,
        t.nominal,
        `"${(t.catatan || '').replace(/"/g, '""')}"`,
      ]);

    // Prepend UTF-8 BOM \uFEFF for Excel compatibility
    return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  },

  /**
   * Generates CSV for Debts with UTF-8 BOM
   */
  generateDebtsCsv(
    debts: Debt[],
    people: Person[],
    payments: DebtPayment[]
  ): string {
    const personMap = new Map(people.map((p) => [p.id, p.nama]));

    const headers = [
      'ID',
      'Kontak',
      'Arah',
      'Pokok (Rp)',
      'Total Dibayar (Rp)',
      'Sisa (Rp)',
      'Tanggal',
      'Jatuh Tempo',
      'Status',
      'Catatan',
    ];

    const rows = debts
      .filter((d) => !d.isDeleted)
      .map((d) => {
        const debtPayments = payments.filter((p) => !p.isDeleted && p.utangId === d.id);
        const totalPaid = debtPayments.reduce((sum, p) => sum + p.nominal, 0);
        const sisa = Math.max(0, d.pokok - totalPaid);

        return [
          d.id,
          `"${personMap.get(d.orangId) || 'Tidak diketahui'}"`,
          d.arah === 'piutang' ? 'Orang Berutang ke Saya' : 'Saya Berutang ke Orang',
          d.pokok,
          totalPaid,
          sisa,
          d.tanggal.slice(0, 10),
          d.jatuhTempo ? d.jatuhTempo.slice(0, 10) : '-',
          d.status,
          `"${(d.catatan || '').replace(/"/g, '""')}"`,
        ];
      });

    return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  },

  /**
   * Download CSV file in browser
   */
  downloadCsv(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Validates imported JSON string with Zod
   */
  validateImportJson(jsonString: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(jsonString);
      const validated = BackupSchema.parse(parsed);
      return validated as Record<string, unknown>;
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        throw new Error('Validasi struktur file backup gagal: ' + err.issues.map((i) => i.message).join(', '));
      }
      throw new Error('Format file JSON tidak valid.');
    }
  },

  /**
   * Format debt reminder text ready to copy or share (WhatsApp / SMS)
   */
  formatDebtReminderText(
    personName: string,
    sisaNominal: number,
    dueDate?: string,
    notes?: string
  ): string {
    const formattedAmount = formatRupiah(sisaNominal);
    let msg = `Halo ${personName}, semoga sehat selalu. Sekadar mengingatkan catatan titipan/pinjaman sebesar ${formattedAmount}`;
    if (dueDate) {
      msg += ` dengan jatuh tempo ${dueDate.slice(0, 10)}`;
    }
    if (notes) {
      msg += ` (${notes})`;
    }
    msg += `. Terima kasih banyak ya!`;
    return msg;
  },
};
