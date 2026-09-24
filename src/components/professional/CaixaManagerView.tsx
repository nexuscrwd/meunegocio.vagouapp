import React, { useMemo } from 'react';
import { 
  ArrowLeft
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { BookingAppointment, UserPersona } from '../../types';
import { hapticLight } from '../../utils/haptics';
import { FinancialManagerView } from './FinancialManagerView';
import { GoalsAndShiftsCard } from './dashboard/GoalsAndShiftsCard';
import { WeeklyGoalsAndDaysCard } from './dashboard/WeeklyGoalsAndDaysCard';

export interface CaixaManagerViewProps {
  appointments: BookingAppointment[];
  onUpdateAppointments?: (appointments: BookingAppointment[]) => void;
  salonName?: string;
  currentPersona?: UserPersona;
  activeProId?: string;
  matchesSelectedPro?: (app: BookingAppointment) => boolean;
  onNavigateTab?: (tab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades') => void;
  onBack?: () => void;
}

export const CaixaManagerView: React.FC<CaixaManagerViewProps> = ({
  appointments = [],
  onUpdateAppointments,
  salonName = 'Meu Estabelecimento',
  currentPersona = 'admin',
  matchesSelectedPro,
  onNavigateTab: _onNavigateTab,
  onBack,
}) => {
  const { isDark } = useTheme();

  // Faturamento Realizado no Dia de Hoje (Conexão direta com Caixa e Metas)
  const todayRealizedRevenue = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let total = 0;

    appointments.forEach((app) => {
      if (matchesSelectedPro && !matchesSelectedPro(app)) return;

      const st = (app.status || '').toUpperCase();
      if (st === 'CANCELADO') return;

      let appDate = new Date();
      if (app.dateIso) {
        appDate = new Date(app.dateIso + 'T00:00:00');
      } else {
        const match = app.dateTime?.match(/(\d{2})\/(\d{2})/);
        if (match) {
          appDate = new Date(now.getFullYear(), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
        } else if (app.dayGroup === 'Hoje' || app.dateTime?.includes('Hoje')) {
          appDate = new Date();
        }
      }

      if (appDate >= todayStart && appDate <= todayEnd) {
        if (st === 'CONCLUÍDO' || st === 'CONFIRMADO' || st === 'FINALIZADO') {
          total += Number(app.totalPrice) || 50;
        }
      }
    });

    return total;
  }, [appointments, matchesSelectedPro]);

  // Faturamento Realizado na Semana Atual (Segunda a Domingo)
  const weekRealizedRevenue = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);

    let total = 0;
    appointments.forEach((app) => {
      if (matchesSelectedPro && !matchesSelectedPro(app)) return;

      const st = (app.status || '').toUpperCase();
      if (st === 'CANCELADO') return;

      let appDate = new Date();
      if (app.dateIso) {
        appDate = new Date(app.dateIso + 'T00:00:00');
      } else {
        const match = app.dateTime?.match(/(\d{2})\/(\d{2})/);
        if (match) {
          appDate = new Date(now.getFullYear(), parseInt(match[2], 10) - 1, parseInt(match[1], 10));
        } else if (app.dayGroup === 'Hoje' || app.dateTime?.includes('Hoje')) {
          appDate = new Date();
        }
      }

      if (appDate >= monday && appDate <= sunday) {
        if (st === 'CONCLUÍDO' || st === 'CONFIRMADO' || st === 'FINALIZADO') {
          total += Number(app.totalPrice) || 50;
        }
      }
    });

    return total;
  }, [appointments, matchesSelectedPro]);

  return (
    <div className={`w-full h-full flex flex-col min-h-0 select-none overflow-hidden ${
      isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* 1. CABEÇALHO UNIFICADO DA SEÇÃO CAIXA */}
      <header className={`px-4 py-3 border-b shrink-0 flex items-center justify-between gap-2 transition-colors ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              id="btn-back-caixa"
              onClick={() => {
                hapticLight();
                onBack();
              }}
              className={`p-1.5 rounded border transition active:scale-95 cursor-pointer shrink-0 ${
                isDark 
                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' 
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
              }`}
              title="Voltar ao Painel"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <h1 className="text-sm font-bold font-['Poppins'] tracking-tight truncate">
            Caixa & Financeiro
          </h1>
        </div>
      </header>

      {/* 2. CORPO ROLÁVEL COM A FERRAMENTA DO CAIXA (LAYOUT PLANO, SEM BORDA NEM CAIXA ANINHADA) */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-4 max-w-3xl mx-auto w-full pb-10">
        <FinancialManagerView
          appointments={appointments}
          onUpdateAppointments={onUpdateAppointments}
          salonName={salonName}
          currentPersona={currentPersona}
          hideHeader={true}
          hideTabs={true}
          initialTab="caixa"
          variant="caixa"
        />

        {/* Bloco 1: Metas e Evolução Financeira por Turno (Hoje: Manhã, Tarde, Noite) */}
        <GoalsAndShiftsCard
          dailyAmount={todayRealizedRevenue}
          appointments={appointments}
          matchesSelectedPro={matchesSelectedPro}
        />

        {/* Bloco 2: Metas e Ganhos Semanais (Segunda a Domingo) */}
        <WeeklyGoalsAndDaysCard
          weeklyAmount={weekRealizedRevenue}
          appointments={appointments}
          matchesSelectedPro={matchesSelectedPro}
        />
      </div>
    </div>
  );
};
