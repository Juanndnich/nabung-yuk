import React, { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Upload, RotateCcw, Check, Sparkles, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { SoundButton } from '../../components/SoundButton';
import { Modal } from '../../components/Modal';

interface AppIconModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIcon?: string;
  onSave: (iconDataUrl?: string) => Promise<void>;
}

export const AppIconModal: React.FC<AppIconModalProps> = ({
  isOpen,
  onClose,
  currentIcon,
  onSave,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Format file tidak didukung. Harap pilih gambar PNG, JPEG, atau WebP.');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file terlalu besar. Maksimum 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageSrc(reader.result as string);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    });
    reader.readAsDataURL(file);
  };

  const createCroppedImage = async (): Promise<string> => {
    if (!imageSrc || !croppedAreaPixels) throw new Error('Data gambar tidak valid');

    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context tidak tersedia');

    const targetSize = 512;
    canvas.width = targetSize;
    canvas.height = targetSize;

    ctx.drawImage(
      image,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      targetSize,
      targetSize
    );

    return canvas.toDataURL('image/png', 0.92);
  };

  const handleSave = async () => {
    try {
      setIsProcessing(true);
      if (imageSrc && croppedAreaPixels) {
        const croppedDataUrl = await createCroppedImage();
        await onSave(croppedDataUrl);
      }
      onClose();
    } catch {
      setErrorMsg('Gagal memproses gambar ikon.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsProcessing(true);
      await onSave(undefined);
      setImageSrc(null);
      onClose();
    } catch {
      setErrorMsg('Gagal mereset ikon.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kustomisasi Ikon Logo Aplikasi" size="md">
      <div className="space-y-4">
        {/* Current / Preview */}
        {!imageSrc ? (
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl text-center space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700">
              {currentIcon ? (
                <img src={currentIcon} alt="Ikon Sekarang" className="w-full h-full object-cover" />
              ) : (
                <img src="/pwa-192x192.png" alt="Ikon Standar" className="w-14 h-14 object-contain" />
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Pilih Foto atau Gambar Ikon
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Format PNG, JPEG, atau WebP (Maksimal 5MB). Rasio persegi 1:1.
              </p>
            </div>

            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-semibold cursor-pointer shadow-xs hover:brightness-110 active:scale-95 transition-all">
              <Upload className="w-4 h-4" />
              <span>Pilih Gambar dari Perangkat</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {currentIcon && (
              <SoundButton
                variant="ghost"
                size="sm"
                sound="delete"
                onClick={handleReset}
                className="text-rose-500 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke Ikon Bawaan Project</span>
              </SoundButton>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cropper Container */}
            <div className="relative w-full h-64 bg-slate-900 rounded-2xl overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            {/* Zoom Slider */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                <span>Perbesar / Zoom</span>
                <span>{zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)] cursor-pointer"
              />
            </div>

            {/* Live Dual Preview */}
            <div className="flex items-center justify-around p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 text-center">
              <div>
                <span className="block text-[11px] font-medium text-slate-500 mb-1">Pratinjau Persegi</span>
                <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 mx-auto overflow-hidden shadow-xs flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                </div>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-slate-500 mb-1">Pratinjau Bulat</span>
                <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 mx-auto overflow-hidden shadow-xs flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-center">
                  <Upload className="w-4 h-4" />
                  <span>Ganti File</span>
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <SoundButton
                onClick={handleSave}
                disabled={isProcessing}
                className="flex-1"
                sound="success"
              >
                <Check className="w-4 h-4" />
                <span>{isProcessing ? 'Menyimpan...' : 'Terapkan Ikon'}</span>
              </SoundButton>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Honest Disclaimer */}
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Informasi Penting Ikon PWA</span>
          </div>
          <p>
            Ikon kustom ini disimpan secara lokal dan langsung diterapkan pada logo di dalam aplikasi (Header, Layar Kunci PIN, dan halaman Tentang).
          </p>
          <p className="text-amber-700 dark:text-amber-400 font-medium">
            * Ikon di Layar Utama HP / Desktop OS mengikuti file manifest bawaan project (<code className="font-mono text-[10px]">public/branding/icon-source.png</code>) dan baru berubah di OS setelah aplikasi di-build ulang dan dipasang kembali.
          </p>
        </div>
      </div>
    </Modal>
  );
};
