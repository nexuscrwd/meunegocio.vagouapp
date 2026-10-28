import React, { useState, useMemo, useEffect } from 'react';
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
  Map as MapIcon,
  ChevronRight,
  FastForward,
  Home,
  Sparkles,
  ArrowLeft,
  ExternalLink,
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
import {
  buildTransportDeepLinks,
  formatMaxDepartureTime,
  TransportMode as BookingTransportMode,
  TRANSPORT_MODE_META,
} from '../../utils/bookingSlots';
import {
  computeGoogleDetailedRoute,
  fetchGoogleModalRouteMatrix,
  GoogleComputedRouteResult,
  ModalMatrixMap,
} from '../../services/googleMapsService';
import { InteractiveGoogleRouteMap } from './InteractiveGoogleRouteMap';
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

function normalizeBookingTransportMode(mode?: TransportMode): BookingTransportMode {
  if (mode === 'walking') return 'walking';
  if (mode === 'bicycling') return 'bicycling';
  if (mode === 'motorcycle') return 'motorcycle';
  if (mode === 'transit') return 'transit';
  if (mode === 'rideshare') return 'rideshare';
  return 'car';
}

const MAP_COMPATIBLE_MODES: Array<{
  key: BookingTransportMode;
  trackingKey: TransportMode;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { key: 'walking', trackingKey: 'walking', label: 'A pé', Icon: Footprints },
  { key: 'bicycling', trackingKey: 'bicycling', label: 'Bicicleta', Icon: Bike },
  { key: 'motorcycle', trackingKey: 'motorcycle', label: 'Moto', Icon: Navigation },
  { key: 'car', trackingKey: 'driving', label: 'Carro', Icon: Car },
  { key: 'transit', trackingKey: 'transit', label: 'Transp. Público', Icon: Bus },
];

