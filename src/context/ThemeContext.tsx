import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ThemeContextType {
  theme: 'dark' | 'light';
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light', options?: { isExplicitUserChoice?: boolean }) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
  accentColor: '#2B82C9',
  setAccentColor: () => {},
});

const isAchromaticOrGreyHex = (hexStr: string): boolean => {
  const clean = hexStr.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6) return true;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return true;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Rejeita qualquer tom acinzentado/neutro (saturação baixa), branco ou preto
  if (max - min < 38) return true;
  if (max < 45 || min > 225) return true;
  return false;
};

export const sanitizeAccentColor = (rawColor?: string | null): string => {
  if (!rawColor) return '#2B82C9';
  const trimmed = rawColor.trim().toLowerCase();
  if (
    !trimmed ||
    trimmed === 'transparent' ||
    trimmed === '#ffffff' ||
    trimmed === '#fff' ||
    trimmed === 'white' ||
    trimmed === '#005ca9'
  ) {
    return '#2B82C9';
  }
  const colorMap: Record<string, string> = {
    emerald: '#2B82C9',
    blue: '#2B82C9',
    rose: '#ef4444',
    amber: '#f59e0b',
    violet: '#8b5cf6',
  };
  if (colorMap[trimmed]) return colorMap[trimmed];
  if (!rawColor.startsWith('#')) return '#2B82C9';
  if (isAchromaticOrGreyHex(trimmed)) {
    return '#2B82C9';
  }
  return rawColor.trim();
};

