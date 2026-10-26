import React, { useState } from 'react';
import {
  Wallet,
  Palette,
  Shield,
  Volume2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Layers,
} from 'lucide-react';
import { SoundButton } from '../../components/SoundButton';
import { CurrencyInput } from '../../components/CurrencyInput';
import { ColorPreset, ThemeMode } from '../../domain/types';
import { PALETTES, applyTheme } from '../../styles/theme';
import { repository } from '../../db/repository';
import { securityService } from '../../services/security';
import { soundService } from '../../services/audio';

interface OnboardingModalProps {
  isOpen: boolean;
  onFinish: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onFinish }) => {
  const [step, setStep] = useState(1);

  // Form states
  const [namaTabungan, setNamaTabungan] = useState('');
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>('system');
  const [selectedPreset, setSelectedPreset] = useState<ColorPreset>('teal');

  // PIN
  const [setupPin, setSetupPin] = useState(false);
  const [pinVal, setPinVal] = useState('');

  // Audio
  const [soundVolume, setSoundVolume] = useState(75);

  if (!isOpen) return null;

  const handleComplete = async () => {
    soundService.play('success');

    // 1. If user entered a first wallet name, create it
    if (namaTabungan.trim()) {
      await repository.createAccount({
        nama: namaTabungan.trim(),
        ikon: 'Wallet',
        warna: PALETTES[selectedPreset].primaryHex,
        saldoAwal,
        diarsipkan: false,
      });
    }

    // 2. PIN setup if requested
    let pinHash: string | undefined = undefined;
    let pinSalt: string | undefined = undefined;
    let pinEnabled = false;

    if (setupPin && pinVal.length >= 4) {
      const res = await securityService.hashPin(pinVal);
      pinHash = res.hashHex;
      pinSalt = res.saltHex;
      pinEnabled = true;
    }

    // 3. Update settings
    await repository.updateSettings({
      hasCompletedOnboarding: true,
      theme: selectedTheme,
      colorPreset: selectedPreset,
      soundVolume,
      pinEnabled,
      pinHash,
      pinSalt,
    });

    applyTheme(selectedTheme, selectedPreset);
    onFinish();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === step
                    ? 'w-7 bg-[var(--color-primary)]'
                    : s < step
                    ? 'w-4 bg-emerald-500'
                    : 'w-2 bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleComplete}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            Lewati
          </button>
        </div>

        {/* STEP 1: Welcome */}
        {step === 1 && (
          <div className="flex flex-col items-center text-center py-4 animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary)]/15 text-[var(--color-primary)] flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Selamat Datang di Nubung Yuk
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
              Aplikasi pencatat tabungan pribadi & buku utang offline-first. Privasi 100% milik Anda —
              tanpa server, tanpa akun, tanpa pelacak.
            </p>
            <SoundButton
              onClick={() => setStep(2)}
              className="w-full max-w-xs"
              sound="click"
            >
              <span>Mulai Pengaturan</span>
              <ArrowRight className="w-4 h-4" />
            </SoundButton>
          </div>
        )}

        {/* STEP 2: First Wallet */}
        {step === 2 && (
          <div className="flex flex-col py-2 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Buat Tabungan Pertama
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Saldo awal boleh Rp0 atau sesuai simpanan Anda saat ini.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Nama Tabungan / Dompet
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Tabungan Utama, Dompet Saku, Rekening BCA"
                  value={namaTabungan}
                  onChange={(e) => setNamaTabungan(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Saldo Awal
                </label>
                <CurrencyInput value={saldoAwal} onChange={setSaldoAwal} placeholder="Rp0" />
              </div>
            </div>

            <div className="flex gap-2">
              <SoundButton variant="secondary" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </SoundButton>
              <SoundButton onClick={() => setStep(3)} className="flex-1">
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4" />
              </SoundButton>
            </div>
          </div>
        )}

        {/* STEP 3: Pos Tabungan (Amplop) */}
        {step === 3 && (
          <div className="flex flex-col py-2 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Pos Tabungan (Amplop)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bagi saldo tabungan Anda ke beberapa pos alokasi mandiri.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    1
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    Setiap tabungan otomatis memiliki pos <strong>"Belum dialokasikan"</strong> untuk menampung sisa saldo yang belum dibagi.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    2
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    Buat pos kustom (misal: Jajan, Transportasi, Dana Darurat) dengan batas bulanan dan target tabungan.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    3
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    Uang masuk dapat dibagi otomatis (persen atau nominal) atau pindahkan dana antar pos secara bebas tanpa mengotori statistik pengeluaran.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <SoundButton variant="secondary" onClick={() => setStep(2)} className="flex-1">
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </SoundButton>
              <SoundButton onClick={() => setStep(4)} className="flex-1">
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4" />
              </SoundButton>
            </div>
          </div>
        )}

        {/* STEP 4: Theme & Palette */}
        {step === 4 && (
          <div className="flex flex-col py-2 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Pilih Tampilan & Tema
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pilih suasana warna yang paling nyaman di mata Anda.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mode Tema
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['light', 'dark', 'system'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setSelectedTheme(t);
                        applyTheme(t, selectedPreset);
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all cursor-pointer ${
                        selectedTheme === t
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t === 'system' ? 'Sistem' : t === 'dark' ? 'Gelap' : 'Terang'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Preset Palet Warna
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(PALETTES).map((pal) => (
                    <button
                      key={pal.id}
                      onClick={() => {
                        setSelectedPreset(pal.id);
                        applyTheme(selectedTheme, pal.id);
                      }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                        selectedPreset === pal.id
                          ? 'border-slate-800 dark:border-slate-200 ring-2 ring-[var(--color-primary)] bg-slate-50 dark:bg-slate-800'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: pal.primaryHex }}
                      />
                      <span className="truncate text-slate-800 dark:text-slate-200">{pal.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <SoundButton variant="secondary" onClick={() => setStep(3)} className="flex-1">
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </SoundButton>
              <SoundButton onClick={() => setStep(5)} className="flex-1">
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4" />
              </SoundButton>
            </div>
          </div>
        )}

        {/* STEP 5: Security (PIN) */}
        {step === 5 && (
          <div className="flex flex-col py-2 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Keamanan & Kunci PIN
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Lindungi aplikasi dari orang lain yang meminjam HP Anda (opsional).
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={setupPin}
                  onChange={(e) => setSetupPin(e.target.checked)}
                  className="w-5 h-5 accent-[var(--color-primary)] rounded"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Aktifkan Kunci PIN Aplikasi Sekarang
                </span>
              </label>

              {setupPin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Buat PIN (4 - 6 Digit Angka)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Contoh: 1234"
                    value={pinVal}
                    onChange={(e) => setPinVal(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-lg tracking-widest text-center font-bold focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    PIN di-hash dengan PBKDF2 (Web Crypto) dan tidak pernah disimpan polos.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <SoundButton variant="secondary" onClick={() => setStep(4)} className="flex-1">
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </SoundButton>
              <SoundButton onClick={() => setStep(6)} className="flex-1">
                <span>Lanjut</span>
                <ArrowRight className="w-4 h-4" />
              </SoundButton>
            </div>
          </div>
        )}

        {/* STEP 6: Audio & Finish */}
        {step === 6 && (
          <div className="flex flex-col py-2 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Efek Suara Interaktif
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Setiap tombol memberikan feedback audio halus (disintesis langsung).
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2 text-slate-700 dark:text-slate-300">
                  <span>Volume Suara</span>
                  <span>{soundVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={soundVolume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSoundVolume(v);
                    soundService.updateConfig(v);
                  }}
                  className="w-full accent-[var(--color-primary)] cursor-pointer"
                />
              </div>

              <div className="flex justify-center pt-2">
                <SoundButton
                  variant="outline"
                  size="sm"
                  sound="click"
                  onClick={() => soundService.play('click')}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Uji Suara Klik</span>
                </SoundButton>
              </div>
            </div>

            <div className="flex gap-2">
              <SoundButton variant="secondary" onClick={() => setStep(5)} className="flex-1">
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </SoundButton>
              <SoundButton onClick={handleComplete} className="flex-1">
                <Check className="w-4 h-4" />
                <span>Selesai & Mulai</span>
              </SoundButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
