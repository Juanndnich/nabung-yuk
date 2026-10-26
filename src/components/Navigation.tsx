import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
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

  const navLinks = [
    { to: '/', label: 'Beranda', icon: Home },
    { to: '/tabungan', label: 'Tabungan', icon: Wallet },
    { to: '/utang', label: 'Utang', icon: BookOpen },
    { to: '/statistik', label: 'Statistik', icon: PieChart },
  ];

  const drawerLinks = [
    { to: '/', label: 'Beranda', icon: Home },
    { to: '/tabungan', label: 'Buku Tabungan', icon: Wallet },
    { to: '/utang', label: 'Buku Utang', icon: BookOpen },
    { to: '/target', label: 'Target Tabungan', icon: Target },
    { to: '/anggaran', label: 'Anggaran Bulanan', icon: BookmarkCheck },
    { to: '/berulang', label: 'Transaksi Berulang', icon: Repeat },
    { to: '/statistik', label: 'Analisis Statistik', icon: PieChart },
    { to: '/tempat-sampah', label: 'Tempat Sampah', icon: Trash2 },
    { to: '/pengaturan', label: 'Pengaturan', icon: Settings },
    { to: '/tentang', label: 'Tentang Aplikasi', icon: HelpCircle },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SoundButton
            variant="ghost"
            size="icon"
            sound="panel"
            onClick={() => setDrawerOpen(true)}
            aria-label="Menu"
            className="md:hidden text-slate-700 dark:text-slate-200"
          >
            <Menu className="w-5 h-5" />
          </SoundButton>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-white font-bold shadow-sm">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">
              Nubung Yuk
            </span>
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
            className="text-slate-600 dark:text-slate-300"
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
            className="text-slate-600 dark:text-slate-300"
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
      <aside className="hidden md:flex flex-col w-64 fixed left-0 top-[57px] bottom-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 z-20 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {drawerLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => soundService.play('click')}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </aside>

      {/* Mobile Drawer (Hamburger) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-fade-in"
            onClick={() => {
              soundService.play('panel');
              setDrawerOpen(false);
            }}
          />
          <div className="relative w-72 max-w-[80vw] bg-white dark:bg-slate-900 h-full shadow-2xl p-4 flex flex-col z-10 animate-slide-right">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-white">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="font-bold text-base text-slate-900 dark:text-slate-100">
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

            <nav className="flex flex-col gap-1 py-4 overflow-y-auto flex-1">
              {drawerLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      soundService.play('click');
                      setDrawerOpen(false);
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-[var(--color-primary)] text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) Speed Dial */}
      <div className="fixed right-4 bottom-20 z-40 md:right-8 md:bottom-8 flex flex-col items-end gap-2.5">
        {fabOpen && (
          <div className="flex flex-col items-end gap-2.5 mb-2 animate-slide-up">
            <button
              onClick={() => {
                setFabOpen(false);
                onOpenQuickAction('income');
              }}
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium text-sm shadow-lg hover:bg-emerald-500 active:scale-95 transition-all cursor-pointer"
            >
              <span>Catat Masuk</span>
              <ArrowDownLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setFabOpen(false);
                onOpenQuickAction('expense');
              }}
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-rose-600 text-white font-medium text-sm shadow-lg hover:bg-rose-500 active:scale-95 transition-all cursor-pointer"
            >
              <span>Catat Keluar</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setFabOpen(false);
                onOpenQuickAction('transfer');
              }}
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-sky-600 text-white font-medium text-sm shadow-lg hover:bg-sky-500 active:scale-95 transition-all cursor-pointer"
            >
              <span>Transfer Tabungan</span>
              <ArrowLeftRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setFabOpen(false);
                onOpenQuickAction('debt');
              }}
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-purple-600 text-white font-medium text-sm shadow-lg hover:bg-purple-500 active:scale-95 transition-all cursor-pointer"
            >
              <span>Tambah Utang</span>
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          onClick={() => {
            soundService.play('panel');
            setFabOpen((prev) => !prev);
          }}
          aria-label="Aksi Cepat"
          className={`w-14 h-14 rounded-2xl bg-[var(--color-primary)] text-white shadow-xl hover:brightness-110 active:scale-90 transition-all flex items-center justify-center cursor-pointer ${
            fabOpen ? 'rotate-45' : ''
          }`}
        >
          <Plus className="w-7 h-7 transition-transform" />
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar (md:hidden) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-2 px-1 md:hidden">
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => soundService.play('click')}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all ${
                  isActive
                    ? 'text-[var(--color-primary)] font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[11px] leading-tight">{item.label}</span>
            </NavLink>
          );
        })}

        {/* Lainnya button opens drawer */}
        <button
          onClick={() => {
            soundService.play('panel');
            setDrawerOpen(true);
          }}
          className="flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight">Lainnya</span>
        </button>
      </nav>
    </>
  );
};
