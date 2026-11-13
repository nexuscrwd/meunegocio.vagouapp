export const DEFAULT_NEUTRAL_HEX = '#334155';
export const DEFAULT_NEUTRAL_PRESET_ID = 'neutral-light';

export interface QuickThemePreset {
  id: string;
  hex: string;
  label: string;
  isDefault?: boolean;
}

export const QUICK_THEME_PRESETS: QuickThemePreset[] = [
  { id: 'neutral-light', hex: '#334155', label: 'Default', isDefault: true },
  { id: 'blue-sapphire', hex: '#2563EB', label: 'Azul' },
  { id: 'emerald-clean', hex: '#059669', label: 'Esmeralda' },
  { id: 'gold-luxury', hex: '#D97706', label: 'Dourado' },
  { id: 'rose-glam', hex: '#E11D48', label: 'Rose' },
  { id: 'purple-neon', hex: '#7C3AED', label: 'Violeta' },
  { id: 'graphite-pro', hex: '#1E293B', label: 'Grafite' },
  { id: 'black-obsidian', hex: '#0F172A', label: 'Preto' },
];

export const LEGACY_UNCUSTOMIZED_HEXES = new Set([
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

export function normalizeHex(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'transparent') return null;

  const colorMap: Record<string, string> = {
    neutral: '#334155',
    default: '#334155',
    zinc: '#3F3F46',
    emerald: '#059669',
    blue: '#2563EB',
    rose: '#E11D48',
    amber: '#D97706',
    gold: '#D97706',
    violet: '#7C3AED',
    graphite: '#1E293B',
    black: '#0F172A',
  };
  const mapped = colorMap[trimmed.toLowerCase()];
  if (mapped) return mapped;

  const clean = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    const expanded = clean
      .split('')
      .map((ch) => ch + ch)
      .join('')
      .toUpperCase();
    return `#${expanded}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean.toUpperCase()}`;
  }
  return null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const norm = normalizeHex(hex) || DEFAULT_NEUTRAL_HEX;
  const intVal = parseInt(norm.slice(1), 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

export function mixHex(hexA: string, hexB: string, weightA: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.min(1, Math.max(0, weightA));
  const r = Math.round(a.r * w + b.r * (1 - w));
  const g = Math.round(a.g * w + b.g * (1 - w));
  const bl = Math.round(a.b * w + b.b * (1 - w));
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1).toUpperCase()}`;
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const linearize = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function isLightColor(color?: string | null): boolean {
  const norm = normalizeHex(color);
  if (!norm) return false;
  return getRelativeLuminance(norm) > 0.45;
}

export function getContrastTextHex(
  bgColor?: string | null,
  darkInk = '#0F172A',
  lightInk = '#FFFFFF'
): string {
  const norm = normalizeHex(bgColor);
  if (!norm) return lightInk;
  return getRelativeLuminance(norm) > 0.52 ? darkInk : lightInk;
}

export function resolveThemePresetId(accentHex?: string | null, isCustomized?: boolean): string {
  if (!isCustomized) return DEFAULT_NEUTRAL_PRESET_ID;
  const norm = (normalizeHex(accentHex) || DEFAULT_NEUTRAL_HEX).toLowerCase();
  const matched = QUICK_THEME_PRESETS.find((p) => !p.isDefault && p.hex.toLowerCase() === norm);
  if (matched) return matched.id;
  if (norm === '#3b82f6' || norm === '#0ea5e9') return 'blue-sapphire';
  if (norm === '#10b981' || norm === '#20c933') return 'emerald-clean';
  if (norm === '#f59e0b') return 'gold-luxury';
  if (norm === '#ef4444' || norm === '#ec4899' || norm === '#f43f5e') return 'rose-glam';
  if (norm === '#8b5cf6' || norm === '#a855f7') return 'purple-neon';
  if (norm === '#475569') return 'graphite-pro';
  if (norm === '#000000') return 'black-obsidian';
  return 'custom-brand';
}

export interface AppThemePalette {
  isCustomized: boolean;
  isDark: boolean;
  primary: string;
  primaryHover: string;
  primaryFg: string;
  softBg: string;
  softBorder: string;
  softFg: string;
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
  sectionBg: string;
  sectionBorder: string;
  sectionText: string;
  sectionIcon: string;
  navBg: string;
  navBorder: string;
  navIsDark: boolean;
  navActiveBtnBg: string;
  navActiveBtnFg: string;
  navInactiveBtnBg: string;
  navInactiveFg: string;
}

export function resolveAppThemeTokens(
  accentColor?: string | null,
  isDark = false,
  isExplicitlyCustomized = false
): AppThemePalette {
  const normAccent = normalizeHex(accentColor);
  const activeCustomized =
    Boolean(isExplicitlyCustomized) &&
    Boolean(normAccent);

  // Padrão Default Neutro (Cinza, Branco & Escuro Suave)
  if (!activeCustomized || !normAccent) {
    if (isDark) {
      return {
        isCustomized: false,
        isDark: true,
        primary: '#475569',
        primaryHover: '#334155',
        primaryFg: '#FFFFFF',
        softBg: '#1E293B',
        softBorder: '#334155',
        softFg: '#E2E8F0',
        outerBg: '#090D16',
        canvasBg: '#0B0F17',
        shellBorder: '#1E293B',
        cardBg: '#0F172A',
        cardBorder: '#1E293B',
        inputBg: '#0F172A',
        inputBorder: '#334155',
        headerBg: '#0F172A',
        headerBorder: '#1E293B',
        headerText: '#F8FAFC',
        headerSubtext: '#94A3B8',
        headerBoxBg: '#1E293B',
        headerBoxBorder: '#334155',
        sectionBg: '#0F172A',
        sectionBorder: '#1E293B',
        sectionText: '#F8FAFC',
        sectionIcon: '#CBD5E1',
        navBg: '#0F172A',
        navBorder: '#1E293B',
        navIsDark: true,
        navActiveBtnBg: '#334155',
        navActiveBtnFg: '#FFFFFF',
        navInactiveBtnBg: 'rgba(255,255,255,0.06)',
        navInactiveFg: '#94A3B8',
      };
    }

    return {
      isCustomized: false,
      isDark: false,
      primary: '#334155',
      primaryHover: '#1E293B',
      primaryFg: '#FFFFFF',
      softBg: '#F1F5F9',
      softBorder: '#CBD5E1',
      softFg: '#1E293B',
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
      sectionBg: '#FFFFFF',
      sectionBorder: '#E2E8F0',
      sectionText: '#1E293B',
      sectionIcon: '#475569',
      navBg: '#F1F5F9',
      navBorder: '#E2E8F0',
      navIsDark: false,
      navActiveBtnBg: '#FFFFFF',
      navActiveBtnFg: '#0F172A',
      navInactiveBtnBg: 'rgba(255,255,255,0.65)',
      navInactiveFg: '#64748B',
    };
  }

  // Tema Personalizado / Cor Rápida em Cascata Total no App Inteiro
  const p = normAccent;
  const lum = getRelativeLuminance(p);
  const primaryHover = lum < 0.08 ? mixHex(p, '#FFFFFF', 0.85) : mixHex(p, '#000000', 0.82);
  const primaryFg = getContrastTextHex(p);

  if (isDark) {
    const isVeryDarkBrand = lum < 0.06;
    const brightHighlight = isVeryDarkBrand ? '#CBD5E1' : mixHex(p, '#FFFFFF', 0.35);
    return {
      isCustomized: true,
      isDark: true,
      primary: p,
      primaryHover,
      primaryFg,
      softBg: mixHex(p, '#0F172A', 0.22),
      softBorder: mixHex(p, '#334155', 0.48),
      softFg: brightHighlight,
      outerBg: mixHex(p, '#070B12', 0.12),
      canvasBg: mixHex(p, '#0B0F17', 0.08),
      shellBorder: mixHex(p, '#1E293B', 0.35),
      cardBg: mixHex(p, '#0F172A', 0.10),
      cardBorder: mixHex(p, '#1E293B', 0.38),
      inputBg: '#0F172A',
      inputBorder: mixHex(p, '#334155', 0.45),
      headerBg: mixHex(p, '#0F172A', 0.26),
      headerBorder: isVeryDarkBrand ? '#334155' : mixHex(p, '#334155', 0.72),
      headerText: '#F8FAFC',
      headerSubtext: mixHex(p, '#CBD5E1', 0.25),
      headerBoxBg: mixHex(p, '#1E293B', 0.32),
      headerBoxBorder: isVeryDarkBrand ? '#475569' : mixHex(p, '#334155', 0.65),
      sectionBg: mixHex(p, '#0F172A', 0.20),
      sectionBorder: isVeryDarkBrand ? '#1E293B' : mixHex(p, '#1E293B', 0.55),
      sectionText: '#F8FAFC',
      sectionIcon: brightHighlight,
      navBg: mixHex(p, '#0F172A', 0.26),
      navBorder: isVeryDarkBrand ? '#334155' : mixHex(p, '#334155', 0.68),
      navIsDark: true,
      navActiveBtnBg: p,
      navActiveBtnFg: primaryFg,
      navInactiveBtnBg: 'rgba(255,255,255,0.06)',
      navInactiveFg: mixHex(p, '#CBD5E1', 0.24),
    };
  }

  // Modo Claro com Cascata do Tema Escolhido (ex: Azul, Rose, Esmeralda, Dourado, Violeta, Grafite, Preto)
  const darkInkHue = mixHex(p, '#0F172A', 0.30);
  const subInkHue = mixHex(p, '#475569', 0.35);

  return {
    isCustomized: true,
    isDark: false,
    primary: p,
    primaryHover,
    primaryFg,
    softBg: mixHex(p, '#FFFFFF', 0.14),
    softBorder: mixHex(p, '#CBD5E1', 0.42),
    softFg: darkInkHue,
    outerBg: mixHex(p, '#EEF2F6', 0.14),
    canvasBg: mixHex(p, '#F8FAFC', 0.08),
    shellBorder: mixHex(p, '#CBD5E1', 0.35),
    cardBg: '#FFFFFF',
    cardBorder: mixHex(p, '#E2E8F0', 0.28),
    inputBg: '#FFFFFF',
    inputBorder: mixHex(p, '#CBD5E1', 0.36),
    headerBg: mixHex(p, '#FFFFFF', 0.18),
    headerBorder: p,
    headerText: darkInkHue,
    headerSubtext: subInkHue,
    headerBoxBg: '#FFFFFF',
    headerBoxBorder: mixHex(p, '#CBD5E1', 0.50),
    sectionBg: mixHex(p, '#FFFFFF', 0.10),
    sectionBorder: mixHex(p, '#CBD5E1', 0.45),
    sectionText: darkInkHue,
    sectionIcon: p,
    navBg: mixHex(p, '#FFFFFF', 0.18),
    navBorder: mixHex(p, '#CBD5E1', 0.62),
    navIsDark: false,
    navActiveBtnBg: p,
    navActiveBtnFg: primaryFg,
    navInactiveBtnBg: 'rgba(255,255,255,0.78)',
    navInactiveFg: subInkHue,
  };
}
