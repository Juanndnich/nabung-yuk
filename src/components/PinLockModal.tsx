import React, { useState, useEffect } from 'react';
import { Delete, ShieldAlert } from 'lucide-react';
import { securityService } from '../services/security';
import { soundService } from '../services/audio';
import { repository } from '../db/repository';
import { AppSettings } from '../domain/types';

interface PinLockModalProps {
  settings: AppSettings;
  isOpen: boolean;
  onUnlocked: () => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  settings,
  isOpen,
  onUnlocked,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  useEffect(() => {
    // Check if locked out
    if (settings.pinLockedUntil && settings.pinLockedUntil > Date.now()) {
      const rem = Math.ceil((settings.pinLockedUntil - Date.now()) / 1000);
      setLockoutRemaining(rem);
    }
  }, [settings.pinLockedUntil]);

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemaining]);

  if (!isOpen) return null;

  const handleKeyPress = async (digit: string) => {
    if (lockoutRemaining > 0) return;
    soundService.play('tap');

    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg('');

    // Check if completed (PIN is 4 to 8 digits)
    if (nextPin.length >= 4 && settings.pinHash && settings.pinSalt) {
      const isValid = await securityService.verifyPin(
        nextPin,
        settings.pinHash,
        settings.pinSalt
      );

      if (isValid) {
        soundService.play('success');
        setPin('');
        await repository.updateSettings({
          pinFailedAttempts: 0,
          pinLockedUntil: undefined,
        });
        onUnlocked();
      } else if (nextPin.length >= 6) {
        // If max standard length or wrong
        handleFailedAttempt();
      }
    }
  };

  const handleBackspace = () => {
    soundService.play('click');
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleFailedAttempt = async () => {
    soundService.play('warning');
    const newAttempts = (settings.pinFailedAttempts || 0) + 1;
    const lockoutSec = securityService.calculateLockoutSeconds(newAttempts);
    let lockedUntil: number | undefined = undefined;

    if (lockoutSec > 0) {
      lockedUntil = Date.now() + lockoutSec * 1000;
      setLockoutRemaining(lockoutSec);
    }

    await repository.updateSettings({
      pinFailedAttempts: newAttempts,
      pinLockedUntil: lockedUntil,
    });

    setPin('');
    setErrorMsg(
      lockoutSec > 0
        ? `Terlalu banyak percobaan salah. Tunggu ${lockoutSec} detik.`
        : `PIN salah. Percobaan ke-${newAttempts}.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-6 select-none">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center mb-4 overflow-hidden border border-slate-800">
          {settings.customAppIcon ? (
            <img src={settings.customAppIcon} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <img
              src="/pwa-192x192.png"
              alt="Logo"
              className="w-12 h-12 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          )}
        </div>

        <h2 className="text-xl font-bold text-white mb-1">Masukkan PIN</h2>
        <p className="text-xs text-slate-400 mb-6">
          Aplikasi terkunci demi keamanan data keuangan Anda.
        </p>

        {/* PIN Indicators */}
        <div className="flex gap-4 mb-6">
          {[0, 1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                pin.length > idx
                  ? 'bg-[var(--color-primary)] scale-110 shadow-sm'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 mb-4 bg-rose-950/40 px-3 py-2 rounded-xl border border-rose-800/50">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {lockoutRemaining > 0 && (
          <div className="text-sm font-semibold text-amber-400 mb-4">
            Terkunci selama {lockoutRemaining} detik
          </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              disabled={lockoutRemaining > 0}
              onClick={() => handleKeyPress(digit)}
              className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-white font-semibold text-2xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer"
            >
              {digit}
            </button>
          ))}

          <div />

          <button
            disabled={lockoutRemaining > 0}
            onClick={() => handleKeyPress('0')}
            className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-white font-semibold text-2xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer"
          >
            0
          </button>

          <button
            disabled={pin.length === 0}
            onClick={handleBackspace}
            aria-label="Hapus digit"
            className="w-16 h-16 rounded-2xl bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
