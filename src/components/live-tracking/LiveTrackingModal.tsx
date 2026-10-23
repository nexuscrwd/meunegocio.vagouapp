import React, { useState, useMemo } from 'react';
import {
  Navigation,
  MapPin,
  Clock,
  AlertTriangle,
  Check,
  CheckCircle2,
  X,
  RefreshCw,
  Car,
  Bike,
  Bus,
  Footprints,
  Bell,
  Package,
  Map as MapIcon,
  Radio,
  ShieldCheck,
  ChevronRight,
  FastForward,
  Home,
  Sparkles,
} from 'lucide-react';
import {
  BookingAppointment,
  TransportMode,
  LiveRouteCheckpoint,
} from '../../types';
import {
  GOOGLE_MAPS_ROUTE_OPTIONS,
  getAdjustedRouteMetrics,
  formatCurrentClockTime,
  syncAppointmentAcrossStorageAndDb,
  useLiveRouteTracker,
} from '../../hooks/useLiveRouteTracker';
import { hapticLight, hapticMedium, hapticSuccess } from '../../utils/haptics';

interface LiveRouteDepartureModalProps {
  isOpen: boolean;
  appointment: BookingAppointment;
  isProfessionalDeliveryMode?: boolean;
  onClose: () => void;
  onUpdateAppointment?: (updated: BookingAppointment) => void;
  onCancelWithReason?: (protocolCode: string, reason: string) => void;
  onRequestReschedule?: (appointment: BookingAppointment) => void;
  onOpenLiveViewer?: (appointment: BookingAppointment, initialTab: 'timeline' | 'map') => void;
}

