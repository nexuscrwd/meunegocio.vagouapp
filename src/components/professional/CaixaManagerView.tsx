import React, { useMemo } from 'react';
import {
  ArrowLeft
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { BookingAppointment, UserPersona, SalonAdminSettings } from '../../types';
import { hapticLight } from '../../utils/haptics';
import { FinancialManagerView } from './FinancialManagerView';
import { GoalsAndShiftsCard } from './dashboard/GoalsAndShiftsCard';
import { getSectionHeaderStyleData } from '../../utils/sectionHeaderStyle';

export interface CaixaManagerViewProps {
  appointments: BookingAppointment[];
  onUpdateAppointments?: (appointments: BookingAppointment[]) => void;
  salonName?: string;
  currentPersona?: UserPersona;
  activeProId?: string;
  matchesSelectedPro?: (app: BookingAppointment) => boolean;
  onNavigateTab?: (tab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades' | 'dados' | 'visual') => void;
  onBack?: () => void;
  adminSettings?: SalonAdminSettings;
  onUpdateSettings?: (settings: Partial<SalonAdminSettings>) => Promise<any> | void;
}

export const CaixaManagerView: React.FC<CaixaManagerViewProps> = ({
  appointments = [],
  onUpdateAppointments,
  salonName = 'Meu Estabelecimento',
  currentPersona = 'admin',
  matchesSelectedPro,
  onNavigateTab: _onNavigateTab,
  onBack,
  adminSettings,
  onUpdateSettings,
}) => {
  const { isDark } = useTheme();
  const sectionHeaderStyleData = useMemo(
    () => getSectionHeaderStyleData(adminSettings || {}, isDark),
    [adminSettings, isDark]
  );

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

  return (
    <div className={`w-full h-full flex flex-col min-h-0 select-none overflow-hidden ${
      isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
    }`}>

      <header
        className={sectionHeaderStyleData.containerClass}
        style={sectionHeaderStyleData.containerStyle}
      >
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <button
              type="button"
              id="btn-back-caixa"
              onClick={() => {
                hapticLight();
                onBack();
              }}
              className={`p-1.5 rounded-[4px] transition active:scale-95 cursor-pointer shrink-0 ${
                isDark
                  ? 'hover:bg-slate-800/80'
                  : 'hover:bg-black/5'
              }`}
              title="Voltar ao Menu"
              aria-label="Voltar ao Menu"
            >
              <ArrowLeft className="w-4 h-4" style={sectionHeaderStyleData.iconStyle} />
            </button>
          )}

          <div className="flex items-center gap-1.5 min-w-0">
            <h1
              className="text-xs sm:text-sm font-bold font-['Poppins'] tracking-tight truncate"
              style={sectionHeaderStyleData.titleStyle}
            >
              Caixa
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-3 sm:p-4 space-y-4 max-w-3xl mx-auto w-full pb-10">
        <FinancialManagerView
          appointments={appointments}
          onUpdateAppointments={onUpdateAppointments}
          salonName={salonName}
          currentPersona={currentPersona}
          hideHeader={true}
          hideTabs={false}
          initialTab="caixa"
          variant="caixa"
          adminSettings={adminSettings}
          onUpdateSettings={onUpdateSettings}
        />

        <GoalsAndShiftsCard
          dailyAmount={todayRealizedRevenue}
          appointments={appointments}
          matchesSelectedPro={matchesSelectedPro}
        />
      </div>
    </div>
  );
};
