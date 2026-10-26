import React, { useState } from 'react';
import {
  Split,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { Account, AutoAllocationItem, AutoAllocationRule, Pocket } from '../../domain/types';
import { calculateAutoAllocation, formatRupiah } from '../../domain/accounting';
import { SoundButton } from '../../components/SoundButton';
import { Modal } from '../../components/Modal';
import { CurrencyInput } from '../../components/CurrencyInput';
import { repository } from '../../db/repository';
import { useToast } from '../../context/ToastContext';

interface AutoAllocationRulesSectionProps {
  accounts: Account[];
  pockets: Pocket[];
  rules: AutoAllocationRule[];
  onRefresh: () => void;
}

export const AutoAllocationRulesSection: React.FC<AutoAllocationRulesSectionProps> = ({
  accounts,
  pockets,
  rules,
  onRefresh,
}) => {
  const { showToast, showUndoToast } = useToast();

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts[0]?.id || ''
  );

  // Modal create/edit rule
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoAllocationRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleItems, setRuleItems] = useState<AutoAllocationItem[]>([]);
  const [previewNominal, setPreviewNominal] = useState<number>(1000000); // 1 Juta default test
  const [validationError, setValidationError] = useState<string | null>(null);

  const accountPockets = pockets.filter(
    (p) => p.tabunganId === selectedAccountId && !p.isDeleted && !p.isSystem
  );
  const sysPocket = pockets.find(
    (p) => p.tabunganId === selectedAccountId && p.isSystem
  );

  const filteredRules = rules.filter(
    (r) => r.tabunganId === selectedAccountId && !r.isDeleted
  );

  const openAddRule = () => {
    setEditingRule(null);
    setRuleName('');
    setRuleItems(
      accountPockets.slice(0, 2).map((p) => ({
        posId: p.id,
        type: 'persen',
        value: 20,
      }))
    );
    setValidationError(null);
    setModalOpen(true);
  };

  const openEditRule = (rule: AutoAllocationRule) => {
    setEditingRule(rule);
    setRuleName(rule.nama);
    setRuleItems([...rule.items]);
    setValidationError(null);
    setModalOpen(true);
  };

  const handleAddItem = () => {
    const unselected = accountPockets.find((p) => !ruleItems.some((it) => it.posId === p.id));
    if (!unselected) {
      showToast({ type: 'info', message: 'Semua pos sudah dimasukkan ke aturan ini' });
      return;
    }
    setRuleItems((prev) => [...prev, { posId: unselected.id, type: 'persen', value: 10 }]);
  };

  const handleRemoveItem = (index: number) => {
    setRuleItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, updates: Partial<AutoAllocationItem>) => {
    setRuleItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...updates } : it))
    );
  };

  // Preview calculation
  let previewResult = null;
  let calcError = null;
  try {
    if (sysPocket) {
      previewResult = calculateAutoAllocation(previewNominal, ruleItems, sysPocket.id);
    }
  } catch (err: unknown) {
    calcError = err instanceof Error ? err.message : 'Perhitungan alokasi gagal';
  }

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      setValidationError('Nama aturan tidak boleh kosong');
      return;
    }
    if (ruleItems.length === 0) {
      setValidationError('Tambahkan minimal 1 pos dalam aturan bagi');
      return;
    }

    // Check percent total
    const totalPercent = ruleItems
      .filter((it) => it.type === 'persen')
      .reduce((sum, it) => sum + it.value, 0);

    if (totalPercent > 100) {
      setValidationError('Total persentase tidak boleh melebihi 100%');
      return;
    }

    try {
      if (editingRule) {
        await repository.updateAutoAllocationRule(editingRule.id, {
          nama: ruleName.trim(),
          items: ruleItems,
        });
        showToast({ type: 'success', message: `Aturan "${ruleName}" berhasil diperbarui.` });
      } else {
        await repository.createAutoAllocationRule({
          tabunganId: selectedAccountId,
          nama: ruleName.trim(),
          items: ruleItems,
          aktif: true,
        });
        showToast({ type: 'success', message: `Aturan "${ruleName}" berhasil dibuat.` });
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan aturan.';
      setValidationError(msg);
    }
  };

  const handleDeleteRule = async (rule: AutoAllocationRule) => {
    try {
      const trashItem = await repository.deleteAutoAllocationRule(rule.id);
      showUndoToast(`Aturan "${rule.nama}" dihapus.`, async () => {
        await repository.restoreFromTrash(trashItem.id);
        onRefresh();
      });
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus aturan.';
      showToast({ type: 'warning', message: msg });
    }
  };

  const pocketMap = new Map<string, Pocket>(pockets.map((p) => [p.id, p]));

  return (
    <div className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Split className="w-5 h-5 text-indigo-500" />
          <div>
            <h2 className="font-bold text-sm text-[var(--text-primary)]">
              Aturan Bagi Otomatis (Pos Tabungan)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Bagi pemasukan secara otomatis ke beberapa pos saat uang masuk
            </p>
          </div>
        </div>

        {accounts.length > 1 && (
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.nama}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Rules list */}
      {filteredRules.length === 0 ? (
        <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Split className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Belum ada aturan bagi otomatis untuk tabungan ini.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
            Aturan ini memudahkan Anda langsung memecah gaji/pemasukan ke pos-pos kebutuhan.
          </p>
          <SoundButton size="sm" sound="click" onClick={openAddRule}>
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Aturan Bagi</span>
          </SoundButton>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRules.map((rule) => (
            <div
              key={rule.id}
              className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {rule.nama}
                  </h4>
                  <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md">
                    {rule.items.length} Pos
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {rule.items.map((it, idx) => {
                    const p = pocketMap.get(it.posId);
                    return (
                      <span
                        key={idx}
                        className="text-[11px] bg-white dark:bg-slate-700 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 flex items-center gap-1"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: p?.warna || '#64748b' }}
                        />
                        <span>{p?.nama || 'Pos'}:</span>
                        <strong>
                          {it.type === 'persen' ? `${it.value}%` : formatRupiah(it.value)}
                        </strong>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <SoundButton
                  variant="ghost"
                  size="icon"
                  sound="click"
                  onClick={() => openEditRule(rule)}
                  title="Ubah Aturan"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                </SoundButton>
                <SoundButton
                  variant="ghost"
                  size="icon"
                  sound="delete"
                  onClick={() => handleDeleteRule(rule)}
                  className="text-rose-500"
                  title="Hapus Aturan"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </SoundButton>
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-1">
            <SoundButton size="sm" variant="outline" sound="click" onClick={openAddRule}>
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Aturan Baru</span>
            </SoundButton>
          </div>
        </div>
      )}

      {/* Modal CRUD Rule */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRule ? 'Ubah Aturan Bagi' : 'Buat Aturan Bagi Baru'}
        size="lg"
      >
        <form onSubmit={handleSaveRule} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Nama Aturan
            </label>
            <input
              type="text"
              placeholder="Contoh: Bagi Gaji Bulanan, Bonus Proyek"
              value={ruleName}
              onChange={(e) => {
                setRuleName(e.target.value);
                setValidationError(null);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Daftar Pos & Pembagian
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-[var(--color-primary)] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Pos</span>
              </button>
            </div>

            {accountPockets.length === 0 ? (
              <p className="text-xs text-amber-500">
                Belum ada pos kustom di tabungan ini. Buat pos terlebih dahulu di menu Buku Tabungan &rarr; Pos Tabungan.
              </p>
            ) : (
              <div className="space-y-2">
                {ruleItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                  >
                    {/* Pocket selector */}
                    <select
                      value={item.posId}
                      onChange={(e) => handleUpdateItem(idx, { posId: e.target.value })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-medium"
                    >
                      {accountPockets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama}
                        </option>
                      ))}
                    </select>

                    {/* Type switcher */}
                    <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateItem(idx, { type: 'persen' })}
                        className={`px-2 py-1 text-xs font-semibold cursor-pointer ${
                          item.type === 'persen'
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        %
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateItem(idx, { type: 'nominal' })}
                        className={`px-2 py-1 text-xs font-semibold cursor-pointer ${
                          item.type === 'nominal'
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Rp
                      </button>
                    </div>

                    {/* Value */}
                    <div className="w-28 shrink-0">
                      {item.type === 'persen' ? (
                        <div className="relative">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={item.value || ''}
                            onChange={(e) =>
                              handleUpdateItem(idx, { value: Number(e.target.value) })
                            }
                            className="w-full px-2 py-1.5 pr-6 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-bold"
                          />
                          <span className="absolute right-2 top-1.5 text-xs text-slate-400">%</span>
                        </div>
                      ) : (
                        <CurrencyInput
                          value={item.value}
                          onChange={(val) => handleUpdateItem(idx, { value: val })}
                          placeholder="Rp0"
                        />
                      )}
                    </div>

                    {/* Delete item */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Live Preview Section */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-indigo-500" />
                <span>Pratinjau Hasil Pembagian</span>
              </span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 text-[11px]">Uji Nominal:</span>
                <div className="w-28">
                  <CurrencyInput
                    value={previewNominal}
                    onChange={setPreviewNominal}
                    placeholder="Rp1.000.000"
                  />
                </div>
              </div>
            </div>

            {calcError ? (
              <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{calcError}</span>
              </div>
            ) : previewResult ? (
              <div className="space-y-1.5 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  {previewResult.allocations.map((a, i) => {
                    const p = pocketMap.get(a.posId);
                    return (
                      <div
                        key={i}
                        className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900/40 flex justify-between items-center"
                      >
                        <span className="truncate text-slate-700 dark:text-slate-300">
                          {p?.nama || 'Pos'}
                        </span>
                        <strong className="text-indigo-600 dark:text-indigo-400">
                          {formatRupiah(a.nominal)}
                        </strong>
                      </div>
                    );
                  })}
                </div>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span>Sisa ke "Belum dialokasikan":</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {formatRupiah(previewResult.unallocatedNominal)}
                  </strong>
                </div>
              </div>
            ) : null}
          </div>

          {validationError && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <SoundButton variant="ghost" onClick={() => setModalOpen(false)}>
              <span>Batal</span>
            </SoundButton>
            <SoundButton type="submit">
              <Check className="w-4 h-4" />
              <span>{editingRule ? 'Perbarui Aturan' : 'Simpan Aturan'}</span>
            </SoundButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};
