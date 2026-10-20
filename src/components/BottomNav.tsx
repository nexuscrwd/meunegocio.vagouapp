import React from 'react';
import { Home, Calendar, LayoutDashboard, Scissors, Users, Store, Wrench, Wallet } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';
import { UserPersona } from '../types';

export interface SalonNavContext {
  activeTab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades';
  onSelectTab: (tab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades') => void;
  ServicesIcon?: React.ComponentType<{ className?: string }>;
  SpaceIcon?: React.ComponentType<{ className?: string }>;
  spaceTabLabel?: string;
  vagasTabLabel?: string;
  isProfessionalMode?: boolean;
  currentPersona?: UserPersona;
  isProAdmin?: boolean;
  isOwnerOrManager?: boolean;
  isProfessionalStaff?: boolean;
  navStyle?: 'minimal' | 'solid' | 'boxed';
}

interface BottomNavProps {
  salonContext?: SalonNavContext | null;
  activeTab?: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades';
  onSelectTab?: (tab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades') => void;
  ServicesIcon?: React.ComponentType<{ className?: string }>;
  SpaceIcon?: React.ComponentType<{ className?: string }>;
  spaceTabLabel?: string;
  vagasTabLabel?: string;
  isProfessionalMode?: boolean;
  currentPersona?: UserPersona;
  isProAdmin?: boolean;
  isOwnerOrManager?: boolean;
  isProfessionalStaff?: boolean;
  navStyle?: 'minimal' | 'solid' | 'boxed';
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
  navStyle: propNavStyle,
}) => {
  const { isDark } = useTheme();

  const activeTab = propActiveTab || salonContext?.activeTab || 'home';
  const onSelectTab = propOnSelectTab || salonContext?.onSelectTab;
  const currentPersona = propPersona || salonContext?.currentPersona || (propIsProfessionalMode ? 'pro' : 'cliente');
  const isOwnerOrManager = propIsOwnerOrManager ?? salonContext?.isOwnerOrManager ?? (currentPersona !== 'cliente');
  const isProfessionalStaff = propIsProfessionalStaff ?? salonContext?.isProfessionalStaff ?? false;
  const vagasTabLabel = propVagasTabLabel || salonContext?.vagasTabLabel || (isOwnerOrManager || isProfessionalStaff ? 'Agenda' : 'Agendar');
  const spaceTabLabel = propSpaceTabLabel || salonContext?.spaceTabLabel || 'Espaço';
  const ServicesIconComponent = propServicesIcon || salonContext?.ServicesIcon || Scissors;
  const SpaceIconComponent = propSpaceIcon || salonContext?.SpaceIcon || Store;
  const navStyle = propNavStyle || salonContext?.navStyle || 'minimal';

  if (!onSelectTab) {
    return null;
  }

  let establishmentTabs: Array<{
    id: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [];

  if (isOwnerOrManager) {
    establishmentTabs = [
      { id: 'home', label: 'Painel', icon: LayoutDashboard },
      { id: 'caixa', label: 'Caixa', icon: Wallet },
      { id: 'vagas', label: vagasTabLabel, icon: Calendar },
      { id: 'utilidades', label: 'Utilidades', icon: Wrench },
    ];
  } else if (isProfessionalStaff) {
    establishmentTabs = [
      { id: 'home', label: 'Painel', icon: LayoutDashboard },
      { id: 'vagas', label: vagasTabLabel, icon: Calendar },
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
      className={`shrink-0 w-full h-[66px] ${
        isDark
          ? 'bg-slate-900/95 border-emerald-500/25 shadow-[0_-4px_20px_rgba(0,0,0,0.45)]'
          : 'bg-white/95 border-emerald-500/25 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] text-slate-800'
      } backdrop-blur-md border-t px-2.5 sm:px-6 flex items-center justify-around z-30 transition-colors pb-[env(safe-area-inset-bottom,0px)] select-none`}
    >
      {establishmentTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        if (navStyle === 'solid') {
          return (
            <button
              key={tab.id}
              id={`nav-salon-${tab.id}`}
              onClick={() => {
                hapticLight();
                onSelectTab(tab.id);
              }}
              className={`flex flex-col items-center justify-center gap-1 h-[50px] px-2 sm:px-3.5 rounded-[4px] transition-all active:scale-95 cursor-pointer flex-1 max-w-[96px] ${
                isActive
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <Icon className={`w-5 h-5 stroke-[2.2] ${isActive ? 'text-white' : ''}`} />
              <span className={`text-[10px] tracking-wide font-['Poppins'] font-bold truncate max-w-[72px] leading-none ${
                isActive ? 'text-white' : isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
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
              className="flex flex-col items-center justify-center gap-1 py-1 px-1.5 sm:px-3 transition active:scale-95 cursor-pointer group flex-1 max-w-[100px]"
            >
              <div className={`w-[34px] h-[34px] rounded-[4px] flex items-center justify-center transition-all ${
                isActive
                  ? 'bg-emerald-500 border border-emerald-400 text-white scale-105 shadow-xs'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200 border border-slate-800 bg-slate-950/70 hover:border-emerald-500/40'
                    : 'text-slate-500 hover:text-slate-800 border border-slate-200 bg-slate-50 hover:border-emerald-500/40'
              }`}>
                <Icon className={`w-4.5 h-4.5 stroke-[2.2] ${isActive ? 'text-white' : ''}`} />
              </div>
              <span className={`text-[10px] tracking-wide font-['Poppins'] font-bold truncate max-w-[68px] transition-colors ${
                isActive
                  ? isDark ? 'text-emerald-400' : 'text-emerald-600 font-extrabold'
                  : isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        }

        // Padrão 'minimal' (Clean Line — Zero Box-in-Box + Indicador Luminoso no Topo)
        return (
          <button
            key={tab.id}
            id={`nav-salon-${tab.id}`}
            onClick={() => {
              hapticLight();
              onSelectTab(tab.id);
            }}
            className="relative h-full flex flex-col items-center justify-center gap-1 px-2 sm:px-3.5 transition-all active:scale-95 cursor-pointer group flex-1 max-w-[100px]"
          >
            {/* Indicador Luminoso Superior na Cor do Tema */}
            <span
              className={`absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-b-[4px] transition-all duration-200 ${
                isActive
                  ? 'w-8 bg-emerald-500 opacity-100'
                  : 'w-0 bg-transparent opacity-0'
              }`}
            />

            <Icon
              className={`w-5 h-5 transition-transform duration-200 ${
                isActive
                  ? isDark
                    ? 'text-emerald-400 stroke-[2.4] -translate-y-0.5'
                    : 'text-emerald-600 stroke-[2.4] -translate-y-0.5'
                  : isDark
                    ? 'text-slate-400 group-hover:text-slate-200 stroke-[2]'
                    : 'text-slate-500 group-hover:text-slate-800 stroke-[2]'
              }`}
            />

            <span
              className={`text-[10px] tracking-wide font-['Poppins'] font-bold truncate max-w-[72px] leading-none transition-colors ${
                isActive
                  ? isDark
                    ? 'text-white'
                    : 'text-emerald-600 font-extrabold'
                  : isDark
                    ? 'text-slate-400 group-hover:text-slate-300'
                    : 'text-slate-500 group-hover:text-slate-800'
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
