// Themes, Palettes, and Typography Configuration
import { ColorPreset, ThemeMode } from '../domain/types';

export interface PaletteDefinition {
  id: ColorPreset;
  name: string;
  primaryLight: string;
  primaryDark: string;
  secondaryLight: string;
  secondaryDark: string;
  primaryHex: string;
  accentHex: string;
}

export const PALETTES: Record<ColorPreset, PaletteDefinition> = {
  blue_pink: {
    id: 'blue_pink',
    name: 'Biru & Pink (Bawaan)',
    primaryLight: '#2563eb',
    primaryDark: '#3b82f6',
    secondaryLight: '#ec4899',
    secondaryDark: '#f472b6',
    primaryHex: '#2563eb',
    accentHex: '#ec4899',
  },
  ocean: {
    id: 'ocean',
    name: 'Biru Samudra',
    primaryLight: '#0284c7',
    primaryDark: '#38bdf8',
    secondaryLight: '#06b6d4',
    secondaryDark: '#22d3ee',
    primaryHex: '#0284c7',
    accentHex: '#06b6d4',
  },
  teal: {
    id: 'teal',
    name: 'Hijau Zamrud',
    primaryLight: '#0d9488',
    primaryDark: '#14b8a6',
    secondaryLight: '#10b981',
    secondaryDark: '#34d399',
    primaryHex: '#0d9488',
    accentHex: '#10b981',
  },
  purple: {
    id: 'purple',
    name: 'Ungu Royal',
    primaryLight: '#7c3aed',
    primaryDark: '#a78bfa',
    secondaryLight: '#ec4899',
    secondaryDark: '#f472b6',
    primaryHex: '#7c3aed',
    accentHex: '#ec4899',
  },
  amber: {
    id: 'amber',
    name: 'Oranye Hangat',
    primaryLight: '#ea580c',
    primaryDark: '#fb923c',
    secondaryLight: '#f59e0b',
    secondaryDark: '#fbbf24',
    primaryHex: '#ea580c',
    accentHex: '#f59e0b',
  },
  rose: {
    id: 'rose',
    name: 'Mawar Delima',
    primaryLight: '#e11d48',
    primaryDark: '#fb7185',
    secondaryLight: '#be123c',
    secondaryDark: '#fda4af',
    primaryHex: '#e11d48',
    accentHex: '#be123c',
  },
  neutral: {
    id: 'neutral',
    name: 'Monokrom Slate',
    primaryLight: '#334155',
    primaryDark: '#94a3b8',
    secondaryLight: '#64748b',
    secondaryDark: '#cbd5e1',
    primaryHex: '#334155',
    accentHex: '#64748b',
  },
};

let watcherAttached = false;
let currentThemeMode: ThemeMode = 'system';
let currentPreset: ColorPreset = 'blue_pink';
let currentCustomAccent: string | undefined = undefined;

export function initSystemThemeWatcher() {
  if (typeof window === 'undefined' || watcherAttached) return;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => {
    if (currentThemeMode === 'system') {
      applyTheme('system', currentPreset, currentCustomAccent);
    }
  };
  media.addEventListener('change', listener);
  watcherAttached = true;
}

export function applyTheme(
  theme: ThemeMode = 'system',
  preset: ColorPreset = 'blue_pink',
  customAccent?: string
) {
  if (typeof document === 'undefined') return;

  currentThemeMode = theme;
  currentPreset = preset;
  currentCustomAccent = customAccent;
  initSystemThemeWatcher();

  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isDark) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
  }

  try {
    localStorage.setItem('nubung_theme_dark', isDark ? '1' : '0');
  } catch {
    // Ignore localStorage failures
  }

  const palette = PALETTES[preset] || PALETTES.blue_pink;
  const primaryColor = customAccent || (isDark ? palette.primaryDark : palette.primaryLight);
  const secondaryColor = isDark ? palette.secondaryDark : palette.secondaryLight;

  root.style.setProperty('--color-primary', primaryColor);
  root.style.setProperty('--color-primary-rgb', hexToRgb(primaryColor));
  root.style.setProperty('--color-secondary', secondaryColor);
  root.style.setProperty('--color-secondary-rgb', hexToRgb(secondaryColor));

  // Update meta theme-color tag dynamically
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#0b1120' : primaryColor);
  }
}

export function applyDensity(density: 'compact' | 'comfortable') {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-density', density);
}

export function applyFontSize(size: 'small' | 'medium' | 'large') {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-font-size', size);
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 37;
  const g = parseInt(clean.substring(2, 4), 16) || 99;
  const b = parseInt(clean.substring(4, 6), 16) || 235;
  return `${r}, ${g}, ${b}`;
}
