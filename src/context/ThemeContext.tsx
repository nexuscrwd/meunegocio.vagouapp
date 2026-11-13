import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  AppThemePalette,
  DEFAULT_NEUTRAL_HEX,
  LEGACY_UNCUSTOMIZED_HEXES,
  normalizeHex,
  resolveAppThemeTokens,
} from '../utils/themePalette';

export type NeutralPresetId = 1 | 2 | 3;

export const EXPLICIT_THEME_STORAGE_KEY = 'vagou_theme_mode_v3';
export const CUSTOMIZED_THEME_STORAGE_KEY = 'vagou_theme_customized';

export interface NeutralPresetTokens {
  id: NeutralPresetId;
  shortLabel: string;
  fullLabel: string;
  outerBg: string;
  canvasBg: string;
  shellBorder: string;
  cardBg: string;
  cardBorder: string;
  inputBg: string;
  inputBorder: string;
  headerBg: string;
  headerBorder: string;
  headerText: string;
  headerSubtext: string;
  headerBoxBg: string;
  headerBoxBorder: string;
  headerIsDark: boolean;
  sectionBg: string;
  sectionBorder: string;
  sectionText: string;
  sectionIcon: string;
  navBg: string;
  navBorder: string;
  navIsDark: boolean;
  navActiveBtnBg: string;
  navActiveBtnFg: string;
  navInactiveFg: string;
  actionBg: string;
  actionHover: string;
  subtleHaloBg: string;
  subtleHaloFg: string;
  priceOnDarkCard: string;
  dotOnDarkCard: string;
}

export const NEUTRAL_PRESETS: Record<NeutralPresetId, NeutralPresetTokens> = {
  1: {
    id: 1,
    shortLabel: 'Claro Neutro',
    fullLabel: 'Padrão Claro Neutro Independente (Cinza, Branco & Escuro Suave)',
    outerBg: '#EEF2F6',
    canvasBg: '#F8FAFC',
    shellBorder: '#E2E8F0',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    inputBg: '#F8FAFC',
    inputBorder: '#CBD5E1',
    headerBg: '#FFFFFF',
    headerBorder: '#E2E8F0',
    headerText: '#1E293B',
    headerSubtext: '#64748B',
    headerBoxBg: '#F8FAFC',
    headerBoxBorder: '#E2E8F0',
    headerIsDark: false,
    sectionBg: '#FFFFFF',
    sectionBorder: '#E2E8F0',
    sectionText: '#1E293B',
    sectionIcon: '#475569',
    navBg: '#F1F5F9',
    navBorder: '#E2E8F0',
    navIsDark: false,
    navActiveBtnBg: '#FFFFFF',
    navActiveBtnFg: '#0F172A',
    navInactiveFg: '#64748B',
    actionBg: '#334155',
    actionHover: '#1E293B',
    subtleHaloBg: '#F1F5F9',
    subtleHaloFg: '#334155',
    priceOnDarkCard: '#FFFFFF',
    dotOnDarkCard: '#E2E8F0',
  },
  2: {
    id: 2,
    shortLabel: 'Claro Acetinado',
    fullLabel: 'Claro Acetinado (Zinc Suave)',
    outerBg: '#E4E4E7',
    canvasBg: '#F4F4F5',
    shellBorder: '#D4D4D8',
    cardBg: '#FFFFFF',
    cardBorder: '#E4E4E7',
    inputBg: '#FAFAFA',
    inputBorder: '#D4D4D8',
    headerBg: '#FAFAFA',
    headerBorder: '#E4E4E7',
    headerText: '#18181B',
    headerSubtext: '#71717A',
    headerBoxBg: '#FFFFFF',
    headerBoxBorder: '#E4E4E7',
    headerIsDark: false,
    sectionBg: '#FAFAFA',
    sectionBorder: '#E4E4E7',
    sectionText: '#18181B',
    sectionIcon: '#52525B',
    navBg: '#F4F4F5',
    navBorder: '#E4E4E7',
    navIsDark: false,
    navActiveBtnBg: '#FFFFFF',
    navActiveBtnFg: '#18181B',
    navInactiveFg: '#71717A',
    actionBg: '#3F3F46',
    actionHover: '#27272A',
    subtleHaloBg: '#F4F4F5',
    subtleHaloFg: '#3F3F46',
    priceOnDarkCard: '#FFFFFF',
    dotOnDarkCard: '#E4E4E7',
  },
  3: {
    id: 3,
    shortLabel: 'Claro Editorial',
    fullLabel: 'Claro Editorial Suave',
    outerBg: '#EEF2F6',
    canvasBg: '#F8FAFC',
    shellBorder: '#E2E8F0',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    inputBg: '#F8FAFC',
    inputBorder: '#CBD5E1',
    headerBg: '#FFFFFF',
    headerBorder: '#E2E8F0',
    headerText: '#1E293B',
    headerSubtext: '#64748B',
    headerBoxBg: '#F8FAFC',
    headerBoxBorder: '#E2E8F0',
    headerIsDark: false,
    sectionBg: '#FFFFFF',
    sectionBorder: '#E2E8F0',
    sectionText: '#1E293B',
    sectionIcon: '#475569',
    navBg: '#F1F5F9',
    navBorder: '#E2E8F0',
    navIsDark: false,
    navActiveBtnBg: '#FFFFFF',
    navActiveBtnFg: '#0F172A',
    navInactiveFg: '#64748B',
    actionBg: '#334155',
    actionHover: '#1E293B',
    subtleHaloBg: '#F1F5F9',
    subtleHaloFg: '#334155',
    priceOnDarkCard: '#FFFFFF',
    dotOnDarkCard: '#E2E8F0',
  },
};

