import React, { useState } from 'react';
import {
  Building2, Palette, Users, DollarSign,
  ArrowLeft, ChevronRight, ShieldCheck, Sparkles,
  Sliders, RotateCcw
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  SalonAdminSettings, CatalogServiceItem, SalonProfessionalItem,
  BookingAppointment
} from '../../types';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { BusinessDataCardView } from './BusinessDataCardView';
import { SalonDesignStudioView } from './SalonDesignStudioView';
import { DefaultThemeConfirmModal } from './DefaultThemeConfirmModal';
import { ProfessionalServicesManager } from './ProfessionalServicesManager';
import { TeamManager } from './TeamManager';
import { ProfessionalSpaceManager } from './ProfessionalSpaceManager';
import { FinancialManagerView } from './FinancialManagerView';
import { UtilitiesAndToolsView } from './UtilitiesAndToolsView';
import { getSectionHeaderStyleData } from '../../utils/sectionHeaderStyle';
import {
  DEFAULT_NEUTRAL_HEX,
  DEFAULT_NEUTRAL_PRESET_ID,
  QUICK_THEME_PRESETS,
  normalizeHex,
} from '../../utils/themePalette';

export type ManagementCardId = 'dados' | 'visual' | 'layout' | 'servicos' | 'equipe' | 'espaco' | 'financeiro' | 'utilidades';

export interface SalonCustomizationHubProps {
  initialSubTab?: ManagementCardId | 'hub';
  adminSettings: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => Promise<any> | void;
  services: CatalogServiceItem[];
  onUpdateServices: (services: CatalogServiceItem[]) => void;
  professionals: SalonProfessionalItem[];
  onUpdateProfessionals: (professionals: SalonProfessionalItem[]) => void;
  appointments?: BookingAppointment[];
  onUpdateAppointments?: (appointments: BookingAppointment[]) => void;
  onBack?: () => void;
}

