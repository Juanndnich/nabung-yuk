// Themes, Palettes, and Typography Configuration
import { ColorPreset, ThemeMode } from '../domain/types';

export interface PaletteDefinition {
  id: ColorPreset;
  name: string;
  primaryLight: string;
  primaryDark: string;
  primaryHex: string;
  accentHex: string;
}

export const PALETTES: Record<ColorPreset, PaletteDefinition> = {
  teal: {
    id: 'teal',
    name: 'Hijau Teal',
    primaryLight: '#0d9488',
    primaryDark: '#14b8a6',
    primaryHex: '#0d9488',
    accentHex: '#065f46',
  },
  ocean: {
    id: 'ocean',
    name: 'Biru Laut',
    primaryLight: '#0284c7',
    primaryDark: '#38bdf8',
    primaryHex: '#0284c7',
    accentHex: '#075985',
  },
  purple: {
    id: 'purple',
    name: 'Ungu Royal',
    primaryLight: '#7c3aed',
    primaryDark: '#a78bfa',
    primaryHex: '#7c3aed',
    accentHex: '#5b21b6',
  },
  amber: {
    id: 'amber',
    name: 'Oranye Hangat',
    primaryLight: '#ea580c',
    primaryDark: '#fb923c',
    primaryHex: '#ea580c',
    accentHex: '#9a3412',
  },
  rose: {
    id: 'rose',
    name: 'Merah Muda',
    primaryLight: '#e11d48',
    primaryDark: '#fb7185',
    primaryHex: '#e11d48',
    accentHex: '#9f1239',
  },
  neutral: {
    id: 'neutral',
    name: 'Abu Netral',
    primaryLight: '#475569',
    primaryDark: '#94a3b8',
    primaryHex: '#475569',
    accentHex: '#334155',
  },
};

export function applyTheme(
  theme: ThemeMode,
  preset: ColorPreset = 'teal',
  customAccent?: string
) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const palette = PALETTES[preset] || PALETTES.teal;
  const accentColor = customAccent || (isDark ? palette.primaryDark : palette.primaryLight);

  root.style.setProperty('--color-primary', accentColor);
  root.style.setProperty('--color-primary-rgb', hexToRgb(accentColor));
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 13;
  const g = parseInt(clean.substring(2, 4), 16) || 148;
  const b = parseInt(clean.substring(4, 6), 16) || 136;
  return `${r}, ${g}, ${b}`;
}
