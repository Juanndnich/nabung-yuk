// Domain Types for Nubung Yuk

export type ID = string;

export type TransactionType = 'masuk' | 'keluar' | 'transfer' | 'penyesuaian' | 'pindah_pos';
export type DebtDirection = 'piutang' | 'utang'; // 'piutang' = orang berutang ke saya, 'utang' = saya berutang ke orang
export type DebtStatus = 'belum_dibayar' | 'dicicil' | 'lunas' | 'terlambat';
export type RecurringFrequency = 'harian' | 'mingguan' | 'bulanan';
export type ReminderType = 'utang' | 'berulang' | 'target' | 'backup';
export type SoundStyle = 'modern' | 'lembut' | 'tegas' | 'retro';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorPreset = 'blue_pink' | 'ocean' | 'teal' | 'purple' | 'amber' | 'rose' | 'neutral';

export interface AppSettings {
  id: string; // 'current'
  theme: ThemeMode;
  colorPreset: ColorPreset;
  customAccent?: string;
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large';
  density: 'compact' | 'comfortable';
  reducedMotion: boolean;
  
  // Audio
  soundVolume: number; // 0 to 100
  soundMuted: boolean;
  soundStyle: SoundStyle;
  hapticsEnabled: boolean;

  // Security
  pinEnabled: boolean;
  pinHash?: string;
  pinSalt?: string;
  pinFailedAttempts: number;
  pinLockedUntil?: number; // timestamp
  autoLockMinutes: number; // 0 = immediately, 1, 3, 5, 10
  privacyMode: boolean; // hide balances "Rp•••"

  // App & Onboarding
  hasCompletedOnboarding: boolean;
  dateFormat: string; // e.g. 'dd/MM/yyyy'
  lastBackupDate?: string;
  backupReminderDays: number;
  
  // Motivation
  motivationEnabled: boolean;

  // Custom Logo / Icon
  customAppIcon?: string; // base64 / data URL cropped locally

  updatedAt: string;
}

export interface Account {
  id: ID;
  nama: string;
  ikon: string;
  warna: string;
  saldoAwal: number; // Integer Rupiah
  catatan?: string;
  diarsipkan: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: ID;
  nama: string;
  jenis: 'masuk' | 'keluar';
  ikon: string;
  warna: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: ID;
  nama: string;
  warna: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pocket {
  id: ID;
  tabunganId: ID;
  nama: string;
  ikon: string;
  warna: string;
  batasBulanan?: number; // Integer Rupiah (opsional)
  target?: number; // Integer Rupiah (opsional)
  urutan: number;
  diarsipkan: boolean;
  isSystem: boolean; // true untuk sistem "Belum dialokasikan"
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutoAllocationItem {
  posId: ID;
  type: 'persen' | 'nominal';
  value: number; // e.g. 20 (20%) atau 50000 (Rp50.000)
}

export interface AutoAllocationRule {
  id: ID;
  tabunganId: ID;
  nama: string;
  items: AutoAllocationItem[];
  aktif: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: ID;
  tabunganId: ID;
  posId?: ID; // ID pos terkait
  targetPosId?: ID; // ID pos tujuan untuk pindah pos atau transfer antar tabungan
  posPairId?: ID; // ID transaksi pasangan jika diperlukan
  jenis: TransactionType;
  nominal: number; // Integer Rupiah (> 0)
  tanggal: string; // ISO string YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  kategoriId?: ID;
  tagIds?: ID[];
  catatan?: string; // "dipakai untuk apa"
  lampiranFoto?: string; // Data URL or base64
  transferPairId?: ID;
  targetTabunganId?: ID;
  debtRefId?: ID; // Reference to debt or payment if linked
  alasanPenyesuaian?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: ID;
  nama: string;
  kontak?: string;
  foto?: string;
  catatan?: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Debt {
  id: ID;
  orangId: ID;
  arah: DebtDirection;
  pokok: number; // Integer Rupiah
  tanggal: string;
  jatuhTempo?: string;
  catatan?: string;
  tautanTabunganId?: ID; // tabungan linked for lending/borrowing
  initialTransactionId?: ID;
  status: DebtStatus;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DebtPayment {
  id: ID;
  utangId: ID;
  nominal: number; // Integer Rupiah
  tanggal: string;
  catatan?: string;
  metode?: string;
  tabunganId?: ID; // if linked to a wallet
  transactionId?: ID; // linked transaction id
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: ID;
  nama: string;
  nominalTarget: number; // Integer Rupiah
  tenggat?: string; // Target completion date
  tabunganId?: ID;
  ikon: string;
  warna: string;
  catatan?: string;
  tercapai?: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyBudget {
  id: ID;
  kategoriId: ID;
  batasNominal: number; // Integer Rupiah
  bulan: number; // 1-12
  tahun: number; // e.g. 2026
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: ID;
  jenis: 'masuk' | 'keluar';
  nominal: number;
  frekuensi: RecurringFrequency;
  tanggalMulai: string;
  tabunganId: ID;
  kategoriId?: ID;
  catatan: string;
  terakhirDiproses?: string;
  aktif: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: ID;
  judul: string;
  pesan: string;
  tanggalWaktu: string;
  tipe: ReminderType;
  refId?: ID;
  aktif: boolean;
  sudahDibaca: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Achievement {
  id: ID;
  kode: string;
  nama: string;
  deskripsi: string;
  ikon: string;
  tanggalTercapai?: string;
  dilihat: boolean;
}

export interface TrashItem {
  id: ID;
  entitasTipe: 'tabungan' | 'transaksi' | 'kategori' | 'tag' | 'orang' | 'utang' | 'pembayaran' | 'target' | 'anggaran' | 'berulang' | 'pos' | 'aturan_bagi';
  entitasId: ID;
  judul: string;
  dataJson: string;
  tanggalDihapus: string;
}

export interface AuditLog {
  id: ID;
  aksi: 'create' | 'update' | 'delete' | 'restore' | 'import' | 'backup';
  entitasTipe: string;
  entitasId: ID;
  ringkasan: string;
  tanggalWaktu: string;
  metadataJson?: string;
}