export const LiveRouteDepartureModal: React.FC<LiveRouteDepartureModalProps> = ({
  isOpen,
  appointment,
  isProfessionalDeliveryMode = false,
  onClose,
  onUpdateAppointment,
  onCancelWithReason,
  onRequestReschedule,
  onOpenLiveViewer,
}) => {
  const isAlreadySharing =
    appointment.tracking_status === 'live_sharing' ||
    appointment.tracking_status === 'arriving_5min';

  const [step, setStep] = useState<'question' | 'not_leaving' | 'cancel_reason' | 'route_tracer' | 'active_transmitter'>(() => {
    if (isAlreadySharing) return 'active_transmitter';
    if (isProfessionalDeliveryMode) return 'route_tracer';
    return 'question';
  });

  const [transportMode, setTransportMode] = useState<TransportMode>(
    appointment.transport_mode || 'driving'
  );
  const [selectedRouteId, setSelectedRouteId] = useState<'route_1' | 'route_2'>('route_1');
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelError, setCancelError] = useState<string>('');

  const { secondsUntilNextPing, advanceRouteStep, reportAdversity } = useLiveRouteTracker({
    appointment,
    onUpdateAppointment,
    autoTickEnabled: isOpen && isAlreadySharing,
  });

  const selectedRoute = useMemo(
    () => GOOGLE_MAPS_ROUTE_OPTIONS.find((r) => r.id === selectedRouteId) || GOOGLE_MAPS_ROUTE_OPTIONS[0],
    [selectedRouteId]
  );

  const metrics = useMemo(
    () => getAdjustedRouteMetrics(selectedRoute, transportMode),
    [selectedRoute, transportMode]
  );

  if (!isOpen) return null;

  const prepBuffer = appointment.prep_buffer_minutes ?? 10;
  const totalPreAlertMinutes = metrics.etaMinutes + prepBuffer;

  const handleConfirmHurry = () => {
    hapticSuccess();
    syncAppointmentAcrossStorageAndDb(
      appointment,
      {
        tracking_status: 'hurry_confirmed',
        transport_mode: transportMode,
        eta_minutes: metrics.etaMinutes,
        distance_km: metrics.distanceKm,
      },
      onUpdateAppointment
    );
    onClose();
  };

  const handleStartLiveRoute = (shareMap: boolean) => {
    hapticSuccess();
    const nowClock = formatCurrentClockTime();
    const initialCheckpoints: LiveRouteCheckpoint[] = selectedRoute.streets.map((s, idx) => ({
      street: s.street,
      distanceText: s.distanceText,
      status: idx === 0 ? 'current' : 'upcoming',
      timestamp: idx === 0 ? nowClock : undefined,
    }));

    const nextStatus = shareMap
      ? metrics.etaMinutes <= 5
        ? 'arriving_5min'
        : 'live_sharing'
      : 'on_way_no_map';

    syncAppointmentAcrossStorageAndDb(
      appointment,
      {
        tracking_status: nextStatus,
        transport_mode: transportMode,
        selected_route_summary: selectedRoute.summary,
        route_polyline: selectedRoute.polyline,
        current_street_name: selectedRoute.streets[0].street,
        route_checkpoints: initialCheckpoints,
        eta_minutes: metrics.etaMinutes,
        distance_km: metrics.distanceKm,
        delay_minutes: 0,
        active_adversity: null,
        client_lat: -23.5614,
        client_lng: -46.6558,
      },
      onUpdateAppointment
    );

    if (shareMap) {
      setStep('active_transmitter');
    } else {
      onClose();
    }
  };

  const handleConfirmCancelWithReason = () => {
    const trimmed = cancelReason.trim();
    if (!trimmed) {
      setCancelError('Informe o motivo do cancelamento para liberar a vaga.');
      return;
    }
    hapticMedium();
    syncAppointmentAcrossStorageAndDb(
      appointment,
      {
        status: 'CANCELADO',
        tracking_status: 'cancelled',
        cancellation_reason: trimmed,
      },
      onUpdateAppointment
    );
    if (onCancelWithReason) {
      onCancelWithReason(appointment.protocolCode, trimmed);
    }
    onClose();
  };

  const handleConfirmReschedule = () => {
    hapticMedium();
    syncAppointmentAcrossStorageAndDb(
      appointment,
      {
        status: 'ALTERADO',
        tracking_status: 'rescheduled',
      },
      onUpdateAppointment
    );
    if (onRequestReschedule) {
      onRequestReschedule(appointment);
    }
    onClose();
  };

  const handleMarkArrived = () => {
    hapticSuccess();
    const nowClock = formatCurrentClockTime();
    const completedCheckpoints: LiveRouteCheckpoint[] = (
      appointment.route_checkpoints || []
    ).map((c) => ({
      ...c,
      status: 'passed',
      timestamp: c.timestamp || nowClock,
    }));

    syncAppointmentAcrossStorageAndDb(
      appointment,
      {
        tracking_status: 'arrived',
        route_checkpoints: completedCheckpoints,
        current_street_name:
          appointment.service_location_type === 'home_delivery'
            ? 'No endereço do cliente (Check-in)'
            : 'Na recepção do salão (Check-in)',
        eta_minutes: 0,
        distance_km: 0,
        active_adversity: null,
      },
      onUpdateAppointment
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-950 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-[6px] text-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho Compacto */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-[4px] bg-emerald-500 flex items-center justify-center text-white shrink-0">
              <Navigation className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-extrabold uppercase tracking-wider font-['Poppins'] text-white truncate">
                {isProfessionalDeliveryMode
                  ? 'Deslocamento Delivery Ao Vivo'
                  : 'Radar Estou a Caminho'}
              </h3>
              <p className="text-[10px] font-mono text-slate-400 truncate">
                {appointment.protocolCode} • {appointment.serviceTitle || appointment.service} às{' '}
                {appointment.time || '14:30'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[4px] text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo Rolável */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* PASSO 1: PERGUNTA PRÉ-PARTIDA (ETA + 10 MIN) */}
          {step === 'question' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-[4px] bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-[3px] bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-white" />
                    <span className="text-white font-mono tabular-nums">
                      Alerta Pré-Partida (ETA + {prepBuffer}m)
                    </span>
                  </span>
                  <span className="text-[11px] font-mono tabular-nums font-bold text-emerald-400">
                    ~{metrics.etaMinutes} min de rota
                  </span>
                </div>

                <h4 className="text-sm font-extrabold text-white font-['Poppins'] leading-snug pt-1">
                  Faltam {totalPreAlertMinutes} min para o seu horário ({appointment.time || '14:30'}). Você já está de partida?
                </h4>

                <p className="text-[11px] text-slate-400">
                  Destino: <strong className="text-slate-200">{appointment.salonName}</strong> (
                  <span className="font-mono tabular-nums">{metrics.distanceKm} km</span>)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setStep('not_leaving');
                  }}
                  className="py-3 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1 active:scale-98"
                >
                  <span>Ainda Não</span>
                  <span className="text-[9.5px] font-normal text-slate-400">
                    Vou atrasar ou remarcar
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setStep('route_tracer');
                  }}
                  className="py-3 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1 active:scale-98 shadow-sm"
                >
                  <span className="text-white flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5 text-white" />
                    Sim, estou saindo
                  </span>
                  <span className="text-[9.5px] font-normal text-white/90">
                    Traçar rota Google Maps
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* PASSO 1B: RESPONDEU "NÃO" -> VAI COMPARECER OU NÃO? */}
          {step === 'not_leaving' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-[4px] bg-slate-900 border border-amber-500/40 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>Atenção ao tempo de deslocamento</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  O trajeto até <strong className="text-white">{appointment.salonName}</strong> leva cerca de{' '}
                  <strong className="text-emerald-400 font-mono tabular-nums">{metrics.etaMinutes} min</strong>. Você ainda vai comparecer hoje?
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleConfirmHurry}
                  className="w-full py-2.5 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer flex items-center justify-between active:scale-98"
                >
                  <span className="flex items-center gap-2 text-white">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span className="text-white">Sim, vou comparecer (Saindo em instantes)</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-white" />
                </button>

                <button
                  type="button"
                  onClick={handleConfirmReschedule}
                  className="w-full py-2.5 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 border border-amber-500/40 text-amber-300 font-bold text-xs transition cursor-pointer flex items-center justify-between active:scale-98"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                    <span>Não consigo agora • Remanejar Horário</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-amber-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setStep('cancel_reason');
                  }}
                  className="w-full py-2.5 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 border border-rose-500/30 text-rose-400 font-bold text-xs transition cursor-pointer flex items-center justify-between active:scale-98"
                >
                  <span className="flex items-center gap-2">
                    <X className="w-4 h-4 text-rose-400" />
                    <span>Não vou comparecer • Cancelar Vaga</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-rose-400" />
                </button>
              </div>
            </div>
          )}

          {/* PASSO 1C: CANCELAMENTO COM MOTIVO OBRIGATÓRIO */}
          {step === 'cancel_reason' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block">
                  Motivo do Cancelamento (Obrigatório) *
                </label>
                <p className="text-[10.5px] text-slate-400">
                  Avise o estabelecimento para liberar imediatamente a cadeira no Radar Vagou.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  'Imprevisto no trabalho',
                  'Trânsito pesado / Sem transporte',
                  'Problema de saúde',
                  'Reunião de última hora',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setCancelReason(preset);
                      setCancelError('');
                    }}
                    className={`px-2.5 py-1 rounded-[4px] text-[10.5px] font-semibold transition cursor-pointer ${
                      cancelReason === preset
                        ? 'bg-emerald-500 text-white font-bold'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className={cancelReason === preset ? 'text-white' : ''}>{preset}</span>
                  </button>
                ))}
              </div>

              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value);
                  setCancelError('');
                }}
                placeholder="Digite o motivo do cancelamento..."
                className="w-full px-3 py-2 rounded-[4px] bg-slate-900 border border-slate-800 text-white text-xs outline-hidden focus:border-rose-500"
              />

              {cancelError && (
                <p className="text-[11px] font-bold text-rose-400">{cancelError}</p>
              )}
            </div>
          )}

          {/* PASSO 2: TRAÇADOR DE ROTA GOOGLE MAPS IN-APP */}
          {step === 'route_tracer' && (
            <div className="space-y-3.5">
              {/* Meio de Transporte */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  1. Como você está indo?
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {(
                    [
                      { id: 'driving', label: 'Carro', icon: Car },
                      { id: 'motorcycle', label: 'Moto', icon: Bike },
                      { id: 'rideshare', label: 'Uber/99', icon: Car },
                      { id: 'transit', label: 'Ônibus', icon: Bus },
                      { id: 'walking', label: 'A pé', icon: Footprints },
                    ] as Array<{ id: TransportMode; label: string; icon: React.FC<{ className?: string }> }>
                  ).map((item) => {
                    const IconComp = item.icon;
                    const active = transportMode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setTransportMode(item.id);
                        }}
                        className={`py-2 px-1 rounded-[4px] flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition cursor-pointer ${
                          active
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        <IconComp className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} />
                        <span className={active ? 'text-white' : ''}>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seleção de Rota Google Maps Routes API */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    2. Escolha a Rota (Google Maps Routes API)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                    Ping GPS: 10s
                  </span>
                </div>

                {GOOGLE_MAPS_ROUTE_OPTIONS.map((route) => {
                  const isSelected = selectedRouteId === route.id;
                  const rMetrics = getAdjustedRouteMetrics(route, transportMode);
                  return (
                    <div
                      key={route.id}
                      onClick={() => {
                        hapticLight();
                        setSelectedRouteId(route.id);
                      }}
                      className={`p-3 rounded-[4px] cursor-pointer transition space-y-2 ${
                        isSelected
                          ? 'bg-slate-900 ring-1 ring-emerald-500'
                          : 'bg-slate-900/50 hover:bg-slate-900 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded-[3px] text-[9.5px] font-black uppercase whitespace-nowrap ${
                              isSelected
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            <span className={isSelected ? 'text-white' : ''}>{route.title}</span>
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold truncate">
                            {route.badge}
                          </span>
                        </div>
                        <span className="text-xs font-mono tabular-nums font-black text-white shrink-0">
                          {rMetrics.etaMinutes} min ({rMetrics.distanceKm} km)
                        </span>
                      </div>

                      {/* Ruas extraídas da rota */}
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        {route.streets.map((st, idx) => (
                          <React.Fragment key={st.street}>
                            <span className="text-[10px] text-slate-300 font-medium">
                              {st.street}
                            </span>
                            {idx < route.streets.length - 1 && (
                              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-2.5 rounded-[4px] bg-slate-900/80 flex items-center gap-2 text-[10.5px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Privacidade LGPD: O GPS atualiza a cada <strong className="text-white font-mono">10s</strong> apenas durante o deslocamento e desliga sozinho na chegada.
                </span>
              </div>
            </div>
          )}

          {/* PASSO 3: TRANSMISSOR AO VIVO ATIVO (10s) + BOTÕES DE ADVERSIDADE */}
          {step === 'active_transmitter' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-[4px] bg-slate-900 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-[3px] bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3 h-3 text-white animate-pulse" />
                    <span className="text-white">Transmitindo Rota Ao Vivo</span>
                  </span>
                  <span className="text-[11px] font-mono tabular-nums font-bold text-emerald-400">
                    Próximo ping: {secondsUntilNextPing}s
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded-[4px] bg-slate-950">
                    <span className="text-[9px] uppercase text-slate-400 block">Rua Atual</span>
                    <span className="text-xs font-bold text-white truncate block mt-0.5">
                      {appointment.current_street_name || 'Av. Paulista'}
                    </span>
                  </div>
                  <div className="p-2 rounded-[4px] bg-slate-950">
                    <span className="text-[9px] uppercase text-slate-400 block">ETA Previsto</span>
                    <span className="text-xs font-mono tabular-nums font-black text-emerald-400 block mt-0.5">
                      {appointment.eta_minutes ?? 12} min ({formatCurrentClockTime(appointment.eta_minutes ?? 12)})
                    </span>
                  </div>
                  <div className="p-2 rounded-[4px] bg-slate-950">
                    <span className="text-[9px] uppercase text-slate-400 block">Distância</span>
                    <span className="text-xs font-mono tabular-nums font-bold text-slate-200 block mt-0.5">
                      {appointment.distance_km ?? 2.4} km
                    </span>
                  </div>
                </div>

                {appointment.active_adversity && (
                  <div className="p-2.5 rounded-[4px] bg-amber-500/15 text-amber-300 text-[11px] flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {appointment.active_adversity.label} em {appointment.active_adversity.street}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums font-black text-amber-400">
                      +{appointment.active_adversity.addedMinutes} min
                    </span>
                  </div>
                )}
              </div>

              {/* Botões de 1 Toque: Radar de Adversidades de Trânsito */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Imprevisto no caminho? Avise em 1 toque:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      reportAdversity('traffic', 'Trânsito inesperado', 6);
                    }}
                    className="p-2 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-amber-300 text-[10px] font-bold transition cursor-pointer flex flex-col items-center gap-1 active:scale-95"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Trânsito</span>
                    <span className="font-mono tabular-nums text-[9.5px] text-amber-400">+6 min</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      reportAdversity('roadwork', 'Obra / Bloqueio na via', 8);
                    }}
                    className="p-2 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-amber-300 text-[10px] font-bold transition cursor-pointer flex flex-col items-center gap-1 active:scale-95"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Obra na Via</span>
                    <span className="font-mono tabular-nums text-[9.5px] text-amber-400">+8 min</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      reportAdversity('parking', 'Procurando vaga', 4);
                    }}
                    className="p-2 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-amber-300 text-[10px] font-bold transition cursor-pointer flex flex-col items-center gap-1 active:scale-95"
                  >
                    <Car className="w-3.5 h-3.5 text-amber-400" />
                    <span>Estacionando</span>
                    <span className="font-mono tabular-nums text-[9.5px] text-amber-400">+4 min</span>
                  </button>
                </div>
              </div>

              {/* Atalhos para visualizar Linha Shopee ou Mapa 10s */}
              {onOpenLiveViewer && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      onOpenLiveViewer(appointment, 'timeline');
                    }}
                    className="py-2 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ver Linha de Ruas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      onOpenLiveViewer(appointment, 'map');
                    }}
                    className="py-2 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ver Mapa 10s</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé Fixo de Ação (Regra Inegociável sticky bottom-0 z-20) */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/95 sticky bottom-0 z-20 flex flex-col gap-2">
          {step === 'cancel_reason' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('not_leaving')}
                className="py-2.5 px-3 rounded-[4px] bg-slate-900 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelWithReason}
                className="flex-1 py-2.5 px-3 rounded-[4px] bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4 text-white" />
                <span className="text-white">Confirmar Cancelamento</span>
              </button>
            </div>
          )}

          {step === 'route_tracer' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleStartLiveRoute(true)}
                className="w-full py-2.5 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
              >
                <Navigation className="w-4 h-4 text-white" />
                <span className="text-white">
                  Iniciar Rota e Compartilhar Ao Vivo ({metrics.etaMinutes} min)
                </span>
              </button>

              {!isProfessionalDeliveryMode && (
                <button
                  type="button"
                  onClick={() => handleStartLiveRoute(false)}
                  className="w-full py-2 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Apenas avisar que estou a caminho (Sem Mapa)</span>
                </button>
              )}
            </div>
          )}

          {step === 'active_transmitter' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  advanceRouteStep();
                }}
                className="py-2.5 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-emerald-400 text-[11px] font-bold cursor-pointer flex items-center justify-center gap-1"
                title="Simular avanço de 10s para a próxima rua da rota"
              >
                <FastForward className="w-3.5 h-3.5 text-emerald-400" />
                <span>Avançar Rua (10s)</span>
              </button>

              <button
                type="button"
                onClick={handleMarkArrived}
                className="flex-1 py-2.5 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
              >
                <Check className="w-4 h-4 text-white stroke-[2.5]" />
                <span className="text-white">Cheguei ao Destino</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface LiveTrackingDrawerModalProps {
  isOpen: boolean;
  appointment: BookingAppointment;
  initialTab?: 'timeline' | 'map';
  viewerRole?: 'salon' | 'client';
  onClose: () => void;
  onUpdateAppointment?: (updated: BookingAppointment) => void;
}

export const LiveTrackingDrawerModal: React.FC<LiveTrackingDrawerModalProps> = ({
  isOpen,
  appointment,
  initialTab = 'timeline',
  viewerRole = 'salon',
  onClose,
  onUpdateAppointment,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'map'>(initialTab);

  const { secondsUntilNextPing, isLiveActive, advanceRouteStep, reportAdversity } =
    useLiveRouteTracker({
      appointment,
      onUpdateAppointment,
      autoTickEnabled: isOpen,
    });

  if (!isOpen) return null;

  const checkpoints: LiveRouteCheckpoint[] =
    appointment.route_checkpoints && appointment.route_checkpoints.length > 0
      ? appointment.route_checkpoints
      : GOOGLE_MAPS_ROUTE_OPTIONS[0].streets.map((s, idx) => ({
          street: s.street,
          distanceText: s.distanceText,
          status: idx === 0 ? 'passed' : idx === 1 ? 'current' : 'upcoming',
          timestamp: idx <= 1 ? formatCurrentClockTime(idx === 0 ? -4 : 0) : undefined,
        }));

  const currentIdx = Math.max(
    0,
    checkpoints.findIndex((c) => c.status === 'current')
  );
  const progressPercent =
    appointment.tracking_status === 'arrived'
      ? 100
      : Math.min(92, Math.max(15, Math.round(((currentIdx + 1) / checkpoints.length) * 85)));

  const isArriving5Min =
    appointment.tracking_status === 'arriving_5min' ||
    ((appointment.eta_minutes ?? 12) <= 5 && (appointment.eta_minutes ?? 12) > 0);

  const actorLabel =
    appointment.service_location_type === 'home_delivery'
      ? `Profissional ${appointment.professionalName || appointment.professional}`
      : appointment.customerName || appointment.clientName || 'Cliente';

  const destinationLabel =
    appointment.service_location_type === 'home_delivery'
      ? appointment.address || 'Residência do Cliente'
      : appointment.salonName || 'Recepção do Salão';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-950 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-[6px] text-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo da Gaveta */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-[4px] bg-emerald-500 flex items-center justify-center text-white shrink-0">
              <Navigation className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-extrabold uppercase tracking-wider font-['Poppins'] text-white truncate">
                  {actorLabel}
                </h3>
                <span className="px-1.5 py-0.5 rounded-[3px] bg-emerald-500 text-white text-[9px] font-mono tabular-nums font-black shrink-0">
                  10s
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {appointment.selected_route_summary || 'Rota 1 • Via Av. Paulista e Av. Rebouças'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[4px] text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Alerta Automático de Chegada Iminente (ETA <= 5 min) */}
        {isArriving5Min && appointment.tracking_status !== 'arrived' && (
          <div className="px-4 py-2.5 bg-emerald-500 text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-white shrink-0 animate-bounce" />
              <span className="text-xs font-black text-white truncate">
                {viewerRole === 'salon'
                  ? `Chegando em ${appointment.eta_minutes ?? 4} min — Prepare a cadeira!`
                  : `Profissional chega em ${appointment.eta_minutes ?? 4} min!`}
              </span>
            </div>
            <span className="text-[10px] font-mono tabular-nums font-black text-white shrink-0">
              {formatCurrentClockTime(appointment.eta_minutes ?? 4)}
            </span>
          </div>
        )}

        {/* Alternador no Topo: Linha Shopee/Correios ⇄ Mapa Ao Vivo 10s */}
        <div className="p-3 bg-slate-900/60 border-b border-slate-800 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-[4px] bg-slate-950">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('timeline');
              }}
              className={`py-2 px-2.5 rounded-[3px] text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'timeline'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className={`w-3.5 h-3.5 ${activeTab === 'timeline' ? 'text-white' : 'text-slate-400'}`} />
              <span className={activeTab === 'timeline' ? 'text-white' : ''}>
                Linha de Ruas (Shopee)
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('map');
              }}
              className={`py-2 px-2.5 rounded-[3px] text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'map'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapIcon className={`w-3.5 h-3.5 ${activeTab === 'map' ? 'text-white' : 'text-slate-400'}`} />
              <span className={activeTab === 'map' ? 'text-white' : ''}>
                Mapa Ao Vivo (10s)
              </span>
            </button>
          </div>
        </div>

        {/* Conteúdo Rolável */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Resumo de Telemetria em Tempo Real */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-[4px] bg-slate-900">
              <span className="text-[9.5px] uppercase text-slate-400 block">ETA Chegada</span>
              <span className="text-sm font-mono tabular-nums font-black text-emerald-400 block mt-0.5">
                {appointment.tracking_status === 'arrived'
                  ? 'Chegou'
                  : `${appointment.eta_minutes ?? 12} min (${formatCurrentClockTime(appointment.eta_minutes ?? 12)})`}
              </span>
            </div>

            <div className="p-2.5 rounded-[4px] bg-slate-900">
              <span className="text-[9.5px] uppercase text-slate-400 block">Distância</span>
              <span className="text-sm font-mono tabular-nums font-bold text-white block mt-0.5">
                {appointment.tracking_status === 'arrived'
                  ? '0.0 km'
                  : `${appointment.distance_km ?? 2.4} km`}
              </span>
            </div>

            <div className="p-2.5 rounded-[4px] bg-slate-900">
              <span className="text-[9.5px] uppercase text-slate-400 block">Atualização</span>
              <span className="text-sm font-mono tabular-nums font-bold text-emerald-400 block mt-0.5">
                {isLiveActive ? `a cada ${secondsUntilNextPing}s` : 'Concluído'}
              </span>
            </div>
          </div>

          {/* ABA 1: LINHA DO TEMPO DE RUAS (ESTILO SHOPEE / CORREIOS) */}
          {activeTab === 'timeline' ? (
            <div className="space-y-1 pt-1">
              {/* Ponto Inicial */}
              <div className="flex items-start gap-3 pb-3">
                <div className="flex flex-col items-center">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                    <Check className="w-3 h-3 text-white stroke-[3]" />
                  </div>
                  <div className="w-0.5 h-6 bg-emerald-500/50 mt-1" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">
                      Partida Confirmada • Rota Iniciada
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">
                      {checkpoints[0]?.timestamp || formatCurrentClockTime(-6)}
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    {appointment.selected_route_summary || 'Rota 1 Recomendada via Google Maps'}
                  </p>
                </div>
              </div>

              {/* Lista Sequencial de Ruas da Rota */}
              {checkpoints.map((cp, index) => {
                const isPassed = cp.status === 'passed';
                const isCurrent = cp.status === 'current';
                const hasAdversity = Boolean(cp.adversity);

                return (
                  <div key={`${cp.street}-${index}`} className="flex items-start gap-3 pb-3">
                    <div className="flex flex-col items-center">
                      {isPassed ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                          <Check className="w-3 h-3 text-white stroke-[3]" />
                        </div>
                      ) : isCurrent ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white ring-4 ring-emerald-500/20 shrink-0">
                          <Navigation className="w-2.5 h-2.5 text-white" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                          <span className="w-2 h-2 rounded-full bg-slate-600" />
                        </div>
                      )}
                      {index < checkpoints.length && (
                        <div
                          className={`w-0.5 h-8 mt-1 ${
                            isPassed ? 'bg-emerald-500/60' : 'bg-slate-800'
                          }`}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-xs font-bold truncate ${
                            isCurrent
                              ? 'text-white'
                              : isPassed
                              ? 'text-slate-300'
                              : 'text-slate-500'
                          }`}
                        >
                          {isPassed ? `Passou por ${cp.street}` : isCurrent ? `Na ${cp.street} (Posição Atual)` : `Próxima: ${cp.street}`}
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                          {cp.timestamp || cp.distanceText || ''}
                        </span>
                      </div>

                      {isCurrent && (
                        <div className="flex items-center gap-2 text-[10.5px] text-emerald-400 font-semibold">
                          <span>Velocidade normal • Atualizado há {10 - secondsUntilNextPing}s</span>
                        </div>
                      )}

                      {hasAdversity && cp.adversity && (
                        <div className="p-2 rounded-[4px] bg-amber-500/15 text-amber-300 text-[10.5px] flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{cp.adversity.label}</span>
                          </span>
                          <span className="font-mono tabular-nums font-black text-amber-400">
                            +{cp.adversity.addedMinutes} min
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Ponto Final: Destino */}
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      appointment.tracking_status === 'arrived'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {appointment.service_location_type === 'home_delivery' ? (
                      <Home className="w-3 h-3" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        appointment.tracking_status === 'arrived'
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }`}
                    >
                      Chegada: {destinationLabel}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-emerald-400 font-bold">
                      ETA {formatCurrentClockTime(appointment.eta_minutes ?? 12)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ABA 2: MAPA AO VIVO 10S (RADAR GOOGLE MAPS DARK) */
            <div className="space-y-3">
              <div className="relative w-full h-60 rounded-[6px] bg-slate-900 overflow-hidden flex flex-col justify-between p-3.5">
                {/* Grade Cartográfica Estilizada Dark Mode */}
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                  }}
                />

                {/* Topo do Mapa: Indicador de Satélite Google Maps Live */}
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-[4px] bg-slate-950/90 text-emerald-400 text-[10px] font-mono tabular-nums font-bold flex items-center gap-1.5">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>GPS 10s • {appointment.current_street_name || 'Av. Rebouças'}</span>
                  </span>

                  <span className="px-2 py-1 rounded-[4px] bg-emerald-500 text-white text-[10px] font-mono tabular-nums font-black">
                    {appointment.eta_minutes ?? 12} min
                  </span>
                </div>

                {/* Trilha Visual da Rota com Pino Móvel em Tempo Real */}
                <div className="relative z-10 my-auto py-4 px-2">
                  <div className="relative w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {/* Pino de Origem */}
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      Partida
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {progressPercent}% concluído
                    </span>
                    <span className="flex items-center gap-1 text-white font-bold">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      {appointment.service_location_type === 'home_delivery' ? 'Cliente' : 'Salão'}
                    </span>
                  </div>

                  {/* Checkpoints na Linha do Mapa */}
                  <div className="grid grid-cols-4 gap-1 mt-3">
                    {checkpoints.slice(0, 4).map((cp, idx) => (
                      <div
                        key={cp.street}
                        className={`p-1.5 rounded-[4px] text-center truncate ${
                          cp.status === 'current'
                            ? 'bg-emerald-500 text-white font-bold'
                            : cp.status === 'passed'
                            ? 'bg-slate-950/80 text-emerald-400'
                            : 'bg-slate-950/50 text-slate-500'
                        }`}
                      >
                        <span className={`text-[9px] block truncate ${cp.status === 'current' ? 'text-white' : ''}`}>
                          {idx + 1}. {cp.street}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rodapé do Mapa: Coordenadas & Adversidade */}
                <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-950/90 px-2.5 py-1.5 rounded-[4px]">
                  <span>
                    LAT {(appointment.client_lat ?? -23.5614).toFixed(4)} • LNG{' '}
                    {(appointment.client_lng ?? -46.6558).toFixed(4)}
                  </span>
                  <span className="text-emerald-400 font-bold">Google Maps API</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé Fixo de Ação (Controles de Simulação & Homologação Ao Vivo) */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/95 sticky bottom-0 z-20 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              advanceRouteStep();
            }}
            className="py-2 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-emerald-400 text-[11px] font-bold cursor-pointer flex items-center gap-1.5"
          >
            <FastForward className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simular +10s (Avançar Rua)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticMedium();
              reportAdversity('traffic', 'Trânsito na via', 6);
            }}
            className="py-2 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-amber-400 text-[11px] font-bold cursor-pointer flex items-center gap-1"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>+6m Trânsito</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
          >
            <span className="text-white">Fechar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
