import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart } from 'lucide-react';

interface AppLoadingScreenProps {
  progress: number; // 0 to 100
  stepLabel: string;
  customIcon?: string;
  reducedMotion?: boolean;
  isVisible: boolean;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  progress,
  stepLabel,
  customIcon,
  reducedMotion = false,
  isVisible,
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="app-loading-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.05 : 0.28, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[var(--bg-page)] text-[var(--text-primary)] select-none transition-colors"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center max-w-xs w-full text-center">
            {/* Logo with Soft Pulse */}
            <motion.div
              initial={reducedMotion ? false : { scale: 0.9, opacity: 0 }}
              animate={reducedMotion ? false : { scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative w-20 h-20 rounded-3xl bg-linear-to-br from-[var(--color-primary)] to-[var(--color-secondary)] p-1 shadow-xl shadow-blue-500/20 mb-5 flex items-center justify-center overflow-hidden"
            >
              {customIcon ? (
                <img
                  src={customIcon}
                  alt="Nubung Yuk"
                  className="w-full h-full object-cover rounded-[22px]"
                />
              ) : (
                <img
                  src="/pwa-192x192.png"
                  alt="Nubung Yuk"
                  className="w-full h-full object-cover rounded-[22px]"
                />
              )}
            </motion.div>

            {/* App Name */}
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] mb-1">
              Nubung Yuk
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium mb-6">
              Pencatatan Keuangan Pribadi & Utang
            </p>

            {/* Dynamic Real Progress Bar Track */}
            <div className="w-full relative py-3">
              <div className="w-full h-2 rounded-full bg-pink-100/70 dark:bg-pink-950/30 border border-[var(--border-color)] overflow-hidden relative">
                <motion.div
                  className="h-full rounded-full bg-linear-to-r from-pink-400 to-pink-500"
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
                  transition={{
                    duration: reducedMotion ? 0.05 : 0.2,
                    ease: 'easeOut',
                  }}
                />
              </div>

              {/* Heart icon sliding along the leading edge of progress */}
              {!reducedMotion && (
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 -ml-2.5 text-pink-500 drop-shadow-xs pointer-events-none"
                  initial={{ left: '5%' }}
                  animate={{ left: `${Math.min(96, Math.max(4, progress))}%` }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <div className="w-5 h-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-xs flex items-center justify-center">
                    <Heart className="w-2.5 h-2.5 fill-pink-500 text-pink-500 animate-pulse" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Real Progress Step Description */}
            <div className="flex items-center justify-between w-full mt-2 text-[11px] text-[var(--text-muted)] font-medium px-1">
              <span className="truncate max-w-[200px] text-left">{stepLabel}</span>
              <span className="tabular-nums font-semibold shrink-0">{Math.round(progress)}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