export const LiveRouteDepartureModal: React.FC<LiveRouteDepartureModalProps> = ({
  isOpen,
  appointment,
  isProfessionalDeliveryMode = false,
  onClose,
  onUpdateAppointment,
  onCancelWithReason,
  onRequestReschedule,
}) => {
  const isAlreadySharing =
    appointment.tracking_status === 'live_sharing' ||
    appointment.tracking_status === 'arriving_5min';

  const [step, setStep] = useState<'question' | 'not_leaving' | 'cancel_reason' | 'in_app_map'>(() => {
    if (isAlreadySharing || isProfessionalDeliveryMode) return 'in_app_map';
    return 'question';
  });

  const [activeViewTab, setActiveViewTab] = useState<'map' | 'timeline'>('map');
  const [isNavigating, setIsNavigating] = useState<boolean>(isAlreadySharing);

  const [transportMode, setTransportMode] = useState<TransportMode>(
    appointment.transport_mode || 'driving'
  );
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelError, setCancelError] = useState<string>('');

  const [liveRouteData, setLiveRouteData] = useState<GoogleComputedRouteResult | null>(null);
  const [modalMatrix, setModalMatrix] = useState<ModalMatrixMap>({});

  const { secondsUntilNextPing, advanceRouteStep, reportAdversity } = useLiveRouteTracker({
    appointment,
    onUpdateAppointment,
    autoTickEnabled: isOpen && (isAlreadySharing || isNavigating),
  });

  const selectedRoute = GOOGLE_MAPS_ROUTE_OPTIONS[0];
  const bookingTransportMode = normalizeBookingTransportMode(transportMode);

  const fallbackMetrics = useMemo(
    () => getAdjustedRouteMetrics(selectedRoute, transportMode),
    [selectedRoute, transportMode]
  );

  const metrics = useMemo(() => {
    const matrixEntry = modalMatrix[bookingTransportMode];
    if (liveRouteData) {
      return {
        distanceKm: liveRouteData.distanceKm,
        etaMinutes: liveRouteData.etaMinutes,
      };
    }
    if (matrixEntry) {
      return {
        distanceKm: matrixEntry.distanceKm,
        etaMinutes: matrixEntry.etaMinutes,
      };
    }
    return fallbackMetrics;
  }, [liveRouteData, modalMatrix, bookingTransportMode, fallbackMetrics]);

  const clientOriginAddress = useMemo(() => {
    const anyApt = appointment as any;
    return (
      anyApt.originFormattedAddress ||
      anyApt.origin_formatted_address ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('vagou_user_address') ||
          localStorage.getItem('vagou_user_cep') ||
          'Endereço de Saída do Cliente'
        : 'Endereço de Saída do Cliente')
    );
  }, [appointment]);

  const salonDestAddress = useMemo(() => {
    return appointment.address || appointment.salonName || 'Estabelecimento';
  }, [appointment]);

  // Busca Rota Real (Routes API v2) + Matriz Simultânea dos 5 Modais
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const anyApt = appointment as any;

    computeGoogleDetailedRoute({
      originLat: appointment.client_lat ?? anyApt.originLat,
      originLng: appointment.client_lng ?? anyApt.originLng,
      originAddress: clientOriginAddress,
      destLat: anyApt.salonLat,
      destLng: anyApt.salonLng,
      destAddress: salonDestAddress,
      mode: bookingTransportMode,
    }).then((res) => {
      if (!active || !res) return;
      setLiveRouteData(res);

      // Se ainda não tiver checkpoints reais salvos ou mudou de modal, atualiza com as ruas reais da Routes API v2
      if (res.checkpoints.length > 0) {
        syncAppointmentAcrossStorageAndDb(
          appointment,
          {
            selected_route_summary: res.description,
            route_checkpoints: res.checkpoints,
            current_street_name: res.checkpoints[0].street,
            eta_minutes: res.etaMinutes,
            distance_km: res.distanceKm,
          },
          onUpdateAppointment
        );
      }
    });

    fetchGoogleModalRouteMatrix({
      originLat: appointment.client_lat ?? anyApt.originLat,
      originLng: appointment.client_lng ?? anyApt.originLng,
      originAddress: clientOriginAddress,
      destLat: anyApt.salonLat,
      destLng: anyApt.salonLng,
      destAddress: salonDestAddress,
    }).then((matrix) => {
      if (active && matrix) {
        setModalMatrix(matrix);
      }
    });

    return () => {
      active = false;
    };
  }, [isOpen, bookingTransportMode, clientOriginAddress, salonDestAddress]);

  const transportLinks = useMemo(() => {
    const anyApt = appointment as any;
    return buildTransportDeepLinks({
      originAddress: clientOriginAddress,
      originLat: appointment.client_lat ?? anyApt.originLat,
      originLng: appointment.client_lng ?? anyApt.originLng,
      salonName: appointment.salonName,
      salonAddress: salonDestAddress,
      salonLat: anyApt.salonLat,
      salonLng: anyApt.salonLng,
      transportMode: bookingTransportMode,
    });
  }, [appointment, clientOriginAddress, salonDestAddress, bookingTransportMode]);

  const maxDepartureTimeFormatted = useMemo(() => {
    return formatMaxDepartureTime(appointment.time || '10:00', metrics.etaMinutes);
  }, [appointment.time, metrics.etaMinutes]);

  if (!isOpen) return null;

  const prepBuffer = appointment.prep_buffer_minutes ?? 15;
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

  const handleStartInAppMapRoute = (autoActivateNavigation = false) => {
    hapticSuccess();
    const nowClock = formatCurrentClockTime();
    const initialCheckpoints: LiveRouteCheckpoint[] =
      liveRouteData?.checkpoints && liveRouteData.checkpoints.length > 0
        ? liveRouteData.checkpoints
        : selectedRoute.streets.map((s, idx) => ({
            street: s.street,
            distanceText: s.distanceText,
            status: idx === 0 ? 'current' : 'upcoming',
            timestamp: idx === 0 ? nowClock : undefined,
          }));

    const nextStatus = metrics.etaMinutes <= 5 ? 'arriving_5min' : 'live_sharing';

    syncAppointmentAcrossStorageAndDb(
      appointment,
      {
        tracking_status: nextStatus,
        transport_mode: transportMode,
        selected_route_summary: liveRouteData?.description || selectedRoute.summary,
        route_polyline: liveRouteData?. decodedPath || selectedRoute.polyline,
        current_street_name: initialCheckpoints[0]?.street || selectedRoute.streets[0].street,
        route_checkpoints: initialCheckpoints,
        eta_minutes: metrics.etaMinutes,
        distance_km: metrics.distanceKm,
        delay_minutes: 0,
        active_adversity: null,
        client_lat: appointment.client_lat ?? -23.5614,
        client_lng: appointment.client_lng ?? -46.6558,
      },
      onUpdateAppointment
    );

    if (autoActivateNavigation) {
      setIsNavigating(true);
    }
    setActiveViewTab('map');
    setStep('in_app_map');
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
    setIsNavigating(false);
    onClose();
  };

  const checkpoints: LiveRouteCheckpoint[] =
    appointment.route_checkpoints && appointment.route_checkpoints.length > 0
      ? appointment.route_checkpoints
      : liveRouteData?.checkpoints && liveRouteData.checkpoints.length > 0
      ? liveRouteData.checkpoints
      : selectedRoute.streets.map((s, idx) => ({
          street: s.street,
          distanceText: s.distanceText,
          status: idx === 0 ? 'current' : 'upcoming',
          timestamp: idx === 0 ? formatCurrentClockTime(0) : undefined,
        }));

  const activeStepIndex = useMemo(() => {
    const idx = checkpoints.findIndex((c) => c.status === 'current');
    return idx >= 0 ? idx : 0;
  }, [checkpoints]);

  const destinationLabel =
    appointment.service_location_type === 'home_delivery'
      ? appointment.address || 'Residência do Cliente'
      : appointment.salonName || 'Recepção do Salão';

  const anyApt = appointment as any;

  // SE ESTIVER NA TELA EXPANDIDA DE MAPA IN-APP + LINHA DO TEMPO
  if (step === 'in_app_map') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-2 bg-black/85 backdrop-blur-xs overflow-hidden animate-in fade-in duration-150">
        <div
          className="w-full h-full sm:max-w-5xl sm:max-h-[96vh] bg-slate-950 sm:border sm:border-slate-800 sm:rounded-[4px] text-white shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabeçalho da Tela Expandida */}
          <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setStep('question');
                }}
                className="w-7 h-7 rounded-[4px] bg-slate-800 text-slate-200 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Voltar"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-500" />
              </button>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-extrabold font-['Poppins'] leading-snug text-white truncate">
                  Mapa da Rota • {TRANSPORT_MODE_META[bookingTransportMode].shortLabel}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 truncate">
                  {appointment.protocolCode} • {appointment.serviceTitle || appointment.service} às{' '}
                  {appointment.time || '10:00'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={
                  bookingTransportMode === 'transit'
                    ? transportLinks.googleMapsTransitUrl
                    : transportLinks.googleMapsUrl
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs whitespace-nowrap"
                title="Abrir no aplicativo externo do Google Maps"
              >
                <ExternalLink className="w-3 h-3 text-white shrink-0" />
                <span className="text-white">Abrir Externo</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-[4px] bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barra Superior: Alternador de Abas (Mapa ⇄ Linha do Tempo) + Modalidades + Resumo */}
          <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-950 space-y-2 shrink-0">
            {/* Abas: Mapa vs Linha do Tempo */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-[4px] bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setActiveViewTab('map');
                }}
                className={`py-2 px-2.5 rounded-[3px] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  activeViewTab === 'map'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <MapIcon className={`w-3.5 h-3.5 shrink-0 ${activeViewTab === 'map' ? 'text-white' : 'text-emerald-500'}`} />
                <span className={activeViewTab === 'map' ? 'text-white' : ''}>Mapa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setActiveViewTab('timeline');
                }}
                className={`py-2 px-2.5 rounded-[3px] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                  activeViewTab === 'timeline'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Clock className={`w-3.5 h-3.5 shrink-0 ${activeViewTab === 'timeline' ? 'text-white' : 'text-emerald-500'}`} />
                <span className={activeViewTab === 'timeline' ? 'text-white' : ''}>Linha do Tempo</span>
              </button>
            </div>

            {/* Seletor Rápido de Modalidade com Tempos Reais (Routes API v2 Matrix) */}
            <div className="grid grid-cols-5 gap-1.5">
              {MAP_COMPATIBLE_MODES.map((opt) => {
                const isSelectedMode = bookingTransportMode === opt.key;
                const ModeIcon = opt.Icon;
                const matrixItem = modalMatrix[opt.key];
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setTransportMode(opt.trackingKey);
                      const nextMetrics =
                        matrixItem || getAdjustedRouteMetrics(selectedRoute, opt.trackingKey);
                      syncAppointmentAcrossStorageAndDb(
                        appointment,
                        {
                          transport_mode: opt.trackingKey,
                          eta_minutes: nextMetrics.etaMinutes,
                          distance_km: nextMetrics.distanceKm,
                        },
                        onUpdateAppointment
                      );
                    }}
                    className={`py-1.5 px-1 rounded-[4px] font-bold text-[10px] sm:text-[11px] flex flex-col items-center justify-center gap-0.5 transition cursor-pointer text-center ${
                      isSelectedMode
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-slate-900 text-slate-300 hover:text-white'
                    }`}
                  >
                    <ModeIcon className={`w-3.5 h-3.5 shrink-0 ${isSelectedMode ? 'text-white' : 'text-emerald-500'}`} />
                    <span className={`leading-tight whitespace-nowrap truncate max-w-full ${isSelectedMode ? 'text-white' : ''}`}>
                      {opt.label}
                    </span>
                    {matrixItem && (
                      <span
                        className={`text-[9px] font-mono tabular-nums leading-none ${
                          isSelectedMode ? 'text-white' : 'text-emerald-400'
                        }`}
                      >
                        {matrixItem.etaMinutes}m
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Faixa de Resumo Rápido da Rota */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] font-bold text-slate-200">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">{clientOriginAddress}</span>
                <span className="text-emerald-500 shrink-0">➔</span>
                <span className="text-emerald-500 truncate">{appointment.salonName}</span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span>{metrics.distanceKm} km</span>
                <span>•</span>
                <span>~{metrics.etaMinutes} min</span>
                <span>•</span>
                <span>
                  Saída máx. <strong className="text-emerald-500">{maxDepartureTimeFormatted}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Conteúdo Principal: Aba Mapa (Interactive Google Maps In-App sem caixa branca) vs Aba Linha do Tempo */}
          {activeViewTab === 'map' ? (
            <InteractiveGoogleRouteMap
              originLat={appointment.client_lat ?? anyApt.originLat ?? -23.5505}
              originLng={appointment.client_lng ?? anyApt.originLng ?? -46.6333}
              originLabel={clientOriginAddress}
              destLat={anyApt.salonLat ?? -23.5621}
              destLng={anyApt.salonLng ?? -46.4795}
              destLabel={appointment.salonName || salonDestAddress}
              routeData={liveRouteData}
              activeStepIndex={activeStepIndex}
              isNavigating={isNavigating}
              fallbackEmbedUrl={transportLinks.googleMapsEmbedUrl}
              onStartNavigation={() => {
                setIsNavigating(true);
                handleStartInAppMapRoute(true);
              }}
              onAdvanceStep={() => {
                advanceRouteStep();
              }}
              onLiveGpsUpdate={(lat, lng, snappedStreet) => {
                const currentEta = appointment.eta_minutes ?? metrics.etaMinutes;
                syncAppointmentAcrossStorageAndDb(
                  appointment,
                  {
                    client_lat: lat,
                    client_lng: lng,
                    ...(snappedStreet ? { current_street_name: snappedStreet } : {}),
                    tracking_status: currentEta <= 5 ? 'arriving_5min' : 'live_sharing',
                  },
                  onUpdateAppointment
                );
              }}
              onArriveAtDestination={handleMarkArrived}
            />
          ) : (
            <div className="flex-1 w-full overflow-y-auto p-4 space-y-4 text-xs">
              {/* Resumo de Telemetria em Tempo Real */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-[4px] bg-slate-900">
                  <span className="text-[9.5px] uppercase text-slate-400 block">ETA Chegada</span>
                  <span className="text-sm font-mono tabular-nums font-black text-emerald-400 block mt-0.5">
                    {appointment.tracking_status === 'arrived'
                      ? 'Chegou'
                      : `${appointment.eta_minutes ?? metrics.etaMinutes} min (${formatCurrentClockTime(
                          appointment.eta_minutes ?? metrics.etaMinutes
                        )})`}
                  </span>
                </div>

                <div className="p-2.5 rounded-[4px] bg-slate-900">
                  <span className="text-[9.5px] uppercase text-slate-400 block">Distância</span>
                  <span className="text-sm font-mono tabular-nums font-bold text-white block mt-0.5">
                    {appointment.distance_km ?? metrics.distanceKm} km
                  </span>
                </div>

                <div className="p-2.5 rounded-[4px] bg-slate-900">
                  <span className="text-[9.5px] uppercase text-slate-400 block">Ping GPS</span>
                  <span className="text-sm font-mono tabular-nums font-bold text-emerald-400 block mt-0.5">
                    a cada {secondsUntilNextPing}s
                  </span>
                </div>
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

              {/* Sequência da Linha do Tempo (Gerada pela Routes API v2) */}
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
                        Partida Confirmada • {clientOriginAddress}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-slate-400">
                        {checkpoints[0]?.timestamp || formatCurrentClockTime(-2)}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-400">
                      Modalidade: {TRANSPORT_MODE_META[bookingTransportMode].label}
                    </p>
                  </div>
                </div>

                {/* Lista Sequencial de Ruas e Manobras Reais da Rota */}
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
                            className={`text-xs font-bold leading-snug ${
                              isCurrent
                                ? 'text-white'
                                : isPassed
                                ? 'text-slate-300'
                                : 'text-slate-500'
                            }`}
                          >
                            {isPassed
                              ? `Concluído: ${cp.street}`
                              : isCurrent
                              ? `Agora: ${cp.street}`
                              : `Próximo: ${cp.street}`}
                          </span>
                          <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                            {cp.timestamp || cp.distanceText || ''}
                          </span>
                        </div>

                        {isCurrent && (
                          <div className="flex items-center gap-2 text-[10.5px] text-emerald-400 font-semibold">
                            <span>Em deslocamento • Atualizado há {10 - secondsUntilNextPing}s</span>
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
                        Atendimento às {appointment.time || '10:00'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rodapé Fixo de Ação (sticky bottom-0 z-20) */}
          <div className="sticky bottom-0 z-20 px-3.5 py-2.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              {!isNavigating ? (
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setIsNavigating(true);
                    handleStartInAppMapRoute(true);
                  }}
                  className="py-2 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <Navigation className="w-3.5 h-3.5 text-white shrink-0" />
                  <span className="text-white">Iniciar Trajeto</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleMarkArrived}
                  className="py-2 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap shadow-xs"
                >
                  <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5]" />
                  <span className="text-white">Cheguei ao Destino</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  advanceRouteStep();
                }}
                className="py-2 px-2.5 rounded-[4px] bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap"
                title="Avançar para a próxima rua da rota"
              >
                <FastForward className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>+10s</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {(bookingTransportMode === 'car' || bookingTransportMode === 'motorcycle') && (
                <a
                  href={transportLinks.wazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-[4px] bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-white">Waze</span>
                  <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0" />
                </a>
              )}

              <a
                href={
                  bookingTransportMode === 'transit'
                    ? transportLinks.googleMapsTransitUrl
                    : transportLinks.googleMapsUrl
                }
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap shadow-xs"
              >
                <MapPin className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="text-white">Google Maps</span>
                <ExternalLink className="w-3 h-3 text-white shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          {/* PASSO 1: PERGUNTA PRÉ-PARTIDA (ETA + 15 MIN) */}
          {step === 'question' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-[4px] bg-slate-900 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 rounded-[3px] bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3 h-3 text-white shrink-0" />
                    <span className="text-white font-mono tabular-nums">
                      Alerta Pré-Partida (ETA + {prepBuffer}m)
                    </span>
                  </span>
                  <span className="text-[11px] font-mono tabular-nums font-bold text-emerald-400 shrink-0">
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
                  onClick={() => handleStartInAppMapRoute(false)}
                  className="py-3 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer flex flex-col items-center justify-center gap-1 active:scale-98 shadow-sm"
                >
                  <span className="text-white flex items-center gap-1">
                    <Navigation className="w-3.5 h-3.5 text-white" />
                    Sim, estou saindo
                  </span>
                  <span className="text-[9.5px] font-normal text-white">
                    Abrir Mapa e Linha do Tempo
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* PASSO 1B: RESPONDEU "NÃO" -> VAI COMPARECER OU NÃO? */}
          {step === 'not_leaving' && (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-[4px] bg-slate-900 space-y-1.5">
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
                  className="w-full py-2.5 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-xs transition cursor-pointer flex items-center justify-between active:scale-98"
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
                  className="w-full py-2.5 px-3 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-rose-400 font-bold text-xs transition cursor-pointer flex items-center justify-between active:scale-98"
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
        </div>

        {/* Rodapé Fixo de Ação (Regra Inegociável sticky bottom-0 z-20) */}
        {step === 'cancel_reason' && (
          <div className="p-3.5 border-t border-slate-800 bg-slate-950/95 sticky bottom-0 z-20 flex items-center gap-2">
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
  initialTab = 'map',
  viewerRole = 'salon',
  onClose,
  onUpdateAppointment,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'map'>(initialTab);
  const [isNavigating, setIsNavigating] = useState<boolean>(true);
  const [transportMode, setTransportMode] = useState<TransportMode>(
    appointment.transport_mode || 'driving'
  );
  const [liveRouteData, setLiveRouteData] = useState<GoogleComputedRouteResult | null>(null);
  const [modalMatrix, setModalMatrix] = useState<ModalMatrixMap>({});

  const { secondsUntilNextPing, isLiveActive, advanceRouteStep, reportAdversity } =
    useLiveRouteTracker({
      appointment,
      onUpdateAppointment,
      autoTickEnabled: isOpen,
    });

  const bookingTransportMode = normalizeBookingTransportMode(transportMode);

  const clientOriginAddress = useMemo(() => {
    const anyApt = appointment as any;
    return (
      anyApt.originFormattedAddress ||
      anyApt.origin_formatted_address ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('vagou_user_address') ||
          localStorage.getItem('vagou_user_cep') ||
          'Endereço de Saída do Cliente'
        : 'Endereço de Saída do Cliente')
    );
  }, [appointment]);

  const salonDestAddress = useMemo(() => {
    return appointment.address || appointment.salonName || 'Estabelecimento';
  }, [appointment]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const anyApt = appointment as any;

    computeGoogleDetailedRoute({
      originLat: appointment.client_lat ?? anyApt.originLat,
      originLng: appointment.client_lng ?? anyApt.originLng,
      originAddress: clientOriginAddress,
      destLat: anyApt.salonLat,
      destLng: anyApt.salonLng,
      destAddress: salonDestAddress,
      mode: bookingTransportMode,
    }).then((res) => {
      if (active && res) {
        setLiveRouteData(res);
      }
    });

    fetchGoogleModalRouteMatrix({
      originLat: appointment.client_lat ?? anyApt.originLat,
      originLng: appointment.client_lng ?? anyApt.originLng,
      originAddress: clientOriginAddress,
      destLat: anyApt.salonLat,
      destLng: anyApt.salonLng,
      destAddress: salonDestAddress,
    }).then((matrix) => {
      if (active && matrix) {
        setModalMatrix(matrix);
      }
    });

    return () => {
      active = false;
    };
  }, [isOpen, bookingTransportMode, clientOriginAddress, salonDestAddress]);

  const transportLinks = useMemo(() => {
    const anyApt = appointment as any;
    return buildTransportDeepLinks({
      originAddress: clientOriginAddress,
      originLat: appointment.client_lat ?? anyApt.originLat,
      originLng: appointment.client_lng ?? anyApt.originLng,
      salonName: appointment.salonName,
      salonAddress: salonDestAddress,
      salonLat: anyApt.salonLat,
      salonLng: anyApt.salonLng,
      transportMode: bookingTransportMode,
    });
  }, [appointment, clientOriginAddress, salonDestAddress, bookingTransportMode]);

  if (!isOpen) return null;

  const checkpoints: LiveRouteCheckpoint[] =
    appointment.route_checkpoints && appointment.route_checkpoints.length > 0
      ? appointment.route_checkpoints
      : liveRouteData?.checkpoints && liveRouteData.checkpoints.length > 0
      ? liveRouteData.checkpoints
      : GOOGLE_MAPS_ROUTE_OPTIONS[0].streets.map((s, idx) => ({
          street: s.street,
          distanceText: s.distanceText,
          status: idx === 0 ? 'passed' : idx === 1 ? 'current' : 'upcoming',
          timestamp: idx <= 1 ? formatCurrentClockTime(idx === 0 ? -4 : 0) : undefined,
        }));

  const activeStepIndex = checkpoints.findIndex((c) => c.status === 'current');

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

  const anyApt = appointment as any;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-2 bg-black/85 backdrop-blur-xs overflow-hidden animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full h-full sm:max-w-5xl sm:max-h-[96vh] bg-slate-950 sm:border sm:border-slate-800 sm:rounded-[4px] text-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Topo da Tela Expandida */}
        <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-[4px] bg-emerald-500 flex items-center justify-center text-white shrink-0">
              <Navigation className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider font-['Poppins'] text-white truncate">
                  {actorLabel} • {TRANSPORT_MODE_META[bookingTransportMode].shortLabel}
                </h3>
                <span className="px-1.5 py-0.5 rounded-[3px] bg-emerald-500 text-white text-[9px] font-mono tabular-nums font-black shrink-0">
                  10s
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {appointment.salonName} • Atendimento às {appointment.time || '10:00'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={
                bookingTransportMode === 'transit'
                  ? transportLinks.googleMapsTransitUrl
                  : transportLinks.googleMapsUrl
              }
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs whitespace-nowrap"
            >
              <ExternalLink className="w-3 h-3 text-white shrink-0" />
              <span className="text-white">Abrir Externo</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-[4px] bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Alerta Automático de Chegada Iminente (ETA <= 5 min) */}
        {isArriving5Min && appointment.tracking_status !== 'arrived' && (
          <div className="px-4 py-2 bg-emerald-500 text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-white shrink-0" />
              <span className="text-xs font-black text-white truncate">
                {viewerRole === 'salon'
                  ? `Chegando em ${appointment.eta_minutes ?? 4} min — Prepare a cadeira!`
                  : `Chegada prevista em ${appointment.eta_minutes ?? 4} min!`}
              </span>
            </div>
            <span className="text-[10px] font-mono tabular-nums font-black text-white shrink-0">
              {formatCurrentClockTime(appointment.eta_minutes ?? 4)}
            </span>
          </div>
        )}

        {/* Alternador no Topo: Mapa ⇄ Linha do Tempo + Troca Rápida de Modalidade */}
        <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800 space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-[4px] bg-slate-900">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('map');
              }}
              className={`py-2 px-2.5 rounded-[3px] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'map'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <MapIcon className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'map' ? 'text-white' : 'text-emerald-500'}`} />
              <span className={activeTab === 'map' ? 'text-white' : ''}>
                Mapa
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('timeline');
              }}
              className={`py-2 px-2.5 rounded-[3px] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                activeTab === 'timeline'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Clock className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'timeline' ? 'text-white' : 'text-emerald-500'}`} />
              <span className={activeTab === 'timeline' ? 'text-white' : ''}>
                Linha do Tempo
              </span>
            </button>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {MAP_COMPATIBLE_MODES.map((opt) => {
              const isSelectedMode = bookingTransportMode === opt.key;
              const ModeIcon = opt.Icon;
              const matrixItem = modalMatrix[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setTransportMode(opt.trackingKey);
                  }}
                  className={`py-1.5 px-1 rounded-[4px] font-bold text-[10px] sm:text-[11px] flex flex-col items-center justify-center gap-0.5 transition cursor-pointer text-center ${
                    isSelectedMode
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-900 text-slate-300 hover:text-white'
                  }`}
                >
                  <ModeIcon className={`w-3.5 h-3.5 shrink-0 ${isSelectedMode ? 'text-white' : 'text-emerald-500'}`} />
                  <span className={`leading-tight whitespace-nowrap truncate max-w-full ${isSelectedMode ? 'text-white' : ''}`}>
                    {opt.label}
                  </span>
                  {matrixItem && (
                    <span
                      className={`text-[9px] font-mono tabular-nums leading-none ${
                        isSelectedMode ? 'text-white' : 'text-emerald-400'
                      }`}
                    >
                      {matrixItem.etaMinutes}m
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo Principal: Aba Mapa (Interactive Google Maps In-App) vs Aba Linha do Tempo */}
        {activeTab === 'map' ? (
          <InteractiveGoogleRouteMap
            originLat={appointment.client_lat ?? anyApt.originLat ?? -23.5505}
            originLng={appointment.client_lng ?? anyApt.originLng ?? -46.6333}
            originLabel={clientOriginAddress}
            destLat={anyApt.salonLat ?? -23.5621}
            destLng={anyApt.salonLng ?? -46.4795}
            destLabel={appointment.salonName || salonDestAddress}
            routeData={liveRouteData}
            activeStepIndex={Math.max(0, activeStepIndex)}
            isNavigating={isNavigating}
            fallbackEmbedUrl={transportLinks.googleMapsEmbedUrl}
            onStartNavigation={() => setIsNavigating(true)}
            onAdvanceStep={() => advanceRouteStep()}
          />
        ) : (
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
                    Saída: {clientOriginAddress}
                  </p>
                </div>
              </div>

              {/* Lista Sequencial de Ruas e Manobras da Rota */}
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
                          className={`text-xs font-bold leading-snug ${
                            isCurrent
                              ? 'text-white'
                              : isPassed
                              ? 'text-slate-300'
                              : 'text-slate-500'
                          }`}
                        >
                          {isPassed
                            ? `Concluído: ${cp.street}`
                            : isCurrent
                            ? `Agora: ${cp.street}`
                            : `Próximo: ${cp.street}`}
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
          </div>
        )}

        {/* Rodapé Fixo de Ação */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900 sticky bottom-0 z-20 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                advanceRouteStep();
              }}
              className="py-2 px-2.5 rounded-[4px] bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <FastForward className="w-3.5 h-3.5 text-emerald-400" />
              <span>+10s Rua</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticMedium();
                reportAdversity('traffic', 'Trânsito na via', 6);
              }}
              className="py-2 px-2.5 rounded-[4px] bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-bold cursor-pointer flex items-center gap-1 whitespace-nowrap"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>+6m Trânsito</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {(bookingTransportMode === 'car' || bookingTransportMode === 'motorcycle') && (
              <a
                href={transportLinks.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-3 rounded-[4px] bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-white">Waze</span>
                <ExternalLink className="w-3 h-3 text-emerald-400 shrink-0" />
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer"
            >
              <span className="text-white">Fechar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
