import React from 'react';
import { Palette, Type, Check, Sliders } from 'lucide-react';
import { SalonAdminSettings } from '../../types';
import { hapticLight } from '../../utils/haptics';
import { getThemeColorPresets } from '../../utils/colorPresets';
import { DEFAULT_NEUTRAL_HEX, isLightColor, normalizeHex } from '../../utils/themePalette';

interface UnifiedButtonEditorProps {
  title?: string;
  adminSettings: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => void;
  isDark: boolean;
  prefixKey?: 'nav' | 'sectionHeader';
}

export const UnifiedButtonEditor: React.FC<UnifiedButtonEditorProps> = ({
  title = 'Botões & Efeitos',
  adminSettings,
  onUpdateSettings,
  isDark,
  prefixKey = 'nav',
}) => {
  const activeHex = normalizeHex(adminSettings.accentColor) || DEFAULT_NEUTRAL_HEX;
  const BTN_BG_PRESETS = getThemeColorPresets(activeHex);
  const isNav = prefixKey === 'nav';
  const bgCol = isNav ? (adminSettings.navBtnBgColor || '') : (adminSettings.sectionHeaderBtnBgColor || '');
  const borderOpt = isNav ? (adminSettings.navBorder || 'bordered') : (adminSettings.sectionHeaderBtnBorder || 'bordered');
  const shadowOpt = isNav ? (adminSettings.navBtnShadow || 'none') : (adminSettings.sectionHeaderBtnShadow || 'none');
  const blurOpt = isNav ? (adminSettings.navBtnBlur || 'none') : (adminSettings.sectionHeaderBtnBlur || 'none');
  const fontOpt = isNav ? (adminSettings.navBtnFont || 'Plus Jakarta Sans') : (adminSettings.sectionHeaderBtnFont || 'Plus Jakarta Sans');

  const updateField = (key: string, value: string) => {
    if (isNav) {
      if (key === 'bgColor') onUpdateSettings({ navBtnBgColor: value });
      if (key === 'border') onUpdateSettings({ navBorder: value as 'bordered' | 'none' });
      if (key === 'shadow') onUpdateSettings({ navBtnShadow: value as 'none' | 'subtle' | 'medium' | 'glow' });
      if (key === 'blur') onUpdateSettings({ navBtnBlur: value as 'none' | 'sm' | 'md' | 'lg' });
      if (key === 'font') onUpdateSettings({ navBtnFont: value });
    } else {
      if (key === 'bgColor') onUpdateSettings({ sectionHeaderBtnBgColor: value });
      if (key === 'border') onUpdateSettings({ sectionHeaderBtnBorder: value as 'bordered' | 'none' });
      if (key === 'shadow') onUpdateSettings({ sectionHeaderBtnShadow: value as 'none' | 'subtle' | 'medium' | 'glow' });
      if (key === 'blur') onUpdateSettings({ sectionHeaderBtnBlur: value as 'none' | 'sm' | 'md' | 'lg' });
      if (key === 'font') onUpdateSettings({ sectionHeaderBtnFont: value });
    }
  };

  return (
    <div className={`p-3.5 rounded-[4px] border space-y-4 ${
      isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
    }`}>
      <div className={`flex items-center justify-between pb-2 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 brand-icon" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
            {title}
          </h3>
        </div>
        <span className="text-[10px] font-bold brand-text">
          Ao Vivo
        </span>
      </div>

      {/* 1. Cor de Fundo dos Botões */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 brand-icon" />
            Fundo dos Botões
          </label>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {BTN_BG_PRESETS.map((color) => {
            const isSel = (bgCol || 'transparent').toLowerCase() === color.hex.toLowerCase();
            return (
              <button
                key={color.hex || 'transparent'}
                type="button"
                onClick={() => {
                  hapticLight();
                  updateField('bgColor', color.hex);
                }}
                className={`w-7 h-7 rounded-[4px] border transition cursor-pointer relative flex items-center justify-center ${
                  isSel
                    ? 'brand-border-active ring-2 ring-offset-1 ring-slate-400 scale-105 shadow-xs'
                    : isDark
                      ? 'border-slate-700 hover:scale-105'
                      : 'border-slate-300 hover:scale-105'
                }`}
                style={{ backgroundColor: color.hex === 'transparent' ? 'transparent' : color.hex }}
                title={color.name}
              >
                {color.hex === 'transparent' ? (
                  <div className="w-full h-full rounded-[3px] border border-rose-500/80 bg-rose-500/10 flex items-center justify-center relative overflow-hidden">
                    <div className="w-[140%] h-[1.5px] bg-rose-500 -rotate-45" />
                  </div>
                ) : (
                  isSel && (
                    <Check className={`w-3.5 h-3.5 ${isLightColor(color.hex) ? 'text-slate-900' : 'text-white'}`} />
                  )
                )}
              </button>
            );
          })}

          <div className="flex items-center gap-1.5 ml-auto">
            <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {bgCol && bgCol !== 'transparent' ? bgCol.toUpperCase() : 'Padrão'}
            </span>
            <input
              type="color"
              value={normalizeHex(bgCol) || activeHex}
              onChange={(e) => updateField('bgColor', e.target.value)}
              className={`w-7 h-7 rounded-[4px] border cursor-pointer bg-transparent ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
              title="Cor personalizada"
            />
          </div>
        </div>
      </div>

      {/* 2. Borda dos Botões */}
      <div className={`space-y-1.5 pt-2 border-t ${isDark ? 'border-slate-800/70' : 'border-slate-200'}`}>
        <label className="text-xs font-bold block">Borda dos Botões</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'bordered' as const, label: 'Com Borda', desc: 'Contorno visível' },
            { id: 'none' as const, label: 'Sem Borda', desc: 'Superfície limpa' },
          ].map((opt) => {
            const isSel = borderOpt === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  updateField('border', opt.id);
                }}
                className={`p-2.5 rounded-[4px] border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                  isSel
                    ? 'brand-btn shadow-xs'
                    : isDark
                      ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">{opt.label}</span>
                  <span className={`text-[9px] ${isSel ? 'opacity-85' : 'text-slate-400'}`}>{opt.desc}</span>
                </div>
                {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Efeito de Sombra */}
      <div className={`space-y-1.5 pt-2 border-t ${isDark ? 'border-slate-800/70' : 'border-slate-200'}`}>
        <label className="text-xs font-bold block">Sombra</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'none' as const, label: 'Plano' },
            { id: 'subtle' as const, label: 'Sutil' },
            { id: 'medium' as const, label: 'Moderada' },
            { id: 'glow' as const, label: 'Glow' },
          ].map((opt) => {
            const isSelected = shadowOpt === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  updateField('shadow', opt.id);
                }}
                className={`p-2 rounded-[4px] border text-center transition cursor-pointer ${
                  isSelected
                    ? 'brand-btn shadow-xs font-bold'
                    : isDark
                      ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                <span className="text-[11px] font-bold">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Efeito de Blur */}
      <div className={`space-y-1.5 pt-2 border-t ${isDark ? 'border-slate-800/70' : 'border-slate-200'}`}>
        <label className="text-xs font-bold block">Desfoque Glass</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'none' as const, label: 'Opaco' },
            { id: 'sm' as const, label: 'Leve' },
            { id: 'md' as const, label: 'Médio' },
            { id: 'lg' as const, label: 'Forte' },
          ].map((opt) => {
            const isSelected = blurOpt === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  updateField('blur', opt.id);
                }}
                className={`p-2 rounded-[4px] border text-center transition cursor-pointer ${
                  isSelected
                    ? 'brand-btn shadow-xs font-bold'
                    : isDark
                      ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                <span className="text-[11px] font-bold">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Fonte dos Botões */}
      <div className={`space-y-1.5 pt-2 border-t ${isDark ? 'border-slate-800/70' : 'border-slate-200'}`}>
        <label className="text-xs font-bold flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 brand-icon" />
          Fonte
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {['Plus Jakarta Sans', 'Poppins', 'Inter', 'Oswald', 'Cormorant Garamond'].map((fontName) => {
            const isSelected = fontOpt === fontName;
            return (
              <button
                key={fontName}
                type="button"
                onClick={() => {
                  hapticLight();
                  updateField('font', fontName);
                }}
                style={{ fontFamily: fontName }}
                className={`p-2 rounded-[4px] border text-center transition cursor-pointer ${
                  isSelected
                    ? 'brand-btn shadow-xs font-bold'
                    : isDark
                      ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                <span className="text-xs">{fontName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
