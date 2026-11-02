import React, { useMemo, useCallback } from 'react';
import { 
  X, 
  CirclePause, 
  Calendar,
  Lock,
  Unlock,
  RotateCcw,
  Check
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
  const themeHex = accentColor || '#20C933';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-md border rounded-t-xl sm:rounded-[4px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-200 ${
          isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Cabeçalho que acompanha o tema */}
        <div className={`p-3.5 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-[4px] flex items-center justify-center border shrink-0"
              style={{
                backgroundColor: `${themeHex}20`,
                borderColor: `${themeHex}40`,
                color: themeHex,
              }}
            >
              <CirclePause className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight leading-tight font-['Poppins']">
                Pausar Agendamentos
              </h2>
              <p className={`text-[11px] flex items-center gap-1.5 mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Calendar className="w-3 h-3 text-slate-400" />
                Hoje • {formattedToday}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition active:scale-95 cursor-pointer ${
              isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo Despoluído e Otimizado */}
        <div className="p-3.5 overflow-y-auto space-y-3.5 flex-1 no-scrollbar">
          {/* Ações Rápidas no Topo */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Botão Pausar Todos os Horários Futuros (Cor do Tema com Texto Branco) */}
            <button
              type="button"
              onClick={handlePauseAllUpcoming}
              disabled={stats.futureAvailableCount === 0}
              style={{ backgroundColor: stats.futureAvailableCount > 0 ? themeHex : undefined }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-[4px] disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs transition active:scale-98 shadow-xs cursor-pointer"
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
                  : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
              }`}
              title="Desbloqueia os horários a partir de 1 hora da hora atual"
            >
              <Unlock className="w-3.5 h-3.5" style={{ color: themeHex }} />
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
                    : 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700'
                }`}
                title="Remove todos os bloqueios de pausa de hoje"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Todos</span>
              </button>
            )}
          </div>

          {/* Grade de Horários Elegíveis (Apenas futuros livres ou pausados) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-0.5">
              <label className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Horários Restantes de Hoje
              </label>
              <span className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Toque no horário para alternar
              </span>
            </div>

            {eligibleSlots.length === 0 ? (
              <div className={`p-6 rounded-[4px] border text-center ${
                isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
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
                        className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-[4px] border transition active:scale-95 cursor-pointer shadow-xs ${
                          isDark 
                            ? 'bg-rose-950/40 border-rose-500/60 hover:bg-rose-900/50 text-white' 
                            : 'bg-rose-50 border-rose-300 hover:bg-rose-100 text-rose-950'
                        }`}
                        title="Toque para despausar este horário"
                      >
                        <div className="flex items-center gap-1">
                          <CirclePause className={`w-3.5 h-3.5 stroke-[2.5] ${isDark ? 'text-rose-400' : 'text-rose-600'}`} />
                          <span className={`text-xs font-mono font-bold ${isDark ? 'text-white' : 'text-rose-950'}`}>
                            {s.time}
                          </span>
                        </div>
                        <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
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
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900 hover:border-slate-300'
                      }`}
                      title="Toque para pausar este horário"
                    >
                      <span className="text-xs font-mono font-bold">
                        {s.time}
                      </span>
                      <span 
                        className="text-[9px] font-bold uppercase tracking-wider mt-0.5"
                        style={{ color: themeHex }}
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
          isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200 shadow-lg'
        }`}>
          <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{stats.futureAvailableCount}</span> livres •{' '}
            <span className="font-bold text-rose-400">{stats.pausedCount}</span> pausados
          </div>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            style={{ backgroundColor: themeHex }}
            className="py-2 px-5 rounded-[4px] text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
            <span className="text-white">Concluir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
