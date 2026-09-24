import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ThemeContextType {
  theme: 'dark' | 'light';
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
  accentColor: '#10b981',
  setAccentColor: () => {},
});

export const applyAccentColorToDom = (color: string) => {
  if (!color) return;
  const colorMap: Record<string, string> = {
    emerald: '#10b981',
    blue: '#3b82f6',
    rose: '#ef4444',
    amber: '#f59e0b',
    violet: '#8b5cf6',
  };
  const hex = color.startsWith('#') ? color : (colorMap[color] || color || '#10b981');

  try {
    localStorage.setItem('vagou_accent_color', hex);

    // 1. Atualiza propriedades CSS no documentElement
    const root = document.documentElement;
    root.style.setProperty('--accent-color', hex);
    root.style.setProperty('--color-emerald-300', `color-mix(in srgb, ${hex} 70%, white 30%)`);
    root.style.setProperty('--color-emerald-400', `color-mix(in srgb, ${hex} 85%, white 15%)`);
    root.style.setProperty('--color-emerald-500', hex);
    root.style.setProperty('--color-emerald-600', `color-mix(in srgb, ${hex} 85%, black 15%)`);
    root.style.setProperty('--color-emerald-700', `color-mix(in srgb, ${hex} 70%, black 30%)`);
    root.style.setProperty('--color-emerald-50', `color-mix(in srgb, ${hex} 10%, white 90%)`);
    root.style.setProperty('--color-emerald-100', `color-mix(in srgb, ${hex} 18%, white 82%)`);
    root.style.setProperty('--color-emerald-200', `color-mix(in srgb, ${hex} 30%, white 70%)`);
    root.style.setProperty('--color-emerald-800', `color-mix(in srgb, ${hex} 55%, black 45%)`);
    root.style.setProperty('--color-emerald-900', `color-mix(in srgb, ${hex} 40%, black 60%)`);
    root.style.setProperty('--color-emerald-950', `color-mix(in srgb, ${hex} 20%, black 80%)`);

    // 2. Injeta tag de estilo dinâmica para garantir reatividade total sem quebrar opacidades
    let styleEl = document.getElementById('vagou-dynamic-accent');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'vagou-dynamic-accent';
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `
      :root {
        --accent-color: ${hex} !important;
        --color-emerald-300: color-mix(in srgb, ${hex} 70%, white 30%) !important;
        --color-emerald-400: color-mix(in srgb, ${hex} 85%, white 15%) !important;
        --color-emerald-500: ${hex} !important;
        --color-emerald-600: color-mix(in srgb, ${hex} 85%, black 15%) !important;
        --color-emerald-700: color-mix(in srgb, ${hex} 70%, black 30%) !important;
        --color-emerald-50: color-mix(in srgb, ${hex} 10%, white 90%) !important;
        --color-emerald-100: color-mix(in srgb, ${hex} 18%, white 82%) !important;
        --color-emerald-200: color-mix(in srgb, ${hex} 30%, white 70%) !important;
        --color-emerald-800: color-mix(in srgb, ${hex} 55%, black 45%) !important;
        --color-emerald-900: color-mix(in srgb, ${hex} 40%, black 60%) !important;
        --color-emerald-950: color-mix(in srgb, ${hex} 20%, black 80%) !important;
      }
      .bg-accent {
        background-color: ${hex} !important;
      }
      .text-accent {
        color: ${hex} !important;
      }
      .border-accent {
        border-color: ${hex} !important;
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
      const saved = localStorage.getItem('vagou_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
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
      const initial = saved || '#10b981';
      applyAccentColorToDom(initial);
      return initial;
    } catch {
      return '#10b981';
    }
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    try {
      localStorage.setItem('vagou_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {}
  }, [theme]);

  useEffect(() => {
    applyAccentColorToDom(accentColor);
  }, [accentColor]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);
  };

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    applyAccentColorToDom(color);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, setTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
