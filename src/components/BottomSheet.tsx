import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { SoundButton } from './SoundButton';
import { soundService } from '../services/audio';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    if (isOpen) {
      soundService.play('panel');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs">
      <div
        className="fixed inset-0"
        onClick={() => {
          soundService.play('panel');
          onClose();
        }}
      />
      <div className="relative w-full max-w-lg mx-auto bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 animate-slide-up">
        {/* Drag pill handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1" />

        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <SoundButton
            variant="ghost"
            size="icon"
            sound="click"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </SoundButton>
        </div>

        <div className="p-5 overflow-y-auto pb-8">{children}</div>
      </div>
    </div>
  );
};