export function isLegacyOrSystemDefaultColor(rawColor?: string | null): boolean {
  if (!rawColor) return true;
  return LEGACY_UNCUSTOMIZED_HEXES.has(rawColor.trim().toLowerCase());
}

export function getCurrentNeutralPreset(): NeutralPresetId {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('vagou_neutral_preset');
    } catch {}
  }
  return 1;
}

export interface ThemeContextType {
  theme: 'dark' | 'light';
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light', options?: { isExplicitUserChoice?: boolean }) => void;
  accentColor: string;
  themeExplicitlyCustomized: boolean;
  setAccentColor: (color: string, options?: { isExplicitUserChoice?: boolean }) => void;
  resetToDefaultPalette: () => void;
  resolvedPalette: AppThemePalette;
  neutralPreset: NeutralPresetId;
  presetTokens: NeutralPresetTokens;
  setNeutralPreset: (preset: NeutralPresetId) => void;
  cycleNeutralPreset: () => void;
}

const DEFAULT_RESOLVED_PALETTE = resolveAppThemeTokens(DEFAULT_NEUTRAL_HEX, false, false);

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
  accentColor: DEFAULT_NEUTRAL_HEX,
  themeExplicitlyCustomized: false,
  setAccentColor: () => {},
  resetToDefaultPalette: () => {},
  resolvedPalette: DEFAULT_RESOLVED_PALETTE,
  neutralPreset: 1,
  presetTokens: NEUTRAL_PRESETS[1],
  setNeutralPreset: () => {},
  cycleNeutralPreset: () => {},
});

export const sanitizeAccentColor = (rawColor?: string | null, fallbackPreset?: NeutralPresetId): string => {
  const preset = NEUTRAL_PRESETS[fallbackPreset || 1];
  const normalized = normalizeHex(rawColor);
  if (!normalized) return preset.actionBg;
  return normalized;
};

