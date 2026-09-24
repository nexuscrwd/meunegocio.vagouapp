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
  isProAdmin: propIsProAdmin,
}) => {
  const { isDark } = useTheme();

  const activeTab = propActiveTab || salonContext?.activeTab || 'home';
  const onSelectTab = propOnSelectTab || salonContext?.onSelectTab;
  const currentPersona = propPersona || salonContext?.currentPersona || (propIsProfessionalMode ? 'pro' : 'cliente');
  const isProfessionalMode = currentPersona !== 'cliente';
  const isProAdmin = propIsProAdmin !== undefined 
    ? propIsProAdmin 
    : salonContext?.isProAdmin !== undefined 
    ? salonContext.isProAdmin 
    : currentPersona === 'admin';
  const vagasTabLabel = propVagasTabLabel || salonContext?.vagasTabLabel || (isProfessionalMode ? 'Agenda' : 'Agendar');
  const spaceTabLabel = propSpaceTabLabel || salonContext?.spaceTabLabel || 'Espaço';
  const ServicesIconComponent = propServicesIcon || salonContext?.ServicesIcon || Scissors;
  const SpaceIconComponent = propSpaceIcon || salonContext?.SpaceIcon || Store;

  if (!onSelectTab) {
    return null;
  }

  let establishmentTabs: Array<{
    id: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [];

  if (isProfessionalMode) {
    establishmentTabs = [
      { id: 'home', label: 'Painel', icon: LayoutDashboard },
      { id: 'caixa', label: 'Caixa', icon: Wallet },
      { id: 'vagas', label: vagasTabLabel, icon: Calendar },
      { id: 'utilidades', label: 'Utilidades', icon: Wrench },
    ];
  } else {
    establishmentTabs = [
      { id: 'home', label: 'Início', icon: Home },
      { id: 'servicos', label: 'Serviços', icon: ServicesIconComponent },
      { id: 'equipe', label: 'Equipe', icon: Users },
      { id: 'espaco', label: spaceTabLabel, icon: SpaceIconComponent },
    ];
  }

  return (
    <nav className={`flex-shrink-0 w-full h-[70px] ${
      isDark
        ? 'bg-[#151A1E]/95 border-slate-800/90 shadow-[0_-4px_16px_rgba(0,0,0,0.5)]'
        : 'bg-white/95 border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] text-slate-800'
    } backdrop-blur-md border-t px-3 sm:px-6 py-1 my-0 mx-0 flex items-center justify-around z-30 transition-colors`}>
      {establishmentTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

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
            <div className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center transition-all ${
              isActive
                ? isDark
                  ? 'bg-accent/20 border-2 border-accent text-white scale-105 shadow-[0_0_12px_var(--accent-color)]/30'
                  : 'bg-accent text-white border-2 border-accent scale-105 shadow-xs'
                : isDark
                  ? 'text-slate-400 hover:text-slate-200 border border-slate-700/80 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800/80'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 bg-slate-50'
            }`}>
              <Icon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className={`text-[10px] tracking-wide font-['Poppins'] font-bold truncate max-w-[65px] transition-colors ${
              isActive
                ? isDark ? 'text-white' : 'text-slate-900 font-extrabold'
                : isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
