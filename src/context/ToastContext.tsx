import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { soundService } from '../services/audio';

export interface ToastItem {
  id: string;
  type: 'success' | 'warning' | 'info';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  showUndoToast: (message: string, onUndo: () => void, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, message, actionLabel, onAction, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      if (type === 'success') soundService.play('success');
      else if (type === 'warning') soundService.play('warning');

      setToasts((prev) => [...prev, { id, type, message, actionLabel, onAction, duration }]);

      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast]
  );

  const showUndoToast = useCallback(
    (message: string, onUndo: () => void, duration: number = 5000) => {
      showToast({
        type: 'info',
        message,
        actionLabel: 'Batal (Undo)',
        onAction: () => {
          soundService.play('success');
          onUndo();
        },
        duration,
      });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, showUndoToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-20 left-4 right-4 z-50 flex flex-col items-center pointer-events-none gap-2 max-w-md mx-auto">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="w-full flex items-center justify-between p-3.5 bg-slate-900/95 dark:bg-slate-800/95 text-white border border-slate-700/60 rounded-2xl shadow-xl backdrop-blur-md pointer-events-auto transition-all animate-bounce-in"
          >
            <div className="flex items-center gap-3 pr-2">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-sky-400 shrink-0" />}
              <span className="text-sm font-medium leading-snug">{toast.message}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {toast.actionLabel && toast.onAction && (
                <button
                  onClick={() => {
                    toast.onAction!();
                    removeToast(toast.id);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/60 hover:bg-emerald-900/80 rounded-lg border border-emerald-500/30 transition-colors"
                >
                  {toast.actionLabel}
                </button>
              )}
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-200 p-1"
                aria-label="Tutup notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
