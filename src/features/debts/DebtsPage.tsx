import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  User,
  CheckCircle2,
  Share2,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  Calendar,
} from 'lucide-react';
import {
  Account,
  AppSettings,
  Debt,
  DebtPayment,
  Person,
} from '../../domain/types';
import {
  formatRupiah,
  calculateDebtSummary,
} from '../../domain/accounting';
import { SoundButton } from '../../components/SoundButton';
import { Modal } from '../../components/Modal';
import { BottomSheet } from '../../components/BottomSheet';
import { CurrencyInput } from '../../components/CurrencyInput';
import { repository } from '../../db/repository';
import { useToast } from '../../context/ToastContext';
import { dataTransferService } from '../../services/dataTransfer';
import { triggerCelebration } from '../../utils/confetti';

interface DebtsPageProps {
  settings: AppSettings;
  debts: Debt[];
  debtPayments: DebtPayment[];
  people: Person[];
  accounts: Account[];
  onRefresh: () => void;
  onOpenQuickAction: (action: 'income' | 'expense' | 'transfer' | 'debt') => void;
}

export const DebtsPage: React.FC<DebtsPageProps> = ({
  settings,
  debts,
  debtPayments,
  people,
  accounts,
  onRefresh,
  onOpenQuickAction,
}) => {
  const { showToast, showUndoToast } = useToast();

  const [activeTab, setActiveTab] = useState<'per_catatan' | 'per_orang'>('per_catatan');
  const [filterDirection, setFilterDirection] = useState<'all' | 'piutang' | 'utang'>('all');
  const [filterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected debt for detail & installment modal
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentNominal, setPaymentNominal] = useState(0);
  const [paymentTanggal, setPaymentTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [paymentCatatan, setPaymentCatatan] = useState('');
  const [paymentTabunganId, setPaymentTabunganId] = useState('');
  const [linkWalletPayment, setLinkWalletPayment] = useState(false);

  // Reminder sharing modal
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [copied, setCopied] = useState(false);

  // New person modal
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonContact, setNewPersonContact] = useState('');
  const [newPersonNotes, setNewPersonNotes] = useState('');

  const personMap = new Map(people.map((p) => [p.id, p]));

  // Filtered debts
  let filteredDebts = debts.filter((d) => !d.isDeleted);

  if (filterDirection !== 'all') {
    filteredDebts = filteredDebts.filter((d) => d.arah === filterDirection);
  }

  if (filterStatus !== 'all') {
    filteredDebts = filteredDebts.filter((d) => d.status === filterStatus);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredDebts = filteredDebts.filter((d) => {
      const p = personMap.get(d.orangId);
      return (
        (p && p.nama.toLowerCase().includes(q)) ||
        (d.catatan && d.catatan.toLowerCase().includes(q)) ||
        d.pokok.toString().includes(q)
      );
    });
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;

    try {
      const payments = debtPayments.filter((p) => !p.isDeleted && p.utangId === selectedDebt.id);
      const { sisa } = calculateDebtSummary(selectedDebt.pokok, payments);
      const willBePaidOff = paymentNominal >= sisa;

      await repository.recordDebtPayment(
        selectedDebt.id,
        paymentNominal,
        `${paymentTanggal}T${new Date().toTimeString().slice(0, 8)}Z`,
        paymentCatatan.trim() || undefined,
        undefined,
        linkWalletPayment ? paymentTabunganId : undefined
      );

      if (willBePaidOff) {
        triggerCelebration();
        showToast({
          type: 'success',
          message: `Selamat! Utang telah LUNAS!`,
        });
      } else {
        showToast({
          type: 'success',
          message: `Pembayaran ${formatRupiah(paymentNominal)} berhasil dicatat`,
        });
      }

      setPaymentModalOpen(false);
      setPaymentNominal(0);
      setPaymentCatatan('');
      setLinkWalletPayment(false);
      onRefresh();

      // Refresh selected debt view
      const updated = await repository.getDebts();
      const nextDebt = updated.find((d) => d.id === selectedDebt.id);
      setSelectedDebt(nextDebt || null);
    } catch (err: unknown) {
      showToast({ type: 'warning', message: (err as Error).message });
    }
  };

  const handleDeleteDebt = async (debt: Debt) => {
    const trash = await repository.deleteDebt(debt.id);
    setSelectedDebt(null);
    showUndoToast(`Catatan utang Rp${debt.pokok} dihapus`, async () => {
      await repository.restoreFromTrash(trash.id);
      onRefresh();
    });
    onRefresh();
  };

  const handleShareReminder = (debt: Debt) => {
    const person = personMap.get(debt.orangId);
    const payments = debtPayments.filter((p) => !p.isDeleted && p.utangId === debt.id);
    const { sisa } = calculateDebtSummary(debt.pokok, payments);

    const text = dataTransferService.formatDebtReminderText(
      person?.nama || 'Teman',
      sisa,
      debt.jatuhTempo,
      debt.catatan
    );

    setReminderText(text);
    setCopied(false);
    setReminderModalOpen(true);
  };

  const handleCopyReminder = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(reminderText);
      setCopied(true);
      showToast({ type: 'success', message: 'Pesan pengingat berhasil disalin' });
    }
  };

  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) {
      showToast({ type: 'warning', message: 'Nama kontak wajib diisi' });
      return;
    }

    await repository.createPerson(
      newPersonName.trim(),
      newPersonContact.trim() || undefined,
      undefined,
      newPersonNotes.trim() || undefined
    );

    showToast({ type: 'success', message: `Kontak "${newPersonName}" berhasil ditambahkan` });
    setPersonModalOpen(false);
    setNewPersonName('');
    setNewPersonContact('');
    setNewPersonNotes('');
    onRefresh();
  };

  // Group debts by person for the 'per_orang' tab
  const debtsByPerson = new Map<string, Debt[]>();
  for (const d of filteredDebts) {
    if (!debtsByPerson.has(d.orangId)) debtsByPerson.set(d.orangId, []);
    debtsByPerson.get(d.orangId)!.push(d);
  }

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-debts)] inline-block" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Buku Utang</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Catatan piutang (orang berutang) & utang pribadi offline
          </p>
        </div>

        <div className="flex gap-2">
          <SoundButton
            size="sm"
            variant="outline"
            sound="click"
            onClick={() => setPersonModalOpen(true)}
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Kontak</span>
          </SoundButton>

          <SoundButton
            size="sm"
            sound="click"
            onClick={() => onOpenQuickAction('debt')}
          >
            <Plus className="w-4 h-4" />
            <span>Catat Utang</span>
          </SoundButton>
        </div>
      </div>

      {/* Mode Tabs: Per Catatan vs Per Orang */}
      <div className="flex p-1 bg-[var(--bg-subtle)] border border-[var(--border-color)] rounded-2xl max-w-sm">
        <button
          onClick={() => setActiveTab('per_catatan')}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'per_catatan'
              ? 'bg-[var(--bg-card)] text-[var(--accent-debts)] shadow-soft-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Per Catatan Utang
        </button>
        <button
          onClick={() => setActiveTab('per_orang')}
          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            activeTab === 'per_orang'
              ? 'bg-[var(--bg-card)] text-[var(--accent-debts)] shadow-soft-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Ringkasan per Kontak
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Cari nama kontak, nominal, atau catatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] focus:outline-hidden focus:border-pink-400"
          />
        </div>

        <select
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value as 'all' | 'piutang' | 'utang')}
          className="px-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] cursor-pointer focus:outline-hidden focus:border-pink-400"
        >
          <option value="all">Semua Arah Utang</option>
          <option value="piutang">Orang Berutang (Piutang)</option>
          <option value="utang">Saya Berutang (Utang)</option>
        </select>
      </div>

      {/* DEBT CARDS: Per Catatan */}
      {activeTab === 'per_catatan' && (
        <div className="space-y-3">
          {filteredDebts.length > 0 ? (
            filteredDebts.map((debt) => {
              const person = personMap.get(debt.orangId);
              const payments = debtPayments.filter((p) => !p.isDeleted && p.utangId === debt.id);
              const { sisa, totalDibayar, persentaseLunas } = calculateDebtSummary(
                debt.pokok,
                payments
              );

              const isPiutang = debt.arah === 'piutang';

              return (
                <div
                  key={debt.id}
                  onClick={() => setSelectedDebt(debt)}
                  className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm hover:border-[var(--accent-debts)] transition-all cursor-pointer flex flex-col gap-3 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                          isPiutang
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPiutang ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-[var(--text-primary)]">
                            {person?.nama || 'Kontak Tanpa Nama'}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize ${
                              debt.status === 'lunas'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : debt.status === 'terlambat'
                                ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                : debt.status === 'dicicil'
                                ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {debt.status.replace('_', ' ')}
                          </span>
                        </div>

                        <span className="text-xs text-[var(--text-muted)] block mt-0.5 tabular-nums">
                          {isPiutang ? 'Berutang ke saya' : 'Saya berutang'} •{' '}
                          {debt.tanggal.slice(0, 10)}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-[var(--text-muted)] block">Sisa Utang:</span>
                      <span className="text-base font-extrabold text-[var(--text-primary)] tabular-nums">
                        {formatRupiah(sisa, settings.privacyMode)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[var(--text-secondary)] mb-1">
                      <span className="tabular-nums">
                        Dibayar: {formatRupiah(totalDibayar, settings.privacyMode)} dari{' '}
                        {formatRupiah(debt.pokok, settings.privacyMode)}
                      </span>
                      <span className="font-semibold tabular-nums">{persentaseLunas}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          persentaseLunas === 100
                            ? 'bg-emerald-500'
                            : isPiutang
                            ? 'bg-[var(--accent-debts)]'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${persentaseLunas}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer details: Due date & share reminder button */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)] text-xs">
                    <span className="text-[var(--text-secondary)] flex items-center gap-1.5 tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <span>
                        Jatuh tempo: {debt.jatuhTempo ? debt.jatuhTempo.slice(0, 10) : 'Tidak ada'}
                      </span>
                    </span>

                    {isPiutang && sisa > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareReminder(debt);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-medium hover:bg-emerald-500/20 cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Bagikan Pengingat</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] text-center flex flex-col items-center shadow-soft-sm">
              <BookOpen className="w-8 h-8 text-[var(--text-muted)] mb-2" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Belum ada catatan utang
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">
                Catat piutang atau utang untuk mulai melacak cicilan dengan rapi.
              </p>
              <SoundButton size="sm" onClick={() => onOpenQuickAction('debt')}>
                Catat Utang Baru
              </SoundButton>
            </div>
          )}
        </div>
      )}

      {/* DEBT CARDS: Per Orang */}
      {activeTab === 'per_orang' && (
        <div className="space-y-3">
          {Array.from(debtsByPerson.entries()).map(([personId, personDebts]) => {
            const person = personMap.get(personId);

            let totalPokok = 0;
            let totalSisa = 0;

            for (const d of personDebts) {
              const payments = debtPayments.filter((p) => !p.isDeleted && p.utangId === d.id);
              const { sisa } = calculateDebtSummary(d.pokok, payments);
              totalPokok += d.pokok;
              totalSisa += sisa;
            }

            return (
              <div
                key={personId}
                className="p-5 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-soft-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--bg-subtle)] flex items-center justify-center font-bold text-[var(--text-secondary)]">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--text-primary)]">
                      {person?.nama || 'Kontak Tanpa Nama'}
                    </h3>
                    <span className="text-xs text-[var(--text-muted)] block tabular-nums">
                      {personDebts.length} Catatan Utang • Pokok Total:{' '}
                      {formatRupiah(totalPokok, settings.privacyMode)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-[var(--text-muted)] block">Total Sisa:</span>
                  <span className="text-base font-extrabold text-[var(--text-primary)] tabular-nums">
                    {formatRupiah(totalSisa, settings.privacyMode)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail BottomSheet & Installment Timeline */}
      {selectedDebt && (
        <BottomSheet
          isOpen={!!selectedDebt}
          onClose={() => setSelectedDebt(null)}
          title="Detail Utang & Cicilan"
        >
          {(() => {
            const person = personMap.get(selectedDebt.orangId);
            const payments = debtPayments.filter(
              (p) => !p.isDeleted && p.utangId === selectedDebt.id
            );
            const { sisa, persentaseLunas } = calculateDebtSummary(
              selectedDebt.pokok,
              payments
            );

            return (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">
                    Sisa Utang
                  </span>
                  <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mt-1 tabular-nums">
                    {formatRupiah(sisa, settings.privacyMode)}
                  </h2>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] tabular-nums">
                      Pokok: {formatRupiah(selectedDebt.pokok, settings.privacyMode)}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 tabular-nums">
                      Lunas: {persentaseLunas}%
                    </span>
                  </div>
                </div>

                {/* Info Card */}
                <div className="bg-[var(--bg-subtle)] p-4 rounded-2xl space-y-2 text-xs border border-[var(--border-color)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Kontak</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {person?.nama} {person?.kontak ? `(${person.kontak})` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Arah</span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {selectedDebt.arah === 'piutang'
                        ? 'Orang Berutang ke Saya'
                        : 'Saya Berutang ke Orang'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Tanggal Mulai</span>
                    <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                      {selectedDebt.tanggal.slice(0, 10)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Jatuh Tempo</span>
                    <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                      {selectedDebt.jatuhTempo ? selectedDebt.jatuhTempo.slice(0, 10) : '-'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {sisa > 0 && (
                    <SoundButton
                      onClick={() => {
                        setPaymentNominal(sisa);
                        setPaymentModalOpen(true);
                      }}
                      className="flex-1"
                      sound="click"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Catat Pembayaran / Cicilan</span>
                    </SoundButton>
                  )}
                  {selectedDebt.arah === 'piutang' && sisa > 0 && (
                    <SoundButton
                      variant="secondary"
                      sound="click"
                      onClick={() => handleShareReminder(selectedDebt)}
                    >
                      <Share2 className="w-4 h-4" />
                    </SoundButton>
                  )}
                </div>

                {/* Riwayat Cicilan Timeline */}
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-3">
                    Riwayat Pembayaran & Cicilan ({payments.length})
                  </h4>

                  {payments.length > 0 ? (
                    <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--border-color)]">
                      {payments.map((p) => (
                        <div
                          key={p.id}
                          className="relative flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs"
                        >
                          <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          </div>
                          <div>
                            <span className="font-bold text-[var(--text-primary)] block tabular-nums">
                              {formatRupiah(p.nominal, settings.privacyMode)}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                              {p.tanggal.slice(0, 10)} {p.catatan ? `• ${p.catatan}` : ''}
                            </span>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic">Belum ada riwayat cicilan.</p>
                  )}
                </div>

                <div className="pt-2 border-t border-[var(--border-color)]">
                  <SoundButton
                    variant="danger"
                    className="w-full"
                    sound="delete"
                    onClick={() => handleDeleteDebt(selectedDebt)}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Catatan Utang Ini</span>
                  </SoundButton>
                </div>
              </div>
            );
          })()}
        </BottomSheet>
      )}

      {/* Record Installment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Catat Pembayaran / Cicilan"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nominal Cicilan / Pembayaran
            </label>
            <CurrencyInput
              value={paymentNominal}
              onChange={setPaymentNominal}
              placeholder="Rp0"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tanggal Pembayaran
            </label>
            <input
              type="date"
              value={paymentTanggal}
              onChange={(e) => setPaymentTanggal(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Keterangan
            </label>
            <input
              type="text"
              placeholder="Contoh: Cicilan ke-1, Transfer BCA"
              value={paymentCatatan}
              onChange={(e) => setPaymentCatatan(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
            />
          </div>

          {/* Wallet Link Toggle */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-medium">
            <input
              type="checkbox"
              checked={linkWalletPayment}
              onChange={(e) => setLinkWalletPayment(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span>Tautkan ke saldo tabungan</span>
          </label>

          {linkWalletPayment && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Tabungan Terkait
              </label>
              <select
                value={paymentTabunganId}
                onChange={(e) => setPaymentTabunganId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium"
              >
                <option value="">Pilih Tabungan...</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nama}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <SoundButton
              type="button"
              variant="secondary"
              onClick={() => setPaymentModalOpen(false)}
              className="flex-1"
            >
              Batal
            </SoundButton>
            <SoundButton type="submit" className="flex-1" sound="success">
              Simpan Pembayaran
            </SoundButton>
          </div>
        </form>
      </Modal>

      {/* Share Reminder Modal */}
      <Modal
        isOpen={reminderModalOpen}
        onClose={() => setReminderModalOpen(false)}
        title="Bagikan Pengingat Sopan"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Teks pesan sopan siap disalin atau dikirim langsung melalui aplikasi perpesanan tanpa
            mengirim data apa pun ke server.
          </p>

          <textarea
            rows={4}
            value={reminderText}
            onChange={(e) => setReminderText(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none"
          />

          <div className="flex gap-2">
            <SoundButton
              onClick={handleCopyReminder}
              className="flex-1"
              sound="success"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Tersalin ke Clipboard' : 'Salin Pesan'}</span>
            </SoundButton>
          </div>
        </div>
      </Modal>

      {/* Add Contact Modal */}
      <Modal
        isOpen={personModalOpen}
        onClose={() => setPersonModalOpen(false)}
        title="Tambah Kontak Baru"
      >
        <form onSubmit={handleCreatePerson} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Kontak (Wajib)
            </label>
            <input
              type="text"
              placeholder="Contoh: Budi Santoso"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nomor WhatsApp / Kontak (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: 08123456789"
              value={newPersonContact}
              onChange={(e) => setNewPersonContact(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Teman kantor, Tetangga"
              value={newPersonNotes}
              onChange={(e) => setNewPersonNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <SoundButton
              type="button"
              variant="secondary"
              onClick={() => setPersonModalOpen(false)}
              className="flex-1"
            >
              Batal
            </SoundButton>
            <SoundButton type="submit" className="flex-1" sound="success">
              Simpan Kontak
            </SoundButton>
          </div>
        </form>
      </Modal>
    </div>
  );
};
