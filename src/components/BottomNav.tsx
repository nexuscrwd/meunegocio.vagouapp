import React from 'react';
import { Home, Calendar, LayoutDashboard, LayoutGrid, Store, Wallet, CirclePause } from 'lucide-react';
import { useTheme, sanitizeAccentColor, isLegacyOrSystemDefaultColor } from '../context/ThemeContext';
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
  const { isDark, accentColor, presetTokens } = useTheme();

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
  const hasCustomSalonNavBg = Boolean(rawNavBgColor && !isLegacyOrSystemDefaultColor(rawNavBgColor));
  const navBgColor = hasCustomSalonNavBg
    ? rawNavBgColor
    : isDark
      ? '#0F172A'
      : presetTokens.navBg;

  const navBtnBgColor = propNavBtnBgColor || salonContext?.navBtnBgColor;
  const navBtnActiveBgColor = propNavBtnActiveBgColor || salonContext?.navBtnActiveBgColor;
  const rawNavActiveColor = propNavActiveColor || salonContext?.navActiveColor;
  const hasCustomActiveColor = Boolean(rawNavActiveColor && !isLegacyOrSystemDefaultColor(rawNavActiveColor));
  const navActiveColor = hasCustomActiveColor
    ? sanitizeAccentColor(rawNavActiveColor)
    : presetTokens.navActiveBtnBg;

  const navTextColor = propNavTextColor || salonContext?.navTextColor;
  const navBtnShadow = propNavBtnShadow || salonContext?.navBtnShadow || 'none';
  const navBtnBlur = propNavBtnBlur || salonContext?.navBtnBlur || 'none';
  const navBtnFont = propNavBtnFont || salonContext?.navBtnFont || 'Plus Jakarta Sans';

  const isWhiteOrLightHex = React.useCallback((c?: string): boolean => {
    if (!c) return false;
    const hex = c.trim().toLowerCase();
    if (!hex || hex === 'transparent') return false;
    return (
      hex === '#ffffff' ||
      hex === '#fff' ||
      hex === 'white' ||
      hex === '#fafafa' ||
      hex === '#f8fafc' ||
      hex === '#f4f4f5' ||
      hex === '#f1f5f9' ||
      hex === '#f3f4f6' ||
      hex === '#e2e8f0' ||
      hex === '#e4e4e7' ||
      hex === '#e5e7eb' ||
      hex.startsWith('#f') ||
      hex.startsWith('#e')
    );
  }, []);

  const isLightNavBg = React.useMemo(() => {
    if (navBgStyle === 'transparent') return !isDark;
    if (!hasCustomSalonNavBg) {
      return isDark ? false : !presetTokens.navIsDark;
    }
    return isWhiteOrLightHex(navBgColor);
  }, [navBgColor, navBgStyle, isDark, hasCustomSalonNavBg, presetTokens.navIsDark, isWhiteOrLightHex]);

  const themeColorForWhiteBtn = React.useMemo(() => {
    if (hasCustomActiveColor && rawNavActiveColor && !isWhiteOrLightHex(rawNavActiveColor)) {
      return rawNavActiveColor.trim();
    }
    if (accentColor && !isWhiteOrLightHex(accentColor)) {
      return accentColor;
    }
    if (navBgColor && !isWhiteOrLightHex(navBgColor) && navBgColor !== 'transparent') {
      return navBgColor;
    }
    return presetTokens.actionBg || '#18181B';
  }, [hasCustomActiveColor, rawNavActiveColor, accentColor, navBgColor, presetTokens.actionBg, isWhiteOrLightHex]);

  const btnShadowCss = React.useMemo(() => {
    if (navBtnShadow === 'subtle') return '0 2px 8px -2px rgba(0,0,0,0.22)';
    if (navBtnShadow === 'medium') return '0 4px 16px -2px rgba(0,0,0,0.35)';
    if (navBtnShadow === 'glow') return `0 0 14px ${themeColorForWhiteBtn}55`;
    return 'none';
  }, [navBtnShadow, themeColorForWhiteBtn]);

  const btnBlurCss = React.useMemo(() => {
    if (navBtnBlur === 'sm') return 'blur(4px)';
    if (navBtnBlur === 'md') return 'blur(8px)';
    if (navBtnBlur === 'lg') return 'blur(16px)';
    return 'none';
  }, [navBtnBlur]);

  const navContainerStyle = React.useMemo(() => {
    const borderHex = isDark ? '#1E293B' : presetTokens.navBorder;
    if (navBgStyle === 'transparent') {
      return {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        boxShadow: 'none',
      };
    }
    if (navBgStyle === 'glass') {
      return {
        backgroundColor: `color-mix(in srgb, ${navBgColor} 82%, transparent)`,
        borderColor: borderHex,
        backdropFilter: 'blur(16px) saturate(150%)',
        WebkitBackdropFilter: 'blur(16px) saturate(150%)',
      };
    }
    return {
      backgroundColor: navBgColor,
      borderColor: borderHex,
      boxShadow: 'none',
    };
  }, [navBgStyle, navBgColor, isDark, presetTokens.navBorder]);

  if (!onSelectTab) {
    return null;
  }

  let establishmentTabs: Array<{
    id: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades' | 'dados' | 'visual' | 'pausar';
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
      className={`shrink-0 w-full h-[76px] px-3 sm:px-6 gap-2 sm:gap-3 flex items-center justify-center z-30 transition-colors pb-[env(safe-area-inset-bottom,0px)] select-none ${
        navBgStyle === 'transparent' ? 'border-t-0' : 'border-t'
      }`}
    >
      {establishmentTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        const effectiveActiveBg =
          navBtnActiveBgColor && navBtnActiveBgColor !== 'transparent'
            ? navBtnActiveBgColor
            : isDark
              ? '#FFFFFF'
              : navActiveColor;

        const resolvedActiveFg = isWhiteOrLightHex(effectiveActiveBg)
          ? themeColorForWhiteBtn
          : '#FFFFFF';

        const resolvedInactiveFg =
          navTextColor && navTextColor !== 'transparent' && !isLegacyOrSystemDefaultColor(navTextColor)
            ? navTextColor
            : isDark
              ? '#94A3B8'
              : presetTokens.navInactiveFg;

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
                backgroundColor: isActive ? effectiveActiveBg : navBtnBgColor || undefined,
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
                    ? 'border border-black/10 shadow-xs'
                    : isLightNavBg
                      ? 'border border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                      : 'border border-white/15 bg-white/5 hover:bg-white/10'
                  : 'border-0'
              }`}
            >
              {tab.id === 'pausar' && hasPausedSlots && (
                <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950" />
              )}
              <Icon
                className="w-5 h-5 stroke-[2.2] shrink-0"
                style={{ color: isActive ? resolvedActiveFg : resolvedInactiveFg }}
              />
              <span
                style={{
                  fontFamily: navBtnFont,
                  color: isActive ? resolvedActiveFg : resolvedInactiveFg,
                }}
                className="text-[10px] tracking-wide font-bold truncate max-w-full leading-none"
              >
                {tab.label}
              </span>
            </button>
          );
        }

        if (navStyle === 'boxed') {
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
                color: isActive ? (isLightNavBg ? themeColorForWhiteBtn : '#FFFFFF') : resolvedInactiveFg,
              }}
              className={`relative flex flex-col items-center justify-center gap-1 py-1 px-1.5 sm:px-3 transition active:scale-95 cursor-pointer group flex-1 min-w-0 max-w-[100px] ${
                navShape === 'circle' ? 'rounded-2xl' : 'rounded-[4px]'
              } ${
                navBorder === 'bordered'
                  ? isActive
                    ? isLightNavBg
                      ? 'border border-slate-300 bg-white shadow-xs'
                      : 'border border-white/30 bg-white/10 shadow-xs'
                    : isLightNavBg
                      ? 'border border-slate-200 bg-slate-50/70'
                      : 'border border-white/15 bg-white/5'
                  : 'border-0'
              }`}
            >
              {tab.id === 'pausar' && hasPausedSlots && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950" />
              )}
              <div
                style={
                  isActive
                    ? {
                        borderColor: navIconBorder === 'bordered' ? effectiveActiveBg : 'transparent',
                        backgroundColor: effectiveActiveBg,
                        boxShadow: btnShadowCss !== 'none' ? btnShadowCss : undefined,
                      }
                    : {
                        backgroundColor: navBtnBgColor || undefined,
                      }
                }
                className={`w-[34px] h-[34px] flex items-center justify-center transition-all ${
                  navShape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
                } ${navIconBorder === 'bordered' ? 'border' : 'border-0'} ${
                  isActive
                    ? 'scale-105 shadow-xs'
                    : isLightNavBg
                      ? 'bg-slate-100'
                      : 'bg-white/10'
                }`}
              >
                <Icon
                  className="w-4.5 h-4.5 stroke-[2.2] shrink-0"
                  style={{ color: isActive ? resolvedActiveFg : resolvedInactiveFg }}
                />
              </div>
              <span
                style={{
                  fontFamily: navBtnFont,
                  color: isActive ? (isLightNavBg ? themeColorForWhiteBtn : '#FFFFFF') : resolvedInactiveFg,
                }}
                className="text-[10px] tracking-wide font-bold truncate max-w-full transition-colors"
              >
                {tab.label}
              </span>
            </button>
          );
        }

        // Padrão 'minimal' claro neutro: barra #F1F5F9 com botão ativo branco nítido (#FFFFFF) e inativos translúcidos claros
        const isActiveWhiteOnLight = isActive && isLightNavBg && isWhiteOrLightHex(effectiveActiveBg);
        const minimalBtnBg = isActive
          ? effectiveActiveBg
          : navBtnBgColor || (isLightNavBg ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.06)');

        const minimalBtnFg = isActive
          ? isActiveWhiteOnLight
            ? hasCustomActiveColor
              ? themeColorForWhiteBtn
              : presetTokens.navActiveBtnFg
            : resolvedActiveFg
          : resolvedInactiveFg;

        return (
          <button
            key={tab.id}
            id={`nav-salon-${tab.id}`}
            onClick={() => {
              hapticLight();
              onSelectTab(tab.id);
            }}
            style={{
              backgroundColor: minimalBtnBg,
              borderColor:
                navBorder === 'bordered'
                  ? isActive
                    ? isActiveWhiteOnLight
                      ? '#CBD5E1'
                      : effectiveActiveBg
                    : isLightNavBg
                      ? presetTokens.navBorder
                      : 'rgba(255,255,255,0.16)'
                  : 'transparent',
              boxShadow:
                btnShadowCss !== 'none'
                  ? btnShadowCss
                  : isActiveWhiteOnLight
                    ? '0 1px 3px rgba(15, 23, 42, 0.08)'
                    : undefined,
              backdropFilter: btnBlurCss !== 'none' ? btnBlurCss : undefined,
              WebkitBackdropFilter: btnBlurCss !== 'none' ? btnBlurCss : undefined,
              fontFamily: navBtnFont,
              color: minimalBtnFg,
            }}
            className={`relative h-[50px] flex flex-col items-center justify-center gap-1 px-1.5 sm:px-3.5 transition-all active:scale-95 cursor-pointer group flex-1 min-w-0 max-w-[100px] ${
              navShape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
            } ${navBorder === 'bordered' ? 'border' : 'border-0'} ${isActive ? 'shadow-xs' : ''}`}
          >
            {tab.id === 'pausar' && hasPausedSlots && (
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-950" />
            )}

            <Icon
              style={{ color: minimalBtnFg }}
              className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                isActive ? 'stroke-[2.3]' : 'stroke-[1.9]'
              }`}
            />

            <span
              style={{
                fontFamily: navBtnFont,
                color: minimalBtnFg,
              }}
              className={`text-[10px] tracking-wide truncate max-w-full leading-none transition-colors ${
                isActive ? 'font-extrabold' : 'font-semibold'
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
