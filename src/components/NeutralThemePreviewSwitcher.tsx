import React, { useState } from 'react';
import { Palette, ChevronDown, Check } from 'lucide-react';
import { useTheme, NeutralPresetId } from '../context/ThemeContext';

const OPTIONS: Array<{ id: NeutralPresetId; label: string; swatch: string; desc: string }> = [
  { id: 1, label: '1 · Puro', swatch: '#FFFFFF', desc: 'Branco + Gelo + Grafite' },
  { id: 2, label: '2 · Acetinado', swatch: '#E4E4E7', desc: 'Zinc Suave + Ardósia' },
  { id: 3, label: '3 · Grafite', swatch: '#18181B', desc: 'Topo/Barra Grafite' },
];

export const NeutralThemePreviewSwitcher: React.FC = () => {
  const { neutralPreset, setNeutralPreset } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Testar Opções de Cor Neutra (1, 2 e 3)"
        className="fixed bottom-[88px] right-3 sm:bottom-4 sm:right-4 z-[9990] h-9 px-3 rounded-[4px] bg-[#18181B] text-white border border-white/20 shadow-lg flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap cursor-pointer active:scale-95 transition-transform"
      >
        <Palette className="w-3.5 h-3.5 text-white shrink-0" />
        <span className="text-white">Tema Neutro: Opção {neutralPreset}</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Seletor de Esquema Neutro Default"
      className="fixed bottom-[86px] left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:bottom-4 sm:right-4 z-[9990] bg-[#18181B]/95 backdrop-blur-md text-white border border-white/15 rounded-[4px] shadow-2xl p-1.5 flex items-center gap-1 max-w-[96vw]"
    >
      <div className="hidden sm:flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-300 whitespace-nowrap">
        <Palette className="w-3.5 h-3.5 text-white shrink-0" />
        <span>Default:</span>
      </div>

      {OPTIONS.map((opt) => {
        const isActive = neutralPreset === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setNeutralPreset(opt.id)}
            title={opt.desc}
            className={`h-8 px-2.5 rounded-[4px] text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
              isActive
                ? 'bg-white text-[#18181B] shadow-xs'
                : 'bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-[2px] border border-zinc-400/60 shrink-0"
              style={{ backgroundColor: opt.swatch }}
            />
            <span style={{ color: isActive ? '#18181B' : '#F4F4F5' }}>{opt.label}</span>
            {isActive && <Check className="w-3 h-3 shrink-0" style={{ color: '#18181B' }} />}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setCollapsed(true)}
        title="Recolher seletor"
        className="h-8 w-7 rounded-[4px] bg-zinc-800/70 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 cursor-pointer shrink-0"
      >
        <ChevronDown className="w-3.5 h-3.5 text-white" />
      </button>
    </aside>
  );
};
