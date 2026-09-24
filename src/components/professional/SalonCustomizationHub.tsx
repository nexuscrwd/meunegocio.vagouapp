import React, { useState } from 'react';
import { 
  Building2, Palette, Scissors, Users, DollarSign, 
  ArrowLeft, ChevronRight, ShieldCheck, Sparkles,
  MapPin, Clock, Store, Wrench
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { 
  SalonAdminSettings, CatalogServiceItem, SalonProfessionalItem, 
  BookingAppointment 
} from '../../types';
import { hapticLight } from '../../utils/haptics';
import { BusinessDataCardView } from './BusinessDataCardView';
import { VisualIdentityCardView } from './VisualIdentityCardView';
import { ProfessionalServicesManager } from './ProfessionalServicesManager';
import { TeamManager } from './TeamManager';
import { FinancialManagerView } from './FinancialManagerView';
import { UtilitiesAndToolsView } from './UtilitiesAndToolsView';

export type ManagementCardId = 'dados' | 'visual' | 'servicos' | 'equipe' | 'financeiro' | 'utilidades';

export interface SalonCustomizationHubProps {
  initialSubTab?: ManagementCardId | 'hub' | 'espaco';
  adminSettings: SalonAdminSettings;
  onUpdateSettings: (settings: Partial<SalonAdminSettings>) => void;
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
  const { isDark } = useTheme();

  // Mapeamento de sub-abas antigas para os novos cards se vier via props
  const initialCard: ManagementCardId | null = 
    initialSubTab === 'servicos' ? 'servicos' :
    initialSubTab === 'equipe' ? 'equipe' :
    initialSubTab === 'dados' ? 'dados' :
    initialSubTab === 'visual' ? 'visual' :
    initialSubTab === 'financeiro' ? 'financeiro' :
    initialSubTab === 'utilidades' ? 'utilidades' :
    null;

  const [selectedCard, setSelectedCard] = useState<ManagementCardId | null>(initialCard);

  const getAccentBadge = (colorHex?: string) => {
    if (!colorHex) return 'Esmeralda';
    const c = colorHex.toLowerCase();
    if (c === '#10b981') return 'Esmeralda';
    if (c === '#3b82f6') return 'Azul Real';
    if (c === '#f59e0b') return 'Âmbar Ouro';
    if (c === '#ef4444') return 'Rubi';
    if (c === '#8b5cf6') return 'Violeta';
    return colorHex.toUpperCase();
  };

  const cards = [
    {
      id: 'dados' as ManagementCardId,
      title: 'Dados do Negócio',
      description: 'Nome fantasia, CNPJ, localização com busca CEP, horários e responsável legal',
      icon: Building2,
      badge: adminSettings.cnpj ? 'CNPJ Ativo' : 'Endereço & Horários',
      highlightColor: 'emerald',
    },
    {
      id: 'visual' as ManagementCardId,
      title: 'Identidade Visual',
      description: 'Cor de destaque, logo do cabeçalho do app e ícone mobile (PWA)',
      icon: Palette,
      badge: getAccentBadge(adminSettings.accentColor),
      highlightColor: 'blue',
    },
    {
      id: 'servicos' as ManagementCardId,
      title: 'Serviços & Preços',
      description: 'Catálogo de serviços, categorias, valores, durações e destaques do cardápio',
      icon: Scissors,
      badge: `${services.length} ${services.length === 1 ? 'Serviço' : 'Serviços'}`,
      highlightColor: 'purple',
    },
    {
      id: 'equipe' as ManagementCardId,
      title: 'Equipe & Turnos',
      description: 'Colaboradores, turnos de atendimento, escalas de trabalho e taxas de comissão',
      icon: Users,
      badge: 'Escalas & Membros',
      highlightColor: 'amber',
    },
    {
      id: 'financeiro' as ManagementCardId,
      title: 'Financeiro & Pagamentos',
      description: 'Faturamento em tempo real, formas de pagamento, repasses e relatórios',
      icon: DollarSign,
      badge: 'Caixa & Métricas',
      highlightColor: 'emerald',
    },
    {
      id: 'utilidades' as ManagementCardId,
      title: 'Utilidades & Ferramentas',
      description: 'Água e luz, medição de relógios, auditoria de fugas, previsão de insumos e bancada',
      icon: Wrench,
      badge: 'Eficiência & Estoque',
      highlightColor: 'emerald',
    },
  ];

  // SUB-VIEW: 1. Dados do Negócio
  if (selectedCard === 'dados') {
    return (
      <BusinessDataCardView
        adminSettings={adminSettings}
        onUpdateSettings={onUpdateSettings}
        onBack={() => {
          hapticLight();
          setSelectedCard(null);
        }}
      />
    );
  }

  // SUB-VIEW: 2. Identidade Visual
  if (selectedCard === 'visual') {
    return (
      <VisualIdentityCardView
        adminSettings={adminSettings}
        onUpdateSettings={onUpdateSettings}
        onBack={() => {
          hapticLight();
          setSelectedCard(null);
        }}
      />
    );
  }

  // SUB-VIEW: 3. Serviços
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
                setSelectedCard(null);
              }}
              className={`p-1.5 rounded transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Voltar ao Gerenciamento"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-emerald-500 shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold font-['Poppins']">
                Serviços & Preços
              </h2>
            </div>
          </div>
          <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded shadow-xs">
            {services.length} Ativos
          </span>
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
                setSelectedCard(null);
              }}
              className={`p-1.5 rounded transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Voltar ao Gerenciamento"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-500 shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold font-['Poppins']">
                Equipe & Escalas de Atendimento
              </h2>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-400 font-mono">
            Multi-Colaboradores
          </span>
        </div>
        <div className="w-full flex-1 min-h-0 overflow-hidden flex flex-col">
          <TeamManager />
        </div>
      </div>
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
                setSelectedCard(null);
              }}
              className={`p-1.5 rounded transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Voltar ao Gerenciamento"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-500 shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold font-['Poppins']">
                Financeiro & Caixa
              </h2>
            </div>
          </div>
          <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded shadow-xs">
            Visão Geral
          </span>
        </div>
        <div className="w-full flex-1 min-h-0 overflow-hidden flex flex-col">
          <FinancialManagerView
            appointments={appointments}
            onUpdateAppointments={onUpdateAppointments}
            salonName={adminSettings.salonName}
            currentPersona="admin"
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
            setSelectedCard(null);
          }}
        />
      </div>
    );
  }

  // VISÃO PRINCIPAL DO HUB: CARDS DE ACESSO AO GERENCIAMENTO
  return (
    <div className={`w-full h-full flex flex-col overflow-y-auto no-scrollbar ${
      isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Cabeçalho Fixo do Gerenciamento */}
      <div className={`px-3.5 py-3 border-b shrink-0 flex items-center justify-between gap-2 sticky top-0 z-30 ${
        isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onBack();
              }}
              className={`p-1.5 rounded transition cursor-pointer active:scale-95 ${
                isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
              }`}
              title="Voltar ao Painel"
              aria-label="Voltar ao Painel"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 min-w-0">
            <Store className="w-4 h-4 text-emerald-500 shrink-0" />
            <h1 className="text-xs sm:text-sm font-bold font-['Poppins'] tracking-tight truncate">
              Gerenciamento
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
            isDark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            Admin Dono
          </span>
        </div>
      </div>

      {/* Grid de Cards de Acesso */}
      <div className="p-3.5 space-y-2.5 max-w-2xl mx-auto w-full pb-20">
        
        {/* Banner Informativo Sintético */}
        <div className={`px-3 py-2 rounded border flex items-center justify-between text-xs ${
          isDark ? 'bg-slate-900/70 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-medium">
              Configure as informações vitais do seu estabelecimento
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0">
            5 Módulos
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
                className={`p-3.5 rounded border text-left transition cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.99] ${
                  isDark 
                    ? 'bg-slate-900/90 border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900' 
                    : 'bg-white border-slate-200 hover:border-emerald-500/60 hover:bg-slate-50 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded border flex items-center justify-center shrink-0 transition group-hover:scale-105 ${
                    isDark 
                      ? 'bg-slate-950 border-slate-800 text-emerald-400 group-hover:border-emerald-500/50' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-600 group-hover:border-emerald-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold font-['Poppins'] group-hover:text-emerald-400 transition">
                        {card.title}
                      </h2>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider flex items-center gap-1 ${
                        isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        {card.id === 'visual' && (
                          <span 
                            className="w-2 h-2 rounded-full shrink-0 shadow-2xs border border-white/20" 
                            style={{ backgroundColor: adminSettings.accentColor || '#10b981' }} 
                          />
                        )}
                        <span>{card.badge}</span>
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-400 mt-0.5 line-clamp-1 leading-snug">
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
