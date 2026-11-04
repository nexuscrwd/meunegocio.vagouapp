import React, { useMemo, useCallback } from 'react';
import { 
  X, 
  CirclePause, 
  Calendar,
  Lock,
  Unlock,
  RotateCcw,
  Check,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { BookingAppointment } from '../../types';
import { hapticLight, hapticMedium, hapticSuccess } from '../../utils/haptics';

interface PauseSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: BookingAppointment[];
  onUpdateAppointments: (newApts: BookingAppointment[]) => void;
  salonName?: string;
  activeProName?: string;
}

const ALL_DAY_SLOTS = [
  '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30',
  '20:00'
];

export const PauseSlotsModal: React.FC<PauseSlotsModalProps> = ({
  isOpen,
  onClose,
  appointments,
  onUpdateAppointments,
  salonName = 'Meu Estabelecimento',
  activeProName = 'Profissional',
}) => {
  const { isDark, accentColor } = useTheme();
  const themeHex = accentColor || '#2B82C9';

  // Determinar data de hoje
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => today.toISOString().split('T')[0], [today]);
  const formattedToday = useMemo(() => {
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    return `${d}/${m}/${y}`;
  }, [today]);

  const shortToday = useMemo(() => {
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
  }, [today]);

  // Minutos atuais do dia
  const currentMinutes = useMemo(() => {
    return today.getHours() * 60 + today.getMinutes();
  }, [today]);

  // Função auxiliar para verificar se agendamento é de hoje
  const isAptToday = useCallback((apt: BookingAppointment) => {
    if (!apt) return false;
    if (apt.dateIso === todayIso) return true;
    if (apt.dayGroup === 'Hoje' || apt.dayGroup === shortToday) return true;
    if (typeof apt.dateTime === 'string' && (apt.dateTime.includes('Hoje') || apt.dateTime.includes(shortToday))) return true;
    return false;
  }, [todayIso, shortToday]);

  // Mapear status de cada horário
  const slotStatuses = useMemo(() => {
    return ALL_DAY_SLOTS.map((timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      const slotMin = h * 60 + m;
      const isPast = slotMin < currentMinutes;

      // Buscar agendamento existente de hoje nesse horário
      const matchingApt = appointments.find((a) => {
        if (!isAptToday(a)) return false;
        const aptTime = (a.time || '').trim().slice(0, 5);
        return aptTime === timeStr;
      });

      const isCancelled = matchingApt && (matchingApt.status || '').toUpperCase() === 'CANCELADO';
      const isBlocked = matchingApt && !isCancelled && (matchingApt.isBlockedSlot || (matchingApt.status || '').toUpperCase() === 'BLOQUEADO');
      const isBookedClient = matchingApt && !isCancelled && !isBlocked;

      let state: 'past' | 'booked' | 'paused' | 'available' = 'available';
      if (isBlocked) {
        state = 'paused';
      } else if (isBookedClient) {
        state = 'booked';
      } else if (isPast) {
        state = 'past';
      }

      return {
        time: timeStr,
        slotMin,
        state,
        isPast,
        appointment: isCancelled ? undefined : matchingApt,
      };
    });
  }, [appointments, currentMinutes, isAptToday]);

  // Filtrar apenas horários elegíveis: os passados e ocupados por clientes são removidos por obviedade
  const eligibleSlots = useMemo(() => {
    return slotStatuses.filter((s) => !s.isPast && (s.state === 'available' || s.state === 'paused'));
  }, [slotStatuses]);

  // Contagens
  const stats = useMemo(() => {
    const pausedCount = eligibleSlots.filter((s) => s.state === 'paused').length;
    const futureAvailableCount = eligibleSlots.filter((s) => s.state === 'available').length;
    return {
      pausedCount,
      futureAvailableCount,
      totalEligible: eligibleSlots.length,
    };
  }, [eligibleSlots]);

  // Alternar um slot individualmente (pausar / despausar)
  const handleToggleSlot = useCallback((timeStr: string) => {
    const target = eligibleSlots.find((s) => s.time === timeStr);
    if (!target) return;

    if (target.state === 'paused') {
      // Despausar este slot
      hapticSuccess();
      const updated = appointments.filter((a) => {
        if (!isAptToday(a)) return true;
        const aptTime = (a.time || '').trim().slice(0, 5);
        const isThisBlocked = aptTime === timeStr && (a.isBlockedSlot || (a.status || '').toUpperCase() === 'BLOQUEADO');
        return !isThisBlocked;
      });
      onUpdateAppointments(updated);
      return;
    }

    // Pausar este slot
    hapticMedium();
    const newBlock: BookingAppointment = {
      protocolCode: `PAUSE-${timeStr.replace(':', '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: '🔒 Pausa de Horário',
      clientName: '🔒 Pausa de Horário',
      service: 'Pausa de Emergência',
      serviceTitle: 'Pausa de Emergência',
      salonName: salonName,
      dateTime: `Hoje, ${timeStr}`,
      dayGroup: 'Hoje',
      time: timeStr,
      duration: '30m',
      totalPrice: 0,
      status: 'BLOQUEADO',
      isBlockedSlot: true,
      blockReason: 'Pausa de Emergência',
      professional: activeProName,
      professionalName: activeProName,
      createdAt: `${formattedToday} às ${timeStr}`,
      dateIso: todayIso,
    };

    const updated = [newBlock, ...appointments];
    onUpdateAppointments(updated);
  }, [eligibleSlots, appointments, isAptToday, salonName, activeProName, formattedToday, todayIso, onUpdateAppointments]);

  // 1. Pausar Todos os Horários Futuros Vagos
  const handlePauseAllUpcoming = useCallback(() => {
    hapticMedium();
    const available = eligibleSlots.filter((s) => s.state === 'available');
    if (available.length === 0) return;

    const newBlocks: BookingAppointment[] = available.map((s) => ({
      protocolCode: `PAUSE-${s.time.replace(':', '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: '🔒 Pausa de Horário',
      clientName: '🔒 Pausa de Horário',
      service: 'Pausa de Emergência',
      serviceTitle: 'Pausa de Emergência',
      salonName: salonName,
      dateTime: `Hoje, ${s.time}`,
      dayGroup: 'Hoje',
      time: s.time,
      duration: '30m',
      totalPrice: 0,
      status: 'BLOQUEADO',
      isBlockedSlot: true,
      blockReason: 'Pausa de Emergência',
      professional: activeProName,
      professionalName: activeProName,
      createdAt: `${formattedToday} às ${s.time}`,
      dateIso: todayIso,
    }));

    const updated = [...newBlocks, ...appointments];
    onUpdateAppointments(updated);
  }, [eligibleSlots, appointments, salonName, activeProName, formattedToday, todayIso, onUpdateAppointments]);

  // 2. Despausar Horários Futuros com antecedência > 1 hora
  const handleUnpauseBeyondOneHour = useCallback(() => {
    hapticSuccess();
    const thresholdMinutes = currentMinutes + 60;

    const updated = appointments.filter((a) => {
      if (!isAptToday(a)) return true;
      const isBlocked = a.isBlockedSlot || (a.status || '').toUpperCase() === 'BLOQUEADO';
      if (!isBlocked) return true;

      const aptTime = (a.time || '').trim().slice(0, 5);
      const [h, m] = aptTime.split(':').map(Number);
      const aptMinutes = h * 60 + m;

      // Se for maior ou igual a 1 hora de antecedência, desbloqueia
      if (aptMinutes >= thresholdMinutes) {
        return false;
      }
      return true;
    });

    onUpdateAppointments(updated);
  }, [appointments, currentMinutes, isAptToday, onUpdateAppointments]);

  // 3. Despausar Todos os Horários de Hoje
  const handleUnpauseAll = useCallback(() => {
    hapticSuccess();
    const updated = appointments.filter((a) => {
      if (!isAptToday(a)) return true;
      const isBlocked = a.isBlockedSlot || (a.status || '').toUpperCase() === 'BLOQUEADO';
      return !isBlocked;
    });
    onUpdateAppointments(updated);
  }, [appointments, isAptToday, onUpdateAppointments]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-[#E6EEF6]/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-[430px] h-dvh max-h-dvh shadow-lg flex flex-col overflow-hidden animate-in fade-in duration-200 ${
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#F7F9FC] text-[#1E293B]'
        }`}
      >
        {/* Barra Superior Institucional com Botão Voltar */}
        <div className={`px-3.5 py-3 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-[#E6EDF5]'
        }`}>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] transition active:scale-95 cursor-pointer text-xs font-bold ${
              isDark ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#F1F5F9] text-[#1E293B]'
            }`}
          >
            <ChevronRight className="w-4 h-4 rotate-180 text-[#2B82C9]" />
            <span>Voltar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className={`w-8 h-8 rounded-[4px] border flex items-center justify-center transition active:scale-95 cursor-pointer ${
              isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#5F6C7B] hover:text-[#1E293B]'
            }`}
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo Despoluído e Otimizado */}
        <div className="p-3.5 overflow-y-auto space-y-3.5 flex-1 no-scrollbar">
          {/* Card de Cabeçalho da Seção */}
          <div className={`caixa-card p-3.5 rounded-[4px] flex items-center justify-between gap-3 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="caixa-icon-halo w-10 h-10 rounded-full shrink-0">
                <CirclePause className="w-5 h-5 text-[#2B82C9] stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-[#1E293B] dark:text-white tracking-tight leading-tight">
                  Pausar Agendamentos
                </h2>
                <p className={`text-[11px] flex items-center gap-1.5 mt-0.5 font-mono-tabular ${isDark ? 'text-slate-400' : 'text-[#64748B]'}`}>
                  <Calendar className="w-3 h-3 text-[#2B82C9]" />
                  Hoje • {formattedToday}
                </p>
              </div>
            </div>
          </div>

          {/* Ações Rápidas no Topo */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Botão Pausar Todos os Horários Futuros */}
            <button
              type="button"
              onClick={handlePauseAllUpcoming}
              disabled={stats.futureAvailableCount === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-[4px] bg-[#2B82C9] hover:bg-[#1F6FB0] disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs transition active:scale-98 shadow-xs cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-white stroke-[2.4]" />
              <span className="text-white">Pausar Todos ({stats.futureAvailableCount} livres)</span>
            </button>

            {/* Botão Despausar (> 1h) */}
            <button
              type="button"
              onClick={handleUnpauseBeyondOneHour}
              disabled={stats.pausedCount === 0}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-[4px] disabled:opacity-40 disabled:pointer-events-none font-bold text-xs border transition active:scale-98 cursor-pointer ${
                isDark 
                  ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-200' 
                  : 'bg-white hover:bg-[#F1F5F9] border-[#E2E8F0] text-[#1E293B]'
              }`}
              title="Desbloqueia os horários a partir de 1 hora da hora atual"
            >
              <Unlock className="w-3.5 h-3.5 text-[#2B82C9]" />
              <span>Despausar (&gt; 1h)</span>
            </button>

            {/* Botão Despausar Todos */}
            {stats.pausedCount > 0 && (
              <button
                type="button"
                onClick={handleUnpauseAll}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-[4px] font-bold text-xs border transition active:scale-98 cursor-pointer ${
                  isDark
                    ? 'bg-rose-950/30 hover:bg-rose-900/40 border-rose-500/40 text-rose-300'
                    : 'bg-[#FEF2F2] hover:bg-rose-100 border-[#FECACA] text-[#DC2626]'
                }`}
                title="Remove todos os bloqueios de pausa de hoje"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Todos</span>
              </button>
            )}
          </div>

          {/* Grade de Horários Elegíveis dentro de .caixa-card */}
          <div className={`caixa-card p-4 rounded-[4px] space-y-3 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between">
              <label className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-[#1E293B]'}`}>
                Horários Restantes de Hoje
              </label>
              <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-[#64748B]'}`}>
                Toque para alternar
              </span>
            </div>

            {eligibleSlots.length === 0 ? (
              <div className={`p-6 rounded-[4px] border text-center ${
                isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-[#F7F9FC] border-[#E6EDF5] text-[#64748B]'
              }`}>
                <p className="text-xs font-medium">Nenhum horário livre restante para pausar hoje.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {eligibleSlots.map((s) => {
                  if (s.state === 'paused') {
                    return (
                      <button
                        key={s.time}
                        type="button"
                        onClick={() => handleToggleSlot(s.time)}
                        className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-[4px] border transition active:scale-95 cursor-pointer ${
                          isDark 
                            ? 'bg-rose-950/40 border-rose-500/60 hover:bg-rose-900/50 text-white' 
                            : 'bg-[#FEF2F2] border-[#FECACA] hover:bg-rose-100 text-[#DC2626]'
                        }`}
                        title="Toque para despausar este horário"
                      >
                        <div className="flex items-center gap-1">
                          <CirclePause className={`w-3.5 h-3.5 stroke-[2.5] ${isDark ? 'text-rose-400' : 'text-[#DC2626]'}`} />
                          <span className={`text-xs font-mono-tabular font-bold ${isDark ? 'text-white' : 'text-[#DC2626]'}`}>
                            {s.time}
                          </span>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${isDark ? 'text-rose-300' : 'text-[#DC2626]'}`}>
                          Pausado
                        </span>
                      </button>
                    );
                  }

                  // Vago / Aberto
                  return (
                    <button
                      key={s.time}
                      type="button"
                      onClick={() => handleToggleSlot(s.time)}
                      className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-[4px] border transition active:scale-95 cursor-pointer ${
                        isDark 
                          ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white hover:border-slate-700' 
                          : 'bg-[#F7F9FC] hover:bg-[#EBF5FF] border-[#D5E0EC] text-[#1E293B] hover:border-[#2B82C9]'
                      }`}
                      title="Toque para pausar este horário"
                    >
                      <span className="text-xs font-mono-tabular font-bold">
                        {s.time}
                      </span>
                      <span 
                        className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-[#2B82C9]"
                      >
                        Vago
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé Fixo */}
        <div className={`p-3 border-t shrink-0 sticky bottom-0 z-20 flex items-center justify-between gap-3 ${
          isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-[#E6EDF5]'
        }`}>
          <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-[#64748B]'}`}>
            <span className={`font-bold font-mono-tabular ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>{stats.futureAvailableCount}</span> livres •{' '}
            <span className="font-bold font-mono-tabular text-[#DC2626]">{stats.pausedCount}</span> pausados
          </div>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className="py-2 px-5 rounded-[4px] bg-[#2B82C9] hover:bg-[#1F6FB0] text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            <span className="text-white">Concluir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
