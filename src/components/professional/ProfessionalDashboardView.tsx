import React from 'react';
import { 
  CheckCircle2, Clock, Calendar, Scissors, Users, 
  Store, Plus, ArrowRight, MessageCircle, DollarSign,
  TrendingUp, Power, UserCheck, Eye, LogOut
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import { BookingAppointment, SalonAdminSettings } from '../../types';
import { CatalogServiceItem } from '../SalonBookingModal';

interface ProfessionalDashboardViewProps {
  salonName: string;
  adminSettings?: SalonAdminSettings;
  onUpdateSettings?: (settings: Partial<SalonAdminSettings>) => void;
  services: CatalogServiceItem[];
  appointments: BookingAppointment[];
  onNavigateTab: (tab: 'servicos' | 'vagas' | 'espaco') => void;
  onOpenNewServiceModal?: () => void;
  onOpenNewAppointmentModal?: () => void;
  onOpenNewService?: () => void;
  onOpenNewAppointment?: () => void;
  onLogout: () => void;
}

export const ProfessionalDashboardView: React.FC<ProfessionalDashboardViewProps> = ({
  salonName,
  adminSettings = { isOpenNow: true, salonName: 'Barbearia', salonPhone: '', salonAddress: '', openingHours: '', pinCode: '1234' },
  onUpdateSettings,
  services,
  appointments,
  onNavigateTab,
  onOpenNewServiceModal,
  onOpenNewAppointmentModal,
  onOpenNewService,
  onOpenNewAppointment,
  onLogout,
}) => {
  const { isDark } = useTheme();

  // Unified modal handlers
  const handleOpenNewService = onOpenNewServiceModal || onOpenNewService || (() => onNavigateTab('servicos'));
  const handleOpenNewAppointment = onOpenNewAppointmentModal || onOpenNewAppointment || (() => onNavigateTab('vagas'));

  // Safe isOpenNow check
  const isOpenNow = adminSettings?.isOpenNow ?? true;

  // Filtrar agendamentos de hoje
  const todayAppointments = appointments.filter(
    (app) => app.dayGroup === 'Hoje' || app.dateTime?.toLowerCase().includes('hoje')
  );

  const confirmedToday = todayAppointments.filter((a) => a.status === 'CONFIRMADO');
  const completedToday = todayAppointments.filter((a) => a.status === 'CONCLUÍDO');
  
  // Faturamento estimado do dia
  const estimatedRevenue = todayAppointments
    .filter((a) => a.status !== 'CANCELADO')
    .reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

  // Próximo atendimento
  const nextAppointment = confirmedToday[0] || appointments.find((a) => a.status === 'CONFIRMADO');

  const handleToggleOpenStatus = () => {
    hapticSuccess();
    const nextStatus = !isOpenNow;
    onUpdateSettings?.({ isOpenNow: nextStatus });
  };

  return (
    <div className="w-full h-full flex flex-col justify-start overflow-y-auto px-3.5 sm:px-4 py-3 space-y-3.5 no-scrollbar">
      {/* 1. STATUS OPERACIONAL E BOAS-VINDAS DO GESTOR */}
      <div className={`p-3.5 rounded-lg border transition-colors ${
        isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 font-['Poppins']">
                Painel do Profissional
              </span>
            </div>
            <h2 className={`text-base sm:text-lg font-bold truncate leading-tight font-['Poppins'] mt-0.5 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {salonName}
            </h2>
          </div>

          {/* Botão de Toggle do Estabelecimento (Aberto / Fechado) */}
          <button
            type="button"
            onClick={handleToggleOpenStatus}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-bold transition active:scale-95 cursor-pointer whitespace-nowrap ${
              isOpenNow
                ? 'bg-[#20C933] text-white shadow-[0_0_12px_rgba(32,201,51,0.3)]'
                : isDark
                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                : 'bg-slate-100 text-slate-600 border border-slate-300'
            }`}
          >
            <Power className="w-3.5 h-3.5 text-white" />
            <span>{isOpenNow ? 'ABERTO AGORA' : 'FECHADO'}</span>
          </button>
        </div>
      </div>

      {/* 2. MÉTRICAS RÁPIDAS DO DIA (ESTATÍSTICAS OBJETIVAS) */}
      <div className="grid grid-cols-3 gap-2">
        {/* Atendimentos Hoje */}
        <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Hoje</span>
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className={`text-lg font-black font-['Poppins'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {todayAppointments.length}
          </span>
          <span className="text-[9px] text-emerald-400 font-medium">
            {confirmedToday.length} confirmados
          </span>
        </div>

        {/* Faturamento Previsto */}
        <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Previsto</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className={`text-lg font-black font-['Poppins'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
            R$ {estimatedRevenue}
          </span>
          <span className="text-[9px] text-slate-400 font-medium">
            em atendimentos
          </span>
        </div>

        {/* Serviços Ativos */}
        <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider">Catálogo</span>
            <Scissors className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className={`text-lg font-black font-['Poppins'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {services.length}
          </span>
          <span className="text-[9px] text-slate-400 font-medium">
            serviços ativos
          </span>
        </div>
      </div>

      {/* 3. PRÓXIMO ATENDIMENTO EM DESTAQUE */}
      {nextAppointment ? (
        <div className={`p-3.5 rounded-lg border transition-colors ${
          isDark ? 'bg-slate-900/90 border-emerald-500/40' : 'bg-emerald-50/50 border-emerald-500/40'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-emerald-400" />
              Próximo Atendimento
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-white">
              {nextAppointment.time || nextAppointment.dateTime}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {nextAppointment.service}
              </h3>
              <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'} mt-0.5 truncate`}>
                Profissional: <span className="font-semibold">{nextAppointment.professional || 'Geral'}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                onNavigateTab('vagas');
              }}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
            >
              <span>Ver na Agenda</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className={`p-3.5 rounded-lg border text-center ${
          isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
        }`}>
          <p className="text-xs">Nenhum atendimento pendente para hoje.</p>
        </div>
      )}

      {/* 4. ATALHOS DE GESTÃO RÁPIDA (ACESSO DIRETO ÀS ABAS) */}
      <div className="space-y-2">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Ações Rápidas de Gestão
        </span>

        <div className="grid grid-cols-2 gap-2">
          {/* Atalho 1: Cadastrar Serviço */}
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onOpenNewServiceModal();
            }}
            className={`p-3 rounded-lg border text-left transition active:scale-95 cursor-pointer flex items-center gap-2.5 ${
              isDark 
                ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-white' 
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-900'
            }`}
          >
            <div className="w-8 h-8 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold block truncate">Novo Serviço</span>
              <span className="text-[10px] text-slate-400 block truncate">Adicionar ao catálogo</span>
            </div>
          </button>

          {/* Atalho 2: Novo Encaixe na Agenda */}
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onOpenNewAppointmentModal();
            }}
            className={`p-3 rounded-lg border text-left transition active:scale-95 cursor-pointer flex items-center gap-2.5 ${
              isDark 
                ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-white' 
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-900'
            }`}
          >
            <div className="w-8 h-8 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold block truncate">Novo Encaixe</span>
              <span className="text-[10px] text-slate-400 block truncate">Agendamento manual</span>
            </div>
          </button>

          {/* Atalho 3: Gerenciar Catálogo */}
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onNavigateTab('servicos');
            }}
            className={`p-3 rounded-lg border text-left transition active:scale-95 cursor-pointer flex items-center gap-2.5 ${
              isDark 
                ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-white' 
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-900'
            }`}
          >
            <div className="w-8 h-8 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0">
              <Scissors className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold block truncate">Ver Serviços</span>
              <span className="text-[10px] text-slate-400 block truncate">{services.length} procedimentos</span>
            </div>
          </button>

          {/* Atalho 4: Editar Dados do Espaço */}
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onNavigateTab('espaco');
            }}
            className={`p-3 rounded-lg border text-left transition active:scale-95 cursor-pointer flex items-center gap-2.5 ${
              isDark 
                ? 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-white' 
                : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-900'
            }`}
          >
            <div className="w-8 h-8 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold block truncate">Editar Espaço</span>
              <span className="text-[10px] text-slate-400 block truncate">Endereço & Equipe</span>
            </div>
          </button>
        </div>
      </div>

      {/* 5. BOTÃO DE LOGOUT DO MODO PROFISSIONAL */}
      <div className="pt-2 pb-4">
        <button
          type="button"
          onClick={() => {
            hapticLight();
            onLogout();
          }}
          className={`w-full py-2.5 px-4 rounded-lg border transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 text-xs font-bold ${
            isDark
              ? 'bg-slate-900 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border-slate-800 hover:border-rose-500/40'
              : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border-slate-200 hover:border-rose-300'
          }`}
        >
          <LogOut className="w-4 h-4" />
          <span>Sair do Modo Profissional (Voltar ao Modo Cliente)</span>
        </button>
      </div>
    </div>
  );
};
