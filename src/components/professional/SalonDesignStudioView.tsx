import React, { useState, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Palette,
  Image as ImageIcon,
  Sliders,
  RotateCcw,
  Save,
  Check,
  Sun,
  Moon,
  Upload,
  Trash2,
  Smartphone,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Home,
  LayoutGrid,
  Calendar,
  Store,
  Square,
  Circle,
  Sparkles,
  Layers,
} from 'lucide-react';
import { useTheme, EXPLICIT_THEME_STORAGE_KEY } from '../../context/ThemeContext';
import { SalonAdminSettings } from '../../types';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { updateDynamicPwaAssets } from '../../utils/pwaAssets';
import { compressImageFile } from '../../utils/imageCompressor';
import { getSectionHeaderStyleData } from '../../utils/sectionHeaderStyle';
import { UnifiedButtonEditor } from './UnifiedButtonEditor';
import { DefaultThemeConfirmModal } from './DefaultThemeConfirmModal';
import { getThemeColorPresets } from '../../utils/colorPresets';
import {
  DEFAULT_NEUTRAL_HEX,
  DEFAULT_NEUTRAL_PRESET_ID,
  QUICK_THEME_PRESETS,
  getContrastTextHex,
  isLightColor,
  normalizeHex,
  resolveAppThemeTokens,
  resolveThemePresetId,
} from '../../utils/themePalette';

export type DesignStudioTab = 'tema' | 'marca' | 'estrutura';

export interface SalonDesignStudioViewProps {
  initialTab?: DesignStudioTab;
  adminSettings: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => Promise<any> | void;
  onBack: () => void;
}

const BRAND_FONT_PRESETS = [
  { id: 'Plus Jakarta Sans', label: 'Plus Jakarta', desc: 'Clean', family: "'Plus Jakarta Sans', sans-serif" },
  { id: 'Poppins', label: 'Poppins', desc: 'Geométrica', family: "'Poppins', sans-serif" },
  { id: 'Cormorant Garamond', label: 'Cormorant', desc: 'Editorial', family: "'Cormorant Garamond', Georgia, serif" },
  { id: 'Oswald', label: 'Oswald', desc: 'Forte', family: "'Oswald', sans-serif" },
];

