import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home,
  Wallet,
  BookOpen,
  PieChart,
  Menu,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  UserPlus,
  Target,
  BookmarkCheck,
  Repeat,
  Trash2,
  Settings,
  HelpCircle,
  X,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Heart,
} from 'lucide-react';
import { soundService } from '../services/audio';
import { SoundButton } from './SoundButton';
import { AppSettings } from '../domain/types';

interface NavigationProps {
  settings: AppSettings;
  onTogglePrivacy: () => void;
  onToggleMute: () => void;
  onOpenQuickAction: (action: 'income' | 'expense' | 'transfer' | 'debt') => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  settings,
  onTogglePrivacy,
  onToggleMute,
  onOpenQuickAction,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { to: '/', label: 'Beranda', icon: Home },
    { to: '/tabungan', label: 'Tabungan', icon: Wallet },
    { to: '/utang', label: 'Utang', icon: BookOpen },
    { to: '/statistik', label: 'Statistik', icon: PieChart },
  ];

  interface NavCategory {
    title: string;
    items: {
      to: string;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
    }[];
  }

  const navCategories: NavCategory[] = [
    {
      title: 'Utama',
      items: [
        { to: '/', label: 'Beranda', icon: Home },
        { to: '/tabungan', label: 'Tabungan', icon: Wallet },
        { to: '/utang', label: 'Utang', icon: BookOpen },
      ],
    },
    {
      title: 'Perencanaan',
      items: [
        { to: '/target', label: 'Target', icon: Target },
        { to: '/anggaran', label: 'Anggaran', icon: BookmarkCheck },
        { to: '/berulang', label: 'Berulang', icon: Repeat },
        { to: '/statistik', label: 'Statistik', icon: PieChart },
      ],
    },
    {
      title: 'Sistem',
      items: [
        { to: '/tempat-sampah', label: 'Sampah', icon: Trash2 },
        { to: '/pengaturan', label: 'Pengaturan', icon: Settings },
        { to: '/tentang', label: 'Tentang', icon: HelpCircle },
      ],
    },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border-color)] px-4 py-2.5 flex items-center justify-between transition-colors shadow-2xs">
        <div className="flex items-center gap-3">
          <SoundButton
            variant="ghost"
            size="icon"
            sound="panel"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka Menu"
            className="md:hidden text-slate-700 dark:text-slate-200"
          >
            <Menu className="w-5 h-5" />
          </SoundButton>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-[var(--color-primary)] to-[var(--color-secondary)] p-0.5 overflow-hidden shrink-0 shadow-sm">
              <img
                src={settings.customAppIcon || '/pwa-192x192.png'}
                alt="Logo"
                className="w-full h-full object-cover rounded-[10px]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight bg-linear-to-r from-[var(--color-primary)] via-indigo-600 to-[var(--color-secondary)] bg-clip-text text-transparent">
                Nubung Yuk
              </span>
            </div>
          </div>
        </div>

        {/* Quick Header Controls: Privacy Mode, Sound Mute */}
        <div className="flex items-center gap-1.5">
          <SoundButton
            variant="ghost"
            size="icon"
            sound="click"
            onClick={onTogglePrivacy}
            title={settings.privacyMode ? 'Tampilkan Nominal' : 'Sembunyikan Nominal'}
            className="text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {settings.privacyMode ? (
              <EyeOff className="w-5 h-5 text-amber-500" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </SoundButton>

          <SoundButton
            variant="ghost"
            size="icon"
            sound="click"
            onClick={onToggleMute}
            title={settings.soundMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
            className="text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {settings.soundMuted ? (
              <VolumeX className="w-5 h-5 text-rose-500" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </SoundButton>
        </div>
      </header>

      {/* Desktop Sidebar (visible on md+) */}
      <aside className="hidden md:flex flex-col w-64 fixed left-0 top-[61px] bottom-0 bg-[var(--bg-surface)] border-r border-[var(--border-color)] p-4 z-20 overflow-y-auto transition-colors">
        <div className="flex flex-col gap-5">
          {navCategories.map((cat, catIdx) => (
            <div key={cat.title} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wider text-[var(--text-muted)] uppercase px-3 py-1">
                {cat.title}
              </span>
              <div className="flex flex-col gap-1">
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => soundService.play('click')}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[var(--text-primary)] text-[var(--bg-page)] border border-[var(--border-color)] shadow-xs font-semibold'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-pink-400' : 'text-[var(--text-muted)]'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                      )}
                    </NavLink>
                  );
                })}
              </div>
              {catIdx < navCategories.length - 1 && (
                <div className="border-b border-[var(--border-subtle)] my-1 mx-2" />
              )}
            </div>
          ))}
        </div>

        {/* Sidebar Footer Accent */}
        <div className="mt-auto pt-4 border-t border-[var(--border-color)] flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-muted)] font-medium">
          <span>Dibuat dengan</span>
          <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-500" />
          <span>untuk Anda</span>
        </div>
      </aside>

      {/* Mobile Drawer (Hamburger) */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => {
                soundService.play('panel');
                setDrawerOpen(false);
              }}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="relative w-72 max-w-[80vw] bg-[var(--bg-surface)] h-full shadow-2xl p-5 flex flex-col z-10 border-r border-[var(--border-color)]"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-linear-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white overflow-hidden shadow-xs">
                    {settings.customAppIcon ? (
                      <img src={settings.customAppIcon} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Heart className="w-4 h-4 fill-white text-white" />
                    )}
                  </div>
                  <span className="font-extrabold text-base bg-linear-to-r from-[var(--color-primary)] to-[var(--color-secondary)] bg-clip-text text-transparent">
                    Nubung Yuk
                  </span>
                </div>
                <SoundButton
                  variant="ghost"
                  size="icon"
                  sound="panel"
                  onClick={() => setDrawerOpen(false)}
                >
                  <X className="w-5 h-5 text-slate-400" />
                </SoundButton>
              </div>

              <nav className="flex flex-col gap-4 py-4 overflow-y-auto flex-1">
                {navCategories.map((cat, catIdx) => (
                  <div key={cat.title} className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold tracking-wider text-[var(--text-muted)] uppercase px-2 py-0.5">
                      {cat.title}
                    </span>
                    <div className="flex flex-col gap-1">
                      {cat.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.to;
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => {
                              soundService.play('click');
                              setDrawerOpen(false);
                            }}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              isActive
                                ? 'bg-[var(--text-primary)] text-[var(--bg-page)] border border-[var(--border-color)] shadow-xs font-semibold'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className={`w-4 h-4 ${isActive ? 'text-pink-400' : 'text-[var(--text-muted)]'}`} />
                              <span>{item.label}</span>
                            </div>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />
                            )}
                          </NavLink>
                        );
                      })}
                    </div>
                    {catIdx < navCategories.length - 1 && (
                      <div className="border-b border-[var(--border-subtle)] my-1 mx-2" />
                    )}
                  </div>
                ))}
              </nav>

              <div className="pt-3 border-t border-[var(--border-color)] text-center text-[11px] text-[var(--text-muted)] flex items-center justify-center gap-1.5">
                <span>100% Offline & Privat</span>
                <Heart className="w-3 h-3 fill-pink-500 text-pink-500" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) Speed Dial */}
      <div className="fixed right-4 bottom-20 z-40 md:right-8 md:bottom-8 flex flex-col items-end gap-2.5">
        <AnimatePresence>
          {fabOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col items-end gap-2.5 mb-2"
            >
              <button
                onClick={() => {
                  setFabOpen(false);
                  onOpenQuickAction('income');
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-600 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <span>Catat Masuk</span>
                <ArrowDownLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setFabOpen(false);
                  onOpenQuickAction('expense');
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-linear-to-r from-rose-600 to-pink-600 text-white font-semibold text-xs shadow-lg shadow-rose-500/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <span>Catat Keluar</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setFabOpen(false);
                  onOpenQuickAction('transfer');
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <span>Transfer Tabungan</span>
                <ArrowLeftRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setFabOpen(false);
                  onOpenQuickAction('debt');
                }}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-linear-to-r from-amber-600 to-orange-600 text-white font-semibold text-xs shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                <span>Tambah Utang</span>
                <UserPlus className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            soundService.play('panel');
            setFabOpen((prev) => !prev);
          }}
          aria-label="Aksi Cepat Tambah"
          className="w-13 h-13 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border border-[var(--border-color)] shadow-lg shadow-pink-500/20 flex items-center justify-center cursor-pointer transition-shadow"
        >
          <motion.div
            animate={{ rotate: fabOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="w-6 h-6 text-pink-400 dark:text-pink-600" />
          </motion.div>
        </motion.button>
      </div>

      {/* Professional Standard Bottom Navigation Bar on Mobile (md:hidden) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-color)] pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg transition-colors">
        <nav
          className="w-full max-w-lg mx-auto px-2 py-1 flex items-center justify-around"
          aria-label="Navigasi Utama"
        >
          {navLinks.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => soundService.play('click')}
                className="relative flex flex-col items-center justify-center flex-1 py-1 px-1 transition-all"
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-pink-500' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-pink-500" />
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 transition-colors ${
                    isActive
                      ? 'text-pink-500 font-bold'
                      : 'text-zinc-500 dark:text-zinc-400 font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}

          {/* Lainnya button */}
          <button
            onClick={() => {
              soundService.play('panel');
              setDrawerOpen(true);
            }}
            className="flex flex-col items-center justify-center flex-1 py-1 px-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            aria-label="Menu Lainnya"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium">Lainnya</span>
          </button>
        </nav>
      </div>
    </>
  );
};