export const applyThemePaletteToDom = (
  color: string,
  isDarkActive: boolean,
  isExplicitlyCustomized: boolean
): AppThemePalette => {
  const palette = resolveAppThemeTokens(color, isDarkActive, isExplicitlyCustomized);
  if (typeof document === 'undefined') return palette;

  try {
    const root = document.documentElement;
    root.setAttribute('data-neutral-preset', '1');
    root.setAttribute('data-theme-customized', palette.isCustomized ? 'true' : 'false');

    // Variáveis Neutras / Superfícies Base do App
    root.style.setProperty('--neutral-outer-bg', palette.outerBg);
    root.style.setProperty('--neutral-canvas-bg', palette.canvasBg);
    root.style.setProperty('--neutral-shell-border', palette.shellBorder);
    root.style.setProperty('--neutral-card-bg', palette.cardBg);
    root.style.setProperty('--neutral-card-border', palette.cardBorder);
    root.style.setProperty('--neutral-input-bg', palette.inputBg);
    root.style.setProperty('--neutral-input-border', palette.inputBorder);
    root.style.setProperty('--neutral-header-bg', palette.headerBg);
    root.style.setProperty('--neutral-header-border', palette.headerBorder);
    root.style.setProperty('--neutral-header-text', palette.headerText);
    root.style.setProperty('--neutral-header-subtext', palette.headerSubtext);
    root.style.setProperty('--neutral-header-box-bg', palette.headerBoxBg);
    root.style.setProperty('--neutral-header-box-border', palette.headerBoxBorder);
    root.style.setProperty('--neutral-section-bg', palette.sectionBg);
    root.style.setProperty('--neutral-section-border', palette.sectionBorder);
    root.style.setProperty('--neutral-section-text', palette.sectionText);
    root.style.setProperty('--neutral-section-icon', palette.sectionIcon);
    root.style.setProperty('--neutral-nav-bg', palette.navBg);
    root.style.setProperty('--neutral-nav-border', palette.navBorder);
    root.style.setProperty('--neutral-action-bg', palette.primary);
    root.style.setProperty('--neutral-action-hover', palette.primaryHover);
    root.style.setProperty('--neutral-halo-bg', palette.softBg);
    root.style.setProperty('--neutral-halo-fg', palette.softFg);
    root.style.setProperty('--neutral-price-on-dark', '#FFFFFF');
    root.style.setProperty('--neutral-dot-on-dark', '#E2E8F0');

    // Tokens Semânticos de Marca (--brand-*) para Cascata Completa
    root.style.setProperty('--brand-primary', palette.primary);
    root.style.setProperty('--brand-primary-hover', palette.primaryHover);
    root.style.setProperty('--brand-primary-fg', palette.primaryFg);
    root.style.setProperty('--brand-soft-bg', palette.softBg);
    root.style.setProperty('--brand-soft-border', palette.softBorder);
    root.style.setProperty('--brand-soft-fg', palette.softFg);
    root.style.setProperty('--brand-canvas-bg', palette.canvasBg);
    root.style.setProperty('--brand-card-bg', palette.cardBg);
    root.style.setProperty('--brand-card-border', palette.cardBorder);
    root.style.setProperty('--brand-header-bg', palette.headerBg);
    root.style.setProperty('--brand-header-border', palette.headerBorder);
    root.style.setProperty('--brand-header-text', palette.headerText);
    root.style.setProperty('--brand-nav-bg', palette.navBg);
    root.style.setProperty('--brand-nav-border', palette.navBorder);
    root.style.setProperty('--brand-nav-active-bg', palette.navActiveBtnBg);
    root.style.setProperty('--brand-nav-active-fg', palette.navActiveBtnFg);
    root.style.setProperty('--accent-color', palette.primary);

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', palette.headerBg);
    }
  } catch (err) {
    console.error('Erro ao aplicar paleta no DOM:', err);
  }

  return palette;
};

export const applyNeutralPresetToDom = (presetId: NeutralPresetId, customAccent?: string) => {
  const tokens = NEUTRAL_PRESETS[presetId] || NEUTRAL_PRESETS[1];
  const isDarkActive = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const hasCustom = Boolean(customAccent && !isLegacyOrSystemDefaultColor(customAccent));
  applyThemePaletteToDom(hasCustom ? customAccent! : tokens.actionBg, isDarkActive, hasCustom);
};

