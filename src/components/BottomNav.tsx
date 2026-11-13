import React from 'react';
import { Home, Calendar, LayoutDashboard, LayoutGrid, Store, Wallet, CirclePause } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getContrastTextHex, isLightColor, normalizeHex } from '../utils/themePalette';
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
  const { isDark, resolvedPalette } = useTheme();

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

  // Overrides manuais da aba Estrutura & Barras (quando vazios, segue 100% resolvedPalette do tema!)
  const customNavBg = normalizeHex(propNavBgColor || salonContext?.navBgColor);
  const navBgColor = customNavBg || resolvedPalette.navBg;

  const customNavBtnBg = normalizeHex(propNavBtnBgColor || salonContext?.navBtnBgColor);
  const customNavBtnActiveBg = normalizeHex(propNavBtnActiveBgColor || salonContext?.navBtnActiveBgColor);
  const customNavActiveColor = normalizeHex(propNavActiveColor || salonContext?.navActiveColor);
  const customNavTextColor = normalizeHex(propNavTextColor || salonContext?.navTextColor);

  const navBtnShadow = propNavBtnShadow || salonContext?.navBtnShadow || 'none';
  const navBtnBlur = navBtnBlurResolve(propNavBtnBlur || salonContext?.navBtnBlur || 'none');
  const navBtnFont = propNavBtnFont || salonContext?.navBtnFont || 'Plus Jakarta Sans';

  const isLightNavBg = React.useMemo(() => {
    if (navBgStyle === 'transparent') return !isDark;
    if (customNavBg) return isLightColor(customNavBg);
    return !resolvedPalette.navIsDark;
  }, [navBgStyle, customNavBg, resolvedPalette.navIsDark, isDark]);

  const effectiveActiveBg = customNavBtnActiveBg || customNavActiveColor || resolvedPalette.navActiveBtnBg;
  const resolvedActiveFg = customNavBtnActiveBg || customNavActiveColor
    ? getContrastTextHex(effectiveActiveBg, '#0F172A', '#FFFFFF')
    : resolvedPalette.navActiveBtnFg;

  const resolvedInactiveFg = customNavTextColor
    ? customNavTextColor
    : customNavBg
      ? getContrastTextHex(customNavBg, '#475569', '#CBD5E1')
      : resolvedPalette.navInactiveFg;

  const btnShadowCss = React.useMemo(() => {
    if (navBtnShadow === 'subtle') return '0 2px 8px -2px rgba(0,0,0,0.22)';
    if (navBtnShadow === 'medium') return '0 4px 16px -2px rgba(0,0,0,0.35)';
    if (navBtnShadow === 'glow') return `0 0 14px ${resolvedPalette.primary}55`;
    return 'none';
  }, [navBtnShadow, resolvedPalette.primary]);

  const navContainerStyle = React.useMemo(() => {
    const borderHex = resolvedPalette.navBorder;
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
  }, [navBgStyle, navBgColor, resolvedPalette.navBorder]);

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
        const inactiveBtnBg = customNavBtnBg || resolvedPalette.navInactiveBtnBg;
        const inactiveFgEffective = customNavBtnBg
          ? getContrastTextHex(customNavBtnBg, '#334155', '#E2E8F0')
          : resolvedInactiveFg;

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
                backgroundColor: isActive ? effectiveActiveBg : inactiveBtnBg,
                borderColor:
                  navBorder === 'bordered'
                    ? isActive
                      ? resolvedPalette.isCustomized ? effectiveActiveBg : '#CBD5E1'
                      : resolvedPalette.navBorder
                    : 'transparent',
                boxShadow: btnShadowCss !== 'none' ? btnShadowCss : undefined,
                backdropFilter: navBtnBlur !== 'none' ? navBtnBlur : undefined,
                WebkitBackdropFilter: navBtnBlur !== 'none' ? navBtnBlur : undefined,
                fontFamily: navBtnFont,
                color: isActive ? resolvedActiveFg : inactiveFgEffective,
              }}
              className={`relative flex flex-col items-center justify-center gap-1 h-[50px] px-1.5 sm:px-3.5 transition-all active:scale-95 cursor-pointer flex-1 min-w-0 max-w-[96px] ${
                navShape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
              } ${navBorder === 'bordered' ? 'border' : 'border-0'} ${isActive ? 'shadow-xs' : ''}`}
            >
              {tab.id === 'pausar' && hasPausedSlots && (
                <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-950" />
              )}
              <Icon
                className="w-5 h-5 stroke-[2.2] shrink-0"
                style={{ color: isActive ? resolvedActiveFg : inactiveFgEffective }}
              />
              <span
                style={{
                  fontFamily: navBtnFont,
                  color: isActive ? resolvedActiveFg : inactiveFgEffective,
                }}
                className="text-[10px] tracking-wide font-bold truncate max-w-full leading-none"
              >
                {tab.label}
              </span>
            </button>
          );
        }

        if (navStyle === 'boxed') {
          const boxedLabelActiveColor = isLightNavBg
            ? resolvedPalette.isCustomized ? resolvedPalette.primary : '#0F172A'
            : '#FFFFFF';

          return (
            <button
              key={tab.id}
              id={`nav-salon-${tab.id}`}
              onClick={() => {
                hapticLight();
                onSelectTab(tab.id);
              }}
              style={{
                backgroundColor: !isActive ? inactiveBtnBg : isLightNavBg ? '#FFFFFF' : 'rgba(255,255,255,0.1)',
                borderColor:
                  navBorder === 'bordered'
                    ? isActive
                      ? resolvedPalette.primary
                      : resolvedPalette.navBorder
                    : 'transparent',
                fontFamily: navBtnFont,
                color: isActive ? boxedLabelActiveColor : inactiveFgEffective,
              }}
              className={`relative flex flex-col items-center justify-center gap-1 py-1 px-1.5 sm:px-3 transition active:scale-95 cursor-pointer group flex-1 min-w-0 max-w-[100px] ${
                navShape === 'circle' ? 'rounded-2xl' : 'rounded-[4px]'
              } ${navBorder === 'bordered' ? 'border' : 'border-0'} ${isActive ? 'shadow-xs' : ''}`}
            >
              {tab.id === 'pausar' && hasPausedSlots && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-950" />
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
                        backgroundColor: customNavBtnBg || (isLightNavBg ? '#F1F5F9' : 'rgba(255,255,255,0.08)'),
                      }
                }
                className={`w-[34px] h-[34px] flex items-center justify-center transition-all ${
                  navShape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
                } ${navIconBorder === 'bordered' ? 'border' : 'border-0'} ${isActive ? 'scale-105 shadow-xs' : ''}`}
              >
                <Icon
                  className="w-4.5 h-4.5 stroke-[2.2] shrink-0"
                  style={{ color: isActive ? resolvedActiveFg : inactiveFgEffective }}
                />
              </div>
              <span
                style={{
                  fontFamily: navBtnFont,
                  color: isActive ? boxedLabelActiveColor : inactiveFgEffective,
                }}
                className="text-[10px] tracking-wide font-bold truncate max-w-full transition-colors"
              >
                {tab.label}
              </span>
            </button>
          );
        }

        // Modo 'minimal': Default Neutro usa #FFFFFF + #0F172A; com tema personalizado usa effectiveActiveBg + resolvedActiveFg
        const activeMinimalBorder =
          isLightNavBg && isLightColor(effectiveActiveBg)
            ? '#CBD5E1'
            : effectiveActiveBg;

        return (
          <button
            key={tab.id}
            id={`nav-salon-${tab.id}`}
            onClick={() => {
              hapticLight();
              onSelectTab(tab.id);
            }}
            style={{
              backgroundColor: isActive ? effectiveActiveBg : inactiveBtnBg,
              borderColor:
                navBorder === 'bordered'
                  ? isActive
                    ? activeMinimalBorder
                    : resolvedPalette.navBorder
                  : 'transparent',
              boxShadow:
                btnShadowCss !== 'none'
                  ? btnShadowCss
                  : isActive
                    ? '0 1px 3px rgba(15, 23, 42, 0.12)'
                    : undefined,
              backdropFilter: navBtnBlur !== 'none' ? navBtnBlur : undefined,
              WebkitBackdropFilter: navBtnBlur !== 'none' ? navBtnBlur : undefined,
              fontFamily: navBtnFont,
              color: isActive ? resolvedActiveFg : inactiveFgEffective,
            }}
            className={`relative h-[50px] flex flex-col items-center justify-center gap-1 px-1.5 sm:px-3.5 transition-all active:scale-95 cursor-pointer group flex-1 min-w-0 max-w-[100px] ${
              navShape === 'circle' ? 'rounded-full' : 'rounded-[4px]'
            } ${navBorder === 'bordered' ? 'border' : 'border-0'} ${isActive ? 'shadow-xs' : ''}`}
          >
            {tab.id === 'pausar' && hasPausedSlots && (
              <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-950" />
            )}

            <Icon
              style={{ color: isActive ? resolvedActiveFg : inactiveFgEffective }}
              className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                isActive ? 'stroke-[2.3]' : 'stroke-[1.9]'
              }`}
            />

            <span
              style={{
                fontFamily: navBtnFont,
                color: isActive ? resolvedActiveFg : inactiveFgEffective,
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

function navBtnBlurResolve(blur: string): string {
  if (blur === 'sm') return 'blur(4px)';
  if (blur === 'md') return 'blur(8px)';
  if (blur === 'lg') return 'blur(16px)';
  return 'none';
}
