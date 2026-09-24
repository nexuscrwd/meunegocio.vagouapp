import React, { useState, useRef } from 'react';
import { 
  Palette, Upload, Trash2, Smartphone, Image as ImageIcon,
  Check, Sparkles, ArrowLeft, Sun, Moon, RefreshCw, Save
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { SalonAdminSettings } from '../../types';
import { hapticSuccess, hapticLight } from '../../utils/haptics';
import { updateDynamicPwaAssets } from '../../utils/pwaAssets';
import { compressImageFile } from '../../utils/imageCompressor';

export interface VisualIdentityCardViewProps {
  adminSettings: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => void;
  onBack: () => void;
}

export const VisualIdentityCardView: React.FC<VisualIdentityCardViewProps> = ({
  adminSettings,
  onUpdateSettings,
  onBack,
}) => {
  const { isDark, setAccentColor: setAccentColorContext } = useTheme();

  const [salonName] = useState(adminSettings.salonName || '');
  const [pwaName, setPwaName] = useState(adminSettings.pwaName || adminSettings.salonName || '');
  const [salonLogoLight, setSalonLogoLight] = useState(adminSettings.salonLogoLight || adminSettings.salonLogo || '');
  const [salonLogoDark, setSalonLogoDark] = useState(adminSettings.salonLogoDark || adminSettings.salonLogo || '');
  const [salonIcon, setSalonIcon] = useState(adminSettings.salonIcon || '');
  const [accentColor, setAccentColor] = useState(adminSettings.accentColor || '#10b981');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const logoLightInputRef = useRef<HTMLInputElement>(null);
  const logoDarkInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const COLOR_PRESETS = [
    { label: 'Esmeralda', hex: '#10b981' },
    { label: 'Azul Real', hex: '#3b82f6' },
    { label: 'Âmbar Ouro', hex: '#f59e0b' },
    { label: 'Rubi', hex: '#ef4444' },
    { label: 'Violeta', hex: '#8b5cf6' },
  ];

  // Upload Logo Tema Claro (com compressão automática para caber no localStorage e PWA)
  const handleLogoLightFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.name.endsWith('.svg'))) {
      try {
        const compressed = await compressImageFile(file, { maxWidth: 640, maxHeight: 180, quality: 0.88 });
        setSalonLogoLight(compressed);
        hapticSuccess();
      } catch (err) {
        console.error('Erro ao processar logo claro:', err);
      }
    }
  };

  // Upload Logo Tema Escuro (com compressão automática)
  const handleLogoDarkFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.name.endsWith('.svg'))) {
      try {
        const compressed = await compressImageFile(file, { maxWidth: 640, maxHeight: 180, quality: 0.88 });
        setSalonLogoDark(compressed);
        hapticSuccess();
      } catch (err) {
        console.error('Erro ao processar logo escuro:', err);
      }
    }
  };

  // Upload Ícone Mobile (1:1 com compressão quadrada para PWA)
  const handleIconFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type.startsWith('image/') || file.name.endsWith('.svg'))) {
      try {
        const compressed = await compressImageFile(file, { maxWidth: 256, maxHeight: 256, quality: 0.9, mimeType: 'image/png' });
        setSalonIcon(compressed);
        hapticSuccess();
      } catch (err) {
        console.error('Erro ao processar ícone mobile:', err);
      }
    }
  };

  const handleLogoLightDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.name.endsWith('.svg'))) {
      try {
        const compressed = await compressImageFile(file, { maxWidth: 640, maxHeight: 180, quality: 0.88 });
        setSalonLogoLight(compressed);
        hapticSuccess();
      } catch (err) {
        console.error('Erro ao processar logo claro:', err);
      }
    }
  };

  const handleLogoDarkDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.name.endsWith('.svg'))) {
      try {
        const compressed = await compressImageFile(file, { maxWidth: 640, maxHeight: 180, quality: 0.88 });
        setSalonLogoDark(compressed);
        hapticSuccess();
      } catch (err) {
        console.error('Erro ao processar logo escuro:', err);
      }
    }
  };

  const handleIconDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.name.endsWith('.svg'))) {
      try {
        const compressed = await compressImageFile(file, { maxWidth: 256, maxHeight: 256, quality: 0.9, mimeType: 'image/png' });
        setSalonIcon(compressed);
        hapticSuccess();
      } catch (err) {
        console.error('Erro ao processar ícone mobile:', err);
      }
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    hapticSuccess();

    const finalLogo = isDark ? (salonLogoDark || salonLogoLight) : (salonLogoLight || salonLogoDark);

    onUpdateSettings({
      salonLogo: finalLogo,
      salonLogoLight,
      salonLogoDark,
      salonIcon,
      accentColor,
      pwaName: pwaName.trim() || salonName,
    });

    try {
      if (salonLogoLight) localStorage.setItem('vagou_salon_logo_light', salonLogoLight);
      if (salonLogoDark) localStorage.setItem('vagou_salon_logo_dark', salonLogoDark);
      if (salonIcon) localStorage.setItem('vagou_salon_icon', salonIcon);
      localStorage.setItem('vagou_accent_color', accentColor);
    } catch (storageErr) {
      console.warn('Erro ao salvar chaves auxiliares de identidade:', storageErr);
    }

    setAccentColorContext(accentColor);
    updateDynamicPwaAssets(pwaName.trim() || salonName, salonIcon || finalLogo);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className={`w-full h-full flex flex-col justify-between overflow-y-auto ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Topo com botão voltar */}
      <div className={`px-3 py-2.5 border-b shrink-0 flex items-center justify-between gap-2 sticky top-0 z-30 ${
        isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onBack();
            }}
            className={`p-1.5 rounded transition cursor-pointer active:scale-95 ${
              isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
            }`}
            title="Voltar ao Gerenciamento"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-emerald-500 shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold font-['Poppins']">
              Identidade Visual
            </h2>
          </div>
        </div>

        {savedSuccess && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded shadow-xs animate-in fade-in">
            <Check className="w-3 h-3 text-white" />
            Salvo
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="p-3.5 space-y-4 pb-24">
        
        {/* 1. COR DE DESTAQUE */}
        <div className={`p-3.5 rounded border space-y-3 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4" style={{ color: accentColor }} />
              <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
                Cor de Destaque
              </h3>
            </div>
            <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>
              {accentColor}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.hex}
                type="button"
                onClick={() => {
                  hapticLight();
                  setAccentColor(preset.hex);
                  setAccentColorContext(preset.hex);
                  onUpdateSettings({ accentColor: preset.hex });
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-bold border transition cursor-pointer ${
                  accentColor.toLowerCase() === preset.hex.toLowerCase()
                    ? 'border-white bg-slate-800 text-white shadow-xs scale-105'
                    : isDark
                    ? 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                    : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300'
                }`}
                style={accentColor.toLowerCase() === preset.hex.toLowerCase() ? { borderColor: preset.hex } : undefined}
              >
                <span 
                  className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 shadow-xs" 
                  style={{ backgroundColor: preset.hex }} 
                />
                <span>{preset.label}</span>
                {accentColor.toLowerCase() === preset.hex.toLowerCase() && (
                  <Check className="w-3 h-3 ml-0.5 text-white" />
                )}
              </button>
            ))}

            {/* Seletor Customizado */}
            <div className="flex items-center gap-1 pl-1">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => {
                  const val = e.target.value;
                  setAccentColor(val);
                  setAccentColorContext(val);
                  onUpdateSettings({ accentColor: val });
                }}
                className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                title="Escolha uma cor personalizada"
              />
              <span className="text-[10px] text-slate-400 font-mono">Custom</span>
            </div>
          </div>
        </div>

        {/* 2. LOGOS DO CABEÇALHO (TEMA CLARO E TEMA ESCURO) */}
        <div className={`p-3.5 rounded border space-y-3.5 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" style={{ color: accentColor }} />
              <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
                Logos do Cabeçalho
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              2 Versões (Claro & Escuro)
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Envie as duas versões do seu logo horizontal (PNG/SVG com fundo transparente) para alternar automaticamente de acordo com o tema selecionado.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            
            {/* 2.1 Logo para Tema Claro */}
            <div className={`p-3 rounded border flex flex-col justify-between gap-2.5 ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/90 border-slate-200'
            }`}>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/40">
                <div className="flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Logo Tema Claro
                  </span>
                </div>
                <span className="text-[8.5px] px-1.5 py-0.5 rounded font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Fundo Claro
                </span>
              </div>

              {/* Prévia Fundo Claro */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Prévia no Topo Claro</span>
                  <span className="flex items-center gap-0.5 font-bold" style={{ color: accentColor }}>
                    <Sparkles className="w-2 h-2" style={{ color: accentColor }} /> Ao Vivo
                  </span>
                </div>

                <div className="h-10 rounded border border-slate-200 bg-white px-3 flex items-center justify-between overflow-hidden shadow-2xs">
                  <div className="h-full flex items-center max-w-[160px] overflow-hidden">
                    {salonLogoLight ? (
                      <img 
                        src={salonLogoLight} 
                        alt="Logo Tema Claro" 
                        className="max-h-6.5 w-auto object-contain object-left" 
                      />
                    ) : (
                      <span className="text-xs font-black uppercase tracking-tight truncate text-slate-900">
                        <span style={{ color: accentColor }}>{salonName.split(' ')[0]}</span>{' '}
                        {salonName.split(' ').slice(1).join(' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-60 text-[9px] text-slate-500 font-bold">
                    <span>Cliente</span>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                  </div>
                </div>
              </div>

              {/* Dropzone / Upload Claro */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleLogoLightDrop}
                className={`p-2.5 rounded border border-dashed flex items-center justify-between gap-2 transition ${
                  isDark ? 'border-slate-700 bg-slate-900/40 hover:border-amber-500' : 'border-slate-300 bg-white hover:border-amber-500'
                }`}
              >
                <div className="min-w-0">
                  <p className={`text-[10px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {salonLogoLight ? 'Logo claro ativo' : 'Nenhum logo enviado'}
                  </p>
                  <p className="text-[9px] text-slate-400 truncate">
                    {salonLogoLight ? 'Toque para substituir' : 'Traços e escrita escura'}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => logoLightInputRef.current?.click()}
                    className="py-1 px-2.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-[9.5px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Upload className="w-3 h-3 text-white" />
                    <span>{salonLogoLight ? 'Substituir' : 'Enviar'}</span>
                  </button>

                  {salonLogoLight && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setSalonLogoLight('');
                      }}
                      className="p-1 rounded text-rose-400 hover:bg-rose-500/10 border border-slate-700 transition cursor-pointer"
                      title="Remover logo do tema claro"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <input 
                  ref={logoLightInputRef}
                  type="file" 
                  accept="image/png,image/jpeg,image/svg+xml,image/webp" 
                  className="hidden" 
                  onChange={handleLogoLightFileChange} 
                />
              </div>
            </div>

            {/* 2.2 Logo para Tema Escuro */}
            <div className={`p-3 rounded border flex flex-col justify-between gap-2.5 ${
              isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/90 border-slate-200'
            }`}>
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/40">
                <div className="flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-blue-400" />
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Logo Tema Escuro
                  </span>
                </div>
                <span className="text-[8.5px] px-1.5 py-0.5 rounded font-bold bg-blue-500/15 text-blue-500 dark:text-blue-400 border border-blue-500/30">
                  Fundo Escuro
                </span>
              </div>

              {/* Prévia Fundo Escuro */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Prévia no Topo Escuro</span>
                  <span className="flex items-center gap-0.5 font-bold" style={{ color: accentColor }}>
                    <Sparkles className="w-2 h-2" style={{ color: accentColor }} /> Ao Vivo
                  </span>
                </div>

                <div className="h-10 rounded border border-slate-800 bg-[#151A1E] px-3 flex items-center justify-between overflow-hidden shadow-2xs">
                  <div className="h-full flex items-center max-w-[160px] overflow-hidden">
                    {salonLogoDark ? (
                      <img 
                        src={salonLogoDark} 
                        alt="Logo Tema Escuro" 
                        className="max-h-6.5 w-auto object-contain object-left" 
                      />
                    ) : (
                      <span className="text-xs font-black uppercase tracking-tight truncate text-white">
                        <span style={{ color: accentColor }}>{salonName.split(' ')[0]}</span>{' '}
                        {salonName.split(' ').slice(1).join(' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-60 text-[9px] text-slate-400 font-bold">
                    <span>Cliente</span>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentColor }} />
                  </div>
                </div>
              </div>

              {/* Dropzone / Upload Escuro */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleLogoDarkDrop}
                className={`p-2.5 rounded border border-dashed flex items-center justify-between gap-2 transition ${
                  isDark ? 'border-slate-700 bg-slate-900/40 hover:border-blue-500' : 'border-slate-300 bg-white hover:border-blue-500'
                }`}
              >
                <div className="min-w-0">
                  <p className={`text-[10px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {salonLogoDark ? 'Logo escuro ativo' : 'Nenhum logo enviado'}
                  </p>
                  <p className="text-[9px] text-slate-400 truncate">
                    {salonLogoDark ? 'Toque para substituir' : 'Traços e escrita clara/branca'}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => logoDarkInputRef.current?.click()}
                    className="py-1 px-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-[9.5px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Upload className="w-3 h-3 text-white" />
                    <span>{salonLogoDark ? 'Substituir' : 'Enviar'}</span>
                  </button>

                  {salonLogoDark && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setSalonLogoDark('');
                      }}
                      className="p-1 rounded text-rose-400 hover:bg-rose-500/10 border border-slate-700 transition cursor-pointer"
                      title="Remover logo do tema escuro"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <input 
                  ref={logoDarkInputRef}
                  type="file" 
                  accept="image/png,image/jpeg,image/svg+xml,image/webp" 
                  className="hidden" 
                  onChange={handleLogoDarkFileChange} 
                />
              </div>
            </div>

          </div>
        </div>

        {/* 3. LOGO ÍCONE DO APP (MOBILE / PWA) */}
        <div className={`p-3.5 rounded border space-y-3 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" style={{ color: accentColor }} />
              <h3 className="text-xs font-bold uppercase tracking-wider font-['Poppins']">
                Ícone do App (Mobile)
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Quadrado (1:1)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            {/* Mockup do Celular */}
            <div className={`p-3 rounded border flex flex-col items-center justify-center gap-1.5 ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-white/20 shadow-md flex items-center justify-center overflow-hidden">
                {salonIcon ? (
                  <img 
                    src={salonIcon} 
                    alt="Ícone do App" 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center text-white font-bold text-base"
                    style={{ backgroundColor: accentColor }}
                  >
                    ✂️
                  </div>
                )}
              </div>
              <div className="text-center">
                <span className={`text-[11px] font-bold block truncate max-w-[140px] ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  {pwaName || salonName}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                  Tela Inicial
                </span>
              </div>
            </div>

            {/* Upload e Nome */}
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Nome do App no Celular
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setPwaName(salonName);
                    }}
                    className="text-[9px] hover:underline flex items-center gap-0.5 cursor-pointer font-bold"
                    style={{ color: accentColor }}
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Sincronizar
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={18}
                  value={pwaName}
                  onChange={(e) => setPwaName(e.target.value)}
                  placeholder="Ex: Meu Salão"
                  className={`w-full px-3 py-1.5 rounded border text-xs font-semibold outline-hidden transition ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                  }`}
                />
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleIconDrop}
                className="flex items-center gap-2 pt-1"
              >
                <button
                  type="button"
                  onClick={() => iconInputRef.current?.click()}
                  className="flex-1 py-1.5 px-3 rounded text-white text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  style={{ backgroundColor: accentColor }}
                >
                  <Upload className="w-3 h-3 text-white" />
                  <span>{salonIcon ? 'Substituir Ícone' : 'Enviar Ícone (1:1)'}</span>
                </button>

                {salonIcon && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setSalonIcon('');
                    }}
                    className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10 border border-slate-700 transition cursor-pointer"
                    title="Remover ícone do app"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <input 
                  ref={iconInputRef}
                  type="file" 
                  accept="image/png,image/jpeg,image/svg+xml,image/webp" 
                  className="hidden" 
                  onChange={handleIconFileChange} 
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* RODAPÉ FIXO DE AÇÃO */}
      <div className={`p-3 border-t shrink-0 sticky bottom-0 z-20 flex items-center justify-between gap-3 ${
        isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-lg'
      }`}>
        <button
          type="button"
          onClick={() => {
            hapticLight();
            onBack();
          }}
          className={`px-4 py-2.5 rounded border text-xs font-bold transition cursor-pointer ${
            isDark ? 'border-slate-800 text-slate-300 hover:bg-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
          }`}
        >
          Cancelar
        </button>

        <button
          type="button"
          onClick={() => handleSave()}
          className="flex-1 py-2.5 px-4 rounded text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs active:scale-98"
          style={{ backgroundColor: accentColor }}
        >
          <Save className="w-4 h-4 text-white" />
          <span>Salvar Identidade Visual</span>
        </button>
      </div>
    </div>
  );
};
