import React, { useState, useMemo, useCallback } from 'react';
import { 
  X, 
  CirclePause, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  ZapOff, 
  ShieldAlert, 
  Calendar,
  Lock,
  Unlock,
  Check
} from 'lucide-react';
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

const EMERGENCY_REASONS = [
  { id: 'queda_energia', label: 'Queda de Energia', icon: ZapOff },
  { id: 'saida_emergencia', label: 'Saída de Emergência', icon: AlertTriangle },
  { id: 'imprevisto', label: 'Imprevisto Geral', icon: ShieldAlert },
  { id: 'intervalo', label: 'Intervalo Não Previsto', icon: Clock },
];

export const PauseSlotsModal: React.FC<PauseSlotsModalProps> = ({
  isOpen,
  onClose,
  appointments,
  onUpdateAppointments,
  salonName = 'Meu Estabelecimento',
  activeProName = 'Profissional',
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('Queda de Energia');

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

  // Contagens
  const stats = useMemo(() => {
    const futureSlots = slotStatuses.filter((s) => !s.isPast);
    const pausedCount = slotStatuses.filter((s) => s.state === 'paused').length;
    const futureAvailableCount = futureSlots.filter((s) => s.state === 'available').length;
    const futureBookedCount = futureSlots.filter((s) => s.state === 'booked').length;
    return {
      pausedCount,
      futureAvailableCount,
      futureBookedCount,
      totalFuture: futureSlots.length,
    };
  }, [slotStatuses]);

  // Alternar um slot individualmente
  const handleToggleSlot = useCallback((timeStr: string) => {
    const target = slotStatuses.find((s) => s.time === timeStr);
    if (!target) return;

    if (target.state === 'booked') {
      hapticMedium();
      return; // Não altera cliente agendado diretamente por segurança
    }

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
      customerName: `🔒 ${selectedReason}`,
      clientName: `🔒 ${selectedReason}`,
      service: `Pausa: ${selectedReason}`,
      serviceTitle: `Pausa: ${selectedReason}`,
      salonName: salonName,
      dateTime: `Hoje, ${timeStr}`,
      dayGroup: 'Hoje',
      time: timeStr,
      duration: '30m',
      totalPrice: 0,
      status: 'BLOQUEADO',
      isBlockedSlot: true,
      blockReason: selectedReason,
      professional: activeProName,
      professionalName: activeProName,
      createdAt: `${formattedToday} às ${timeStr}`,
      dateIso: todayIso,
    };

    const updated = [newBlock, ...appointments];
    onUpdateAppointments(updated);
  }, [slotStatuses, appointments, isAptToday, selectedReason, salonName, activeProName, formattedToday, todayIso, onUpdateAppointments]);

  // 1. Pausar Todos os Horários Futuros (Instantaneamente para caso de emergência)
  const handlePauseAllUpcoming = useCallback(() => {
    hapticMedium();
    const futureAvailable = slotStatuses.filter((s) => !s.isPast && s.state === 'available');
    if (futureAvailable.length === 0) return;

    const newBlocks: BookingAppointment[] = futureAvailable.map((s) => ({
      protocolCode: `PAUSE-${s.time.replace(':', '')}-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: `🔒 ${selectedReason}`,
      clientName: `🔒 ${selectedReason}`,
      service: `Pausa: ${selectedReason}`,
      serviceTitle: `Pausa: ${selectedReason}`,
      salonName: salonName,
      dateTime: `Hoje, ${s.time}`,
      dayGroup: 'Hoje',
      time: s.time,
      duration: '30m',
      totalPrice: 0,
      status: 'BLOQUEADO',
      isBlockedSlot: true,
      blockReason: selectedReason,
      professional: activeProName,
      professionalName: activeProName,
      createdAt: `${formattedToday} às ${s.time}`,
      dateIso: todayIso,
    }));

    const updated = [...newBlocks, ...appointments];
    onUpdateAppointments(updated);
  }, [slotStatuses, appointments, selectedReason, salonName, activeProName, formattedToday, todayIso, onUpdateAppointments]);

  // 2. Despausar Horários Futuros com antecedência > 1 hora (Regra do Usuário)
  const handleUnpauseBeyondOneHour = useCallback(() => {
    hapticSuccess();
    // Horários futuros acima de 1 hora do momento atual (currentMinutes + 60)
    const thresholdMinutes = currentMinutes + 60;

    const updated = appointments.filter((a) => {
      if (!isAptToday(a)) return true;
      const isBlocked = a.isBlockedSlot || (a.status || '').toUpperCase() === 'BLOQUEADO';
      if (!isBlocked) return true;

      const aptTime = (a.time || '').trim().slice(0, 5);
      const [h, m] = aptTime.split(':').map(Number);
      const aptMinutes = h * 60 + m;

      // Se for maior que 1 hora de antecedência, desbloqueia (remove o bloqueio)
      if (aptMinutes >= thresholdMinutes) {
        return false; // Remove da lista de agendamentos
      }
      return true; // Mantém bloqueado os horários da próxima 1h
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-t-xl sm:rounded-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100 animate-in slide-in-from-bottom-4 duration-200"
      >
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded flex items-center justify-center ${
              stats.pausedCount > 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              <CirclePause className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight leading-tight">
                Pausar Agendamentos
              </h2>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Hoje • {formattedToday}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Rolável */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Alerta de Status Dinâmico */}
          {stats.pausedCount > 0 ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 flex items-start gap-3 text-amber-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-amber-300">
                  {stats.pausedCount} {stats.pausedCount === 1 ? 'horário pausado' : 'horários pausados'} hoje
                </p>
                <p className="text-amber-200/80 mt-0.5">
                  Horários pausados estão indisponíveis para clientes agendarem no Radar e na Vitrine.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-3 flex items-start gap-3 text-emerald-200 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold text-emerald-300">Agenda operando normalmente</p>
                <p className="text-emerald-200/80 mt-0.5">
                  Em caso fortuito ou emergência, use os botões abaixo para bloquear instantaneamente os horários futuros.
                </p>
              </div>
            </div>
          )}

          {/* Motivo Rápido da Pausa Emergencial */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Motivo da Pausa:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EMERGENCY_REASONS.map((r) => {
                const Icon = r.icon;
                const isSelected = selectedReason === r.label;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setSelectedReason(r.label);
                    }}
                    className={`flex items-center gap-2 p-2 rounded text-xs font-medium border text-left transition active:scale-95 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-xs'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span className="truncate">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ações Globais de Emergência */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-slate-300 block">
              Ações Rápidas:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Botão Pausar Todos os Horários Futuros */}
              <button
                type="button"
                onClick={handlePauseAllUpcoming}
                disabled={stats.futureAvailableCount === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:pointer-events-none text-slate-950 font-bold text-xs transition active:scale-95 shadow-md shadow-amber-500/20"
              >
                <Lock className="w-4 h-4 stroke-[2.4]" />
                <span>Pausar Todos ({stats.futureAvailableCount} livres)</span>
              </button>

              {/* Botão Despausar (> 1h) */}
              <button
                type="button"
                onClick={handleUnpauseBeyondOneHour}
                disabled={stats.pausedCount === 0}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-100 font-semibold text-xs border border-slate-700 transition active:scale-95"
                title="Desbloqueia os horários a partir de 1 hora da hora atual"
              >
                <Unlock className="w-4 h-4 text-emerald-400" />
                <span>Despausar (&gt; 1h)</span>
              </button>

              {/* Botão Despausar Todos */}
              {stats.pausedCount > 0 && (
                <button
                  type="button"
                  onClick={handleUnpauseAll}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded bg-slate-900 hover:bg-slate-800 text-rose-300 font-semibold text-xs border border-rose-500/30 transition active:scale-95"
                  title="Remove todos os bloqueios de pausa de hoje"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Todos</span>
                </button>
              )}
            </div>
          </div>

          {/* Grade de Horários do Dia */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">
                Grade de Horários de Hoje:
              </label>
              <span className="text-[11px] text-slate-400">
                Toque no horário para alternar pausa
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slotStatuses.map((s) => {
                if (s.state === 'past') {
                  return (
                    <div
                      key={s.time}
                      className="flex flex-col items-center justify-center py-2 px-1 rounded bg-slate-900/40 border border-slate-800/40 text-slate-600 cursor-not-allowed select-none opacity-60"
                    >
                      <span className="text-xs font-mono font-medium line-through">
                        {s.time}
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-600">
                        Passado
                      </span>
                    </div>
                  );
                }

                if (s.state === 'booked') {
                  const clientName = s.appointment?.clientName || s.appointment?.customerName || 'Cliente';
                  return (
                    <div
                      key={s.time}
                      className="flex flex-col items-center justify-center py-2 px-1 rounded bg-emerald-950/20 border border-emerald-600/30 text-emerald-300 cursor-default select-none"
                    >
                      <span className="text-xs font-mono font-bold text-emerald-200">
                        {s.time}
                      </span>
                      <span className="text-[9px] truncate max-w-full font-medium text-emerald-400">
                        {clientName}
                      </span>
                    </div>
                  );
                }

                if (s.state === 'paused') {
                  return (
                    <button
                      key={s.time}
                      type="button"
                      onClick={() => handleToggleSlot(s.time)}
                      className="flex flex-col items-center justify-center py-2 px-1 rounded bg-rose-950/30 border border-rose-500/60 text-rose-200 hover:bg-rose-900/40 transition active:scale-95 cursor-pointer shadow-xs shadow-rose-950/50"
                      title="Toque para despausar este horário"
                    >
                      <div className="flex items-center gap-1">
                        <CirclePause className="w-3 h-3 text-rose-400 stroke-[2.5]" />
                        <span className="text-xs font-mono font-bold">
                          {s.time}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-rose-400">
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
                    className="flex flex-col items-center justify-center py-2 px-1 rounded bg-slate-900 border border-slate-700/80 hover:border-amber-500/60 hover:bg-slate-800 text-slate-200 transition active:scale-95 cursor-pointer"
                    title="Toque para pausar este horário"
                  >
                    <span className="text-xs font-mono font-bold text-white">
                      {s.time}
                    </span>
                    <span className="text-[9px] font-medium text-emerald-400">
                      Vago
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rodapé Fixo */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 shrink-0 sticky bottom-0 z-20 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-white">{stats.futureAvailableCount}</span> livres •{' '}
            <span className="font-semibold text-amber-400">{stats.pausedCount}</span> pausados
          </div>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className="py-2 px-5 rounded bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-emerald-500/20"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Concluir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