export const applyAccentColorToDom = (color: string) => {
  const hex = sanitizeAccentColor(color || '#2B82C9');

  try {
    localStorage.setItem('vagou_accent_color', hex);

    // 1. Atualiza propriedades CSS no documentElement
    const root = document.documentElement;
    root.style.setProperty('--accent-color', hex);
    root.style.setProperty('--color-emerald-50', `color-mix(in srgb, ${hex} 10%, white 90%)`);
    root.style.setProperty('--color-emerald-100', `color-mix(in srgb, ${hex} 18%, white 82%)`);
    root.style.setProperty('--color-emerald-200', `color-mix(in srgb, ${hex} 30%, white 70%)`);
    root.style.setProperty('--color-emerald-300', `color-mix(in srgb, ${hex} 70%, white 30%)`);
    root.style.setProperty('--color-emerald-400', `color-mix(in srgb, ${hex} 85%, white 15%)`);
    root.style.setProperty('--color-emerald-500', hex);
    root.style.setProperty('--color-emerald-600', `color-mix(in srgb, ${hex} 85%, black 15%)`);
    root.style.setProperty('--color-emerald-700', `color-mix(in srgb, ${hex} 70%, black 30%)`);
    root.style.setProperty('--color-emerald-800', `color-mix(in srgb, ${hex} 55%, black 45%)`);
    root.style.setProperty('--color-emerald-900', `color-mix(in srgb, ${hex} 40%, black 60%)`);
    root.style.setProperty('--color-emerald-950', `color-mix(in srgb, ${hex} 20%, black 80%)`);

    // 2. Injeta tag de estilo dinâmica para garantir reatividade total em botões, bordas, subtítulos e textos secundários
    let styleEl = document.getElementById('vagou-dynamic-accent');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'vagou-dynamic-accent';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      :root {
        --accent-color: ${hex} !important;
        --color-emerald-50: color-mix(in srgb, ${hex} 10%, white 90%) !important;
        --color-emerald-100: color-mix(in srgb, ${hex} 18%, white 82%) !important;
        --color-emerald-200: color-mix(in srgb, ${hex} 30%, white 70%) !important;
        --color-emerald-300: color-mix(in srgb, ${hex} 70%, white 30%) !important;
        --color-emerald-400: color-mix(in srgb, ${hex} 85%, white 15%) !important;
        --color-emerald-500: ${hex} !important;
        --color-emerald-600: color-mix(in srgb, ${hex} 85%, black 15%) !important;
        --color-emerald-700: color-mix(in srgb, ${hex} 70%, black 30%) !important;
        --color-emerald-800: color-mix(in srgb, ${hex} 55%, black 45%) !important;
        --color-emerald-900: color-mix(in srgb, ${hex} 40%, black 60%) !important;
        --color-emerald-950: color-mix(in srgb, ${hex} 20%, black 80%) !important;
      }
      .bg-accent, .bg-\\[\\#20C933\\], .status-green-bg {
        background-color: ${hex} !important;
        color: #ffffff !important;
      }
      .hover\\:bg-\\[\\#1bb32d\\]:hover, .hover\\:bg-\\[\\#1eb72e\\]:hover {
        background-color: color-mix(in srgb, ${hex} 85%, black 15%) !important;
      }
      .text-accent, .text-\\[\\#20C933\\] {
        color: ${hex} !important;
      }
      .text-\\[\\#087A2A\\] {
        color: color-mix(in srgb, ${hex} 72%, black 28%) !important;
      }
      .border-accent, .border-\\[\\#20C933\\] {
        border-color: ${hex} !important;
      }
      .dark .border-slate-800:not([style*="border-color"]),
      .dark .border-slate-800\\/90:not([style*="border-color"]),
      .dark .border-slate-800\\/80:not([style*="border-color"]),
      .dark .border-slate-800\\/60:not([style*="border-color"]) {
        border-color: color-mix(in srgb, ${hex} 24%, #1e293b 76%) !important;
      }
      .dark .border-slate-700:not([style*="border-color"]),
      .dark .border-slate-700\\/80:not([style*="border-color"]),
      .dark .border-slate-700\\/60:not([style*="border-color"]) {
        border-color: color-mix(in srgb, ${hex} 32%, #334155 68%) !important;
      }
      html:not(.dark) .border-slate-200:not([style*="border-color"]),
      html:not(.dark) .border-slate-200\\/90:not([style*="border-color"]),
      html:not(.dark) .border-slate-200\\/80:not([style*="border-color"]),
      html:not(.dark) .border-slate-800:not([style*="border-color"]),
      html:not(.dark) .border-slate-800\\/90:not([style*="border-color"]),
      html:not(.dark) .border-slate-800\\/80:not([style*="border-color"]),
      html:not(.dark) .border-slate-800\\/60:not([style*="border-color"]) {
        border-color: color-mix(in srgb, ${hex} 22%, #e2e8f0 78%) !important;
      }
      html:not(.dark) .border-slate-300:not([style*="border-color"]),
      html:not(.dark) .border-slate-700:not([style*="border-color"]),
      html:not(.dark) .border-slate-700\\/80:not([style*="border-color"]),
      html:not(.dark) .border-slate-700\\/60:not([style*="border-color"]) {
        border-color: color-mix(in srgb, ${hex} 28%, #cbd5e1 72%) !important;
      }
      .dark .text-slate-300:not([style*="color"]) {
        color: color-mix(in srgb, ${hex} 16%, #cbd5e1 84%) !important;
      }
      .dark .text-slate-400:not([style*="color"]) {
        color: color-mix(in srgb, ${hex} 24%, #94a3b8 76%) !important;
      }
      .dark .text-slate-500:not([style*="color"]) {
        color: color-mix(in srgb, ${hex} 20%, #64748b 80%) !important;
      }
      html:not(.dark) .text-slate-400:not([style*="color"]) {
        color: color-mix(in srgb, ${hex} 25%, #64748b 75%) !important;
      }
      html:not(.dark) .text-slate-500:not([style*="color"]) {
        color: color-mix(in srgb, ${hex} 28%, #475569 72%) !important;
      }
      html:not(.dark) .text-slate-600:not([style*="color"]) {
        color: color-mix(in srgb, ${hex} 24%, #334155 76%) !important;
      }
      .text-white, .dark .text-white {
        color: #ffffff !important;
      }
    `;

    // 3. Atualiza meta theme-color da barra de status móvel
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', hex);
    }
  } catch (err) {
    console.error('Erro ao aplicar cor de destaque:', err);
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<'dark' | 'light'>(() => {
    try {
      const explicitChoice = localStorage.getItem('vagou_user_theme_preference');
      let salonDefaultTheme: 'dark' | 'light' | undefined = undefined;

      const settingsStr = localStorage.getItem('vagou_salon_admin_settings');
      if (settingsStr) {
        try {
          const parsed = JSON.parse(settingsStr);
          if (parsed && (parsed.defaultTheme === 'dark' || parsed.defaultTheme === 'light')) {
            salonDefaultTheme = parsed.defaultTheme;
          }
        } catch (e) {
          console.warn('[Theme:ThemeProvider] Erro ao parsear vagou_salon_admin_settings:', e);
        }
      }

      if (!salonDefaultTheme) {
        try {
          const partnerStr = localStorage.getItem('vagou_partner_data');
          if (partnerStr) {
            const parsed = JSON.parse(partnerStr);
            if (parsed && (parsed.defaultTheme === 'dark' || parsed.defaultTheme === 'light')) {
              salonDefaultTheme = parsed.defaultTheme;
            }
          }
        } catch {}
      }

      const hasExplicitChoice = explicitChoice === 'dark' || explicitChoice === 'light';
      const resolvedTheme: 'dark' | 'light' = hasExplicitChoice
        ? (explicitChoice as 'dark' | 'light')
        : (salonDefaultTheme === 'dark' || salonDefaultTheme === 'light')
          ? salonDefaultTheme
          : 'light';

      const sourceDescription = hasExplicitChoice
        ? 'vagou_user_theme_preference'
        : salonDefaultTheme
          ? 'salonSettings.defaultTheme'
          : 'fallback_light';

      console.log('[Theme:ThemeProvider] Rastreamento de Fonte de Preferência de Tema:', {
        vagou_user_theme_preference: explicitChoice,
        'salonSettings.defaultTheme': salonDefaultTheme,
        source: sourceDescription,
        resolvedTheme,
        documentHasDarkClass: typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
      });

      // Aplica imediatamente no documentElement para garantir alinhamento pré-render
      if (typeof document !== 'undefined') {
        if (resolvedTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }

      return resolvedTheme;
    } catch (err) {
      console.warn('[Theme:ThemeProvider] Erro inesperado na inicialização:', err);
      return 'light';
    }
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    try {
      let saved = localStorage.getItem('vagou_accent_color');
      if (!saved) {
        const settingsStr = localStorage.getItem('vagou_salon_admin_settings');
        if (settingsStr) {
          const parsed = JSON.parse(settingsStr);
          if (parsed && parsed.accentColor) saved = parsed.accentColor;
        }
      }
      const initial = sanitizeAccentColor(saved);
      applyAccentColorToDom(initial);
      return initial;
    } catch {
      return '#20C933';
    }
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    try {
      const hadDarkBefore = document.documentElement.classList.contains('dark');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      const hasDarkAfter = document.documentElement.classList.contains('dark');
      console.log('[Theme:useEffect[theme]] Sincronizando classe "dark" no DOM:', {
        theme,
        hadDarkBefore,
        hasDarkAfter,
        domDarkApplied: hasDarkAfter
      });
    } catch (err) {
      console.warn('[Theme:useEffect[theme]] Erro ao sincronizar classes DOM:', err);
    }
  }, [theme]);

  useEffect(() => {
    applyAccentColorToDom(accentColor);
  }, [accentColor]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      console.log('[Theme:toggleTheme] Alternando tema manualmente pelo usuário:', {
        previousTheme: prev,
        nextTheme: next
      });
      try {
        localStorage.setItem('vagou_user_theme_preference', next);
        localStorage.setItem('vagou_theme', next);
      } catch (err) {
        console.warn('[Theme:toggleTheme] Erro ao persistir tema:', err);
      }
      return next;
    });
  };

  const setTheme = (newTheme: 'dark' | 'light', options?: { isExplicitUserChoice?: boolean }) => {
    const isExplicit = options?.isExplicitUserChoice !== false;
    console.log('[Theme:setTheme] Definindo tema:', {
      newTheme,
      isExplicitUserChoice: isExplicit,
      source: isExplicit ? 'user_manual_selection' : 'salon_sync'
    });
    setThemeState(newTheme);
    try {
      if (isExplicit) {
        localStorage.setItem('vagou_user_theme_preference', newTheme);
      }
      localStorage.setItem('vagou_theme', newTheme);
    } catch (err) {
      console.warn('[Theme:setTheme] Erro ao persistir tema:', err);
    }
  };

  const setAccentColor = (color: string) => {
    const clean = sanitizeAccentColor(color);
    setAccentColorState(clean);
    applyAccentColorToDom(clean);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
