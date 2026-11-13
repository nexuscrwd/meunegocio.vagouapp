import { useState, useEffect, useCallback } from 'react';
import {
  BookingAppointment,
  LiveRouteCheckpoint,
  LiveAdversityReport,
  TransportMode,
  LiveTrackingStatus,
} from '../types';
import { updateAppointmentLiveTrackingInDb } from '../lib/supabase';

export interface GoogleMapsRouteOption {
  id: 'route_1' | 'route_2';
  badge: string;
  title: string;
  summary: string;
  baseEtaMinutes: number;
  distanceKm: number;
  polyline: string;
  streets: Array<{ street: string; distanceText: string }>;
}

const LEGACY_MOCK_STREETS = new Set([
  'av. paulista',
  'rua da consolação',
  'rua da consolacao',
  'av. rebouças',
  'av. reboucas',
  'rua oscar freire',
  'alameda santos',
  'av. brigadeiro luís antônio',
  'av. brigadeiro luis antonio',
  'av. brasil',
  'rua augusta',
]);

/**
 * Detecta se a lista de checkpoints contém o antigo mock fixo (Av. Paulista / Consolação / Rebouças / Oscar Freire)
 * para substituí-lo automaticamente pelas vias reais calculadas pela rota.
 */
export function isPlaceholderCheckpoints(
  checkpoints?: LiveRouteCheckpoint[] | null
): boolean {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) return true;
  const normalized = checkpoints.map((c) => String(c?.street || '').trim().toLowerCase());
  const legacyMatches = normalized.filter((s) => LEGACY_MOCK_STREETS.has(s)).length;
  return legacyMatches >= 2;
}

export const GOOGLE_MAPS_ROUTE_OPTIONS: GoogleMapsRouteOption[] = [
  {
    id: 'route_1',
    badge: 'Mais rápida • Tempo real',
    title: 'Rota Principal',
    summary: 'Malha viária calculada em tempo real',
    baseEtaMinutes: 12,
    distanceKm: 6.0,
    polyline: '',
    streets: [],
  },
  {
    id: 'route_2',
    badge: 'Alternativa',
    title: 'Rota Alternativa',
    summary: 'Trajeto alternativo na malha viária',
    baseEtaMinutes: 15,
    distanceKm: 7.2,
    polyline: '',
    streets: [],
  },
];

export function getAdjustedRouteMetrics(
  route: GoogleMapsRouteOption,
  mode: TransportMode
): { etaMinutes: number; distanceKm: number } {
  const factorMap: Record<TransportMode, number> = {
    motorcycle: 0.78,
    car: 1.0,
    driving: 1.0,
    rideshare: 1.05,
    bicycling: 1.6,
    transit: 1.45,
    walking: 3.4,
  };
  const factor = factorMap[mode] || 1.0;
  return {
    etaMinutes: Math.max(2, Math.round(route.baseEtaMinutes * factor)),
    distanceKm: route.distanceKm,
  };
}

export function formatCurrentClockTime(plusMinutes = 0): string {
  const d = new Date(Date.now() + plusMinutes * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function syncAppointmentAcrossStorageAndDb(
  appointment: BookingAppointment,
  patch: Partial<BookingAppointment>,
  onUpdateAppointment?: (updated: BookingAppointment) => void
): BookingAppointment {
  const nowIso = new Date().toISOString();
  const updatedApt: BookingAppointment = {
    ...appointment,
    ...patch,
    last_location_update: patch.last_location_update || nowIso,
  };

  // 1. Atualiza localStorage do Cliente (vagou_user_appointments)
  try {
    const rawUser = localStorage.getItem('vagou_user_appointments');
    if (rawUser) {
      const parsed: BookingAppointment[] = JSON.parse(rawUser);
      const exists = parsed.some(
        (a) => a.protocolCode === updatedApt.protocolCode || (a.id && a.id === updatedApt.id)
      );
      const nextList = exists
        ? parsed.map((a) =>
            a.protocolCode === updatedApt.protocolCode || (a.id && a.id === updatedApt.id)
              ? { ...a, ...updatedApt }
              : a
          )
        : [updatedApt, ...parsed];
      localStorage.setItem('vagou_user_appointments', JSON.stringify(nextList));
    }
  } catch {}

  // 2. Atualiza localStorage do Profissional/Salão (vagou_professional_appointments)
  try {
    const rawPro = localStorage.getItem('vagou_professional_appointments');
    if (rawPro) {
      const parsedPro: BookingAppointment[] = JSON.parse(rawPro);
      const existsPro = parsedPro.some(
        (a) => a.protocolCode === updatedApt.protocolCode || (a.id && a.id === updatedApt.id)
      );
      const nextProList = existsPro
        ? parsedPro.map((a) =>
            a.protocolCode === updatedApt.protocolCode || (a.id && a.id === updatedApt.id)
              ? { ...a, ...updatedApt }
              : a
          )
        : [updatedApt, ...parsedPro];
      localStorage.setItem('vagou_professional_appointments', JSON.stringify(nextProList));
    }
  } catch {}

  // 3. Dispara evento global na janela para que Agenda do Salão e Visão do Cliente atualizem instantaneamente
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('vagou:appointments-updated', {
        detail: { appointment: updatedApt },
      })
    );
  }

  // 4. Sincroniza com Supabase em background
  const idOrProto = updatedApt.id || updatedApt.protocolCode;
  if (idOrProto) {
    updateAppointmentLiveTrackingInDb(idOrProto, patch).catch(() => {});
  }

  if (onUpdateAppointment) {
    onUpdateAppointment(updatedApt);
  }

  return updatedApt;
}

