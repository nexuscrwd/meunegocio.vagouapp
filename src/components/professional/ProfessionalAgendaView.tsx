import React, { useState, useMemo } from 'react';
import { 
  Calendar, Clock, Check, X, MessageCircle, Plus, 
  User, Scissors, DollarSign, CalendarDays, ChevronLeft,
  ChevronRight, RotateCcw, CheckCircle2, AlertCircle
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight, hapticSuccess, hapticMedium } from '../../utils/haptics';
import { BookingAppointment } from '../../types';
import { CatalogServiceItem, SalonProfessionalItem } from '../SalonBookingModal';

interface ProfessionalAgendaViewProps {
  appointments: BookingAppointment[];
  onUpdateAppointments: (appointments: BookingAppointment[]) => void;
  services: CatalogServiceItem[];
  professionals: SalonProfessionalItem[];
  salonPhone?: string;
  isAddingNewFromQuickAction?: boolean;
  onCloseQuickAction?: () => void;
}

interface DayItem {
  key: string;
  dateIso: string;
  weekdayLabel: string;
  dayNumber: number;
  monthLabel: string;
  fullDateLabel: string;
  isToday: boolean;
  isTomorrow: boolean;
}

export const ProfessionalAgendaView: React.FC<ProfessionalAgendaViewProps> = ({
  appointments,
  onUpdateAppointments,
  services,
  professionals,
  salonPhone = '5511987654321',
  isAddingNewFromQuickAction = false,
  onCloseQuickAction,
}) => {
  const { isDark } = useTheme();

  // Data Selecionada - Por padrão: Hoje ('hoje')
  const [selectedDateKey, setSelectedDateKey] = useState<string>('hoje');
  const [isCalendarPickerOpen, setIsCalendarPickerOpen] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'CONFIRMADO' | 'CONCLUÍDO' | 'CANCELADO'>('TODOS');

  // Modal de Novo Encaixe
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState<boolean>(isAddingNewFromQuickAction);
  const [newClientName, setNewClientName] = useState<string>('');
  const [newClientPhone, setNewClientPhone] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(services[0]?.id || '');
  const [selectedProfessionalName, setSelectedProfessionalName] = useState<string>(professionals[0]?.name || 'Carlos Henrique');
  const [newTime, setNewTime] = useState<string>('14:00');
  const [newDayGroup, setNewDayGroup] = useState<string>('Hoje');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Gerar dias dinâmicos para a barra horizontal (Hoje + 13 próximos dias)
  const daysList: DayItem[] = useMemo(() => {
    const list: DayItem[] = [];
    const now = new Date();

    const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const fullMonths = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);

      const isToday = i === 0;
      const isTomorrow = i === 1;
      const dateIso = d.toISOString().split('T')[0];
      const key = isToday ? 'hoje' : isTomorrow ? 'amanha' : dateIso;

      let weekdayLabel = weekdays[d.getDay()];
      if (isToday) weekdayLabel = 'HOJE';
      else if (isTomorrow) weekdayLabel = 'AMANHÃ';

      const dayNumber = d.getDate();
      const monthLabel = months[d.getMonth()];
      const fullDateLabel = `${dayNumber} de ${fullMonths[d.getMonth()]}`;

      list.push({
        key,
        dateIso,
        weekdayLabel,
        dayNumber,
        monthLabel,
        fullDateLabel,
        isToday,
        isTomorrow,
      });
    }

    return list;
  }, []);

  // Informações do dia atualmente selecionado
  const currentSelectedDay = useMemo(() => {
    return daysList.find((d) => d.key === selectedDateKey) || daysList[0];
  }, [daysList, selectedDateKey]);

  // Contagem de agendamentos por dia
  const appointmentCountByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    appointments.forEach((app) => {
      const isToday = app.dayGroup === 'Hoje' || app.dateTime?.toLowerCase().includes('hoje');
      const isTomorrow = app.dayGroup === 'Amanhã' || app.dateTime?.toLowerCase().includes('amanhã');

      if (isToday) {
        counts['hoje'] = (counts['hoje'] || 0) + 1;
      } else if (isTomorrow) {
        counts['amanha'] = (counts['amanha'] || 0) + 1;
      }

      if (app.dateIso) {
        counts[app.dateIso] = (counts[app.dateIso] || 0) + 1;
      }
    });
    return counts;
  }, [appointments]);

  // Filtragem dos Agendamentos para o dia selecionado
  const filteredAppointments = useMemo(() => {
    return appointments.filter((app) => {
      // 1. Filtro por Data
      let matchesDate = false;
      if (selectedDateKey === 'hoje') {
        matchesDate = app.dayGroup === 'Hoje' || app.dateTime?.toLowerCase().includes('hoje') || app.dateIso === currentSelectedDay.dateIso;
      } else if (selectedDateKey === 'amanha') {
        matchesDate = app.dayGroup === 'Amanhã' || app.dateTime?.toLowerCase().includes('amanhã') || app.dateIso === currentSelectedDay.dateIso;
      } else {
        matchesDate = app.dateIso === selectedDateKey || app.dateTime?.includes(currentSelectedDay.fullDateLabel);
      }

      // 2. Filtro por Status
      let matchesStatus = true;
      if (statusFilter !== 'TODOS') {
        const normalizedAppStatus = app.status?.toUpperCase();
        matchesStatus = normalizedAppStatus === statusFilter || 
          (statusFilter === 'CONCLUÍDO' && normalizedAppStatus === 'CONCLUIDO');
      }

      return matchesDate && matchesStatus;
    }).sort((a, b) => {
      const timeA = a.time || (a.dateTime?.match(/\b\d{1,2}:\d{2}\b/)?.[0]) || '12:00';
      const timeB = b.time || (b.dateTime?.match(/\b\d{1,2}:\d{2}\b/)?.[0]) || '12:00';
      return timeA.localeCompare(timeB);
    });
  }, [appointments, selectedDateKey, currentSelectedDay, statusFilter]);

  // Estatísticas do dia selecionado
  const dayStats = useMemo(() => {
    const total = filteredAppointments.length;
    const confirmed = filteredAppointments.filter((a) => a.status?.toUpperCase().includes('CONFIRMADO')).length;
    const revenue = filteredAppointments
      .filter((a) => !a.status?.toUpperCase().includes('CANCELADO'))
      .reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

    return { total, confirmed, revenue };
  }, [filteredAppointments]);

  // Alterar Status do Agendamento
  const handleUpdateStatus = (protocolCode: string, newStatus: 'CONFIRMADO' | 'CONCLUÍDO' | 'CANCELADO') => {
    hapticSuccess();
    const updated = appointments.map((app) => {
      if (app.protocolCode === protocolCode) {
        return { ...app, status: newStatus };
      }
      return app;
    });
    onUpdateAppointments(updated);
    showToast(`Status atualizado para ${newStatus}!`);
  };

  // Enviar Mensagem no WhatsApp para o Cliente
  const handleContactClient = (app: BookingAppointment) => {
    hapticLight();
    const cleanPhone = (app.customerPhone || app.clientPhone || salonPhone).replace(/\D/g, '');
    const clientName = app.clientName || app.customerName || 'Cliente';
    const serviceName = app.serviceTitle || app.service || 'Atendimento';
    const timeDisplay = app.time || (app.dateTime?.match(/\b\d{1,2}:\d{2}\b/)?.[0]) || 'seu horário';

    const message = encodeURIComponent(
      `Olá ${clientName}! Aqui é da Barbearia confirmando seu atendimento de ${serviceName} às ${timeDisplay}. Podemos te esperar?`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  // Criar Novo Encaixe Manual
  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    const srv = services.find((s) => s.id === selectedServiceId) || services[0];
    const targetDayLabel = newDayGroup === 'Hoje' ? 'Hoje' : newDayGroup === 'Amanhã' ? 'Amanhã' : currentSelectedDay.fullDateLabel;

    const newAppointment: BookingAppointment = {
      id: `apt-${Date.now()}`,
      protocolCode: `VG-${Math.floor(1000 + Math.random() * 9000)}`,
      service: srv?.title || 'Corte Degradê / Fade Moderno',
      serviceTitle: srv?.title || 'Corte Degradê / Fade Moderno',
      professional: selectedProfessionalName,
      professionalName: selectedProfessionalName,
      salonName: 'Barbearia Rota 99',
      dateTime: `${targetDayLabel}, ${newTime}`,
      dayGroup: newDayGroup,
      time: newTime,
      dateIso: currentSelectedDay.dateIso,
      totalPrice: srv?.price || 55.0,
      status: 'CONFIRMADO',
      address: 'Rua das Flores, 1420 - Centro',
      customerName: newClientName.trim(),
      clientName: newClientName.trim(),
      customerPhone: newClientPhone.trim(),
      clientPhone: newClientPhone.trim(),
    };

    onUpdateAppointments([newAppointment, ...appointments]);
    hapticSuccess();
    showToast(`Encaixe de ${newClientName} agendado!`);

    setIsNewBookingModalOpen(false);
    setNewClientName('');
    setNewClientPhone('');
    onCloseQuickAction?.();
  };

  return (
    <div className="w-full h-full flex flex-col justify-start overflow-hidden relative">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-emerald-500 text-white font-bold text-xs shadow-xl animate-in fade-in flex items-center gap-1.5 whitespace-nowrap">
          <Check className="w-4 h-4 text-white stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. CABEÇALHO UNIFICADO DA AGENDA: TÍTULO, SELETOR DE DATA & CALENDÁRIO */}
      <div className={`p-3.5 border-b transition-colors shrink-0 space-y-3 ${
        isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        {/* Linha 1: Título e Botões de Ação */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <h3 className={`text-sm sm:text-base font-bold font-['Poppins'] flex items-center gap-1.5 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                Agenda de Horários
              </h3>
            </div>
            <p className={`text-[11px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {currentSelectedDay.isToday 
                ? `Hoje • ${currentSelectedDay.fullDateLabel}`
                : currentSelectedDay.isTomorrow
                ? `Amanhã • ${currentSelectedDay.fullDateLabel}`
                : currentSelectedDay.fullDateLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Botão de Abrir Mini-Calendário */}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setIsCalendarPickerOpen(!isCalendarPickerOpen);
              }}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                isCalendarPickerOpen
                  ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                  : isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/80'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
              }`}
              title="Abrir Calendário Completo"
              aria-label="Abrir Calendário Completo"
            >
              <CalendarDays className="w-4 h-4" />
              <span className="hidden xs:inline text-[11px]">Calendário</span>
            </button>

            {/* Botão de Novo Encaixe */}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setNewDayGroup(currentSelectedDay.isToday ? 'Hoje' : currentSelectedDay.isTomorrow ? 'Amanhã' : currentSelectedDay.fullDateLabel);
                setIsNewBookingModalOpen(true);
              }}
              className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-white stroke-[3]" />
              <span>NOVO ENCAIXE</span>
            </button>
          </div>
        </div>

        {/* Linha 2: Seletor Horizontal de Dias (Carrossel Interativo) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
          {daysList.map((day) => {
            const isSelected = selectedDateKey === day.key;
            const count = appointmentCountByDay[day.key] || 0;

            return (
              <button
                key={day.key}
                type="button"
                onClick={() => {
                  hapticLight();
                  setSelectedDateKey(day.key);
                  setIsCalendarPickerOpen(false);
                }}
                className={`shrink-0 flex flex-col items-center justify-center min-w-[58px] py-1.5 px-2 rounded-xl transition-all duration-150 cursor-pointer text-center relative ${
                  isSelected
                    ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/25 scale-[1.02]'
                    : isDark
                    ? 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {/* Rótulo do Dia (HOJE / AMANHÃ / SEX / SÁB) */}
                <span className={`text-[10px] tracking-wider uppercase leading-none font-bold ${
                  isSelected ? 'text-white' : 'text-slate-400'
                }`}>
                  {day.weekdayLabel}
                </span>

                {/* Número do Dia */}
                <span className={`text-base font-black leading-tight mt-0.5 font-['Poppins'] ${
                  isSelected ? 'text-white' : isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  {day.dayNumber}
                </span>

                {/* Indicador de Quantidade / Ponto */}
                <div className="flex items-center gap-1 mt-0.5">
                  {count > 0 ? (
                    <span className={`text-[9px] px-1 py-0.2 rounded-full font-extrabold ${
                      isSelected 
                        ? 'bg-white/20 text-white' 
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {count}
                    </span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600/40" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Linha 3: Mini-Calendário Integrado (Visível ao clicar em 'Calendário') */}
        {isCalendarPickerOpen && (
          <div className={`p-3 rounded-xl border animate-in slide-in-from-top-2 duration-200 ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60">
              <span className={`text-xs font-bold font-['Poppins'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Escolha uma data para visualizar os horários
              </span>
              <button
                type="button"
                onClick={() => setIsCalendarPickerOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((wd, i) => (
                <span key={i} className="text-[10px] font-bold text-slate-500 py-1">
                  {wd}
                </span>
              ))}

              {daysList.map((day) => {
                const isSelected = selectedDateKey === day.key;
                const count = appointmentCountByDay[day.key] || 0;

                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      setSelectedDateKey(day.key);
                      setIsCalendarPickerOpen(false);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : isDark
                        ? 'bg-slate-900 hover:bg-slate-800 text-slate-300'
                        : 'bg-white hover:bg-slate-200 text-slate-800 shadow-2xs'
                    }`}
                  >
                    <span>{day.dayNumber}</span>
                    {count > 0 && (
                      <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-emerald-400'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Linha 4: Resumo Rápido & Filtros de Status */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {dayStats.total} {dayStats.total === 1 ? 'atendimento' : 'atendimentos'}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-bold">
              R$ {dayStats.revenue.toFixed(2)}
            </span>
          </div>

          {/* Filtros Rápidos de Status */}
          <div className="flex items-center gap-1">
            {(['TODOS', 'CONFIRMADO', 'CONCLUÍDO'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  hapticLight();
                  setStatusFilter(st);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st === 'TODOS' ? 'Todos' : st === 'CONFIRMADO' ? 'Pendentes' : 'Concluídos'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. LISTAGEM DE HORÁRIOS DO DIA (TIMELINE LIMPA & ELEGANTE) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3.5 sm:px-4 py-3 space-y-2.5 no-scrollbar">
        {filteredAppointments.length === 0 ? (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
              isDark ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100 border border-slate-200'
            }`}>
              <Clock className="w-6 h-6 text-slate-500" />
            </div>
            <h4 className={`text-sm font-bold font-['Poppins'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Nenhum horário marcado para {currentSelectedDay.isToday ? 'hoje' : currentSelectedDay.isTomorrow ? 'amanhã' : currentSelectedDay.fullDateLabel}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Aproveite os horários disponíveis deste dia para realizar novos encaixes ou divulgar no radar.
            </p>

            <button
              type="button"
              onClick={() => {
                setNewDayGroup(currentSelectedDay.isToday ? 'Hoje' : currentSelectedDay.isTomorrow ? 'Amanhã' : currentSelectedDay.fullDateLabel);
                setIsNewBookingModalOpen(true);
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white stroke-[2.5]" />
              <span>Adicionar Encaixe Neste Dia</span>
            </button>
          </div>
        ) : (
          filteredAppointments.map((app) => {
            const rawStatus = app.status?.toUpperCase() || '';
            const isConfirmed = rawStatus === 'CONFIRMADO';
            const isDone = rawStatus === 'CONCLUÍDO' || rawStatus === 'CONCLUIDO';
            const isCancelled = rawStatus === 'CANCELADO';

            const clientName = app.clientName || app.customerName || 'Cliente';
            const serviceTitle = app.serviceTitle || app.service || 'Atendimento Personalizado';
            const professional = app.professionalName || app.professional || 'Geral';
            const timeDisplay = app.time || (app.dateTime?.match(/\b\d{1,2}:\d{2}\b/)?.[0]) || '14:00';
            const priceDisplay = (app.totalPrice || 0).toFixed(2);

            return (
              <div
                key={app.protocolCode || app.id}
                className={`p-3.5 rounded-xl border transition-all duration-200 ${
                  isDark 
                    ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700/80 shadow-xs' 
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Linha 1: Horário, Preço e Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Badge de Horário em Alto Contraste */}
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-tight font-['Poppins'] flex items-center gap-1 ${
                      isDone
                        ? 'bg-slate-800 text-slate-300'
                        : isCancelled
                        ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                        : 'bg-emerald-500 text-white shadow-xs'
                    }`}>
                      <Clock className="w-3 h-3 text-white" />
                      <span>{timeDisplay}</span>
                    </div>

                    {/* Preço do Serviço */}
                    <span className="text-xs font-extrabold text-emerald-400 font-['Poppins']">
                      R$ {priceDisplay}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isConfirmed
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : isDone
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  }`}>
                    {isDone ? 'CONCLUÍDO' : isCancelled ? 'CANCELADO' : 'CONFIRMADO'}
                  </span>
                </div>

                {/* Linha 2: Nome do Cliente e Procedimento */}
                <div className="mt-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h5 className={`text-sm font-bold truncate font-['Poppins'] ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}>
                      {clientName}
                    </h5>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      Prof. <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{professional}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                    <Scissors className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{serviceTitle}</span>
                  </div>
                </div>

                {/* Linha 3: Barra de Ações (WhatsApp & Conclusão) */}
                <div className={`mt-3 pt-2.5 border-t flex items-center justify-between gap-2 ${
                  isDark ? 'border-slate-800/80' : 'border-slate-100'
                }`}>
                  {/* Botão WhatsApp */}
                  <button
                    type="button"
                    onClick={() => handleContactClient(app)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                      isDark 
                        ? 'bg-slate-800/90 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-slate-700/60' 
                        : 'bg-slate-100 hover:bg-slate-200 text-emerald-600 border border-slate-200'
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp</span>
                  </button>

                  {/* Ações de Status */}
                  <div className="flex items-center gap-1.5">
                    {isConfirmed && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(app.protocolCode, 'CONCLUÍDO')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                          <span>Concluir</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(app.protocolCode, 'CANCELADO')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                          title="Cancelar Agendamento"
                          aria-label="Cancelar Agendamento"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {!isConfirmed && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(app.protocolCode, 'CONFIRMADO')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          isDark 
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reabrir</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. MODAL DE NOVO ENCAIXE MANUAL */}
      {isNewBookingModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsNewBookingModalOpen(false)}
        >
          <div 
            className={`w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
              isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className={`p-4 border-b flex items-center justify-between ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold font-['Poppins']">
                  Novo Encaixe na Agenda
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewBookingModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleCreateBooking} className="p-4 space-y-3.5 overflow-y-auto no-scrollbar flex-1">
              {/* Nome do Cliente */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ex: Silvana Santos"
                  className={`w-full px-3 py-2 rounded-lg text-xs border ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                  } outline-hidden`}
                />
              </div>

              {/* Telefone / WhatsApp */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Telefone / WhatsApp
                </label>
                <input
                  type="tel"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="(41) 98765-4321"
                  className={`w-full px-3 py-2 rounded-lg text-xs border ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-500 focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                  } outline-hidden`}
                />
              </div>

              {/* Serviço */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Serviço / Procedimento *
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-xs border ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  } outline-hidden`}
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                      {s.title} — R$ {s.price.toFixed(2)} ({s.duration || '40 min'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Profissional */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Profissional *
                </label>
                <select
                  value={selectedProfessionalName}
                  onChange={(e) => setSelectedProfessionalName(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-xs border ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                  } outline-hidden`}
                >
                  {professionals.map((p, idx) => (
                    <option key={idx} value={p.name} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}>
                      {p.name} ({p.role || 'Barber'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Dia e Horário */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Dia *
                  </label>
                  <select
                    value={newDayGroup}
                    onChange={(e) => setNewDayGroup(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-xs border ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                    } outline-hidden`}
                  >
                    <option value="Hoje">Hoje</option>
                    <option value="Amanhã">Amanhã</option>
                    <option value={currentSelectedDay.fullDateLabel}>{currentSelectedDay.fullDateLabel}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Horário *
                  </label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg text-xs border ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-emerald-500'
                    } outline-hidden`}
                  />
                </div>
              </div>

              {/* Botão de Envio Fixo */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-bold text-xs uppercase tracking-wider transition shadow-md shadow-emerald-500/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-white stroke-[2.5]" />
                  <span>SALVAR ENCAIXE</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
