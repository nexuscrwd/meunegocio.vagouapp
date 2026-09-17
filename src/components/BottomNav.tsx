import React from 'react';
import { Home, Calendar, Sparkles, Store, LayoutDashboard } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { hapticLight } from '../utils/haptics';

export interface SalonNavContext {
  activeTab: 'home' | 'servicos' | 'vagas' | 'espaco';
  onSelectTab: (tab: 'home' | 'servicos' | 'vagas' | 'espaco') => void;
  ServicesIcon?: React.ComponentType<{ className?: string }>;
  SpaceIcon?: React.ComponentType<{ className?: string }>;
  spaceTabLabel?: string;
  vagasTabLabel?: string;
  isProfessionalMode?: boolean;
}

interface BottomNavProps {
  salonContext?: SalonNavContext | null;
  activeTab?: 'home' | 'servicos' | 'vagas' | 'espaco';
  onSelectTab?: (tab: 'home' | 'servicos' | 'vagas' | 'espaco') => void;
  ServicesIcon?: React.ComponentType<{ className?: string }>;
  SpaceIcon?: React.ComponentType<{ className?: string }>;
  spaceTabLabel?: string;
  vagasTabLabel?: string;
  isProfessionalMode?: boolean;
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
}) => {
  const { isDark } = useTheme();

  const activeTab = propActiveTab || salonContext?.activeTab || 'home';
  const onSelectTab = propOnSelectTab || salonContext?.onSelectTab;
  const isProfessionalMode = propIsProfessionalMode ?? salonContext?.isProfessionalMode ?? false;
  const ServicesIcon = propServicesIcon || salonContext?.ServicesIcon || Sparkles;
  const SpaceIcon = propSpaceIcon || salonContext?.SpaceIcon || Store;
  const spaceTabLabel = propSpaceTabLabel || salonContext?.spaceTabLabel || (isProfessionalMode ? 'Espaço' : 'Espaço');
  const vagasTabLabel = propVagasTabLabel || salonContext?.vagasTabLabel || (isProfessionalMode ? 'Agenda' : 'Agendar');

  if (!onSelectTab) {
    return null;
  }

  const establishmentTabs = [
    { id: 'home' as const, label: 'Início', icon: isProfessionalMode ? LayoutDashboard : Home },
    { id: 'servicos' as const, label: 'Serviços', icon: ServicesIcon },
    { id: 'vagas' as const, label: vagasTabLabel, icon: Calendar },
    { id: 'espaco' as const, label: spaceTabLabel, icon: SpaceIcon },
  ];

  return (
    <nav className={`flex-shrink-0 w-full h-[70px] ${
      isDark
        ? 'bg-[#151A1E]/95 border-slate-800/90 shadow-[0_-4px_16px_rgba(0,0,0,0.5)]'
        : 'bg-white/95 border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]'
    } backdrop-blur-md border-t px-2 sm:px-3 py-1 my-0 mx-0 flex items-center justify-around z-30 transition-colors`}>
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
            className="flex flex-col items-center justify-center gap-1 py-1 px-2 sm:px-3 transition active:scale-95 cursor-pointer group"
          >
            <div className={`w-[34px] h-[34px] rounded flex items-center justify-center transition-all ${
              isActive
                ? isDark
                  ? 'bg-emerald-950/80 border border-[#20C933]/60 text-[#20C933] scale-105 shadow-[0_0_12px_rgba(32,201,51,0.25)]'
                  : 'bg-emerald-50 border border-[#20C933]/60 text-[#087A2A] scale-105 shadow-[0_0_12px_rgba(32,201,51,0.18)]'
                : isDark
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
            }`}>
              <Icon className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span className={`text-[10px] tracking-wide font-['Poppins'] font-bold truncate max-w-[64px] ${
              isActive
                ? isDark ? 'text-[#20C933]' : 'text-[#087A2A]'
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
