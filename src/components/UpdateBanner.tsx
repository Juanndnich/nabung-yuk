import React from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { SoundButton } from './SoundButton';

interface UpdateBannerProps {
  needRefresh: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  needRefresh,
  onUpdate,
  onDismiss,
}) => {
  if (!needRefresh) return null;

  return (
    <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto p-4 rounded-2xl bg-slate-900 text-white border border-[var(--color-primary)] shadow-2xl backdrop-blur-md animate-slide-down flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-xs">Pembaruan Tersedia</h4>
          <p className="text-[11px] text-slate-300">
            Versi baru Nubung Yuk siap digunakan. Muat ulang sekarang?
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onDismiss}
          className="text-xs text-slate-400 hover:text-white px-2 py-1"
        >
          Nanti
        </button>
        <SoundButton size="sm" sound="success" onClick={onUpdate}>
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Muat Ulang</span>
        </SoundButton>
      </div>
    </div>
  );
};
