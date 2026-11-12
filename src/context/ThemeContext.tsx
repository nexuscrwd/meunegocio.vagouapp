import React, { createContext, useContext, useState, useEffect } from 'react';

export type NeutralPresetId = 1 | 2 | 3;

export const EXPLICIT_THEME_STORAGE_KEY = 'vagou_theme_mode_v3';

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
    fullLabel: 'Padrão Claro Neutro Independente (Branco, Gelo & Slate Suave)',
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

const LEGACY_SYSTEM_COLORS = new Set([
  '',
  'transparent',
  '#ffffff',
  '#fff',
  'white',
  '#005ca9',
  '#2b82c9',
  '#10b981',
  '#20c933',
  '#059669',
  '#065f46',
  '#047857',
  '#d1fae5',
  '#dcfce7',
  '#ecfdf5',
  '#f0fdf4',
  '#a7f3d0',
  '#f1f5f9',
  '#f8fafc',
  '#fafafa',
  '#f4f4f5',
  '#18181b',
  '#27272a',
  '#0f172a',
  '#1e293b',
  '#334155',
  '#475569',
]);

export function isLegacyOrSystemDefaultColor(rawColor?: string | null): boolean {
  if (!rawColor) return true;
  return LEGACY_SYSTEM_COLORS.has(rawColor.trim().toLowerCase());
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
  setAccentColor: (color: string) => void;
  neutralPreset: NeutralPresetId;
  presetTokens: NeutralPresetTokens;
  setNeutralPreset: (preset: NeutralPresetId) => void;
  cycleNeutralPreset: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
  accentColor: '#334155',
  setAccentColor: () => {},
  neutralPreset: 1,
  presetTokens: NEUTRAL_PRESETS[1],
  setNeutralPreset: () => {},
  cycleNeutralPreset: () => {},
});

export const sanitizeAccentColor = (rawColor?: string | null, fallbackPreset?: NeutralPresetId): string => {
  const preset = NEUTRAL_PRESETS[fallbackPreset || 1];
  if (!rawColor) return preset.actionBg;
  const trimmed = rawColor.trim().toLowerCase();
  if (isLegacyOrSystemDefaultColor(trimmed)) {
    return preset.actionBg;
  }
  const colorMap: Record<string, string> = {
    neutral: '#334155',
    zinc: '#3F3F46',
    emerald: '#10B981',
    blue: '#2563EB',
    rose: '#E11D48',
    amber: '#D97706',
    violet: '#7C3AED',
  };
  if (colorMap[trimmed]) return colorMap[trimmed];
  if (!rawColor.startsWith('#')) return preset.actionBg;
  return rawColor.trim();
};

export const applyNeutralPresetToDom = (presetId: NeutralPresetId, customAccent?: string) => {
  if (typeof document === 'undefined') return;
  const tokens = NEUTRAL_PRESETS[presetId] || NEUTRAL_PRESETS[1];
  const root = document.documentElement;
  root.setAttribute('data-neutral-preset', String(tokens.id));

  root.style.setProperty('--neutral-outer-bg', tokens.outerBg);
  root.style.setProperty('--neutral-canvas-bg', tokens.canvasBg);
  root.style.setProperty('--neutral-shell-border', tokens.shellBorder);
  root.style.setProperty('--neutral-card-bg', tokens.cardBg);
  root.style.setProperty('--neutral-card-border', tokens.cardBorder);
  root.style.setProperty('--neutral-input-bg', tokens.inputBg);
  root.style.setProperty('--neutral-input-border', tokens.inputBorder);
  root.style.setProperty('--neutral-header-bg', tokens.headerBg);
  root.style.setProperty('--neutral-header-border', tokens.headerBorder);
  root.style.setProperty('--neutral-header-text', tokens.headerText);
  root.style.setProperty('--neutral-header-subtext', tokens.headerSubtext);
  root.style.setProperty('--neutral-header-box-bg', tokens.headerBoxBg);
  root.style.setProperty('--neutral-header-box-border', tokens.headerBoxBorder);
  root.style.setProperty('--neutral-section-bg', tokens.sectionBg);
  root.style.setProperty('--neutral-section-border', tokens.sectionBorder);
  root.style.setProperty('--neutral-section-text', tokens.sectionText);
  root.style.setProperty('--neutral-section-icon', tokens.sectionIcon);
  root.style.setProperty('--neutral-nav-bg', tokens.navBg);
  root.style.setProperty('--neutral-nav-border', tokens.navBorder);
  root.style.setProperty(
    '--neutral-action-bg',
    customAccent && !isLegacyOrSystemDefaultColor(customAccent) ? customAccent : tokens.actionBg
  );
  root.style.setProperty('--neutral-action-hover', tokens.actionHover);
  root.style.setProperty('--neutral-halo-bg', tokens.subtleHaloBg);
  root.style.setProperty('--neutral-halo-fg', tokens.subtleHaloFg);
  root.style.setProperty('--neutral-price-on-dark', tokens.priceOnDarkCard);
  root.style.setProperty('--neutral-dot-on-dark', tokens.dotOnDarkCard);
};

