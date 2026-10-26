import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  Account,
  AppSettings,
  Category,
  Debt,
  DebtPayment,
  MonthlyBudget,
  Person,
  RecurringTransaction,
  SavingsGoal,
  Tag,
  Transaction,
  TrashItem,
} from './domain/types';
import { repository, DEFAULT_SETTINGS } from './db/repository';
import { applyTheme } from './styles/theme';
import { soundService } from './services/audio';
import { ToastProvider } from './context/ToastContext';
import { Navigation } from './components/Navigation';
import { QuickActionModal } from './components/QuickActionModal';
import { PinLockModal } from './components/PinLockModal';
import { UpdateBanner } from './components/UpdateBanner';
import { OnboardingModal } from './features/onboarding/OnboardingModal';

import { HomePage } from './features/home/HomePage';
import { AccountsPage } from './features/accounts/AccountsPage';
import { DebtsPage } from './features/debts/DebtsPage';
import { GoalsPage } from './features/goals/GoalsPage';
import { BudgetsPage } from './features/budgets/BudgetsPage';
import { RecurringPage } from './features/recurring/RecurringPage';
import { StatsPage } from './features/stats/StatsPage';
import { TrashPage } from './features/trash/TrashPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { AboutPage } from './features/about/AboutPage';

export const AppContent: React.FC = () => {
  const navigate = useNavigate();

  // App data state
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [budgets, setBudgets] = useState<MonthlyBudget[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Quick Action FAB Modal
  const [quickActionModalOpen, setQuickActionModalOpen] = useState(false);
  const [quickActionType, setQuickActionType] = useState<
    'income' | 'expense' | 'transfer' | 'debt'
  >('income');

  // PWA update handler
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r?: ServiceWorkerRegistration) {
      if (r) {
        setInterval(() => r.update(), 60 * 60 * 1000); // Check every hour
      }
    },
  });

  const lastActiveRef = useRef<number>(Date.now());

  // Load all data from IndexedDB
  const refreshData = useCallback(async () => {
    try {
      const [
        s,
        accs,
        txs,
        dbt,
        dbtPay,
        cats,
        tgs,
        goals,
        bdgs,
        rec,
        trash,
        ppl,
      ] = await Promise.all([
        repository.getSettings(),
        repository.getAccounts(),
        repository.getTransactions(),
        repository.getDebts(),
        repository.getDebtPayments(),
        repository.getCategories(),
        repository.getTags(),
        repository.getSavingsGoals(),
        repository.getBudgets(),
        repository.getRecurringTransactions(),
        repository.getTrashItems(),
        repository.getPeople(),
      ]);

      setSettings(s);
      setAccounts(accs);
      setTransactions(txs);
      setDebts(dbt);
      setDebtPayments(dbtPay);
      setCategories(cats);
      setTags(tgs);
      setSavingsGoals(goals);
      setBudgets(bdgs);
      setRecurring(rec);
      setTrashItems(trash);
      setPeople(ppl);

      // Apply theme & sound config
      applyTheme(s.theme, s.colorPreset, s.customAccent);
      soundService.init(s.soundVolume, s.soundMuted, s.soundStyle, s.hapticsEnabled);

      // Trigger onboarding on first run if not completed
      if (!s.hasCompletedOnboarding && accs.length === 0) {
        setOnboardingOpen(true);
      }

      // Check PIN lock on load
      if (s.pinEnabled && s.pinHash) {
        setIsLocked(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle user activity & auto-lock
  useEffect(() => {
    const updateActive = () => {
      lastActiveRef.current = Date.now();
    };

    window.addEventListener('click', updateActive);
    window.addEventListener('keydown', updateActive);
    window.addEventListener('touchstart', updateActive);

    // Visibility change: Lock when app goes to background
    const handleVisibility = () => {
      if (document.hidden && settings.pinEnabled && settings.pinHash) {
        setIsLocked(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Auto-lock interval check
    const checkInterval = setInterval(() => {
      if (
        settings.pinEnabled &&
        settings.pinHash &&
        !isLocked &&
        settings.autoLockMinutes > 0
      ) {
        const elapsed = (Date.now() - lastActiveRef.current) / (1000 * 60);
        if (elapsed >= settings.autoLockMinutes) {
          setIsLocked(true);
        }
      }
    }, 15000);

    return () => {
      window.removeEventListener('click', updateActive);
      window.removeEventListener('keydown', updateActive);
      window.removeEventListener('touchstart', updateActive);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(checkInterval);
    };
  }, [settings.pinEnabled, settings.pinHash, settings.autoLockMinutes, isLocked]);

  const handleTogglePrivacy = async () => {
    const updated = await repository.updateSettings({ privacyMode: !settings.privacyMode });
    setSettings(updated);
  };

  const handleToggleMute = async () => {
    const updated = await repository.updateSettings({ soundMuted: !settings.soundMuted });
    setSettings(updated);
    soundService.updateConfig(undefined, updated.soundMuted);
  };

  const handleOpenQuickAction = (action: 'income' | 'expense' | 'transfer' | 'debt') => {
    setQuickActionType(action);
    setQuickActionModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center animate-pulse">
            <span className="text-xl font-bold">N</span>
          </div>
          <span className="text-xs text-slate-400 font-semibold tracking-wide">
            Memuat Nubung Yuk...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Navigation Header, Drawer, Desktop Sidebar, and Mobile Bottom Bar */}
      <Navigation
        settings={settings}
        onTogglePrivacy={handleTogglePrivacy}
        onToggleMute={handleToggleMute}
        onOpenQuickAction={handleOpenQuickAction}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full p-4 md:p-8 md:pl-72 max-w-7xl mx-auto transition-all">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                settings={settings}
                accounts={accounts}
                transactions={transactions}
                debts={debts}
                categories={categories}
                savingsGoals={savingsGoals}
                budgets={budgets}
                onOpenQuickAction={handleOpenQuickAction}
                onNavigate={navigate}
              />
            }
          />
          <Route
            path="/tabungan"
            element={
              <AccountsPage
                settings={settings}
                accounts={accounts}
                transactions={transactions}
                categories={categories}
                tags={tags}
                onRefresh={refreshData}
                onOpenQuickAction={handleOpenQuickAction}
              />
            }
          />
          <Route
            path="/utang"
            element={
              <DebtsPage
                settings={settings}
                debts={debts}
                debtPayments={debtPayments}
                people={people}
                accounts={accounts}
                onRefresh={refreshData}
                onOpenQuickAction={handleOpenQuickAction}
              />
            }
          />
          <Route
            path="/target"
            element={
              <GoalsPage
                settings={settings}
                goals={savingsGoals}
                accounts={accounts}
                transactions={transactions}
                onRefresh={refreshData}
              />
            }
          />
          <Route
            path="/anggaran"
            element={
              <BudgetsPage
                settings={settings}
                budgets={budgets}
                categories={categories}
                transactions={transactions}
                onRefresh={refreshData}
              />
            }
          />
          <Route
            path="/berulang"
            element={
              <RecurringPage
                settings={settings}
                recurring={recurring}
                accounts={accounts}
                categories={categories}
                onRefresh={refreshData}
              />
            }
          />
          <Route
            path="/statistik"
            element={
              <StatsPage
                settings={settings}
                transactions={transactions}
                categories={categories}
              />
            }
          />
          <Route
            path="/tempat-sampah"
            element={
              <TrashPage
                trashItems={trashItems}
                onRefresh={refreshData}
              />
            }
          />
          <Route
            path="/pengaturan"
            element={
              <SettingsPage
                settings={settings}
                categories={categories}
                onRefresh={refreshData}
                onNavigate={navigate}
              />
            }
          />
          <Route
            path="/tentang"
            element={
              <AboutPage
                onRestartTour={() => setOnboardingOpen(true)}
              />
            }
          />
        </Routes>
      </main>

      {/* Quick Action FAB Modal */}
      <QuickActionModal
        isOpen={quickActionModalOpen}
        actionType={quickActionType}
        onClose={() => setQuickActionModalOpen(false)}
        accounts={accounts}
        categories={categories}
        people={people}
        onSuccess={refreshData}
      />

      {/* PIN Lock Screen Modal */}
      <PinLockModal
        settings={settings}
        isOpen={isLocked}
        onUnlocked={() => setIsLocked(false)}
      />

      {/* Onboarding Wizard */}
      <OnboardingModal
        isOpen={onboardingOpen}
        onFinish={() => {
          setOnboardingOpen(false);
          refreshData();
        }}
      />

      {/* PWA Update Banner */}
      <UpdateBanner
        needRefresh={needRefresh}
        onUpdate={() => updateServiceWorker(true)}
        onDismiss={() => setNeedRefresh(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
};