export const SalonCustomizationHub: React.FC<SalonCustomizationHubProps> = ({
  initialSubTab = 'hub',
  adminSettings,
  onUpdateSettings,
  services,
  onUpdateServices,
  professionals,
  onUpdateProfessionals,
  appointments = [],
  onUpdateAppointments,
  onBack,
}) => {
  const { isDark, themeExplicitlyCustomized, resetToDefaultPalette, setTheme } = useTheme();
  const [isDefaultModalOpen, setIsDefaultModalOpen] = useState(false);

  // Mapeamento de sub-abas para os cards se vier via props
  const initialCard: ManagementCardId | null =
    initialSubTab === 'servicos' ? 'servicos' :
    initialSubTab === 'equipe' ? 'equipe' :
    initialSubTab === 'espaco' ? 'espaco' :
    initialSubTab === 'dados' ? 'dados' :
    initialSubTab === 'visual' ? 'visual' :
    initialSubTab === 'layout' ? 'layout' :
    initialSubTab === 'financeiro' ? 'financeiro' :
    initialSubTab === 'utilidades' ? 'utilidades' :
    null;

  const [selectedCard, setSelectedCard] = useState<ManagementCardId | null>(initialCard);

  React.useEffect(() => {
    if (initialSubTab === 'servicos') setSelectedCard('servicos');
    else if (initialSubTab === 'equipe') setSelectedCard('equipe');
    else if (initialSubTab === 'espaco') setSelectedCard('espaco');
    else if (initialSubTab === 'dados') setSelectedCard('dados');
    else if (initialSubTab === 'visual') setSelectedCard('visual');
    else if (initialSubTab === 'layout') setSelectedCard('layout');
    else if (initialSubTab === 'financeiro') setSelectedCard('financeiro');
    else if (initialSubTab === 'utilidades') setSelectedCard('utilidades');
    else if (initialSubTab === 'hub') setSelectedCard(null);
  }, [initialSubTab]);

  const sectionHeaderStyleData = React.useMemo(() => {
    return getSectionHeaderStyleData(adminSettings, isDark);
  }, [adminSettings, isDark]);

  const getThemeBadgeLabel = () => {
    const isCust = Boolean(adminSettings.themeExplicitlyCustomized ?? themeExplicitlyCustomized);
    if (!isCust && !isDark) return 'Default Neutro';
    const norm = normalizeHex(adminSettings.accentColor);
    const match = QUICK_THEME_PRESETS.find((p) => p.hex.toLowerCase() === (norm || '').toLowerCase());
    if (match && match.id !== DEFAULT_NEUTRAL_PRESET_ID) return match.label;
    return norm || 'Personalizado';
  };

  const handleConfirmDefaultReset = async (keepLogos: boolean) => {
    resetToDefaultPalette();
    setTheme('light', { isExplicitUserChoice: false });
    if (!keepLogos) {
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
      ...(keepLogos
        ? {}
        : {
            salonLogo: '',
            salonLogoLight: '',
            salonLogoDark: '',
            salonIcon: '',
            logoTextFallback: '',
          }),
    });
    hapticSuccess();
  };

  // Cards unificados do menu Preferências: Dados do negócio + Visual & Layout
  const cards = [
    {
      id: 'dados' as ManagementCardId,
      title: 'Dados do negócio',
      description: 'Informações comerciais e fiscais do estabelecimento',
      icon: Building2,
      badge: adminSettings.cnpj ? 'CNPJ Ativo' : 'Comercial & Fiscal',
    },
    {
      id: 'visual' as ManagementCardId,
      title: 'Visual & Layout',
      description: 'Tema neutro/cores em cascata, logotipos, topo e barra inferior',
      icon: Palette,
      badge: getThemeBadgeLabel(),
    },
  ];

  // SUB-VIEW: 1. Dados do Negócio
  if (selectedCard === 'dados') {
    return (
      <BusinessDataCardView
        adminSettings={adminSettings}
        onUpdateSettings={onUpdateSettings}
        professionals={professionals}
        onUpdateProfessionals={onUpdateProfessionals}
        onBack={() => {
          hapticLight();
          if (initialSubTab === 'dados') {
            if (onBack) onBack();
          } else {
            setSelectedCard(null);
          }
        }}
      />
    );
  }

  // SUB-VIEW UNIFICADA: 2. Visual & Layout (Tema & Cores / Marca & Logos / Estrutura)
  if (selectedCard === 'visual' || selectedCard === 'layout') {
    return (
      <SalonDesignStudioView
        initialTab={selectedCard === 'layout' ? 'estrutura' : 'tema'}
        adminSettings={adminSettings}
        onUpdateSettings={onUpdateSettings}
        onBack={() => {
          hapticLight();
          if (initialSubTab === 'visual' || initialSubTab === 'layout') {
            if (onBack) onBack();
          } else {
            setSelectedCard(null);
          }
        }}
      />
    );
  }

  // SUB-VIEW: 4. Serviços
  if (selectedCard === 'servicos') {
    return (
      <div className={`w-full h-full flex flex-col justify-between overflow-hidden ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
        <div className={`px-3 py-2.5 border-b shrink-0 flex items-center justify-between gap-2 ${
          isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                if (initialSubTab === 'servicos') {
                  if (onBack) onBack();
                } else {
                  setSelectedCard(null);
                }
              }}
              className={`p-1.5 rounded transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Voltar ao Menu"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-bold font-['Poppins']">
                Serviços & Preços
              </h2>
            </div>
          </div>
        </div>
        <div className="w-full flex-1 min-h-0 overflow-hidden flex flex-col">
          <ProfessionalServicesManager
            services={services}
            onUpdateServices={onUpdateServices}
          />
        </div>
      </div>
    );
  }

  // SUB-VIEW: 4. Equipe & Turnos
  if (selectedCard === 'equipe') {
    return (
      <div className={`w-full h-full flex flex-col justify-between overflow-hidden ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
        <div className={`px-3 py-2.5 border-b shrink-0 flex items-center justify-between gap-2 ${
          isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                if (initialSubTab === 'equipe') {
                  if (onBack) onBack();
                } else {
                  setSelectedCard(null);
                }
              }}
              className={`p-1.5 rounded transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Voltar ao Menu"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 brand-icon shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold font-['Poppins']">
                Equipe & Escalas de Atendimento
              </h2>
            </div>
          </div>
          <span className="text-[10px] font-bold brand-text font-mono">
            Sincronizado Supabase
          </span>
        </div>
        <div className="w-full flex-1 min-h-0 overflow-hidden flex flex-col">
          <TeamManager
            salonProfessionals={professionals}
            onUpdateSalonProfessionals={onUpdateProfessionals}
            services={services}
          />
        </div>
      </div>
    );
  }

  // SUB-VIEW: 4B. Espaço (Estrutura, Localização & Contatos)
  if (selectedCard === 'espaco') {
    return (
      <ProfessionalSpaceManager
        adminSettings={adminSettings}
        onUpdateSettings={onUpdateSettings}
        professionals={professionals}
        onUpdateProfessionals={onUpdateProfessionals}
        onBack={() => {
          hapticLight();
          if (initialSubTab === 'espaco') {
            if (onBack) onBack();
          } else {
            setSelectedCard(null);
          }
        }}
      />
    );
  }

  // SUB-VIEW: 5. Financeiro & Pagamentos
  if (selectedCard === 'financeiro') {
    return (
      <div className={`w-full h-full flex flex-col justify-between overflow-hidden ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}>
        <div className={`px-3 py-2.5 border-b shrink-0 flex items-center justify-between gap-2 ${
          isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                if (onBack) onBack();
                else setSelectedCard(null);
              }}
              className={`p-1.5 rounded-[4px] transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Voltar ao Painel"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 brand-icon shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold font-['Poppins']">
                Financeiro & Caixa
              </h2>
            </div>
          </div>
          <span className="text-[10px] font-bold brand-btn px-2 py-0.5 rounded-[4px] shadow-xs">
            Visão Geral
          </span>
        </div>
        <div className="w-full flex-1 min-h-0 overflow-hidden flex flex-col">
          <FinancialManagerView
            appointments={appointments}
            onUpdateAppointments={onUpdateAppointments}
            salonName={adminSettings.salonName}
            currentPersona="admin"
            adminSettings={adminSettings}
            onUpdateSettings={onUpdateSettings}
          />
        </div>
      </div>
    );
  }

  // SUB-VIEW: 6. Utilidades & Ferramentas
  if (selectedCard === 'utilidades') {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        <UtilitiesAndToolsView
          appointments={appointments}
          services={services}
          onBack={() => {
            hapticLight();
            if (onBack) onBack();
            else setSelectedCard(null);
          }}
        />
      </div>
    );
  }

  // VISÃO PRINCIPAL DO HUB: CARDS DE ACESSO AO GERENCIAMENTO
  return (
    <div className={`w-full h-full flex flex-col overflow-y-auto no-scrollbar ${
      isDark ? 'bg-slate-950 text-white' : 'bg-[var(--brand-canvas-bg)] text-slate-900'
    }`}>
      {/* Cabeçalho Fixo do Gerenciamento */}
      <div
        className={sectionHeaderStyleData.containerClass}
        style={sectionHeaderStyleData.containerStyle}
      >
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onBack();
              }}
              className={`p-1.5 rounded-[4px] transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Voltar ao Menu"
              aria-label="Voltar ao Menu"
            >
              <ArrowLeft className="w-4 h-4" style={sectionHeaderStyleData.iconStyle} />
            </button>
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <Sliders className="w-4 h-4 shrink-0" style={sectionHeaderStyleData.iconStyle} />
            <h1 className="text-xs sm:text-sm font-bold font-['Poppins'] tracking-tight truncate" style={sectionHeaderStyleData.titleStyle}>
              Preferências
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setIsDefaultModalOpen(true);
            }}
            className={`text-[10px] font-bold px-2 py-1 rounded-[4px] border flex items-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
            title="Restaurar tema Default neutro"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Default</span>
          </button>

          <span className="text-[10px] font-bold px-2 py-1 rounded-[4px] border uppercase tracking-wider flex items-center gap-1 brand-soft-badge whitespace-nowrap">
            <ShieldCheck className="w-3 h-3" />
            Admin Dono
          </span>
        </div>
      </div>

      {/* Grid de Cards de Acesso */}
      <div className="p-3.5 space-y-2.5 max-w-2xl mx-auto w-full pb-20">
        {/* Banner Informativo Sintético */}
        <div className={`px-3 py-2 rounded-[4px] border flex items-center justify-between text-xs ${
          isDark ? 'bg-slate-900/70 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 brand-icon shrink-0" />
            <span className="text-[11px] font-medium truncate">
              Dados do negócio, tema em cascata e layout unificados
            </span>
          </div>
          <span className="text-[10px] font-mono brand-text font-bold shrink-0">
            {cards.length} Cards
          </span>
        </div>

        {/* Lista de Cards de Acesso */}
        <div className="grid grid-cols-1 gap-2.5">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setSelectedCard(card.id);
                }}
                className={`p-3.5 rounded-[4px] border text-left transition cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99] ${
                  isDark
                    ? 'bg-slate-900/90 border-slate-800 hover:border-[var(--brand-primary)] hover:bg-slate-900'
                    : 'bg-white border-slate-200 hover:border-[var(--brand-primary)] hover:bg-slate-50 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-[4px] border flex items-center justify-center shrink-0 transition group-hover:scale-105 ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 brand-icon'
                      : 'brand-soft-badge'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold font-['Poppins'] transition">
                        {card.title}
                      </h2>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-[4px] border uppercase tracking-wider flex items-center gap-1 whitespace-nowrap ${
                        isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        {card.id === 'visual' && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0 border border-black/15"
                            style={{ backgroundColor: normalizeHex(adminSettings.accentColor) || DEFAULT_NEUTRAL_HEX }}
                          />
                        )}
                        <span>{card.badge}</span>
                      </span>
                    </div>
                    <p className={`text-[10.5px] mt-0.5 line-clamp-1 leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center text-slate-400 group-hover:translate-x-0.5 transition">
                  <ChevronRight className="w-4 h-4 brand-icon" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <DefaultThemeConfirmModal
        isOpen={isDefaultModalOpen}
        isDark={isDark}
        onClose={() => setIsDefaultModalOpen(false)}
        onConfirm={handleConfirmDefaultReset}
      />
    </div>
  );
};