interface UseLiveRouteTrackerProps {
  appointment: BookingAppointment | null;
  onUpdateAppointment?: (updated: BookingAppointment) => void;
  autoTickEnabled?: boolean;
}

export function useLiveRouteTracker({
  appointment,
  onUpdateAppointment,
  autoTickEnabled = true,
}: UseLiveRouteTrackerProps) {
  const [secondsUntilNextPing, setSecondsUntilNextPing] = useState<number>(10);

  const isLiveActive =
    appointment?.tracking_status === 'live_sharing' ||
    appointment?.tracking_status === 'arriving_5min';

  // Atualiza telemetria real a cada ciclo de 10s usando coordenadas reais do navegador
  const advanceRouteStep = useCallback(
    (gpsCoords?: { lat: number; lng: number; speedMps?: number | null }) => {
      if (!appointment) return;

      const hasRealCheckpoints =
        appointment.route_checkpoints &&
        appointment.route_checkpoints.length > 0 &&
        !isPlaceholderCheckpoints(appointment.route_checkpoints);

      if (!hasRealCheckpoints && !gpsCoords) {
        setSecondsUntilNextPing(10);
        return;
      }

      const checkpoints: LiveRouteCheckpoint[] = hasRealCheckpoints
        ? [...(appointment.route_checkpoints || [])]
        : [];

      const nowClock = formatCurrentClockTime();
      const currentEta = appointment.eta_minutes ?? 12;
      const currentDist = appointment.distance_km ?? 3.0;

      if (currentDist <= 0.15 || currentEta <= 0) {
        const completedCheckpoints: LiveRouteCheckpoint[] = checkpoints.map((c) => ({
          ...c,
          status: 'passed',
          timestamp: c.timestamp || nowClock,
        }));

        syncAppointmentAcrossStorageAndDb(
          appointment,
          {
            tracking_status: 'arrived',
            ...(completedCheckpoints.length > 0 ? { route_checkpoints: completedCheckpoints } : {}),
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
        setSecondsUntilNextPing(10);
        return;
      }

      const patch: Partial<BookingAppointment> = {};
      if (gpsCoords && Number.isFinite(gpsCoords.lat) && Number.isFinite(gpsCoords.lng)) {
        patch.client_lat = Number(gpsCoords.lat.toFixed(6));
        patch.client_lng = Number(gpsCoords.lng.toFixed(6));
      }

      if (Object.keys(patch).length > 0) {
        syncAppointmentAcrossStorageAndDb(appointment, patch, onUpdateAppointment);
      }

      setSecondsUntilNextPing(10);
    },
    [appointment, onUpdateAppointment]
  );

  // Reportar adversidade de trânsito em 1 toque (+X min)
  const reportAdversity = useCallback(
    (type: 'traffic' | 'roadwork' | 'parking', label: string, addedMinutes: number) => {
      if (!appointment) return;
      const nowClock = formatCurrentClockTime();
      const currentStreet =
        appointment.current_street_name ||
        appointment.route_checkpoints?.find((c) => c.status === 'current')?.street ||
        'Via atual';

      const adversityObj: LiveAdversityReport = {
        type,
        label,
        street: currentStreet,
        addedMinutes,
        reportedAt: nowClock,
      };

      const hasRealCheckpoints =
        appointment.route_checkpoints &&
        appointment.route_checkpoints.length > 0 &&
        !isPlaceholderCheckpoints(appointment.route_checkpoints);

      const updatedCheckpoints: LiveRouteCheckpoint[] = (
        hasRealCheckpoints ? appointment.route_checkpoints || [] : []
      ).map((cp) => {
        if (cp.status === 'current' || cp.street === currentStreet) {
          return {
            ...cp,
            adversity: {
              type,
              label,
              addedMinutes,
            },
          };
        }
        return cp;
      });

      const prevDelay = appointment.delay_minutes || 0;
      const prevEta = appointment.eta_minutes ?? 12;
      const newEta = prevEta + addedMinutes;

      syncAppointmentAcrossStorageAndDb(
        appointment,
        {
          active_adversity: adversityObj,
          delay_minutes: prevDelay + addedMinutes,
          eta_minutes: newEta,
          tracking_status: newEta <= 5 ? 'arriving_5min' : 'live_sharing',
          ...(updatedCheckpoints.length > 0 ? { route_checkpoints: updatedCheckpoints } : {}),
          current_street_name: currentStreet,
        },
        onUpdateAppointment
      );
    },
    [appointment, onUpdateAppointment]
  );

  // Ciclo de 10 segundos (contagem regressiva visual de 10s a 1s + ping GPS real)
  useEffect(() => {
    if (!isLiveActive || !autoTickEnabled) {
      setSecondsUntilNextPing(10);
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsUntilNextPing((prev) => {
        if (prev <= 1) {
          if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                advanceRouteStep({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  speedMps: pos.coords.speed,
                });
              },
              () => {
                advanceRouteStep();
              },
              { enableHighAccuracy: true, timeout: 3500, maximumAge: 5000 }
            );
          } else {
            advanceRouteStep();
          }
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isLiveActive, autoTickEnabled, advanceRouteStep]);

  return {
    secondsUntilNextPing,
    isLiveActive,
    advanceRouteStep,
    reportAdversity,
  };
}