export const applyAccentColorToDom = (color: string, presetOverride?: NeutralPresetId) => {
  const presetId = presetOverride || 1;
  const tokens = NEUTRAL_PRESETS[presetId] || NEUTRAL_PRESETS[1];
  const hex = isLegacyOrSystemDefaultColor(color)
    ? tokens.actionBg
    : sanitizeAccentColor(color, presetId);

  try {
    applyNeutralPresetToDom(presetId, hex);

    const root = document.documentElement;
    root.style.setProperty('--accent-color', hex);

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const isDarkActive = root.classList.contains('dark');
      metaThemeColor.setAttribute('content', isDarkActive ? '#0F172A' : tokens.headerBg);
    }
  } catch (err) {
    console.error('Erro ao aplicar tema:', err);
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [neutralPreset, setNeutralPresetState] = useState<NeutralPresetId>(() => {
    const initialPreset = getCurrentNeutralPreset();
    if (typeof document !== 'undefined') {
      applyNeutralPresetToDom(initialPreset);
    }
    return initialPreset;
  });

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

  const [accentColor, setAccentColorState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vagou_accent_color');
      const resolved = isLegacyOrSystemDefaultColor(saved)
        ? NEUTRAL_PRESETS[1].actionBg
        : sanitizeAccentColor(saved, 1);
      applyAccentColorToDom(resolved, 1);
      return resolved;
    } catch {
      return NEUTRAL_PRESETS[1].actionBg;
    }
  });

  const isDark = theme === 'dark';
  const presetTokens = NEUTRAL_PRESETS[neutralPreset] || NEUTRAL_PRESETS[1];

  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#0F172A' : presetTokens.headerBg);
      }
    } catch {}
  }, [theme, presetTokens.headerBg]);

  useEffect(() => {
    applyAccentColorToDom(accentColor, neutralPreset);
  }, [accentColor, neutralPreset]);

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

  const setAccentColor = (color: string) => {
    const clean = sanitizeAccentColor(color, neutralPreset);
    setAccentColorState(clean);
    try {
      localStorage.setItem('vagou_accent_color', clean);
    } catch {}
    applyAccentColorToDom(clean, neutralPreset);
  };

  const setNeutralPreset = (preset: NeutralPresetId) => {
    setNeutralPresetState(preset);
    const nextTokens = NEUTRAL_PRESETS[preset];
    try {
      localStorage.removeItem(EXPLICIT_THEME_STORAGE_KEY);
    } catch {}
    setThemeState('light');
    if (isLegacyOrSystemDefaultColor(accentColor)) {
      setAccentColorState(nextTokens.actionBg);
      applyAccentColorToDom(nextTokens.actionBg, preset);
    } else {
      applyAccentColorToDom(accentColor, preset);
    }
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
        setAccentColor,
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
