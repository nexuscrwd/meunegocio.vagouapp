import React from 'react';
import { Home, Calendar, LayoutDashboard, LayoutGrid, Users, Store, Wrench, Wallet, CirclePause } from 'lucide-react';
import { useTheme, sanitizeAccentColor } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import { UserPersona } from '../types';

export interface SalonNavContext {
  activeTab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades' | 'dados' | 'visual' | 'pausar';
  onSelectTab: (tab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades' | 'dados' | 'visual' | 'pausar') => void;
  ServicesIcon?: React.ComponentType<{ className?: string }>;
  SpaceIcon?: React.ComponentType<{ className?: string }>;
  spaceTabLabel?: string;
  vagasTabLabel?: string;
  isProfessionalMode?: boolean;
  currentPersona?: UserPersona;
  isProAdmin?: boolean;
  isOwnerOrManager?: boolean;
  isProfessionalStaff?: boolean;
  hasPausedSlots?: boolean;
  navStyle?: 'minimal' | 'solid' | 'boxed';
  navShape?: 'square' | 'circle';
  navBorder?: 'bordered' | 'none';
  navIconBorder?: 'bordered' | 'none';
  navBgStyle?: 'solid' | 'glass' | 'transparent';
  navBgColor?: string;
  navBtnBgColor?: string;
  navBtnActiveBgColor?: string;
  navActiveColor?: string;
  navTextColor?: string;
  navBtnShadow?: 'none' | 'subtle' | 'medium' | 'glow';
  navBtnBlur?: 'none' | 'sm' | 'md' | 'lg';
  navBtnFont?: string;
}

interface BottomNavProps {
  salonContext?: SalonNavContext | null;
  activeTab?: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades' | 'dados' | 'visual' | 'pausar';
  onSelectTab?: (tab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades' | 'dados' | 'visual' | 'pausar') => void;
  ServicesIcon?: React.ComponentType<{ className?: string }>;
  SpaceIcon?: React.ComponentType<{ className?: string }>;
  spaceTabLabel?: string;
  vagasTabLabel?: string;
  isProfessionalMode?: boolean;
  currentPersona?: UserPersona;
  isProAdmin?: boolean;
  isOwnerOrManager?: boolean;
  isProfessionalStaff?: boolean;
  hasPausedSlots?: boolean;
  navStyle?: 'minimal' | 'solid' | 'boxed';
  navShape?: 'square' | 'circle';
  navBorder?: 'bordered' | 'none';
  navIconBorder?: 'bordered' | 'none';
  navBgStyle?: 'solid' | 'glass' | 'transparent';
  navBgColor?: string;
  navBtnBgColor?: string;
  navBtnActiveBgColor?: string;
  navActiveColor?: string;
  navTextColor?: string;
  navBtnShadow?: 'none' | 'subtle' | 'medium' | 'glow';
  navBtnBlur?: 'none' | 'sm' | 'md' | 'lg';
  navBtnFont?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  salonContext,
  activeTab: propActiveTab,
  onSelectTab: propOnSelectTab,
  ServicesIcon: propServicesIcon,
  SpaceIcon: propSpaceIcon,
  spaceTabLabel: propSpaceTabLabel,
  vagasTabLabel: propVagasTabLabel,
  isProfessionalMode: propIsProfessionalMode,
  currentPersona: propPersona,
  isOwnerOrManager: propIsOwnerOrManager,
  isProfessionalStaff: propIsProfessionalStaff,
  hasPausedSlots: propHasPausedSlots,
  navStyle: propNavStyle,
  navShape: propNavShape,
  navBorder: propNavBorder,
  navIconBorder: propNavIconBorder,
  navBgStyle: propNavBgStyle,
  navBgColor: propNavBgColor,
  navBtnBgColor: propNavBtnBgColor,
  navBtnActiveBgColor: propNavBtnActiveBgColor,
  navActiveColor: propNavActiveColor,
  navTextColor: propNavTextColor,
  navBtnShadow: propNavBtnShadow,
  navBtnBlur: propNavBtnBlur,
  navBtnFont: propNavBtnFont,
}) => {
  const { isDark, accentColor } = useTheme();

  const activeTab = propActiveTab || salonContext?.activeTab || 'home';
  const onSelectTab = propOnSelectTab || salonContext?.onSelectTab;
  const currentPersona = propPersona || salonContext?.currentPersona || (propIsProfessionalMode ? 'pro' : 'cliente');
  const isOwnerOrManager = propIsOwnerOrManager ?? salonContext?.isOwnerOrManager ?? (currentPersona !== 'cliente');
  const isProfessionalStaff = propIsProfessionalStaff ?? salonContext?.isProfessionalStaff ?? false;
  const hasPausedSlots = propHasPausedSlots ?? salonContext?.hasPausedSlots ?? false;
  const vagasTabLabel = propVagasTabLabel || salonContext?.vagasTabLabel || 'Agenda';
  const spaceTabLabel = propSpaceTabLabel || salonContext?.spaceTabLabel || 'Espaço';
  const ServicesIconComponent = propServicesIcon || salonContext?.ServicesIcon || LayoutGrid;
  const SpaceIconComponent = propSpaceIcon || salonContext?.SpaceIcon || Store;
  const navStyle = propNavStyle || salonContext?.navStyle || 'minimal';
  const navShape = propNavShape || salonContext?.navShape || 'square';
  const navBorder = propNavBorder || salonContext?.navBorder || 'bordered';
  const navIconBorder = propNavIconBorder || salonContext?.navIconBorder || 'none';
  const navBgStyle = propNavBgStyle || salonContext?.navBgStyle || 'solid';
  const rawNavBgColor = propNavBgColor || salonContext?.navBgColor || '';
  // Default: cor sólida igual à cor principal do cabeçalho (#005CA9), salvo se o usuário alterou nas ferramentas de estilo
  const navBgColor =
    !rawNavBgColor || rawNavBgColor.trim().toLowerCase() === '#f1f5f9'
      ? '#005CA9'
      : rawNavBgColor;
  const isDefaultHeaderMatchBg = navBgColor.trim().toLowerCase() === '#005ca9';
  const navBtnBgColor = propNavBtnBgColor || salonContext?.navBtnBgColor;
  const navBtnActiveBgColor = propNavBtnActiveBgColor || salonContext?.navBtnActiveBgColor;
  const rawNavActiveColor = propNavActiveColor || salonContext?.navActiveColor;
  const navActiveColor = sanitizeAccentColor(rawNavActiveColor || accentColor || '#2B82C9');
  const navTextColor = propNavTextColor || salonContext?.navTextColor;
  const navBtnShadow = propNavBtnShadow || salonContext?.navBtnShadow || 'none';
  const navBtnBlur = propNavBtnBlur || salonContext?.navBtnBlur || 'none';
  const navBtnFont = propNavBtnFont || salonContext?.navBtnFont || 'Poppins';

  const isWhiteOrLightHex = React.useCallback((c?: string): boolean => {
    if (!c) return false;
    const hex = c.trim().toLowerCase();
    if (!hex || hex === 'transparent') return false;
    return (
      hex === '#ffffff' ||
      hex === '#fff' ||
      hex === 'white' ||
      hex === '#f8fafc' ||
      hex === '#f1f5f9' ||
      hex === '#f3f4f6' ||
      hex === '#e2e8f0' ||
      hex === '#e5e7eb' ||
      hex.startsWith('#f') ||
      hex.startsWith('#e')
    );
  }, []);

  // Cor do tema para aplicar em ícone e texto quando o botão ativo tem fundo branco/claro
  const themeColorForWhiteBtn = React.useMemo(() => {
    if (rawNavActiveColor && !isWhiteOrLightHex(rawNavActiveColor) && rawNavActiveColor.trim().toLowerCase() !== 'transparent') {
      return rawNavActiveColor.trim();
    }
    if (accentColor && !isWhiteOrLightHex(accentColor)) {
      return accentColor;
    }
    if (navBgColor && !isWhiteOrLightHex(navBgColor) && navBgColor !== 'transparent') {
      return navBgColor;
    }
    return navActiveColor || '#005CA9';
  }, [rawNavActiveColor, accentColor, navBgColor, navActiveColor, isWhiteOrLightHex]);

  // Detecta se a barra inferior tem fundo claro para garantir contraste de bordas e textos
  const isLightNavBg = React.useMemo(() => {
    if (navBgStyle === 'transparent') return !isDark;
    const hex = (navBgColor || '').trim().toLowerCase();
    if (!hex) return false;
    return (
      hex === '#f1f5f9' ||
      hex === '#f8fafc' ||
      hex === '#ffffff' ||
      hex === '#e2e8f0' ||
      hex === '#e5e7eb' ||
      hex === '#f3f4f6' ||
      hex.startsWith('#f') ||
      hex.startsWith('#e') ||
      hex.startsWith('#d')
    );
  }, [navBgColor, navBgStyle, isDark]);

  const btnShadowCss = React.useMemo(() => {
    if (navBtnShadow === 'subtle') return '0 2px 8px -2px rgba(0,0,0,0.3)';
    if (navBtnShadow === 'medium') return '0 4px 16px -2px rgba(0,0,0,0.5)';
    if (navBtnShadow === 'glow') return `0 0 14px ${navActiveColor || '#10b981'}80`;
    return 'none';
  }, [navBtnShadow, navActiveColor]);

  const btnBlurCss = React.useMemo(() => {
    if (navBtnBlur === 'sm') return 'blur(4px)';
    if (navBtnBlur === 'md') return 'blur(8px)';
    if (navBtnBlur === 'lg') return 'blur(16px)';
    return 'none';
  }, [navBtnBlur]);

  // Estilização dinâmica do contêiner da barra conforme navBgStyle e navBgColor (Default: fundo sólido puro sem degradê ou efeitos)
  const navContainerStyle = React.useMemo(() => {
    if (navBgStyle === 'transparent') {
      return { 
        backgroundColor: 'transparent', 
        backgroundImage: 'none',
        borderColor: 'transparent',
        boxShadow: 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      };
    }
    if (navBgColor) {
      if (navBgStyle === 'glass') {
        const hex = navBgColor.startsWith('#') ? navBgColor : '#005CA9';
        return {
          backgroundColor: `color-mix(in srgb, ${hex} 75%, transparent)`,
          borderColor: `color-mix(in srgb, ${hex} 45%, #cbd5e1)`,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        };
      }
      return {
        backgroundColor: navBgColor,
        backgroundImage: 'none',
        borderColor: isLightNavBg ? '#cbd5e1' : 'rgba(255, 255, 255, 0.18)',
        boxShadow: 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      };
    }
    if (navBgStyle === 'glass') {
      return {
        backdropFilter: 'blur(16px) saturate(160%)',
        WebkitBackdropFilter: 'blur(16px) saturate(160%)',
      };
    }
    return {
      backgroundColor: '#005CA9',
      backgroundImage: 'none',
      borderColor: 'rgba(255, 255, 255, 0.18)',
      boxShadow: 'none',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
    };
  }, [navBgStyle, navBgColor, isLightNavBg]);

  const navContainerClasses = React.useMemo(() => {
    if (navBgStyle === 'transparent') {
      return 'bg-transparent border-t-0 shadow-none backdrop-blur-none';
    }
    if (navBgStyle === 'solid') {
      return `backdrop-blur-none border-t shadow-none ${
        isLightNavBg ? 'text-slate-800' : 'text-white'
      }`;
    }
    // 'glass' (caso o usuário selecione efeito vidro nas ferramentas de estilo)
    return `backdrop-blur-md backdrop-saturate-150 border-t ${
      navBgColor
        ? ''
        : isDark
          ? 'bg-slate-900/50 border-white/10'
          : 'bg-slate-100/80 border-slate-300/80 text-slate-800'
    }`;
  }, [navBgStyle, navBgColor, isDark, isLightNavBg]);

  if (!onSelectTab) {
    return null;
  }

  let establishmentTabs: Array<{
    id: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades' | 'dados' | 'visual' | 'preferencias' | 'layout' | 'pausar';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [];

  if (isOwnerOrManager) {
    establishmentTabs = [
      { id: 'home', label: 'Painel', icon: LayoutDashboard },
      { id: 'caixa', label: 'Caixa', icon: Wallet },
      { id: 'vagas', label: vagasTabLabel, icon: Calendar },
      { id: 'pausar', label: 'Pausar', icon: CirclePause },
    ];
  } else if (isProfessionalStaff) {
    establishmentTabs = [
      { id: 'home', label: 'Painel', icon: LayoutDashboard },
      { id: 'vagas', label: vagasTabLabel, icon: Calendar },
      { id: 'pausar', label: 'Pausar', icon: CirclePause },
    ];
  } else {
    establishmentTabs = [
      { id: 'home', label: 'Início', icon: Home },
      { id: 'servicos', label: 'Serviços', icon: ServicesIconComponent },
      { id: 'vagas', label: vagasTabLabel || 'Agenda', icon: Calendar },
      { id: 'espaco', label: spaceTabLabel, icon: SpaceIconComponent },
    ];
  }

  return (
    <nav 
      id="vagou-bottom-nav"
      style={navContainerStyle}
      className={`shrink-0 w-full h-[80px] px-3 sm:px-6 gap-2 sm:gap-3 flex items-center justify-center z-30 transition-colors pb-[env(safe-area-inset-bottom,0px)] select-none ${navContainerClasses}`}
    >
      {establishmentTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        const effectiveActiveBg = (navBtnActiveBgColor && navBtnActiveBgColor !== 'transparent')
          ? navBtnActiveBgColor
          : navActiveColor;

        // Se o botão ativo tem fundo branco/claro, a cor do ícone e textos deve ser a cor do tema
        const resolvedActiveFg = (() => {
          if (isWhiteOrLightHex(effectiveActiveBg)) {
            return themeColorForWhiteBtn;
          }
          const bgLower = (effectiveActiveBg || '').trim().toLowerCase();
          const fgLower = (rawNavActiveColor || navActiveColor || '').trim().toLowerCase();
          if (bgLower && fgLower && bgLower === fgLower) {
            return '#ffffff';
          }
          return '#ffffff';
        })();

        const resolvedInactiveFg = navTextColor && navTextColor !== 'transparent' ? navTextColor : undefined;

        if (navStyle === 'solid') {
          return (
            <button
              key={tab.id}
              id={`nav-salon-${tab.id}`}
              onClick={() => {
                hapticLight();
                onSelectTab(tab.id);
              }}
              style={{
                backgroundColor: isActive
                  ? effectiveActiveBg
                  : navBtnBgColor || undefined,
                boxShadow: btnShadowCss !== 'none' ? btnShadowCss : undefined,
                backdropFilter: btnBlurCss !== 'none' ? btnBlurCss : undefined,
                WebkitBackdropFilter: btnBlurCss !== 'none' ? btnBlurCss : undefined,
                fontFamily: navBtnFont,
                color: isActive ? resolvedActiveFg : resolvedInactiveFg,
              }}
              className={`relative flex flex-col items-center justify-center gap-1 h-[50px] px-1.5 sm:px-3.5 transition-all active:scale-95 cursor-pointer flex-1 min-w-0 max-w-[96px] ${
                navShape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
              } ${
                navBorder === 'bordered'
                  ? isActive
                    ? isLightNavBg
                      ? 'border border-emerald-600/40 shadow-sm'
                      : 'border border-white/35 shadow-sm'
                    : isLightNavBg
                      ? 'border border-slate-300 bg-white/70'
                      : 'border border-slate-800/80'
                  : 'border-0'
              } ${
                isActive
                  ? 'shadow-sm'
                  : resolvedInactiveFg
                    ? 'hover:opacity-90'
                    : isLightNavBg
                      ? 'text-slate-700 hover:text-slate-950 hover:bg-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {tab.id === 'pausar' && hasPausedSlots && (
                <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950 animate-pulse" />
              )}
              <Icon 
                className="w-5 h-5 stroke-[2.2] shrink-0"
                style={{
                  color: isActive ? resolvedActiveFg : resolvedInactiveFg,
                }}
              />
              <span 
                style={{
                  fontFamily: navBtnFont,
                  color: isActive ? resolvedActiveFg : resolvedInactiveFg,
                }}
                className={`text-[10px] tracking-wide font-bold truncate max-w-full leading-none ${
                  isActive
                    ? ''
                    : resolvedInactiveFg
                      ? ''
                      : isLightNavBg
                        ? 'text-slate-700'
                        : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        }

        if (navStyle === 'boxed') {
          const isBoxedBtnWhite = isWhiteOrLightHex(navBtnActiveBgColor) || isWhiteOrLightHex(effectiveActiveBg);
          const boxedLabelActiveFg = isBoxedBtnWhite ? themeColorForWhiteBtn : (navActiveColor || resolvedActiveFg);
          return (
            <button
              key={tab.id}
              id={`nav-salon-${tab.id}`}
              onClick={() => {
                hapticLight();
                onSelectTab(tab.id);
              }}
              style={{
                backgroundColor: !isActive && navBtnBgColor ? navBtnBgColor : isActive && navBtnActiveBgColor ? navBtnActiveBgColor : undefined,
                fontFamily: navBtnFont,
                color: isActive ? boxedLabelActiveFg : resolvedInactiveFg,
              }}
              className={`relative flex flex-col items-center justify-center gap-1 py-1 px-1.5 sm:px-3 transition active:scale-95 cursor-pointer group flex-1 min-w-0 max-w-[100px] ${
                navShape === 'circle' ? 'rounded-2xl' : 'rounded-[4px]'
              } ${
                navBorder === 'bordered'
                  ? isActive
                    ? isLightNavBg
                      ? 'border border-emerald-500/60 bg-white shadow-xs'
                      : 'border border-white/35 shadow-xs'
                    : isLightNavBg
                      ? 'border border-slate-300 bg-white/70'
                      : 'border border-slate-800/80'
                  : 'border-0'
              }`}
            >
              {tab.id === 'pausar' && hasPausedSlots && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950 animate-pulse" />
              )}
              <div 
                style={
                  isActive
                    ? { 
                        borderColor: navIconBorder === 'bordered' ? navActiveColor : 'transparent', 
                        backgroundColor: effectiveActiveBg,
                        boxShadow: btnShadowCss !== 'none' ? btnShadowCss : undefined,
                        backdropFilter: btnBlurCss !== 'none' ? btnBlurCss : undefined,
                        WebkitBackdropFilter: btnBlurCss !== 'none' ? btnBlurCss : undefined,
                      }
                    : {
                        backgroundColor: navBtnBgColor || undefined,
                        borderColor: navIconBorder === 'bordered' ? (resolvedInactiveFg ? `${resolvedInactiveFg}40` : undefined) : 'transparent',
                        boxShadow: btnShadowCss !== 'none' ? btnShadowCss : undefined,
                        backdropFilter: btnBlurCss !== 'none' ? btnBlurCss : undefined,
                        WebkitBackdropFilter: btnBlurCss !== 'none' ? btnBlurCss : undefined,
                      }
                }
                className={`w-[34px] h-[34px] flex items-center justify-center transition-all ${
                  navShape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
                } ${
                  navIconBorder === 'bordered' ? 'border' : 'border-0'
                } ${
                  isActive
                    ? 'scale-105 shadow-xs'
                    : resolvedInactiveFg
                      ? navIconBorder === 'bordered' ? 'border-white/25 bg-slate-950/30' : 'bg-slate-950/30 border-transparent'
                      : isLightNavBg
                        ? `text-slate-700 hover:text-slate-950 bg-slate-100 ${navIconBorder === 'bordered' ? 'border-slate-300 hover:border-emerald-500/40' : 'border-transparent'}`
                        : `text-slate-400 hover:text-slate-200 bg-slate-950/70 ${navIconBorder === 'bordered' ? 'border-slate-800 hover:border-emerald-500/40' : 'border-transparent'}`
                }`}
              >
                <Icon 
                  className="w-4.5 h-4.5 stroke-[2.2] shrink-0"
                  style={{
                    color: isActive ? resolvedActiveFg : resolvedInactiveFg,
                  }}
                />
              </div>
              <span 
                style={{
                  fontFamily: navBtnFont,
                  color: isActive ? boxedLabelActiveFg : resolvedInactiveFg,
                }}
                className={`text-[10px] tracking-wide font-bold truncate max-w-full transition-colors ${
                  isActive || resolvedInactiveFg
                    ? ''
                    : isLightNavBg ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        }

        // Padrão 'minimal' (Clean Line — Botões com Borda Nítida + Indicador no Topo)
        const hasCustomActiveBg = Boolean(navBtnActiveBgColor && navBtnActiveBgColor !== 'transparent');
        const isMinimalActiveBgWhite = hasCustomActiveBg
          ? isWhiteOrLightHex(navBtnActiveBgColor)
          : isLightNavBg;

        const minimalActiveFg = (() => {
          if (isMinimalActiveBgWhite) {
            return themeColorForWhiteBtn;
          }
          if (hasCustomActiveBg) {
            return resolvedActiveFg;
          }
          if (!isLightNavBg || isDefaultHeaderMatchBg) {
            return '#ffffff';
          }
          return themeColorForWhiteBtn;
        })();

        const effectiveInactiveFg =
          resolvedInactiveFg && (!isDefaultHeaderMatchBg || resolvedInactiveFg.toLowerCase() !== '#334155')
            ? resolvedInactiveFg
            : undefined;

        return (
          <button
            key={tab.id}
            id={`nav-salon-${tab.id}`}
            onClick={() => {
              hapticLight();
              onSelectTab(tab.id);
            }}
            style={{
              backgroundColor: isActive && hasCustomActiveBg
                ? navBtnActiveBgColor
                : !isActive && navBtnBgColor
                ? navBtnBgColor
                : undefined,
              boxShadow: btnShadowCss !== 'none' ? btnShadowCss : undefined,
              backdropFilter: btnBlurCss !== 'none' ? btnBlurCss : undefined,
              WebkitBackdropFilter: btnBlurCss !== 'none' ? btnBlurCss : undefined,
              fontFamily: navBtnFont,
              color: isActive ? minimalActiveFg : effectiveInactiveFg,
            }}
            className={`relative h-[52px] flex flex-col items-center justify-center gap-1 px-1.5 sm:px-3.5 transition-all active:scale-95 cursor-pointer group flex-1 min-w-0 max-w-[100px] ${
              navShape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
            } ${
              navBorder === 'bordered'
                ? isActive
                  ? isLightNavBg
                    ? navShape === 'circle'
                      ? 'rounded-full border border-emerald-500/60 bg-white shadow-xs'
                      : 'rounded-[4px] border border-emerald-500/60 bg-white shadow-xs'
                    : navShape === 'circle'
                      ? 'rounded-full border border-white/50 bg-white/20'
                      : 'rounded-[4px] border border-white/50 bg-white/20'
                  : isLightNavBg
                    ? 'border border-slate-300 bg-white/60 hover:bg-white'
                    : 'border border-white/25 bg-white/10 hover:bg-white/15'
                : ''
            }`}
          >
            {tab.id === 'pausar' && hasPausedSlots && (
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950 animate-pulse" />
            )}
            {/* Indicador Superior */}
            <span
              style={
                isActive
                  ? {
                      backgroundColor: isMinimalActiveBgWhite
                        ? themeColorForWhiteBtn
                        : !isLightNavBg || isDefaultHeaderMatchBg
                          ? '#ffffff'
                          : navActiveColor,
                    }
                  : undefined
              }
              className={`absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-b-[4px] transition-all duration-200 ${
                isActive
                  ? 'w-8 opacity-100'
                  : 'w-0 bg-transparent opacity-0'
              }`}
            />

            <Icon
              style={{
                color: isActive ? minimalActiveFg : effectiveInactiveFg,
              }}
              className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                isActive
                  ? 'stroke-[2.4] -translate-y-0.5'
                  : effectiveInactiveFg
                    ? 'stroke-[2]'
                    : isLightNavBg
                      ? 'text-slate-700 group-hover:text-slate-950 stroke-[2]'
                      : 'text-white/85 group-hover:text-white stroke-[2]'
              }`}
            />

            <span
              style={{
                fontFamily: navBtnFont,
                color: isActive ? minimalActiveFg : effectiveInactiveFg,
              }}
              className={`text-[10px] tracking-wide font-bold truncate max-w-full leading-none transition-colors ${
                isActive
                  ? 'font-extrabold'
                  : effectiveInactiveFg
                    ? ''
                    : isLightNavBg
                      ? 'text-slate-700 group-hover:text-slate-950'
                      : 'text-white/85 group-hover:text-white'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
