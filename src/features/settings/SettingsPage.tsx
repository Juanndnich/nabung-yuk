import React, { useState, useEffect } from 'react';
import {
  Palette,
  Volume2,
  Shield,
  Database,
  FileSpreadsheet,
  Download,
  Upload,
  Printer,
  Trash2,
  HardDrive,
  Plus,
} from 'lucide-react';
import { AppSettings, Category, ColorPreset, ThemeMode } from '../../domain/types';
import { PALETTES, applyTheme } from '../../styles/theme';
import { soundService } from '../../services/audio';
import { securityService } from '../../services/security';
import { dataTransferService } from '../../services/dataTransfer';
import { repository } from '../../db/repository';
import { SoundButton } from '../../components/SoundButton';
import { Modal } from '../../components/Modal';
import { useToast } from '../../context/ToastContext';

interface SettingsPageProps {
  settings: AppSettings;
  categories: Category[];
  onRefresh: () => void;
  onNavigate?: (path: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  categories,
  onRefresh,
  onNavigate: _onNavigate,
}) => {
  const { showToast } = useToast();

  // Storage persistent status
  const [isPersisted, setIsPersisted] = useState<boolean>(false);

  // Backup encryption modal
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [useEncryption, setUseEncryption] = useState(false);

  // Restore modal
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [restorePassword, setRestorePassword] = useState('');
  const [pendingFileContent, setPendingFileContent] = useState<string | null>(null);

  // Wipe data modal
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');

  // PIN settings modal
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');

  // Category management modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'masuk' | 'keluar'>('keluar');
  const [catColor, setCatColor] = useState('#0d9488');

  useEffect(() => {
    securityService.checkAndRequestPersistentStorage().then((res) => {
      setIsPersisted(res.persisted);
    });
  }, []);

  const handleUpdateTheme = async (theme: ThemeMode, preset?: ColorPreset) => {
    const nextPreset = preset || settings.colorPreset;
    await repository.updateSettings({ theme, colorPreset: nextPreset });
    applyTheme(theme, nextPreset);
    onRefresh();
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4 || newPin.length > 8) {
      showToast({ type: 'warning', message: 'PIN harus 4 sampai 8 digit angka' });
      return;
    }

    const { hashHex, saltHex } = await securityService.hashPin(newPin);
    await repository.updateSettings({
      pinEnabled: true,
      pinHash: hashHex,
      pinSalt: saltHex,
      pinFailedAttempts: 0,
      pinLockedUntil: undefined,
    });

    showToast({ type: 'success', message: 'PIN pengunci aplikasi berhasil diatur' });
    setPinModalOpen(false);
    setNewPin('');
    onRefresh();
  };

  const handleRemovePin = async () => {
    await repository.updateSettings({
      pinEnabled: false,
      pinHash: undefined,
      pinSalt: undefined,
    });
    showToast({ type: 'info', message: 'Kunci PIN dinonaktifkan' });
    onRefresh();
  };

  const handleExportBackup = async () => {
    const fullData = await repository.exportFullData();
    const jsonStr = JSON.stringify(fullData, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);

    if (useEncryption) {
      if (!backupPassword || backupPassword.length < 6) {
        showToast({ type: 'warning', message: 'Password enkripsi minimal 6 karakter' });
        return;
      }
      const encrypted = await securityService.encryptBackup(jsonStr, backupPassword);
      dataTransferService.downloadJson(encrypted, `NubungYuk-Backup-Terenkripsi-${dateStr}.json`);
    } else {
      dataTransferService.downloadJson(fullData, `NubungYuk-Backup-${dateStr}.json`);
    }

    await repository.updateSettings({ lastBackupDate: new Date().toISOString() });
    showToast({ type: 'success', message: 'File backup berhasil diunduh' });
    setBackupModalOpen(false);
    setBackupPassword('');
    onRefresh();
  };

  const handleFileSelectForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      setPendingFileContent(content);
      setRestoreModalOpen(true);
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!pendingFileContent) return;

    try {
      let finalJsonStr = pendingFileContent;

      // Check if file is encrypted AES-GCM
      if (pendingFileContent.includes('"format": "AES-GCM-256"')) {
        if (!restorePassword) {
          showToast({ type: 'warning', message: 'Masukkan password untuk membuka backup terenkripsi' });
          return;
        }
        finalJsonStr = await securityService.decryptBackup(pendingFileContent, restorePassword);
      }

      const validated = dataTransferService.validateImportJson(finalJsonStr);
      await repository.importFullData(validated);

      showToast({ type: 'success', message: 'Data backup berhasil dipulihkan secara penuh!' });
      setRestoreModalOpen(false);
      setPendingFileContent(null);
      setRestorePassword('');
      onRefresh();
    } catch (err: unknown) {
      showToast({ type: 'warning', message: (err as Error).message });
    }
  };

  const handleExportCsvTransactions = async () => {
    const [txs, accs, cats] = await Promise.all([
      repository.getTransactions(),
      repository.getAccounts(),
      repository.getCategories(),
    ]);
    const csv = dataTransferService.generateTransactionsCsv(txs, accs, cats);
    dataTransferService.downloadCsv(
      csv,
      `NubungYuk-Transaksi-${new Date().toISOString().slice(0, 10)}.csv`
    );
    showToast({ type: 'success', message: 'CSV Transaksi berhasil diunduh' });
  };

  const handleExportCsvDebts = async () => {
    const [debts, people, payments] = await Promise.all([
      repository.getDebts(),
      repository.getPeople(),
      repository.getDebtPayments(),
    ]);
    const csv = dataTransferService.generateDebtsCsv(debts, people, payments);
    dataTransferService.downloadCsv(
      csv,
      `NubungYuk-Utang-${new Date().toISOString().slice(0, 10)}.csv`
    );
    showToast({ type: 'success', message: 'CSV Utang berhasil diunduh' });
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      showToast({ type: 'warning', message: 'Nama kategori wajib diisi' });
      return;
    }
    await repository.createCategory({
      nama: catName.trim(),
      jenis: catType,
      ikon: 'Tag',
      warna: catColor,
    });
    showToast({ type: 'success', message: `Kategori "${catName}" dibuat` });
    setCatModalOpen(false);
    setCatName('');
    onRefresh();
  };

  const handleDeleteCategory = async (cat: Category) => {
    await repository.deleteCategory(cat.id);
    showToast({ type: 'info', message: `Kategori "${cat.nama}" dihapus` });
    onRefresh();
  };

  const handleWipeAll = async () => {
    if (wipeConfirmText !== 'HAPUS SEMUA DATA') {
      showToast({ type: 'warning', message: 'Teks konfirmasi tidak cocok' });
      return;
    }
    await repository.wipeAllData();
    setWipeModalOpen(false);
    setWipeConfirmText('');
    showToast({ type: 'success', message: 'Semua data telah dibersihkan' });
    onRefresh();
  };

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Pengaturan</h1>
        <p className="text-xs text-slate-500">Sesuaikan tema, suara, privasi, dan manajemen data</p>
      </div>

      {/* SECTION 1: APPEARANCE & THEME */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Palette className="w-5 h-5 text-[var(--color-primary)]" />
          <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Tampilan & Palet Warna
          </h2>
        </div>

        {/* Theme mode */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Mode Tema
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleUpdateTheme(t)}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize cursor-pointer transition-all ${
                  settings.theme === t
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {t === 'system' ? 'Ikuti Sistem' : t === 'dark' ? 'Gelap' : 'Terang'}
              </button>
            ))}
          </div>
        </div>

        {/* Palettes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            6 Preset Palet Warna
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.values(PALETTES).map((pal) => (
              <button
                key={pal.id}
                onClick={() => handleUpdateTheme(settings.theme, pal.id)}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                  settings.colorPreset === pal.id
                    ? 'ring-2 ring-[var(--color-primary)] border-slate-700 bg-slate-50 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: pal.primaryHex }}
                />
                <span className="truncate">{pal.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: AUDIO & HAPTICS */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Volume2 className="w-5 h-5 text-sky-500" />
          <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Suara Interaktif & Haptik
          </h2>
        </div>

        <div>
          <div className="flex justify-between text-xs font-semibold mb-2">
            <span>Volume Suara Sintesis</span>
            <span>{settings.soundVolume}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.soundVolume}
            onChange={async (e) => {
              const v = Number(e.target.value);
              await repository.updateSettings({ soundVolume: v });
              soundService.updateConfig(v);
              onRefresh();
            }}
            className="w-full accent-[var(--color-primary)] cursor-pointer"
          />
        </div>

        {/* Sound style */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Gaya Suara
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['modern', 'lembut', 'tegas', 'retro'] as const).map((style) => (
              <button
                key={style}
                onClick={async () => {
                  await repository.updateSettings({ soundStyle: style });
                  soundService.updateConfig(undefined, undefined, style);
                  soundService.play('click');
                  onRefresh();
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize cursor-pointer transition-all ${
                  settings.soundStyle === style
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <SoundButton
            size="sm"
            variant="outline"
            sound="click"
            onClick={() => soundService.play('click')}
          >
            <span>Uji Suara Klik</span>
          </SoundButton>

          <SoundButton
            size="sm"
            variant="outline"
            sound="success"
            onClick={() => soundService.play('success')}
          >
            <span>Uji Suara Sukses</span>
          </SoundButton>
        </div>
      </div>

      {/* SECTION 3: SECURITY & PRIVACY */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Shield className="w-5 h-5 text-emerald-500" />
          <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Keamanan & Privasi
          </h2>
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
          <div>
            <span className="text-xs font-semibold block text-slate-900 dark:text-slate-100">
              Kunci Aplikasi dengan PIN
            </span>
            <span className="text-[11px] text-slate-400">
              {settings.pinEnabled ? 'Aktif (PIN di-hash dengan PBKDF2)' : 'Belum diaktifkan'}
            </span>
          </div>

          {settings.pinEnabled ? (
            <div className="flex gap-2">
              <SoundButton size="sm" variant="outline" onClick={() => setPinModalOpen(true)}>
                Ganti PIN
              </SoundButton>
              <SoundButton size="sm" variant="danger" sound="delete" onClick={handleRemovePin}>
                Hapus
              </SoundButton>
            </div>
          ) : (
            <SoundButton size="sm" onClick={() => setPinModalOpen(true)}>
              Atur PIN
            </SoundButton>
          )}
        </div>

        {/* Honest Security Disclaimer */}
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
          <strong>Perhatian Keamanan:</strong> Enkripsi dan PIN di sisi klien melindungi dari orang
          yang membuka aplikasi di HP Anda, bukan dari orang yang memiliki akses root/akses penuh ke
          sistem perangkat yang tidak terkunci.
        </div>
      </div>

      {/* SECTION 4: CATEGORY MANAGEMENT */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Kategori Transaksi ({categories.length})
            </h2>
          </div>

          <SoundButton size="sm" sound="click" onClick={() => setCatModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Tambah Kategori</span>
          </SoundButton>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: c.warna }}
                />
                <span className="font-medium truncate">{c.nama}</span>
              </div>
              <button
                onClick={() => handleDeleteCategory(c)}
                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 5: BACKUP, RESTORE & EXPORT */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-purple-500" />
          <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
            Cadangkan, Pulihkan & Ekspor
          </h2>
        </div>

        {/* Persistent Storage indicator */}
        <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-slate-400" />
            <span>Penyimpanan Persisten Browser:</span>
          </div>
          <span
            className={`font-semibold ${
              isPersisted ? 'text-emerald-600' : 'text-amber-500'
            }`}
          >
            {isPersisted ? 'Aktif (Aman dari pembersihan otomatis)' : 'Standar'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SoundButton
            variant="outline"
            sound="click"
            onClick={() => {
              setUseEncryption(false);
              setBackupModalOpen(true);
            }}
          >
            <Download className="w-4 h-4" />
            <span>Cadangkan Data (JSON)</span>
          </SoundButton>

          <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
            <Upload className="w-4 h-4" />
            <span>Pulihkan Data (Restore)</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelectForRestore}
              className="hidden"
            />
          </label>

          <SoundButton variant="outline" sound="click" onClick={handleExportCsvTransactions}>
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor CSV Transaksi</span>
          </SoundButton>

          <SoundButton variant="outline" sound="click" onClick={handleExportCsvDebts}>
            <FileSpreadsheet className="w-4 h-4 text-sky-600" />
            <span>Ekspor CSV Utang</span>
          </SoundButton>

          <SoundButton
            variant="outline"
            sound="click"
            onClick={() => window.print()}
            className="sm:col-span-2"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Laporan / Simpan PDF</span>
          </SoundButton>
        </div>
      </div>

      {/* SECTION 6: DANGER ZONE (WIPE DATA) */}
      <div className="p-5 rounded-3xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 shadow-xs space-y-3">
        <h2 className="font-bold text-sm text-rose-700 dark:text-rose-400">Zona Bahaya</h2>
        <p className="text-xs text-rose-600/80 leading-relaxed">
          Menghapus seluruh tabungan, transaksi, catatan utang, dan kontak secara permanen dari
          perangkat ini.
        </p>

        <SoundButton
          variant="danger"
          sound="delete"
          onClick={() => setWipeModalOpen(true)}
        >
          <Trash2 className="w-4 h-4" />
          <span>Hapus Seluruh Data Aplikasi</span>
        </SoundButton>
      </div>

      {/* Backup Modal */}
      <Modal
        isOpen={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
        title="Cadangkan Data (Backup)"
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-semibold">
            <input
              type="checkbox"
              checked={useEncryption}
              onChange={(e) => setUseEncryption(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span>Enkripsi file backup dengan Password (AES-GCM 256-bit)</span>
          </label>

          {useEncryption && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password Enkripsi (Minimal 6 Karakter)
              </label>
              <input
                type="password"
                placeholder="Masukkan password kuat..."
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
              />
              <p className="text-[11px] text-amber-500 mt-1">
                Peringatan: Jika password hilang, file backup terenkripsi tidak dapat dipulihkan oleh
                siapa pun!
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <SoundButton
              variant="secondary"
              onClick={() => setBackupModalOpen(false)}
              className="flex-1"
            >
              Batal
            </SoundButton>
            <SoundButton onClick={handleExportBackup} className="flex-1" sound="success">
              Unduh Backup
            </SoundButton>
          </div>
        </div>
      </Modal>

      {/* Restore Password Prompt Modal */}
      <Modal
        isOpen={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        title="Konfirmasi Pemulihan Data"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Data aktif saat ini akan digantikan dengan data yang ada di dalam file cadangan.
          </p>

          {pendingFileContent?.includes('"format": "AES-GCM-256"') && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                File terenkripsi. Masukkan Password:
              </label>
              <input
                type="password"
                placeholder="Password cadangan..."
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <SoundButton
              variant="secondary"
              onClick={() => setRestoreModalOpen(false)}
              className="flex-1"
            >
              Batal
            </SoundButton>
            <SoundButton onClick={handleExecuteRestore} className="flex-1" sound="success">
              Pulihkan Sekarang
            </SoundButton>
          </div>
        </div>
      </Modal>

      {/* Set PIN Modal */}
      <Modal isOpen={pinModalOpen} onClose={() => setPinModalOpen(false)} title="Atur PIN Aplikasi">
        <form onSubmit={handleSavePin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Masukkan 4 - 8 Digit Angka
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              placeholder="Contoh: 1234"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-lg tracking-widest text-center font-bold"
              autoFocus
            />
          </div>

          <div className="flex gap-2 pt-2">
            <SoundButton
              type="button"
              variant="secondary"
              onClick={() => setPinModalOpen(false)}
              className="flex-1"
            >
              Batal
            </SoundButton>
            <SoundButton type="submit" className="flex-1" sound="success">
              Simpan PIN
            </SoundButton>
          </div>
        </form>
      </Modal>

      {/* Create Category Modal */}
      <Modal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="Tambah Kategori Baru"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Kategori
            </label>
            <input
              type="text"
              placeholder="Contoh: Makanan, Transportasi, Gaji"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Jenis Kategori
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCatType('keluar')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                  catType === 'keluar'
                    ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-600'
                    : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                Pengeluaran
              </button>
              <button
                type="button"
                onClick={() => setCatType('masuk')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                  catType === 'masuk'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                    : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                Pemasukan
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Warna Kategori
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={catColor}
                onChange={(e) => setCatColor(e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
              />
              <span className="text-xs font-mono">{catColor}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <SoundButton
              type="button"
              variant="secondary"
              onClick={() => setCatModalOpen(false)}
              className="flex-1"
            >
              Batal
            </SoundButton>
            <SoundButton type="submit" className="flex-1" sound="success">
              Simpan Kategori
            </SoundButton>
          </div>
        </form>
      </Modal>

      {/* Wipe All Confirmation Modal */}
      <Modal
        isOpen={wipeModalOpen}
        onClose={() => setWipeModalOpen(false)}
        title="Konfirmasi Hapus Seluruh Data"
      >
        <div className="space-y-4">
          <p className="text-xs text-rose-600 leading-relaxed font-semibold">
            Tindakan ini akan mengosongkan seluruh IndexedDB lokal. Ketik teks berikut untuk
            mengonfirmasi: <strong>HAPUS SEMUA DATA</strong>
          </p>

          <input
            type="text"
            value={wipeConfirmText}
            onChange={(e) => setWipeConfirmText(e.target.value)}
            placeholder="HAPUS SEMUA DATA"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-rose-300 dark:border-rose-800 text-sm font-bold text-center"
          />

          <div className="flex gap-2 pt-2">
            <SoundButton
              variant="secondary"
              onClick={() => setWipeModalOpen(false)}
              className="flex-1"
            >
              Batal
            </SoundButton>
            <SoundButton
              variant="danger"
              sound="delete"
              disabled={wipeConfirmText !== 'HAPUS SEMUA DATA'}
              onClick={handleWipeAll}
              className="flex-1"
            >
              Hapus Permanen
            </SoundButton>
          </div>
        </div>
      </Modal>
    </div>
  );
};