export const SalonDesignStudioView: React.FC<SalonDesignStudioViewProps> = ({
  initialTab = 'tema',
  adminSettings,
  onUpdateSettings,
  onBack,
}) => {
  const {
    isDark,
    setTheme,
    setAccentColor: setAccentColorContext,
    resetToDefaultPalette,
    themeExplicitlyCustomized,
    resolvedPalette,
  } = useTheme();

  const [activeStudioTab, setActiveStudioTab] = useState<DesignStudioTab>(initialTab);
  const [isDefaultModalOpen, setIsDefaultModalOpen] = useState(false);

  // Estado local espelhado das configurações
  const [salonName] = useState(adminSettings.salonName || '');
  const [pwaName, setPwaName] = useState(adminSettings.pwaName || adminSettings.salonName || '');
  const [slogan, setSlogan] = useState(adminSettings.slogan || '');
  const [brandFont, setBrandFont] = useState<string>(adminSettings.brandFont || 'Plus Jakarta Sans');
  const [salonLogoLight, setSalonLogoLight] = useState(adminSettings.salonLogoLight || adminSettings.salonLogo || '');
  const [salonLogoDark, setSalonLogoDark] = useState(adminSettings.salonLogoDark || adminSettings.salonLogo || '');
  const [salonIcon, setSalonIcon] = useState(adminSettings.salonIcon || '');
  const [logoTextFallback, setLogoTextFallback] = useState(adminSettings.logoTextFallback || '');
  const [logoTextColor, setLogoTextColor] = useState(adminSettings.logoTextColor || DEFAULT_NEUTRAL_HEX);

  const [defaultTheme, setDefaultTheme] = useState<'light' | 'dark'>(
    adminSettings.defaultTheme === 'dark' || isDark ? 'dark' : 'light'
  );
  const [accentColor, setAccentColor] = useState<string>(
    normalizeHex(adminSettings.accentColor) || DEFAULT_NEUTRAL_HEX
  );
  const [hexDraft, setHexDraft] = useState<string>(
    normalizeHex(adminSettings.accentColor) || DEFAULT_NEUTRAL_HEX
  );
  const [isCustomized, setIsCustomized] = useState<boolean>(
    Boolean(adminSettings.themeExplicitlyCustomized ?? themeExplicitlyCustomized)
  );

  // Controles estruturais & barras
  const [showSlogan, setShowSlogan] = useState<boolean>(adminSettings.showSlogan !== false);
  const [showHeroSlides, setShowHeroSlides] = useState<boolean>(adminSettings.showHeroSlides !== false);
  const [welcomeStyle, setWelcomeStyle] = useState<'atmospheric' | 'glass'>(adminSettings.welcomeStyle || 'atmospheric');

  const [sectionHeaderBgStyle, setSectionHeaderBgStyle] = useState<'solid' | 'glass' | 'transparent'>(
    adminSettings.sectionHeaderBgStyle || 'solid'
  );
  const [sectionHeaderBorder, setSectionHeaderBorder] = useState<'bordered' | 'none'>(
    adminSettings.sectionHeaderBorder || 'bordered'
  );
  const [sectionHeaderBgColor, setSectionHeaderBgColor] = useState<string>(adminSettings.sectionHeaderBgColor || '');
  const [sectionHeaderTextColor, setSectionHeaderTextColor] = useState<string>(adminSettings.sectionHeaderTextColor || '');
  const [sectionHeaderIconColor, setSectionHeaderIconColor] = useState<string>(adminSettings.sectionHeaderIconColor || '');

  const [navStyle, setNavStyle] = useState<'minimal' | 'solid' | 'boxed'>(adminSettings.navStyle || 'minimal');
  const [navShape, setNavShape] = useState<'square' | 'circle'>(adminSettings.navShape || 'square');
  const [navBorder, setNavBorder] = useState<'bordered' | 'none'>(adminSettings.navBorder || 'bordered');
  const [navIconBorder, setNavIconBorder] = useState<'bordered' | 'none'>(adminSettings.navIconBorder || 'none');
  const [navBgStyle, setNavBgStyle] = useState<'solid' | 'glass' | 'transparent'>(adminSettings.navBgStyle || 'solid');
  const [navBgColor, setNavBgColor] = useState<string>(adminSettings.navBgColor || '');
  const [navBtnBgColor, setNavBtnBgColor] = useState<string>(adminSettings.navBtnBgColor || '');
  const [navBtnActiveBgColor, setNavBtnActiveBgColor] = useState<string>(adminSettings.navBtnActiveBgColor || '');
  const [navActiveColor, setNavActiveColor] = useState<string>(adminSettings.navActiveColor || '');
  const [navTextColor, setNavTextColor] = useState<string>(adminSettings.navTextColor || '');

  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const logoLightInputRef = useRef<HTMLInputElement>(null);
  const logoDarkInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const colorPresetsForSubBars = useMemo(() => getThemeColorPresets(accentColor), [accentColor]);

  const previewPalette = useMemo(
    () => resolveAppThemeTokens(accentColor, defaultTheme === 'dark', isCustomized),
    [accentColor, defaultTheme, isCustomized]
  );

  const sectionHeaderStyleData = useMemo(
    () =>
      getSectionHeaderStyleData(
        {
          ...adminSettings,
          accentColor,
          themeExplicitlyCustomized: isCustomized,
          sectionHeaderBgColor,
          sectionHeaderTextColor,
          sectionHeaderIconColor,
          sectionHeaderBgStyle,
          sectionHeaderBorder,
        },
        isDark
      ),
    [
      adminSettings,
      accentColor,
      isCustomized,
      sectionHeaderBgColor,
      sectionHeaderTextColor,
      sectionHeaderIconColor,
      sectionHeaderBgStyle,
      sectionHeaderBorder,
      isDark,
    ]
  );

  // Aplica Tema Rápido em Cascata Total (sobrescreve ajustes manuais de barras e seções para garantir uniformidade no app inteiro)
  const applyQuickThemeCascade = async (rawHex: string) => {
    const cleanHex = normalizeHex(rawHex) || DEFAULT_NEUTRAL_HEX;
    const presetId = resolveThemePresetId(cleanHex, true);
    hapticSuccess();

    setAccentColor(cleanHex);
    setHexDraft(cleanHex);
    setIsCustomized(true);

    // Limpa todos os overrides manuais anteriores para cascata 100% uniforme
    setSectionHeaderBgColor('');
    setSectionHeaderTextColor('');
    setSectionHeaderIconColor('');
    setSectionHeaderBgStyle('solid');
    setNavBgColor('');
    setNavBtnBgColor('');
    setNavBtnActiveBgColor('');
    setNavActiveColor('');
    setNavTextColor('');
    setLogoTextColor(cleanHex);
    setNavStyle('minimal');
    setNavBgStyle('solid');

    setAccentColorContext(cleanHex, { isExplicitUserChoice: true });

    await onUpdateSettings({
      accentColor: cleanHex,
      primaryColor: cleanHex,
      themePresetId: presetId,
      themeExplicitlyCustomized: true,
      logoTextColor: cleanHex,
      sectionHeaderBgColor: '',
      sectionHeaderTextColor: '',
      sectionHeaderIconColor: '',
      sectionHeaderBgStyle: 'solid',
      sectionHeaderBtnBgColor: '',
      sectionHeaderBtnActiveBgColor: '',
      navStyle: 'minimal',
      navBgStyle: 'solid',
      navBgColor: '',
      navBtnBgColor: '',
      navBtnActiveBgColor: '',
      navActiveColor: '',
      navTextColor: '',
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  // Restauração completa ao Default Neutro (cinza, branco & escuro suave) com opção de manter apenas o logotipo
  const handleConfirmDefaultReset = async (keepLogos: boolean) => {
    resetToDefaultPalette();
    setDefaultTheme('light');
    setAccentColor(DEFAULT_NEUTRAL_HEX);
    setHexDraft(DEFAULT_NEUTRAL_HEX);
    setIsCustomized(false);
    setTheme('light', { isExplicitUserChoice: false });

    setShowSlogan(true);
    setShowHeroSlides(true);
    setWelcomeStyle('atmospheric');
    setSectionHeaderBgStyle('solid');
    setSectionHeaderBorder('bordered');
    setSectionHeaderBgColor('');
    setSectionHeaderTextColor('');
    setSectionHeaderIconColor('');
    setNavStyle('minimal');
    setNavShape('square');
    setNavBorder('bordered');
    setNavIconBorder('none');
    setNavBgStyle('solid');
    setNavBgColor('');
    setNavBtnBgColor('');
    setNavBtnActiveBgColor('');
    setNavActiveColor('');
    setNavTextColor('');
    setLogoTextColor(DEFAULT_NEUTRAL_HEX);
    setBrandFont('Plus Jakarta Sans');

    const logoUpdates: Partial<SalonAdminSettings> = keepLogos
      ? {}
      : {
          salonLogo: '',
          salonLogoLight: '',
          salonLogoDark: '',
          salonIcon: '',
          logoTextFallback: '',
        };

    if (!keepLogos) {
      setSalonLogoLight('');
      setSalonLogoDark('');
      setSalonIcon('');
      setLogoTextFallback('');
      try {
        localStorage.removeItem('vagou_salon_logo');
        localStorage.removeItem('vagou_salon_logo_light');
        localStorage.removeItem('vagou_salon_logo_dark');
        localStorage.removeItem('vagou_salon_icon');
      } catch {}
    }

    await onUpdateSettings({
      defaultTheme: 'light',
      accentColor: DEFAULT_NEUTRAL_HEX,
      primaryColor: DEFAULT_NEUTRAL_HEX,
      themePresetId: DEFAULT_NEUTRAL_PRESET_ID,
      themeExplicitlyCustomized: false,
      showSlogan: true,
      showHeroSlides: true,
      welcomeStyle: 'atmospheric',
      brandFont: 'Plus Jakarta Sans',
      logoTextColor: DEFAULT_NEUTRAL_HEX,
      sectionHeaderBgColor: '',
      sectionHeaderTextColor: '',
      sectionHeaderIconColor: '',
      sectionHeaderBgStyle: 'solid',
      sectionHeaderBorder: 'bordered',
      sectionHeaderBtnBgColor: '',
      sectionHeaderBtnActiveBgColor: '',
      sectionHeaderBtnBorder: 'bordered',
      sectionHeaderBtnShadow: 'none',
      sectionHeaderBtnBlur: 'none',
      navStyle: 'minimal',
      navShape: 'square',
      navBorder: 'bordered',
      navIconBorder: 'none',
      navBgStyle: 'solid',
      navBgColor: '',
      navBtnBgColor: '',
      navBtnActiveBgColor: '',
      navActiveColor: '',
      navTextColor: '',
      navBtnShadow: 'none',
      navBtnBlur: 'none',
      ...logoUpdates,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2200);
  };

  const handleToggleBaseMode = async (mode: 'light' | 'dark') => {
    hapticLight();
    setDefaultTheme(mode);
    setTheme(mode, { isExplicitUserChoice: true });
    try {
      localStorage.setItem(EXPLICIT_THEME_STORAGE_KEY, mode);
    } catch {}
    await onUpdateSettings({
      defaultTheme: mode,
      themeExplicitlyCustomized: isCustomized || mode === 'dark',
    });
  };

  const handleImageUpload = async (
    file: File | undefined,
    target: 'light' | 'dark' | 'icon'
  ) => {
    if (!file || (!file.type.startsWith('image/') && !file.name.endsWith('.svg'))) return;
    try {
      if (target === 'icon') {
        const compressed = await compressImageFile(file, {
          maxWidth: 256,
          maxHeight: 256,
          quality: 0.9,
          mimeType: 'image/png',
        });
        setSalonIcon(compressed);
      } else {
        const compressed = await compressImageFile(file, {
          maxWidth: 640,
          maxHeight: 180,
          quality: 0.88,
        });
        if (target === 'light') setSalonLogoLight(compressed);
        else setSalonLogoDark(compressed);
      }
      hapticSuccess();
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
    }
  };

  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    hapticSuccess();
    setIsSaving(true);

    const finalLogo = isDark ? (salonLogoDark || salonLogoLight) : (salonLogoLight || salonLogoDark);
    const resolvedAccent = normalizeHex(accentColor) || DEFAULT_NEUTRAL_HEX;

    try {
      if (salonLogoLight) localStorage.setItem('vagou_salon_logo_light', salonLogoLight);
      else localStorage.removeItem('vagou_salon_logo_light');
      if (salonLogoDark) localStorage.setItem('vagou_salon_logo_dark', salonLogoDark);
      else localStorage.removeItem('vagou_salon_logo_dark');
      if (salonIcon) localStorage.setItem('vagou_salon_icon', salonIcon);
      else localStorage.removeItem('vagou_salon_icon');
    } catch {}

    if (isCustomized) {
      setAccentColorContext(resolvedAccent, { isExplicitUserChoice: true });
    }
    updateDynamicPwaAssets(pwaName.trim() || salonName, salonIcon || finalLogo, resolvedAccent, slogan, defaultTheme === 'dark');

    await onUpdateSettings({
      salonLogo: finalLogo,
      salonLogoLight,
      salonLogoDark,
      salonIcon,
      pwaName: pwaName.trim() || salonName,
      slogan: slogan.trim(),
      brandFont,
      logoTextFallback: logoTextFallback.trim(),
      logoTextColor,
      defaultTheme,
      accentColor: resolvedAccent,
      primaryColor: resolvedAccent,
      themePresetId: resolveThemePresetId(resolvedAccent, isCustomized),
      themeExplicitlyCustomized: isCustomized || defaultTheme === 'dark',
      showSlogan,
      showHeroSlides,
      welcomeStyle,
      sectionHeaderBgStyle,
      sectionHeaderBorder,
      sectionHeaderBgColor,
      sectionHeaderTextColor,
      sectionHeaderIconColor,
      navStyle,
      navShape,
      navBorder,
      navIconBorder,
      navBgStyle,
      navBgColor,
      navBtnBgColor,
      navBtnActiveBgColor,
      navActiveColor,
      navTextColor,
    });

    setIsSaving(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2400);
  };

  const syncPartial = (updates: Partial<SalonAdminSettings>) => {
    try {
      onUpdateSettings(updates);
    } catch {}
  };

  const renderInlineColorRow = (
    label: string,
    value: string,
    onChange: (val: string) => void,
    withClearOption = true
  ) => {
    const cleanVal = normalizeHex(value) || '';
    return (
      <div className={`space-y-2 py-2.5 border-b ${isDark ? 'border-slate-800/70' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold">{label}</span>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
              {cleanVal || 'Padrão Tema'}
            </span>
            <input
              type="color"
              value={cleanVal || accentColor}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              className={`w-7 h-7 rounded-[4px] border cursor-pointer bg-transparent ${
                isDark ? 'border-slate-700' : 'border-slate-300'
              }`}
              title={`Selecionar ${label}`}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {colorPresetsForSubBars
            .filter((c) => withClearOption || c.hex !== 'transparent')
            .map((color) => {
              const isSel =
                (value || 'transparent').toLowerCase() === color.hex.toLowerCase() ||
                (!value && color.hex === 'transparent');
              return (
                <button
                  key={`${label}-${color.hex}`}
                  type="button"
                  onClick={() => {
                    hapticLight();
                    onChange(color.hex === 'transparent' ? '' : color.hex);
                  }}
                  className={`w-7 h-7 rounded-[4px] border transition cursor-pointer flex items-center justify-center ${
                    isSel
                      ? 'brand-border-active ring-2 ring-offset-1 ring-slate-400 scale-105'
                      : isDark
                        ? 'border-slate-700 hover:scale-105'
                        : 'border-slate-300 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex === 'transparent' ? 'transparent' : color.hex }}
                  title={color.name}
                >
                  {color.hex === 'transparent' ? (
                    <span className="text-[8px] font-black text-slate-500 uppercase">Auto</span>
                  ) : (
                    isSel && <Check className={`w-3.5 h-3.5 ${isLightColor(color.hex) ? 'text-slate-900' : 'text-white'}`} />
                  )}
                </button>
              );
            })}
        </div>
      </div>
    );
  };

  return (
    <div
      className="w-full h-full flex flex-col justify-between overflow-hidden"
      style={{
        backgroundColor: resolvedPalette.canvasBg,
        color: isDark ? '#F8FAFC' : '#0F172A',
      }}
    >
      {/* Topo Fixo do Estúdio com Botão Default Sempre Visível */}
      <div className="shrink-0 sticky top-0 z-30">
        <div className={sectionHeaderStyleData.containerClass} style={sectionHeaderStyleData.containerStyle}>
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onBack();
              }}
              className={`p-1.5 rounded-[4px] transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-200/60'
              }`}
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" style={sectionHeaderStyleData.iconStyle} />
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              <Palette className="w-4 h-4 shrink-0" style={sectionHeaderStyleData.iconStyle} />
              <h2 className="text-xs sm:text-sm font-bold font-display truncate" style={sectionHeaderStyleData.titleStyle}>
                Visual & Layout
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {savedSuccess && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[4px] brand-btn">
                <Check className="w-3 h-3" />
                <span>Salvo</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setIsDefaultModalOpen(true);
              }}
              className={`px-2.5 py-1.5 rounded-[4px] border text-[11px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                isDark
                  ? 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
                  : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              }`}
              title="Restaurar padrão neutro cinza, branco e escuro suave"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Default</span>
            </button>
          </div>
        </div>

        {/* Barra de Abas Unificada (3 Abas) */}
        <div
          className={`grid grid-cols-3 border-b ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {[
            { id: 'tema' as DesignStudioTab, label: 'Tema & Cores', icon: Palette },
            { id: 'marca' as DesignStudioTab, label: 'Marca & Logos', icon: ImageIcon },
            { id: 'estrutura' as DesignStudioTab, label: 'Estrutura', icon: Sliders },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isTabActive = activeStudioTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setActiveStudioTab(tab.id);
                }}
                className={`py-2.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1.5 border-b-2 transition cursor-pointer whitespace-nowrap ${
                  isTabActive
                    ? 'brand-border-active brand-text'
                    : isDark
                      ? 'border-transparent text-slate-400 hover:text-slate-200'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Área Rolável do Estúdio */}
      <form onSubmit={handleSaveAll} className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3.5 space-y-4 pb-24">
        {/* ================= ABA 1: TEMA & CORES ================= */}
        {activeStudioTab === 'tema' && (
          <div className="space-y-4">
            {/* Prévia Ao Vivo do App Inteiro */}
            <div
              className="rounded-[4px] border overflow-hidden shadow-xs"
              style={{
                backgroundColor: previewPalette.canvasBg,
                borderColor: previewPalette.cardBorder,
              }}
            >
              {/* Topo Simulado */}
              <div
                className="px-3 py-2 flex items-center justify-between border-b"
                style={{
                  backgroundColor: previewPalette.headerBg,
                  borderColor: previewPalette.headerBorder,
                  color: previewPalette.headerText,
                }}
              >
                <span
                  className="px-2 py-0.5 rounded-[4px] border text-[9px] font-extrabold uppercase tracking-wider"
                  style={{
                    backgroundColor: previewPalette.headerBoxBg,
                    borderColor: previewPalette.headerBoxBorder,
                    color: previewPalette.headerText,
                  }}
                >
                  Logo
                </span>
                <span className="text-[10px] font-extrabold" style={{ color: previewPalette.headerText }}>
                  {isCustomized ? 'Tema em Cascata' : 'Default Neutro'}
                </span>
              </div>

              {/* Conteúdo + Ação Simulada */}
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold block" style={{ color: previewPalette.sectionText }}>
                    {salonName || 'Seu Estabelecimento'}
                  </span>
                  <span className="text-[9px] font-semibold" style={{ color: previewPalette.softFg }}>
                    Cabeçalho, barra e botões
                  </span>
                </div>
                <span
                  className="px-2.5 py-1 rounded-[4px] text-[10px] font-bold shrink-0"
                  style={{
                    backgroundColor: previewPalette.primary,
                    color: previewPalette.primaryFg,
                  }}
                >
                  Agendar
                </span>
              </div>

              {/* Barra Inferior Simulada */}
              <div
                className="px-2.5 py-1.5 border-t grid grid-cols-4 gap-1.5"
                style={{
                  backgroundColor: normalizeHex(navBgColor) || previewPalette.navBg,
                  borderColor: previewPalette.navBorder,
                }}
              >
                {[
                  { label: 'Início', Icon: Home, active: true },
                  { label: 'Serviços', Icon: LayoutGrid, active: false },
                  { label: 'Agenda', Icon: Calendar, active: false },
                  { label: 'Espaço', Icon: Store, active: false },
                ].map((item) => {
                  const IconItem = item.Icon;
                  const actBg = normalizeHex(navBtnActiveBgColor) || normalizeHex(navActiveColor) || previewPalette.navActiveBtnBg;
                  const actFg =
                    normalizeHex(navBtnActiveBgColor) || normalizeHex(navActiveColor)
                      ? getContrastTextHex(actBg)
                      : previewPalette.navActiveBtnFg;
                  return (
                    <div
                      key={item.label}
                      className={`py-1 px-1 flex flex-col items-center justify-center gap-0.5 ${
                        navShape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
                      } border`}
                      style={{
                        backgroundColor: item.active ? actBg : normalizeHex(navBtnBgColor) || previewPalette.navInactiveBtnBg,
                        borderColor: item.active ? previewPalette.primary : previewPalette.navBorder,
                        color: item.active ? actFg : normalizeHex(navTextColor) || previewPalette.navInactiveFg,
                      }}
                    >
                      <IconItem className="w-3 h-3" />
                      <span className="text-[8px] font-bold leading-none">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modo Base (Claro / Escuro) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">
                  Tom Base
                </h3>
                <span className="text-[10px] font-bold opacity-70">
                  {defaultTheme === 'dark' ? 'Escuro' : 'Claro (Padrão)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleBaseMode('light')}
                  className={`p-2.5 rounded-[4px] border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                    defaultTheme === 'light'
                      ? 'brand-btn shadow-xs'
                      : isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300'
                        : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold">Claro</span>
                  </div>
                  {defaultTheme === 'light' && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleBaseMode('dark')}
                  className={`p-2.5 rounded-[4px] border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                    defaultTheme === 'dark'
                      ? 'brand-btn shadow-xs'
                      : isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300'
                        : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold">Escuro</span>
                  </div>
                  {defaultTheme === 'dark' && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              </div>
            </div>

            {/* Temas Rápidos (1 Toque -> Altera App Inteiro) */}
            <div className={`space-y-2.5 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">
                  Temas Rápidos
                </h3>
                <span className="text-[10px] font-mono font-bold brand-text">
                  {isCustomized ? accentColor : 'DEFAULT'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {QUICK_THEME_PRESETS.map((preset) => {
                  const isActivePreset = preset.isDefault
                    ? !isCustomized
                    : isCustomized && accentColor.toLowerCase() === preset.hex.toLowerCase();

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        if (preset.isDefault) {
                          hapticLight();
                          setIsDefaultModalOpen(true);
                        } else {
                          applyQuickThemeCascade(preset.hex);
                        }
                      }}
                      style={
                        isActivePreset && !preset.isDefault
                          ? { backgroundColor: preset.hex, borderColor: preset.hex, color: getContrastTextHex(preset.hex) }
                          : isActivePreset && preset.isDefault
                            ? { backgroundColor: '#334155', borderColor: '#334155', color: '#FFFFFF' }
                            : undefined
                      }
                      className={`px-2.5 py-2 rounded-[4px] border text-xs font-bold flex items-center justify-between gap-1.5 transition cursor-pointer ${
                        isActivePreset
                          ? 'shadow-xs'
                          : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-600'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span className="truncate">{preset.label}</span>
                      </span>
                      {isActivePreset && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cor Personalizada (#HEX) sem placeholder colidindo e com rótulo à esquerda do picker */}
            <div className={`space-y-2 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">
                  Cor Personalizada
                </label>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {accentColor}
                  </span>
                  <input
                    type="color"
                    value={normalizeHex(accentColor) || DEFAULT_NEUTRAL_HEX}
                    onChange={(e) => {
                      const picked = e.target.value.toUpperCase();
                      applyQuickThemeCascade(picked);
                    }}
                    className={`w-7 h-7 rounded-[4px] border cursor-pointer bg-transparent ${
                      isDark ? 'border-slate-700' : 'border-slate-300'
                    }`}
                    title="Selecionar cor personalizada"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={hexDraft}
                  maxLength={7}
                  onChange={(e) => {
                    let val = e.target.value.trim().toUpperCase();
                    if (val && !val.startsWith('#')) val = '#' + val;
                    setHexDraft(val);
                  }}
                  placeholder="#2563EB"
                  className={`flex-1 h-9 px-3 rounded-[4px] border text-xs font-mono font-bold uppercase tracking-wider focus:outline-none ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const valid = normalizeHex(hexDraft);
                    if (valid) applyQuickThemeCascade(valid);
                  }}
                  disabled={!normalizeHex(hexDraft)}
                  className="h-9 px-3.5 rounded-[4px] brand-btn text-xs font-bold transition cursor-pointer disabled:opacity-40 whitespace-nowrap"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 2: MARCA & LOGOS ================= */}
        {activeStudioTab === 'marca' && (
          <div className="space-y-4">
            {/* Logo Tema Claro & Tema Escuro */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Logo Tema Claro */}
              <div className="space-y-2 pb-3 border-b sm:border-b-0 sm:pr-2 border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    Logo Tema Claro
                  </span>
                  {salonLogoLight && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setSalonLogoLight('');
                      }}
                      className="p-1 rounded-[4px] text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                      title="Remover logo claro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="h-12 rounded-[4px] border border-slate-200 bg-white px-3 flex items-center justify-between">
                  {salonLogoLight ? (
                    <img src={salonLogoLight} alt="Logo Claro" className="max-h-8 max-w-[140px] object-contain" />
                  ) : (
                    <span className="text-xs font-black uppercase text-slate-800 truncate">
                      {logoTextFallback || salonName || 'Logo Claro'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => logoLightInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-[4px] brand-btn text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{salonLogoLight ? 'Trocar' : 'Enviar'}</span>
                  </button>
                  <input
                    ref={logoLightInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0], 'light')}
                  />
                </div>
              </div>

              {/* Logo Tema Escuro */}
              <div className="space-y-2 pb-3 border-b sm:border-b-0 border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-blue-400" />
                    Logo Tema Escuro
                  </span>
                  {salonLogoDark && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setSalonLogoDark('');
                      }}
                      className="p-1 rounded-[4px] text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                      title="Remover logo escuro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="h-12 rounded-[4px] border border-slate-800 bg-[#0F172A] px-3 flex items-center justify-between">
                  {salonLogoDark ? (
                    <img src={salonLogoDark} alt="Logo Escuro" className="max-h-8 max-w-[140px] object-contain" />
                  ) : (
                    <span className="text-xs font-black uppercase text-white truncate">
                      {logoTextFallback || salonName || 'Logo Escuro'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => logoDarkInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-[4px] brand-btn text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{salonLogoDark ? 'Trocar' : 'Enviar'}</span>
                  </button>
                  <input
                    ref={logoDarkInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e.target.files?.[0], 'dark')}
                  />
                </div>
              </div>
            </div>

            {/* Ícone Mobile (PWA) & Nome na Tela Inicial */}
            <div className={`space-y-2.5 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 brand-icon" />
                  Ícone do App (1:1)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setPwaName(salonName);
                  }}
                  className="text-[10px] font-bold brand-text flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sincronizar Nome</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-[4px] border shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm"
                  style={{
                    backgroundColor: salonIcon ? 'transparent' : previewPalette.primary,
                    borderColor: previewPalette.cardBorder,
                    color: previewPalette.primaryFg,
                  }}
                >
                  {salonIcon ? (
                    <img src={salonIcon} alt="Ícone" className="w-full h-full object-cover" />
                  ) : (
                    (pwaName || salonName || 'VG').slice(0, 2).toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    type="text"
                    maxLength={18}
                    value={pwaName}
                    onChange={(e) => setPwaName(e.target.value)}
                    placeholder="Nome no celular"
                    className={`w-full h-8 px-2.5 rounded-[4px] border text-xs font-semibold ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                    }`}
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => iconInputRef.current?.click()}
                      className="flex-1 h-7 px-2.5 rounded-[4px] brand-btn text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{salonIcon ? 'Trocar' : 'Enviar Ícone'}</span>
                    </button>
                    {(salonLogoDark || salonLogoLight) && (
                      <button
                        type="button"
                        onClick={() => {
                          hapticSuccess();
                          setSalonIcon(salonLogoLight || salonLogoDark);
                        }}
                        className={`h-7 px-2 rounded-[4px] border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                          isDark ? 'border-slate-700 text-slate-200' : 'border-slate-300 text-slate-700'
                        }`}
                        title="Copiar logo"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Logo</span>
                      </button>
                    )}
                    {salonIcon && (
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setSalonIcon('');
                        }}
                        className="h-7 px-2 rounded-[4px] border border-rose-500/30 text-rose-500 cursor-pointer"
                        title="Remover ícone"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <input
                      ref={iconInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e.target.files?.[0], 'icon')}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Texto Provisório & Slogan */}
            <div className={`space-y-3 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="space-y-1">
                <label className="text-xs font-bold block">Texto Provisório (Sem Logo)</label>
                <input
                  type="text"
                  maxLength={40}
                  value={logoTextFallback}
                  onChange={(e) => {
                    setLogoTextFallback(e.target.value);
                    syncPartial({ logoTextFallback: e.target.value.trim() });
                  }}
                  placeholder={salonName || 'Nome do estabelecimento'}
                  className={`w-full h-9 px-3 rounded-[4px] border text-xs font-medium ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {renderInlineColorRow('Cor do Texto Provisório', logoTextColor, (val) => {
                const nextVal = val || DEFAULT_NEUTRAL_HEX;
                setLogoTextColor(nextVal);
                syncPartial({ logoTextColor: nextVal });
              }, false)}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold">Slogan Curto</label>
                  <span className="text-[10px] font-mono opacity-60">{slogan.length}/60</span>
                </div>
                <input
                  type="text"
                  maxLength={60}
                  value={slogan}
                  onChange={(e) => {
                    setSlogan(e.target.value);
                    syncPartial({ slogan: e.target.value });
                  }}
                  placeholder="Frase curta da marca"
                  className={`w-full h-9 px-3 rounded-[4px] border text-xs font-medium ${
                    isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Fonte da Marca */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold block">Fonte da Marca</label>
                <div className="grid grid-cols-2 gap-2">
                  {BRAND_FONT_PRESETS.map((f) => {
                    const isSel = brandFont === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setBrandFont(f.id);
                          syncPartial({ brandFont: f.id });
                        }}
                        className={`p-2 rounded-[4px] border text-left transition cursor-pointer flex items-center justify-between gap-2 ${
                          isSel
                            ? 'brand-btn shadow-xs'
                            : isDark
                              ? 'bg-slate-900 border-slate-800 text-slate-200'
                              : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-bold block truncate" style={{ fontFamily: f.family }}>
                            {f.label}
                          </span>
                          <span className={`text-[9px] ${isSel ? 'opacity-85' : 'opacity-60'}`}>{f.desc}</span>
                        </div>
                        {isSel && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= ABA 3: ESTRUTURA & BARRAS ================= */}
        {activeStudioTab === 'estrutura' && (
          <div className="space-y-4">
            {/* Vitrine: Slogan, Slides & Faixa de Boas-Vindas */}
            <div className="space-y-2.5">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">
                Vitrine & Início
              </h3>

              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold">Exibir Slogan no Cabeçalho</span>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    const next = !showSlogan;
                    setShowSlogan(next);
                    syncPartial({ showSlogan: next });
                  }}
                  className={`h-7 px-2.5 rounded-[4px] text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                    showSlogan ? 'brand-btn' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {showSlogan ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{showSlogan ? 'Ativo' : 'Oculto'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 brand-icon" />
                  Slides na Tela Inicial
                </span>
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    const next = !showHeroSlides;
                    setShowHeroSlides(next);
                    syncPartial({ showHeroSlides: next });
                  }}
                  className={`h-7 px-2.5 rounded-[4px] text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                    showHeroSlides ? 'brand-btn' : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {showHeroSlides ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{showHeroSlides ? 'Ativo' : 'Oculto'}</span>
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 brand-icon" />
                  Faixa de Boas-Vindas
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'atmospheric' as const, label: 'Tema Suave' },
                    { id: 'glass' as const, label: 'Cristal / Vidro' },
                  ].map((opt) => {
                    const isSel = welcomeStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setWelcomeStyle(opt.id);
                          syncPartial({ welcomeStyle: opt.id });
                        }}
                        className={`p-2 rounded-[4px] border text-xs font-bold flex items-center justify-between cursor-pointer ${
                          isSel
                            ? 'brand-btn'
                            : isDark
                              ? 'bg-slate-900 border-slate-800 text-slate-300'
                              : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSel && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Barra de Títulos das Seções */}
            <div className={`space-y-2.5 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">
                Barra de Títulos das Seções
              </h3>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'solid' as const, label: 'Sólido' },
                  { id: 'glass' as const, label: 'Vidro' },
                  { id: 'transparent' as const, label: 'Alpha' },
                ].map((opt) => {
                  const isSel = sectionHeaderBgStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setSectionHeaderBgStyle(opt.id);
                        syncPartial({ sectionHeaderBgStyle: opt.id });
                      }}
                      className={`p-2 rounded-[4px] border text-xs font-bold text-center cursor-pointer ${
                        isSel
                          ? 'brand-btn'
                          : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'bordered' as const, label: 'Com Borda' },
                  { id: 'none' as const, label: 'Sem Borda' },
                ].map((opt) => {
                  const isSel = sectionHeaderBorder === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setSectionHeaderBorder(opt.id);
                        syncPartial({ sectionHeaderBorder: opt.id });
                      }}
                      className={`p-2 rounded-[4px] border text-xs font-bold text-center cursor-pointer ${
                        isSel
                          ? 'brand-btn'
                          : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {sectionHeaderBgStyle !== 'transparent' &&
                renderInlineColorRow('Fundo da Barra de Títulos', sectionHeaderBgColor, (val) => {
                  setSectionHeaderBgColor(val);
                  syncPartial({ sectionHeaderBgColor: val });
                })}
              {renderInlineColorRow('Texto dos Títulos', sectionHeaderTextColor, (val) => {
                setSectionHeaderTextColor(val);
                syncPartial({ sectionHeaderTextColor: val });
              })}
              {renderInlineColorRow('Ícones dos Títulos', sectionHeaderIconColor, (val) => {
                setSectionHeaderIconColor(val);
                syncPartial({ sectionHeaderIconColor: val });
              })}
            </div>

            {/* Barra de Navegação Inferior (BottomNav) */}
            <div className={`space-y-2.5 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider opacity-80">
                Barra Inferior (Rodapé)
              </h3>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'minimal' as const, label: 'Minimal' },
                  { id: 'solid' as const, label: 'Sólido' },
                  { id: 'boxed' as const, label: 'Emoldurado' },
                ].map((opt) => {
                  const isSel = navStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setNavStyle(opt.id);
                        syncPartial({ navStyle: opt.id });
                      }}
                      className={`p-2 rounded-[4px] border text-xs font-bold text-center cursor-pointer ${
                        isSel
                          ? 'brand-btn'
                          : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'solid' as const, label: 'Fundo Sólido' },
                  { id: 'glass' as const, label: 'Vidro' },
                  { id: 'transparent' as const, label: 'Alpha' },
                ].map((opt) => {
                  const isSel = navBgStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setNavBgStyle(opt.id);
                        syncPartial({ navBgStyle: opt.id });
                      }}
                      className={`p-2 rounded-[4px] border text-xs font-bold text-center cursor-pointer ${
                        isSel
                          ? 'brand-btn'
                          : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'square' as const, label: 'Quadrado (4px)', Icon: Square },
                  { id: 'circle' as const, label: 'Circular', Icon: Circle },
                ].map((opt) => {
                  const IconShape = opt.Icon;
                  const isSel = navShape === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setNavShape(opt.id);
                        syncPartial({ navShape: opt.id });
                      }}
                      className={`p-2 rounded-[4px] border text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                        isSel
                          ? 'brand-btn'
                          : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <IconShape className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'bordered' as const, label: 'Borda Ícone: Sim' },
                  { id: 'none' as const, label: 'Borda Ícone: Não' },
                ].map((opt) => {
                  const isSel = navIconBorder === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setNavIconBorder(opt.id);
                        syncPartial({ navIconBorder: opt.id });
                      }}
                      className={`p-2 rounded-[4px] border text-xs font-bold text-center cursor-pointer ${
                        isSel
                          ? 'brand-btn'
                          : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-300'
                            : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {navBgStyle !== 'transparent' &&
                renderInlineColorRow('Fundo da Barra Inferior', navBgColor, (val) => {
                  setNavBgColor(val);
                  syncPartial({ navBgColor: val });
                })}
              {renderInlineColorRow('Fundo Botão Ativo', navBtnActiveBgColor || navActiveColor, (val) => {
                setNavBtnActiveBgColor(val);
                setNavActiveColor(val);
                syncPartial({ navBtnActiveBgColor: val, navActiveColor: val });
              })}
              {renderInlineColorRow('Texto/Ícone Inativo', navTextColor, (val) => {
                setNavTextColor(val);
                syncPartial({ navTextColor: val });
              })}

              <UnifiedButtonEditor
                title="Botões & Efeitos do Rodapé"
                adminSettings={{
                  ...adminSettings,
                  accentColor,
                  navBorder,
                  navBtnBgColor,
                }}
                onUpdateSettings={(upd) => {
                  if (upd.navBorder) setNavBorder(upd.navBorder);
                  if (upd.navBtnBgColor !== undefined) setNavBtnBgColor(upd.navBtnBgColor);
                  syncPartial(upd);
                }}
                isDark={isDark}
                prefixKey="nav"
              />
            </div>
          </div>
        )}
      </form>

      {/* Rodapé Fixo de Ação */}
      <div
        className={`p-3 border-t shrink-0 sticky bottom-0 z-20 flex items-center gap-2 ${
          isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-lg'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            hapticLight();
            setIsDefaultModalOpen(true);
          }}
          className={`px-3 py-2.5 rounded-[4px] border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
            isDark
              ? 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
              : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Default</span>
        </button>

        <button
          type="button"
          onClick={() => handleSaveAll()}
          disabled={isSaving}
          className="flex-1 py-2.5 px-4 rounded-[4px] brand-btn font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-60"
        >
          {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
        </button>
      </div>

      {/* Modal In-App de Confirmação Default */}
      <DefaultThemeConfirmModal
        isOpen={isDefaultModalOpen}
        isDark={isDark}
        onClose={() => setIsDefaultModalOpen(false)}
        onConfirm={handleConfirmDefaultReset}
      />
    </div>
  );
};