export const applyAccentColorToDom = (
  color: string,
  _presetOverride?: NeutralPresetId,
  forceCustomized?: boolean
) => {
  const isDarkActive = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const norm = normalizeHex(color);
  let isCustomized = forceCustomized;
  if (isCustomized === undefined) {
    try {
      const savedCust = typeof window !== 'undefined' && localStorage.getItem(CUSTOMIZED_THEME_STORAGE_KEY) === '1';
      isCustomized = savedCust || Boolean(norm && !isLegacyOrSystemDefaultColor(norm));
    } catch {
      isCustomized = Boolean(norm && !isLegacyOrSystemDefaultColor(norm));
    }
  }
  applyThemePaletteToDom(norm || DEFAULT_NEUTRAL_HEX, isDarkActive, isCustomized);
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [neutralPreset, setNeutralPresetState] = useState<NeutralPresetId>(() => getCurrentNeutralPreset());

  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try {
      localStorage.removeItem('vagou_user_theme_preference');
      localStorage.removeItem('vagou_theme');
      const explicitChoice = localStorage.getItem(EXPLICIT_THEME_STORAGE_KEY);
      const resolvedTheme: 'dark' | 'light' = explicitChoice === 'dark' ? 'dark' : 'light';

      if (typeof document !== 'undefined') {
        if (resolvedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }

      return resolvedTheme;
    } catch {
      return 'light';
    }
  });

  const [themeExplicitlyCustomized, setThemeExplicitlyCustomized] = useState<boolean>(() => {
    try {
      if (localStorage.getItem(CUSTOMIZED_THEME_STORAGE_KEY) === '1') return true;
      const savedAccent = localStorage.getItem('vagou_accent_color');
      if (savedAccent && !isLegacyOrSystemDefaultColor(savedAccent)) return true;
      return false;
    } catch {
      return false;
    }
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    try {
      const isCust = localStorage.getItem(CUSTOMIZED_THEME_STORAGE_KEY) === '1';
      const saved = localStorage.getItem('vagou_accent_color');
      if (isCust && saved) {
        return sanitizeAccentColor(saved, 1);
      }
      if (saved && !isLegacyOrSystemDefaultColor(saved)) {
        return sanitizeAccentColor(saved, 1);
      }
      return DEFAULT_NEUTRAL_HEX;
    } catch {
      return DEFAULT_NEUTRAL_HEX;
    }
  });

  const isDark = theme === 'dark';
  const presetTokens = NEUTRAL_PRESETS[neutralPreset] || NEUTRAL_PRESETS[1];

  const resolvedPalette = useMemo(
    () => resolveAppThemeTokens(accentColor, isDark, themeExplicitlyCustomized),
    [accentColor, isDark, themeExplicitlyCustomized]
  );

  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      applyThemePaletteToDom(accentColor, isDark, themeExplicitlyCustomized);
    } catch {}
  }, [theme, isDark, accentColor, themeExplicitlyCustomized]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(EXPLICIT_THEME_STORAGE_KEY, next);
      } catch {}
      return next;
    });
  };

  const setTheme = (newTheme: 'dark' | 'light', options?: { isExplicitUserChoice?: boolean }) => {
    const isExplicit = options?.isExplicitUserChoice !== false;
    setThemeState(newTheme);
    try {
      if (isExplicit) {
        localStorage.setItem(EXPLICIT_THEME_STORAGE_KEY, newTheme);
      }
    } catch {}
  };

  const setAccentColor = (color: string, options?: { isExplicitUserChoice?: boolean }) => {
    const clean = sanitizeAccentColor(color, neutralPreset);
    const isExplicit = options?.isExplicitUserChoice !== false;
    setAccentColorState(clean);
    if (isExplicit) {
      setThemeExplicitlyCustomized(true);
      try {
        localStorage.setItem(CUSTOMIZED_THEME_STORAGE_KEY, '1');
        localStorage.setItem('vagou_accent_color', clean);
      } catch {}
    } else {
      const customDetected = !isLegacyOrSystemDefaultColor(clean);
      setThemeExplicitlyCustomized(customDetected);
      try {
        if (customDetected) {
          localStorage.setItem(CUSTOMIZED_THEME_STORAGE_KEY, '1');
          localStorage.setItem('vagou_accent_color', clean);
        } else {
          localStorage.removeItem(CUSTOMIZED_THEME_STORAGE_KEY);
        }
      } catch {}
    }
    applyThemePaletteToDom(clean, isDark, isExplicit ? true : !isLegacyOrSystemDefaultColor(clean));
  };

  const resetToDefaultPalette = () => {
    setThemeState('light');
    setAccentColorState(DEFAULT_NEUTRAL_HEX);
    setThemeExplicitlyCustomized(false);
    setNeutralPresetState(1);
    try {
      localStorage.removeItem(EXPLICIT_THEME_STORAGE_KEY);
      localStorage.removeItem(CUSTOMIZED_THEME_STORAGE_KEY);
      localStorage.removeItem('vagou_accent_color');
      localStorage.removeItem('vagou_accent_color_timestamp');
      localStorage.removeItem('vagou_neutral_preset');
    } catch {}
    applyThemePaletteToDom(DEFAULT_NEUTRAL_HEX, false, false);
  };

  const setNeutralPreset = (preset: NeutralPresetId) => {
    setNeutralPresetState(preset);
    resetToDefaultPalette();
  };

  const cycleNeutralPreset = () => {
    setNeutralPreset(1);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        toggleTheme,
        setTheme,
        accentColor,
        themeExplicitlyCustomized,
        setAccentColor,
        resetToDefaultPalette,
        resolvedPalette,
        neutralPreset,
        presetTokens,
        setNeutralPreset,
        cycleNeutralPreset,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
