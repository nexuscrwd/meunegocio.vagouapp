import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Package, 
  ArrowLeft, 
  Wrench, 
  DollarSign, 
  Layers,
  Droplets,
  Building2,
  Gauge
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { BookingAppointment, CatalogServiceItem, UserPersona } from '../../types';
import { hapticLight } from '../../utils/haptics';
import { FinancialManagerView } from './FinancialManagerView';
import { ServicesAndSuppliesForecast } from './dashboard/ServicesAndSuppliesForecast';
import { EnergyMeterManager } from './consumption/EnergyMeterManager';
import { WaterConsumptionManager } from './consumption/WaterConsumptionManager';
import { OperationalEquipmentsManager } from './consumption/OperationalEquipmentsManager';
import { InfrastructureEquipmentsManager } from './consumption/InfrastructureEquipmentsManager';

export type UtilitiesSubTab = 
  | 'hub'
  | 'consumo_hub'
  | 'consumo_energia'
  | 'consumo_agua'
  | 'consumo_equip_operacionais'
  | 'consumo_equip_infra'
  | 'financeiro'
  | 'insumos'
  | 'bancada'
  | 'utilidades';

export interface UtilitiesAndToolsViewProps {
  appointments: BookingAppointment[];
  services?: CatalogServiceItem[];
  activeProId?: string;
  isOwner?: boolean;
  onBack?: () => void;
  salonName?: string;
  currentPersona?: UserPersona;
  initialSubTab?: UtilitiesSubTab;
  onUpdateAppointments?: (appointments: BookingAppointment[]) => void;
}

