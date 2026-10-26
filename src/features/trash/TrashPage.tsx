import React, { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { TrashItem } from '../../domain/types';
import { SoundButton } from '../../components/SoundButton';
import { repository } from '../../db/repository';
import { useToast } from '../../context/ToastContext';

interface TrashPageProps {
  trashItems: TrashItem[];
  onRefresh: () => void;
}

export const TrashPage: React.FC<TrashPageProps> = ({ trashItems, onRefresh }) => {
  const { showToast } = useToast();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const handleRestore = async (item: TrashItem) => {
    const ok = await repository.restoreFromTrash(item.id);
    if (ok) {
      showToast({ type: 'success', message: `${item.judul} berhasil dipulihkan` });
      onRefresh();
    }
  };

  const handleDeletePermanent = async (item: TrashItem) => {
    await repository.deletePermanent(item.id);
    showToast({ type: 'info', message: `${item.judul} dihapus permanen` });
    onRefresh();
  };

  const handleEmptyAll = async () => {
    await repository.emptyTrash();
    setConfirmEmpty(false);
    showToast({ type: 'success', message: 'Tempat sampah berhasil dikosongkan' });
    onRefresh();
  };

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Tempat Sampah</h1>
          <p className="text-xs text-slate-500">
            Data yang dihapus tersimpan di sini dan dapat dipulihkan kapan saja
          </p>
        </div>

        {trashItems.length > 0 && (
          <SoundButton
            size="sm"
            variant="danger"
            sound="delete"
            onClick={() => setConfirmEmpty(true)}
          >
            <Trash2 className="w-4 h-4" />
            <span>Kosongkan Semua</span>
          </SoundButton>
        )}
      </div>

      {confirmEmpty && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>Yakin hapus permanen semua data di tempat sampah? Tindakan ini tidak bisa dibatalkan.</span>
          </div>
          <div className="flex gap-2">
            <SoundButton size="sm" variant="secondary" onClick={() => setConfirmEmpty(false)}>
              Batal
            </SoundButton>
            <SoundButton size="sm" variant="danger" sound="delete" onClick={handleEmptyAll}>
              Ya, Kosongkan
            </SoundButton>
          </div>
        </div>
      )}

      {trashItems.length > 0 ? (
        <div className="space-y-2.5">
          {trashItems.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                    {item.judul}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {item.entitasTipe}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Dihapus pada: {item.tanggalDihapus.slice(0, 10)} {item.tanggalDihapus.slice(11, 16)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <SoundButton
                  size="sm"
                  variant="outline"
                  sound="success"
                  onClick={() => handleRestore(item)}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Pulihkan</span>
                </SoundButton>

                <button
                  onClick={() => handleDeletePermanent(item)}
                  title="Hapus Permanen"
                  className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
          <Trash2 className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Tempat sampah kosong
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Tidak ada data yang dihapus saat ini.
          </p>
        </div>
      )}
    </div>
  );
};