export const UtilitiesAndToolsView: React.FC<UtilitiesAndToolsViewProps> = ({
  appointments = [],
  services = [],
  activeProId,
  isOwner = true,
  onBack,
  salonName = 'Meu Estabelecimento',
  currentPersona = 'admin',
  initialSubTab = 'hub',
  onUpdateAppointments,
}) => {
  const { isDark } = useTheme();

  // Mapear rota inicial com compatibilidade retroativa
  const resolveInitialSubTab = (tab?: string): UtilitiesSubTab => {
    if (tab === 'bancada') return 'consumo_equip_operacionais';
    if (tab === 'utilidades') return 'consumo_hub';
    if (
      tab === 'consumo_hub' ||
      tab === 'consumo_energia' ||
      tab === 'consumo_agua' ||
      tab === 'consumo_equip_operacionais' ||
      tab === 'consumo_equip_infra' ||
      tab === 'financeiro' ||
      tab === 'insumos'
    ) {
      return tab;
    }
    return 'hub';
  };

  const [activeSubTab, setActiveSubTab] = useState<UtilitiesSubTab>(() => resolveInitialSubTab(initialSubTab));

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(resolveInitialSubTab(initialSubTab));
    }
  }, [initialSubTab]);

  // CARDS DA PORTA DE ENTRADA PRINCIPAL DE UTILIDADES (LAYOUT PLANO: ÍCONE E TÍTULO)
  const mainHubCards = [
    {
      id: 'consumo_hub' as const,
      name: 'Gestão de Consumo',
      icon: Gauge,
      iconColor: 'text-amber-400',
    },
    {
      id: 'financeiro' as const,
      name: 'Financeiro',
      icon: DollarSign,
      iconColor: 'text-emerald-400',
    },
    {
      id: 'insumos' as const,
      name: 'Insumos & Estoque',
      icon: Package,
      iconColor: 'text-purple-400',
    },
  ];

  // CARDS DA PORTA DE ENTRADA DE CONSUMO (SUB-HUB)
  const consumoCards = [
    {
      id: 'consumo_energia' as const,
      name: 'Energia Elétrica',
      icon: Zap,
      iconColor: 'text-amber-400',
    },
    {
      id: 'consumo_agua' as const,
      name: 'Água',
      icon: Droplets,
      iconColor: 'text-cyan-400',
    },
    {
      id: 'consumo_equip_operacionais' as const,
      name: 'Operação',
      icon: Wrench,
      iconColor: 'text-emerald-400',
    },
    {
      id: 'consumo_equip_infra' as const,
      name: 'Infraestrutura',
      icon: Building2,
      iconColor: 'text-blue-400',
    },
  ];

  // Helper de Navegação do Botão Voltar
  const isInsideConsumoTool = [
    'consumo_energia',
    'consumo_agua',
    'consumo_equip_operacionais',
    'consumo_equip_infra'
  ].includes(activeSubTab);

  const handleBackNavigation = () => {
    hapticLight();
    if (isInsideConsumoTool) {
      setActiveSubTab('consumo_hub');
    } else if (activeSubTab === 'consumo_hub' || activeSubTab === 'financeiro' || activeSubTab === 'insumos') {
      setActiveSubTab('hub');
    } else if (onBack) {
      onBack();
    }
  };

  // Título e Subtítulo dinâmicos do cabeçalho
  const getHeaderInfo = () => {
    switch (activeSubTab) {
      case 'consumo_hub':
        return {
          title: 'Gestão de Consumo',
          badge: 'Porta de Entrada',
          desc: 'Energia elétrica, água, operação e infraestrutura',
          icon: Gauge,
        };
      case 'consumo_energia':
        return {
          title: 'Energia Elétrica',
          badge: 'Consumo',
          desc: 'Previsão de fatura e medição do relógio',
          icon: Zap,
        };
      case 'consumo_agua':
        return {
          title: 'Água',
          badge: 'Consumo',
          desc: 'Previsão de fatura e controle de hidrômetro',
          icon: Droplets,
        };
      case 'consumo_equip_operacionais':
        return {
          title: 'Operação',
          badge: 'Equipamentos',
          desc: 'Equipamentos operacionais e bancada',
          icon: Wrench,
        };
      case 'consumo_equip_infra':
        return {
          title: 'Infraestrutura',
          badge: 'Equipamentos',
          desc: 'Eletrodomésticos, copa e climatização',
          icon: Building2,
        };
      case 'financeiro':
        return {
          title: 'Financeiro',
          badge: 'Ferramenta',
          desc: 'DRE, despesas, balanço e comissões',
          icon: DollarSign,
        };
      case 'insumos':
        return {
          title: 'Insumos & Estoque',
          badge: 'Ferramenta',
          desc: 'Previsão de produtos e suprimentos',
          icon: Package,
        };
      default:
        return {
          title: 'Utilidades & Ferramentas',
          badge: 'Porta de Entrada',
          desc: 'Selecione uma ferramenta operacional abaixo',
          icon: Layers,
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden select-none ${
      isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* 1. CABEÇALHO */}
      <header className={`p-3.5 border-b shrink-0 flex items-center justify-between gap-2 ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            id="utilidades-btn-voltar"
            onClick={handleBackNavigation}
            className={`p-1.5 rounded transition cursor-pointer ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
            }`}
            title={activeSubTab !== 'hub' ? 'Voltar' : 'Voltar ao Painel'}
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <h2 className="text-xs font-bold uppercase tracking-wider font-['Poppins'] truncate">
            {headerInfo.title}
          </h2>
        </div>

        {/* Atalhos Rápidos no Cabeçalho */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isInsideConsumoTool && (
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveSubTab('consumo_hub');
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded border flex items-center gap-1.5 transition cursor-pointer ${
                isDark 
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-300' 
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Consumo</span>
            </button>
          )}

          {activeSubTab !== 'hub' && (
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveSubTab('hub');
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded border flex items-center gap-1.5 transition cursor-pointer ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' 
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Todas as Ferramentas</span>
              <span className="sm:hidden">Menu</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. CORPO ROLÁVEL COM CONTEÚDO */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4 max-w-4xl mx-auto w-full">
        {/* PORTA DE ENTRADA PRINCIPAL: CARDS QUADRADOS DAS FERRAMENTAS */}
        {activeSubTab === 'hub' && (
          <div className="space-y-4 animate-in fade-in duration-150 py-1">
            {/* GRADE DE 3 CARDS LADO A LADO - COMPACTO E PROPORCIONAL (SEM ASPECT-SQUARE NEM ESPAÇOS VAZIOS) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {mainHubCards.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    id={`tool-card-${tool.id}`}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setActiveSubTab(tool.id);
                    }}
                    className={`w-full min-h-[78px] sm:min-h-[86px] rounded border py-3 px-2 flex flex-col justify-center items-center text-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 group hover:shadow-xs ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
                    }`}
                  >
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8] shrink-0 transition-transform duration-200 group-hover:scale-110 ${tool.iconColor}`} />

                    <h3 className={`font-bold font-['Poppins'] text-[11px] sm:text-xs tracking-tight line-clamp-2 leading-snug ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {tool.name}
                    </h3>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* SUB-HUB: PORTA DE ENTRADA DO GERENCIAMENTO DE CONSUMO */}
        {activeSubTab === 'consumo_hub' && (
          <div className="space-y-4 animate-in fade-in duration-150 py-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 shrink-0" />
                <span>Gestão de Consumo</span>
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}>
                4 Ferramentas
              </span>
            </div>

            {/* GRADE DE 4 CARDS - COMPACTO E PROPORCIONAL */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
              {consumoCards.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    id={`consumo-card-${tool.id}`}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setActiveSubTab(tool.id);
                    }}
                    className={`w-full min-h-[78px] sm:min-h-[86px] rounded border py-3 px-2 flex flex-col justify-center items-center text-center gap-1.5 transition-all duration-200 cursor-pointer active:scale-95 group hover:shadow-xs ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
                    }`}
                  >
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8] shrink-0 transition-transform duration-200 group-hover:scale-110 ${tool.iconColor}`} />

                    <h3 className={`font-bold font-['Poppins'] text-[11px] sm:text-xs tracking-tight line-clamp-2 leading-snug ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {tool.name}
                    </h3>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* FERRAMENTA CONSUMO 1: ENERGIA ELÉTRICA (REGISTRO DO RELÓGIO & LISTA) */}
        {activeSubTab === 'consumo_energia' && (
          <div className="animate-in fade-in duration-150">
            <EnergyMeterManager />
          </div>
        )}

        {/* FERRAMENTA CONSUMO 2: ÁGUA (CONSUMO BÁSICO & HIDRÔMETRO) */}
        {activeSubTab === 'consumo_agua' && (
          <div className="animate-in fade-in duration-150">
            <WaterConsumptionManager />
          </div>
        )}

        {/* FERRAMENTA CONSUMO 3: EQUIPAMENTOS OPERACIONAIS */}
        {activeSubTab === 'consumo_equip_operacionais' && (
          <div className="animate-in fade-in duration-150">
            <OperationalEquipmentsManager />
          </div>
        )}

        {/* FERRAMENTA CONSUMO 4: EQUIPAMENTOS DE INFRAESTRUTURA */}
        {activeSubTab === 'consumo_equip_infra' && (
          <div className="animate-in fade-in duration-150">
            <InfrastructureEquipmentsManager />
          </div>
        )}

        {/* FERRAMENTA GERAL 1: GESTÃO FINANCEIRA (DRE, Despesas, Balanço, Comissões) */}
        {activeSubTab === 'financeiro' && (
          <div className="animate-in fade-in duration-150">
            <FinancialManagerView
              appointments={appointments}
              onUpdateAppointments={onUpdateAppointments}
              salonName={salonName}
              currentPersona={currentPersona}
            />
          </div>
        )}

        {/* FERRAMENTA GERAL 2: INSUMOS & ESTOQUE */}
        {activeSubTab === 'insumos' && (
          <div className="animate-in fade-in duration-150 space-y-3">
            <ServicesAndSuppliesForecast
              appointments={appointments}
              services={services}
              activeProId={activeProId}
              isOwner={isOwner}
            />
          </div>
        )}
      </div>
    </div>
  );
};


