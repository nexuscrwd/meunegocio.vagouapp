import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  ColorScheme,
  Map as GoogleMapCanvas,
  Polyline as GooglePolyline,
  RenderingType,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { Navigation } from 'lucide-react';
import {
  GoogleComputedRouteResult,
  GoogleRouteStep,
  computeGoogleDetailedRoute,
  getGoogleMapsApiKey,
  snapAndReverseGeocodeGps,
  formatDistanceMeters,
} from '../../services/googleMapsService';
import { TransportMode } from '../../types';
import { isValidAvatarUrlString } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight } from '../../utils/haptics';

interface InteractiveGoogleRouteMapProps {
  originLat?: number;
  originLng?: number;
  originLabel: string;
  destLat?: number;
  destLng?: number;
  destLabel: string;
  destAddress?: string;
  mode?: TransportMode;
  userAvatarUrl?: string;
  routeData: GoogleComputedRouteResult | null;
  initialDistanceKm: number;
  initialEtaMinutes: number;
  fallbackEmbedUrl?: string;
  onLiveGpsUpdate?: (lat: number, lng: number, snappedStreetName?: string) => void;
  onDestinationReachedChange?: (reached: boolean) => void;
  onSpeedUpdate?: (speedKmh: number) => void;
  onManeuverUpdate?: (maneuver: {
    instruction: string;
    distanceText: string;
    maneuver: string;
  }) => void;
  onTelemetryUpdate?: (distanceKm: number, etaMinutes: number) => void;
  onRouteResolved?: (route: GoogleComputedRouteResult) => void;
}

function computeHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function computeRoadDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const straightKm = computeHaversineKm(lat1, lng1, lat2, lng2);
  if (straightKm < 0.04) return 0;
  return Number((straightKm * 1.32).toFixed(1));
}

function computePolylineLengthKm(points: Array<{ lat: number; lng: number }>): number {
  if (!points || points.length < 2) return 0;
  let totalKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalKm += computeHaversineKm(
      points[i].lat,
      points[i].lng,
      points[i + 1].lat,
      points[i + 1].lng
    );
  }
  if (totalKm < 0.04) return 0;
  return Number(totalKm.toFixed(1));
}

function computeBearingDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const theta = (Math.atan2(y, x) * 180) / Math.PI;
  return (theta + 360) % 360;
}

function signedAngleDeltaDeg(fromBearing: number, toBearing: number): number {
  return ((((toBearing - fromBearing) % 360) + 540) % 360) - 180;
}

function projectPointAhead(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceKm: number
): { lat: number; lng: number } {
  const R = 6371;
  const dByR = distanceKm / R;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dByR) +
      Math.cos(lat1) * Math.sin(dByR) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(dByR) * Math.cos(lat1),
      Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}

function smoothAngleDeg(currentDeg: number, targetDeg: number, factor = 0.3): number {
  const diff = signedAngleDeltaDeg(currentDeg, targetDeg);
  return (currentDeg + diff * factor + 360) % 360;
}

function angleDiffDeg(a: number, b: number): number {
  return Math.abs(signedAngleDeltaDeg(b, a));
}

function isTurnManeuverCode(maneuverRaw: string, instructionRaw = ''): boolean {
  const m = (maneuverRaw || '').toUpperCase();
  const txt = (instructionRaw || '').toLowerCase();
  return (
    m.includes('LEFT') ||
    m.includes('RIGHT') ||
    m.includes('UTURN') ||
    m.includes('ROUNDABOUT') ||
    m.includes('RAMP') ||
    m.includes('FORK') ||
    txt.includes('esquerda') ||
    txt.includes('direita') ||
    txt.includes('retorno') ||
    txt.includes('rotatória') ||
    txt.includes('saída') ||
    txt.includes('acesso')
  );
}

/**
 * Resolve a próxima manobra real (seta + instrução + distância regressiva exata)
 * a partir da posição atual do GPS na malha viária, usando os steps da rota + geometria da polilinha.
 */
function resolveLiveManeuverFromGps(
  userLat: number,
  userLng: number,
  closestIndex: number,
  roadPath: Array<{ lat: number; lng: number }>,
  steps: GoogleRouteStep[],
  destLabel: string
): { instruction: string; distanceText: string; maneuver: string } {
  const endPt = roadPath.length > 0 ? roadPath[roadPath.length - 1] : null;
  if (endPt && computeHaversineKm(userLat, userLng, endPt.lat, endPt.lng) <= 0.14) {
    return {
      instruction: `Você chegou em ${destLabel}`,
      distanceText: '0 m',
      maneuver: 'STRAIGHT',
    };
  }

  // 1. Se houver steps estruturados com coordenadas (Google Routes API v2 / OSRM steps=true)
  if (steps.length > 0 && roadPath.length >= 2) {
    let bestStepIdx = -1;
    let minStepStartDistKm = Infinity;

    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      const targetLat = st.startLat ?? st.endLat;
      const targetLng = st.startLng ?? st.endLng;
      if (typeof targetLat !== 'number' || typeof targetLng !== 'number') continue;

      let stepPolyIdx = 0;
      let bestVertexDist = Infinity;
      for (let p = 0; p < roadPath.length; p++) {
        const d = computeHaversineKm(targetLat, targetLng, roadPath[p].lat, roadPath[p].lng);
        if (d < bestVertexDist) {
          bestVertexDist = d;
          stepPolyIdx = p;
        }
      }

      if (stepPolyIdx >= closestIndex && isTurnManeuverCode(st.maneuver, st.instruction)) {
        const sliceToTurn = [
          { lat: userLat, lng: userLng },
          ...roadPath.slice(closestIndex + 1, stepPolyIdx + 1),
          { lat: targetLat, lng: targetLng },
        ];
        let distKm = 0;
        for (let k = 0; k < sliceToTurn.length - 1; k++) {
          distKm += computeHaversineKm(
            sliceToTurn[k].lat,
            sliceToTurn[k].lng,
            sliceToTurn[k + 1].lat,
            sliceToTurn[k + 1].lng
          );
        }
        if (distKm >= 0.01 && distKm < minStepStartDistKm) {
          minStepStartDistKm = distKm;
          bestStepIdx = i;
          break;
        }
      }
    }

    if (bestStepIdx >= 0) {
      const upcomingTurn = steps[bestStepIdx];
      return {
        instruction: upcomingTurn.instruction,
        distanceText: formatDistanceMeters(minStepStartDistKm * 1000),
        maneuver: upcomingTurn.maneuver,
      };
    }

    // Fallback proporcional sobre os steps caso todos sejam retos ou sem startLat
    const propIdx = Math.min(
      steps.length - 1,
      Math.floor((closestIndex / Math.max(1, roadPath.length - 1)) * steps.length)
    );
    const nextTurnIdx = steps.findIndex(
      (s, idx) => idx >= propIdx && isTurnManeuverCode(s.maneuver, s.instruction)
    );
    const chosen = steps[nextTurnIdx >= 0 ? nextTurnIdx : propIdx];
    if (chosen) {
      return {
        instruction: chosen.instruction,
        distanceText: chosen.distanceText,
        maneuver: chosen.maneuver,
      };
    }
  }

  // 2. Detecção geométrica pura na polilinha (sem falso positivo de retorno em alças de rodovia)
  if (roadPath.length > closestIndex + 2) {
    let accumMeters = 0;
    let prevLat = userLat;
    let prevLng = userLng;
    const initialNext = roadPath[Math.min(roadPath.length - 1, closestIndex + 1)];
    let prevBearing = computeBearingDeg(userLat, userLng, initialNext.lat, initialNext.lng);

    for (let i = closestIndex + 1; i < roadPath.length - 1; i++) {
      const A = roadPath[i];
      const B = roadPath[i + 1];
      const segMeters = computeHaversineKm(prevLat, prevLng, A.lat, A.lng) * 1000;
      accumMeters += segMeters;
      prevLat = A.lat;
      prevLng = A.lng;

      const nextSegMeters = computeHaversineKm(A.lat, A.lng, B.lat, B.lng) * 1000;
      if (nextSegMeters < 12) continue;

      const nextBearing = computeBearingDeg(A.lat, A.lng, B.lat, B.lng);
      const delta = signedAngleDeltaDeg(prevBearing, nextBearing);

      if (accumMeters >= 25 && accumMeters <= 1200) {
        if (delta <= -35) {
          return {
            instruction: 'Mantenha-se à esquerda à frente',
            distanceText: formatDistanceMeters(accumMeters),
            maneuver: 'TURN_LEFT',
          };
        }
        if (delta >= 35) {
          return {
            instruction: 'Mantenha-se à direita à frente',
            distanceText: formatDistanceMeters(accumMeters),
            maneuver: 'TURN_RIGHT',
          };
        }
      }
      prevBearing = nextBearing;
      if (accumMeters > 1200) break;
    }

    const totalRemMeters = computePolylineLengthKm(roadPath.slice(closestIndex)) * 1000;
    return {
      instruction: `Siga em frente para ${destLabel}`,
      distanceText: totalRemMeters > 30 ? formatDistanceMeters(totalRemMeters) : '',
      maneuver: 'STRAIGHT',
    };
  }

  return {
    instruction: `Siga em direção a ${destLabel}`,
    distanceText: '',
    maneuver: 'STRAIGHT',
  };
}

/**
 * Calcula o Tempo Restante (ETA em minutos) combinando o ritmo real da rota (duração oficial / km)
 * com a velocidade real suavizada do GPS em movimento, eliminando distorções como 01:21 para 18 km.
 */
function computeRealisticRemainingMinutes(params: {
  remainingKm: number;
  routeTotalKm: number;
  routeTotalMinutes: number;
  smoothedSpeedKmh: number;
  mode?: TransportMode;
}): number {
  const { remainingKm, routeTotalKm, routeTotalMinutes, smoothedSpeedKmh, mode } = params;
  if (remainingKm <= 0.12) return 0;

  // Ritmo padrão caso rota detalhada ainda não tenha chegado (ex.: ~40 km/h urbano/arterial = 1.5 min/km)
  const fallbackPaceMinPerKm =
    mode === 'walking'
      ? 12.0
      : mode === 'bicycling'
      ? 4.0
      : mode === 'transit'
      ? 2.6
      : mode === 'motorcycle'
      ? 1.25
      : 1.55;

  const rawRoutePace =
    routeTotalKm > 0.25 && routeTotalMinutes > 0
      ? routeTotalMinutes / routeTotalKm
      : fallbackPaceMinPerKm;

  const minAllowedPace = mode === 'walking' ? 8.0 : mode === 'bicycling' ? 2.2 : 0.55;
  const maxAllowedPace = mode === 'walking' ? 16.0 : mode === 'bicycling' ? 6.5 : 2.85;
  const routePaceMinPerKm = Math.min(maxAllowedPace, Math.max(minAllowedPace, rawRoutePace));

  const routeBasedMinutes = remainingKm * routePaceMinPerKm;

  // Se o veículo está em movimento real medido pelo GPS (>= 12 km/h), pondera com a velocidade ao vivo
  if (smoothedSpeedKmh >= 12 && mode !== 'walking') {
    const clampedSpeed = Math.min(115, Math.max(15, smoothedSpeedKmh));
    const gpsPaceMinPerKm = (60 / clampedSpeed) * 1.12; // +12% margem para semáforos/acessos finais
    const blendedMinutes = routeBasedMinutes * 0.55 + remainingKm * gpsPaceMinPerKm * 0.45;
    return Math.max(1, Math.round(blendedMinutes));
  }

  return Math.max(1, Math.round(routeBasedMinutes));
}

/**
 * Map-Matching Ortogonal Contínuo (Snap-to-Polyline):
 * Projeta a coordenada do usuário ortogonalmente no segmento viário mais próximo,
 * eliminando desvios laterais do GPS e calculando o azimute (bearing) exato da rua à frente.
 * GARANTIA ZERO LINHA RETA: Jamais retorna um segmento reto de 2 pontos [user, dest].
 */
function findForwardRouteBearingAndRemainingPath(
  userLat: number,
  userLng: number,
  roadPath: Array<{ lat: number; lng: number }>,
  destLat: number,
  destLng: number
): {
  forwardBearingDeg: number;
  snappedLat: number;
  snappedLng: number;
  remainingPath: Array<{ lat: number; lng: number }>;
  closestIndex: number;
  isOffRoute: boolean;
} {
  if (!roadPath || roadPath.length <= 2) {
    return {
      forwardBearingDeg: computeBearingDeg(userLat, userLng, destLat, destLng),
      snappedLat: userLat,
      snappedLng: userLng,
      remainingPath: [],
      closestIndex: 0,
      isOffRoute: true,
    };
  }

  const cosLat = Math.cos((userLat * Math.PI) / 180);
  let bestSegIdx = 0;
  let bestProjLat = roadPath[0].lat;
  let bestProjLng = roadPath[0].lng;
  let minDistKm = Infinity;

  for (let i = 0; i < roadPath.length - 1; i++) {
    const A = roadPath[i];
    const B = roadPath[i + 1];
    const dx = (B.lng - A.lng) * cosLat;
    const dy = B.lat - A.lat;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 1e-12) {
      const px = (userLng - A.lng) * cosLat;
      const py = userLat - A.lat;
      t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
    }

    const projLat = A.lat + t * (B.lat - A.lat);
    const projLng = A.lng + t * (B.lng - A.lng);
    const d = computeHaversineKm(userLat, userLng, projLat, projLng);

    if (d < minDistKm) {
      minDistKm = d;
      bestSegIdx = i;
      bestProjLat = projLat;
      bestProjLng = projLng;
    }
  }

  // Se o GPS real do usuário estiver a mais de 220m da rota calculada originalmente,
  // sinaliza recálculo viário mantendo a geometria atual até a nova rota chegar (sem linha reta).
  if (minDistKm > 0.22) {
    const nextPt = roadPath[Math.min(1, roadPath.length - 1)];
    return {
      forwardBearingDeg: computeBearingDeg(
        roadPath[0].lat,
        roadPath[0].lng,
        nextPt.lat,
        nextPt.lng
      ),
      snappedLat: userLat,
      snappedLng: userLng,
      remainingPath: roadPath,
      closestIndex: 0,
      isOffRoute: true,
    };
  }

  const effectiveLat = minDistKm <= 0.055 ? bestProjLat : userLat;
  const effectiveLng = minDistKm <= 0.055 ? bestProjLng : userLng;

  let targetAheadLat = roadPath[roadPath.length - 1].lat;
  let targetAheadLng = roadPath[roadPath.length - 1].lng;
  let accumKm = 0;
  let curLat = bestProjLat;
  let curLng = bestProjLng;

  for (let j = bestSegIdx + 1; j < roadPath.length; j++) {
    const pt = roadPath[j];
    const segKm = computeHaversineKm(curLat, curLng, pt.lat, pt.lng);
    if (accumKm + segKm >= 0.045) {
      const remainKm = 0.045 - accumKm;
      const ratio = segKm > 0.0001 ? Math.min(1, Math.max(0, remainKm / segKm)) : 1;
      targetAheadLat = curLat + ratio * (pt.lat - curLat);
      targetAheadLng = curLng + ratio * (pt.lng - curLng);
      break;
    }
    accumKm += segKm;
    curLat = pt.lat;
    curLng = pt.lng;
  }

  const bearingAlongRoad = computeBearingDeg(
    bestProjLat,
    bestProjLng,
    targetAheadLat,
    targetAheadLng
  );

  const tailPoints = roadPath.slice(bestSegIdx + 1);
  const remainingSlice =
    tailPoints.length >= 2
      ? [{ lat: effectiveLat, lng: effectiveLng }, ...tailPoints]
      : [
          { lat: effectiveLat, lng: effectiveLng },
          roadPath[Math.max(0, roadPath.length - 2)],
          roadPath[roadPath.length - 1],
        ];

  return {
    forwardBearingDeg: bearingAlongRoad,
    snappedLat: effectiveLat,
    snappedLng: effectiveLng,
    remainingPath: remainingSlice,
    closestIndex: bestSegIdx,
    isOffRoute: false,
  };
}

function createPinBadge(bgHex: string, textHex: string, labelText: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.background = bgHex;
  el.style.color = textHex;
  el.style.padding = '3px 7px';
  el.style.borderRadius = '4px';
  el.style.fontWeight = '800';
  el.style.fontSize = '10.5px';
  el.style.fontFamily = 'Poppins, sans-serif';
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
  el.style.whiteSpace = 'nowrap';
  el.style.transform = 'rotate(var(--map-counter-rotate, 0deg))';
  el.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';
  el.textContent = labelText;
  return el;
}

function resolveActiveUserAvatarUrl(propAvatarUrl?: string): string {
  if (isValidAvatarUrlString(propAvatarUrl)) {
    return propAvatarUrl.trim();
  }
  if (typeof window !== 'undefined') {
    const savedAvatar = localStorage.getItem('vagou_user_avatar') || '';
    if (isValidAvatarUrlString(savedAvatar)) {
      return savedAvatar.trim();
    }
    try {
      const savedProfile = JSON.parse(localStorage.getItem('vagou_user_profile') || '{}');
      if (isValidAvatarUrlString(savedProfile?.avatarUrl)) {
        return savedProfile.avatarUrl.trim();
      }
    } catch {}
  }
  return '';
}

function createDirectionalUserMarkerElement(avatarUrl?: string): {
  container: HTMLDivElement;
  rotor: HTMLDivElement;
} {
  const hasValidPhoto = isValidAvatarUrlString(avatarUrl);

  const container = document.createElement('div');
  container.style.width = '56px';
  container.style.height = '56px';
  container.style.position = 'relative';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.pointerEvents = 'none';

  const rotor = document.createElement('div');
  rotor.className = 'vagou-nav-rotor';
  rotor.style.position = 'relative';
  rotor.style.width = '56px';
  rotor.style.height = '56px';
  rotor.style.display = 'flex';
  rotor.style.alignItems = 'center';
  rotor.style.justifyContent = 'center';
  rotor.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
  rotor.style.transformOrigin = '50% 50%';

  const visionCone = document.createElement('div');
  visionCone.style.position = 'absolute';
  visionCone.style.top = '-16px';
  visionCone.style.left = '50%';
  visionCone.style.transform = 'translateX(-50%)';
  visionCone.style.width = '42px';
  visionCone.style.height = '40px';
  visionCone.style.background =
    'linear-gradient(to top, rgba(16, 185, 129, 0.55) 0%, rgba(16, 185, 129, 0.0) 100%)';
  visionCone.style.clipPath = 'polygon(0% 0%, 100% 0%, 65% 100%, 35% 100%)';
  visionCone.style.borderRadius = '50% 50% 0 0';

  const defaultPuck = document.createElement('div');
  defaultPuck.style.position = 'relative';
  defaultPuck.style.width = '26px';
  defaultPuck.style.height = '26px';
  defaultPuck.style.borderRadius = '9999px';
  defaultPuck.style.background = '#10b981';
  defaultPuck.style.border = '3px solid #ffffff';
  defaultPuck.style.boxShadow =
    '0 3px 12px rgba(0, 0, 0, 0.45), 0 0 0 4px rgba(16, 185, 129, 0.35)';
  defaultPuck.style.display = hasValidPhoto ? 'none' : 'flex';
  defaultPuck.style.alignItems = 'center';
  defaultPuck.style.justifyContent = 'center';

  const arrow = document.createElement('div');
  arrow.style.width = '0';
  arrow.style.height = '0';
  arrow.style.borderLeft = '5px solid transparent';
  arrow.style.borderRight = '5px solid transparent';
  arrow.style.borderBottom = '9px solid #ffffff';
  arrow.style.transform = 'translateY(-1px)';

  defaultPuck.appendChild(arrow);
  rotor.appendChild(visionCone);
  rotor.appendChild(defaultPuck);

  if (hasValidPhoto && avatarUrl) {
    const directionTip = document.createElement('div');
    directionTip.style.position = 'absolute';
    directionTip.style.top = '1px';
    directionTip.style.left = '50%';
    directionTip.style.transform = 'translateX(-50%)';
    directionTip.style.width = '0';
    directionTip.style.height = '0';
    directionTip.style.borderLeft = '6px solid transparent';
    directionTip.style.borderRight = '6px solid transparent';
    directionTip.style.borderBottom = '10px solid #10b981';
    directionTip.style.filter = 'drop-shadow(0 -1px 2px rgba(255,255,255,0.95))';
    rotor.appendChild(directionTip);

    const avatarBadge = document.createElement('div');
    avatarBadge.style.position = 'absolute';
    avatarBadge.style.width = '34px';
    avatarBadge.style.height = '34px';
    avatarBadge.style.borderRadius = '9999px';
    avatarBadge.style.border = '2.5px solid #10b981';
    avatarBadge.style.boxShadow =
      '0 2px 10px rgba(0, 0, 0, 0.45), 0 0 0 2px #ffffff, 0 0 0 5px rgba(16, 185, 129, 0.3)';
    avatarBadge.style.background = '#0f172a';
    avatarBadge.style.overflow = 'hidden';
    avatarBadge.style.display = 'flex';
    avatarBadge.style.alignItems = 'center';
    avatarBadge.style.justifyContent = 'center';
    avatarBadge.style.zIndex = '2';
    avatarBadge.style.transform = 'rotate(var(--map-counter-rotate, 0deg))';
    avatarBadge.style.transition = 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)';

    const img = document.createElement('img');
    img.src = avatarUrl.trim();
    img.alt = 'Sua Posição';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    img.onerror = () => {
      avatarBadge.style.display = 'none';
      directionTip.style.display = 'none';
      defaultPuck.style.display = 'flex';
    };

    avatarBadge.appendChild(img);
    container.appendChild(rotor);
    container.appendChild(avatarBadge);
  } else {
    container.appendChild(rotor);
  }

  return { container, rotor };
}

interface GoogleMapRuntimeSyncProps {
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  onVectorModeChange: (isVector: boolean) => void;
  onAuthFailure: () => void;
  initialCenter: { lat: number; lng: number };
  initialHeading: number;
}

const GoogleMapRuntimeSync: React.FC<GoogleMapRuntimeSyncProps> = ({
  mapRef,
  onVectorModeChange,
  onAuthFailure,
  initialCenter,
  initialHeading,
}) => {
  const map = useMap();
  const loadingStatus = useApiLoadingStatus();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (
      loadingStatus === APILoadingStatus.AUTH_FAILURE ||
      loadingStatus === APILoadingStatus.FAILED
    ) {
      onAuthFailure();
    }
  }, [loadingStatus, onAuthFailure]);

  useEffect(() => {
    mapRef.current = map;
    if (!map) return;

    const checkVectorSupport = () => {
      try {
        const rType = map.getRenderingType?.();
        const isVec = rType === 'VECTOR';
        onVectorModeChange(isVec);
        if (isVec && !initializedRef.current) {
          initializedRef.current = true;
          map.moveCamera({
            center: initialCenter,
            zoom: 17,
            heading: initialHeading,
            tilt: 0,
          });
        }
      } catch {}
    };

    checkVectorSupport();
    const l1 = map.addListener('renderingtype_changed', checkVectorSupport);
    const l2 = map.addListener('tilesloaded', checkVectorSupport);

    return () => {
      l1.remove();
      l2.remove();
      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, [map, mapRef, onVectorModeChange, initialCenter, initialHeading]);

  return null;
};

interface DirectionalUserPuckProps {
  avatarUrl?: string;
  coneAngleDeg: number;
  counterRotateCssVar?: boolean;
}

const DirectionalUserPuck: React.FC<DirectionalUserPuckProps> = ({
  avatarUrl,
  coneAngleDeg,
  counterRotateCssVar = true,
}) => {
  const [imgBroken, setImgBroken] = useState(false);
  const showPhoto = Boolean(avatarUrl && isValidAvatarUrlString(avatarUrl) && !imgBroken);

  useEffect(() => {
    setImgBroken(false);
  }, [avatarUrl]);

  return (
    <div className="relative w-14 h-14 flex items-center justify-center pointer-events-none select-none">
      <div
        className="relative w-14 h-14 flex items-center justify-center transition-transform duration-200 ease-out"
        style={{ transform: `rotate(${coneAngleDeg.toFixed(1)}deg)` }}
      >
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 w-[42px] h-10 rounded-t-full"
          style={{
            background:
              'linear-gradient(to top, rgba(16, 185, 129, 0.55) 0%, rgba(16, 185, 129, 0) 100%)',
            clipPath: 'polygon(0% 0%, 100% 0%, 65% 100%, 35% 100%)',
          }}
        />
        {showPhoto ? (
          <div
            className="absolute top-[1px] left-1/2 -translate-x-1/2 w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: '10px solid #10b981',
              filter: 'drop-shadow(0 -1px 2px rgba(255,255,255,0.95))',
            }}
          />
        ) : (
          <div
            className="relative w-[26px] h-[26px] rounded-full bg-emerald-500 border-[3px] border-white flex items-center justify-center"
            style={{
              boxShadow: '0 3px 12px rgba(0, 0, 0, 0.45), 0 0 0 4px rgba(16, 185, 129, 0.35)',
            }}
          >
            <div
              className="w-0 h-0 -translate-y-[1px]"
              style={{
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderBottom: '9px solid #ffffff',
              }}
            />
          </div>
        )}
      </div>

      {showPhoto && avatarUrl && (
        <div
          className="absolute w-[34px] h-[34px] rounded-full border-[2.5px] border-emerald-500 bg-slate-900 overflow-hidden flex items-center justify-center z-10"
          style={{
            boxShadow:
              '0 2px 10px rgba(0, 0, 0, 0.45), 0 0 0 2px #ffffff, 0 0 0 5px rgba(16, 185, 129, 0.3)',
            transform: counterRotateCssVar ? 'rotate(var(--map-counter-rotate, 0deg))' : 'none',
            transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <img
            src={avatarUrl.trim()}
            alt="Sua Posição"
            className="w-full h-full object-cover block"
            onError={() => setImgBroken(true)}
          />
        </div>
      )}
    </div>
  );
};

export const InteractiveGoogleRouteMap: React.FC<InteractiveGoogleRouteMapProps> = ({
  originLat = -23.5505,
  originLng = -46.6333,
  destLat = -23.5621,
  destLng = -46.4795,
  destLabel,
  destAddress,
  mode = 'driving' as TransportMode,
  userAvatarUrl,
  routeData,
  initialDistanceKm,
  initialEtaMinutes,
  onLiveGpsUpdate,
  onDestinationReachedChange,
  onSpeedUpdate,
  onManeuverUpdate,
  onTelemetryUpdate,
  onRouteResolved,
}) => {
  const { isDark } = useTheme();
  const effectiveUserAvatar = useMemo(
    () => resolveActiveUserAvatarUrl(userAvatarUrl),
    [userAvatarUrl]
  );

  const initialEnvKey = useMemo(
    () => (((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '') as string).trim(),
    []
  );
  const [googleApiKey, setGoogleApiKey] = useState<string>(initialEnvKey);
  const [keyResolved, setKeyResolved] = useState<boolean>(Boolean(initialEnvKey));
  const [googleMapsAuthFailed, setGoogleMapsAuthFailed] = useState<boolean>(false);
  const [isGoogleVectorMap, setIsGoogleVectorMap] = useState<boolean>(false);

  const useOfficialGoogleMap = Boolean(googleApiKey) && !googleMapsAuthFailed;
  const useOfficialGoogleMapRef = useRef<boolean>(useOfficialGoogleMap);
  useOfficialGoogleMapRef.current = useOfficialGoogleMap;

  const useNativeVectorHeading = useOfficialGoogleMap && isGoogleVectorMap;
  const useNativeVectorHeadingRef = useRef<boolean>(useNativeVectorHeading);
  useNativeVectorHeadingRef.current = useNativeVectorHeading;

  const shouldMountLeaflet = keyResolved && !useOfficialGoogleMap;

  useEffect(() => {
    let active = true;
    if (!googleApiKey) {
      getGoogleMapsApiKey().then((resolvedKey) => {
        if (!active) return;
        if (resolvedKey) {
          setGoogleApiKey(resolvedKey);
        }
        setKeyResolved(true);
      });
    }
    return () => {
      active = false;
    };
  }, [googleApiKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !useOfficialGoogleMap) return;

    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      if (typeof prevAuthFailure === 'function') {
        try {
          prevAuthFailure();
        } catch {}
      }
      setGoogleMapsAuthFailed(true);
    };

    const origError = console.error;
    console.error = (...args: unknown[]) => {
      origError.apply(console, args);
      const msg = args.map((a) => String(a)).join(' ');
      if (
        msg.includes('RefererNotAllowedMapError') ||
        msg.includes('InvalidKeyMapError') ||
        msg.includes('ApiNotActivatedMapError') ||
        msg.includes('BillingNotEnabledMapError') ||
        msg.includes('ExpiredKeyMapError')
      ) {
        setGoogleMapsAuthFailed(true);
      }
    };

    return () => {
      (window as any).gm_authFailure = prevAuthFailure;
      console.error = origError;
    };
  }, [useOfficialGoogleMap]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const googleMapRef = useRef<google.maps.Map | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletTileLayerRef = useRef<L.TileLayer | null>(null);
  const leafletOuterPolylineRef = useRef<L.Polyline | null>(null);
  const leafletInnerPolylineRef = useRef<L.Polyline | null>(null);
  const leafletOriginMarkerRef = useRef<L.Marker | null>(null);
  const leafletDestMarkerRef = useRef<L.Marker | null>(null);
  const leafletUserMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRotorRef = useRef<HTMLDivElement | null>(null);

  const [isFollowingGps, setIsFollowingGps] = useState<boolean>(true);
  const [isCourseUp] = useState<boolean>(true);
  const isCourseUpRef = useRef<boolean>(true);
  isCourseUpRef.current = isCourseUp;

  const initialBearing = useMemo(
    () => computeBearingDeg(originLat, originLng, destLat, destLng),
    [originLat, originLng, destLat, destLng]
  );

  const [mapBearingDeg, setMapBearingDeg] = useState<number>(initialBearing);
  const mapBearingDegRef = useRef<number>(initialBearing);
  const [userHeadingDeg, setUserHeadingDeg] = useState<number>(initialBearing);
  const [isTouchInteracting, setIsTouchInteracting] = useState<boolean>(false);

  const [activePolylinePath, setActivePolylinePath] = useState<Array<{ lat: number; lng: number }>>(
    () => (routeData?.decodedPath && routeData.decodedPath.length > 2 ? routeData.decodedPath : [])
  );
  const [originMarkerPos, setOriginMarkerPos] = useState<{ lat: number; lng: number }>({
    lat: originLat,
    lng: originLng,
  });
  const [destMarkerPos, setDestMarkerPos] = useState<{ lat: number; lng: number }>({
    lat: destLat,
    lng: destLng,
  });
  const [userMarkerPos, setUserMarkerPos] = useState<{ lat: number; lng: number }>({
    lat: originLat,
    lng: originLng,
  });

  const roadPathRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const routeStepsRef = useRef<GoogleRouteStep[]>(routeData?.steps || []);
  const routeMetaRef = useRef<{ totalDistanceKm: number; totalDurationMinutes: number }>({
    totalDistanceKm: routeData?.distanceKm ?? initialDistanceKm ?? 6.0,
    totalDurationMinutes: routeData?.etaMinutes ?? initialEtaMinutes ?? 12,
  });
  const smoothedSpeedKmhRef = useRef<number>(0);

  const lastGpsFixRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const lastSnappedApiTsRef = useRef<number>(0);
  const lastRerouteTsRef = useRef<number>(0);
  const hasActiveGpsFollowRef = useRef<boolean>(true);
  const userManualPanUntilRef = useRef<number>(0);

  const forwardHeadingRef = useRef<number>(initialBearing);
  const routeLookAheadBearingRef = useRef<number>(initialBearing);
  const liveUserPosRef = useRef<{ lat: number; lng: number }>({
    lat: originLat,
    lng: originLng,
  });
  const effectiveDestRef = useRef<{ lat: number; lng: number }>({
    lat: destLat,
    lng: destLng,
  });

  const onLiveGpsUpdateRef = useRef(onLiveGpsUpdate);
  onLiveGpsUpdateRef.current = onLiveGpsUpdate;

  const onDestinationReachedRef = useRef(onDestinationReachedChange);
  onDestinationReachedRef.current = onDestinationReachedChange;

  const onSpeedUpdateRef = useRef(onSpeedUpdate);
  onSpeedUpdateRef.current = onSpeedUpdate;

  const onManeuverUpdateRef = useRef(onManeuverUpdate);
  onManeuverUpdateRef.current = onManeuverUpdate;

  const onTelemetryUpdateRef = useRef(onTelemetryUpdate);
  onTelemetryUpdateRef.current = onTelemetryUpdate;

  const onRouteResolvedRef = useRef(onRouteResolved);
  onRouteResolvedRef.current = onRouteResolved;

  const updateManeuver = useCallback(
    (m: { instruction: string; distanceText: string; maneuver: string }) => {
      onManeuverUpdateRef.current?.(m);
    },
    []
  );

  const handleGoogleAuthFailure = useCallback(() => {
    setGoogleMapsAuthFailed(true);
  }, []);

  const baseDistanceKm = routeData?.distanceKm ?? initialDistanceKm ?? 6.0;
  const baseEtaMinutes = routeData?.etaMinutes ?? initialEtaMinutes ?? 12;

  const [remainingDistanceKm, setRemainingDistanceKm] = useState<number>(baseDistanceKm);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(baseEtaMinutes);

  useEffect(() => {
    effectiveDestRef.current = { lat: destLat, lng: destLng };
    setDestMarkerPos({ lat: destLat, lng: destLng });
  }, [destLat, destLng]);

  useEffect(() => {
    if (routeData) {
      routeStepsRef.current = routeData.steps || [];
      routeMetaRef.current = {
        totalDistanceKm: routeData.distanceKm,
        totalDurationMinutes: routeData.etaMinutes,
      };
      if (routeData.resolvedDestination) {
        effectiveDestRef.current = routeData.resolvedDestination;
        setDestMarkerPos(routeData.resolvedDestination);
      }
      setRemainingDistanceKm(routeData.distanceKm);
      setRemainingMinutes(routeData.etaMinutes);
      onTelemetryUpdateRef.current?.(routeData.distanceKm, routeData.etaMinutes);
    }
  }, [routeData]);

  const hasReachedDestination = remainingDistanceKm <= 0.15 || remainingMinutes <= 0;

  useEffect(() => {
    onDestinationReachedRef.current?.(hasReachedDestination);
  }, [hasReachedDestination]);

  const syncPositionAndOrientation = useCallback(
    (
      userLat: number,
      userLng: number,
      headingDeg: number,
      shouldPanCamera: boolean,
      forceInstant = false
    ) => {
      liveUserPosRef.current = { lat: userLat, lng: userLng };
      setUserMarkerPos({ lat: userLat, lng: userLng });
      setUserHeadingDeg(headingDeg);

      if (leafletUserMarkerRef.current) {
        leafletUserMarkerRef.current.setLatLng([userLat, userLng]);
      }

      if (userMarkerRotorRef.current) {
        userMarkerRotorRef.current.style.transform = `rotate(${headingDeg.toFixed(1)}deg)`;
      }

      const isManualPan = Date.now() < userManualPanUntilRef.current;
      const roadCourse = routeLookAheadBearingRef.current;
      let nextMapBearing = mapBearingDegRef.current;

      if (!isManualPan) {
        const targetMapBearing = isCourseUpRef.current ? roadCourse : 0;
        if (
          forceInstant ||
          angleDiffDeg(targetMapBearing, mapBearingDegRef.current) >= 1.2
        ) {
          nextMapBearing = forceInstant
            ? targetMapBearing
            : smoothAngleDeg(mapBearingDegRef.current, targetMapBearing, 0.45);
          mapBearingDegRef.current = nextMapBearing;
          setMapBearingDeg(nextMapBearing);
        }
      }

      const gmap = googleMapRef.current;
      if (gmap && useOfficialGoogleMapRef.current) {
        if (shouldPanCamera && !isManualPan) {
          const lookAheadCenter = projectPointAhead(userLat, userLng, roadCourse, 0.15);
          try {
            if (useNativeVectorHeadingRef.current) {
              gmap.moveCamera({
                center: lookAheadCenter,
                heading: nextMapBearing,
              });
            } else if (forceInstant) {
              gmap.setCenter(lookAheadCenter);
            } else {
              gmap.panTo(lookAheadCenter);
            }
          } catch {}
        } else if (!isManualPan && useNativeVectorHeadingRef.current) {
          try {
            gmap.moveCamera({ heading: nextMapBearing });
          } catch {}
        }
        return;
      }

      const lmap = leafletMapRef.current;
      if (!lmap) return;

      if (shouldPanCamera && !isManualPan) {
        const lookAheadCenter = projectPointAhead(userLat, userLng, roadCourse, 0.15);
        try {
          lmap.panTo([lookAheadCenter.lat, lookAheadCenter.lng], {
            animate: !forceInstant,
            duration: forceInstant ? 0 : 0.55,
            easeLinearity: 0.25,
          });
        } catch {}
      }
    },
    []
  );

  // Fallback OpenStreetMap / Esri (somente quando não há chave Google Maps ativa ou em caso de restrição de domínio)
  useEffect(() => {
    if (!shouldMountLeaflet) {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      return;
    }

    const containerEl = mapContainerRef.current;
    if (!containerEl) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const initialPos = liveUserPosRef.current;
    const lmap = L.map(containerEl, {
      center: [initialPos.lat, initialPos.lng],
      zoom: 17,
      zoomSnap: 1,
      zoomDelta: 1,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      zoomControl: false,
      attributionControl: false,
    });

    const tileProviders = [
      {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: [] as string[],
      },
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        subdomains: [] as string[],
      },
    ];

    let currentProviderIdx = 0;
    let consecutiveTileErrors = 0;

    const mountTileLayer = (providerIdx: number) => {
      const provider = tileProviders[providerIdx] || tileProviders[0];
      if (leafletTileLayerRef.current) {
        try {
          lmap.removeLayer(leafletTileLayerRef.current);
        } catch {}
      }
      const layer = L.tileLayer(provider.url, {
        ...(provider.subdomains.length > 0 ? { subdomains: provider.subdomains } : {}),
        maxZoom: 19,
        keepBuffer: 4,
        updateWhenIdle: false,
      });

      layer.on('tileload', () => {
        consecutiveTileErrors = 0;
      });

      layer.on('tileerror', () => {
        consecutiveTileErrors += 1;
        if (consecutiveTileErrors >= 4 && currentProviderIdx < tileProviders.length - 1) {
          consecutiveTileErrors = 0;
          currentProviderIdx += 1;
          mountTileLayer(currentProviderIdx);
        }
      });

      layer.addTo(lmap);
      leafletTileLayerRef.current = layer;
    };

    mountTileLayer(0);

    const outerPoly = L.polyline([], {
      color: '#064e3b',
      weight: 9,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(lmap);

    const innerPoly = L.polyline([], {
      color: '#10b981',
      weight: 5.5,
      opacity: 1.0,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(lmap);

    leafletOuterPolylineRef.current = outerPoly;
    leafletInnerPolylineRef.current = innerPoly;

    const originIcon = L.divIcon({
      html: createPinBadge(
        isDark ? '#0f172a' : '#ffffff',
        isDark ? '#ffffff' : '#0f172a',
        'Saída'
      ),
      className: 'vagou-leaflet-badge',
      iconSize: [60, 24],
      iconAnchor: [30, 12],
    });
    leafletOriginMarkerRef.current = L.marker([originMarkerPos.lat, originMarkerPos.lng], {
      icon: originIcon,
    }).addTo(lmap);

    const destIcon = L.divIcon({
      html: createPinBadge('#10b981', '#ffffff', destLabel.slice(0, 22)),
      className: 'vagou-leaflet-badge',
      iconSize: [120, 24],
      iconAnchor: [60, 12],
    });
    leafletDestMarkerRef.current = L.marker([effectiveDestRef.current.lat, effectiveDestRef.current.lng], {
      icon: destIcon,
    }).addTo(lmap);

    const { container, rotor } = createDirectionalUserMarkerElement(effectiveUserAvatar);
    userMarkerRotorRef.current = rotor;
    rotor.style.transform = `rotate(${forwardHeadingRef.current.toFixed(1)}deg)`;
    const userDivIcon = L.divIcon({
      html: container,
      className: 'vagou-leaflet-user-puck',
      iconSize: [56, 56],
      iconAnchor: [28, 28],
    });
    leafletUserMarkerRef.current = L.marker([initialPos.lat, initialPos.lng], {
      icon: userDivIcon,
      zIndexOffset: 1000,
    }).addTo(lmap);

    leafletMapRef.current = lmap;

    const invalidateTimer = window.setTimeout(() => {
      try {
        lmap.invalidateSize();
      } catch {}
    }, 120);

    let resizeObs: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => {
        try {
          lmap.invalidateSize();
        } catch {}
      });
      resizeObs.observe(containerEl);
    }

    if (roadPathRef.current.length > 2) {
      const latlngs = roadPathRef.current.map((p) => [p.lat, p.lng] as [number, number]);
      outerPoly.setLatLngs(latlngs);
      innerPoly.setLatLngs(latlngs);
    }

    return () => {
      window.clearTimeout(invalidateTimer);
      resizeObs?.disconnect();
      lmap.remove();
      leafletMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldMountLeaflet, isDark]);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    let isDraggingOneFinger = false;
    let lastX = 0;
    let lastY = 0;
    let totalDragDist = 0;

    let isTwoFingerGesture = false;
    let lastTwoFingerAngle = 0;
    let lastTwoFingerDist = 0;

    const panMapInScreenSpace = (dxScreen: number, dyScreen: number) => {
      const gmap = googleMapRef.current;
      if (gmap && useOfficialGoogleMapRef.current) {
        if (useNativeVectorHeadingRef.current) {
          gmap.panBy(-dxScreen, -dyScreen);
        } else {
          const rad = (mapBearingDegRef.current * Math.PI) / 180;
          const cosA = Math.cos(rad);
          const sinA = Math.sin(rad);
          const dxMap = dxScreen * cosA - dyScreen * sinA;
          const dyMap = dxScreen * sinA + dyScreen * cosA;
          gmap.panBy(-dxMap, -dyMap);
        }
        return;
      }

      const lmap = leafletMapRef.current;
      if (!lmap) return;
      const rad = (mapBearingDegRef.current * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      const dxMap = dxScreen * cosA - dyScreen * sinA;
      const dyMap = dxScreen * sinA + dyScreen * cosA;
      lmap.panBy([-dxMap, -dyMap], { animate: false });
    };

    const adjustMapZoom = (delta: number) => {
      const gmap = googleMapRef.current;
      if (gmap && useOfficialGoogleMapRef.current) {
        const curZoom = gmap.getZoom() ?? 17;
        gmap.setZoom(Math.min(20, Math.max(12, curZoom + delta)));
        return;
      }
      const lmap = leafletMapRef.current;
      if (lmap) {
        lmap.setZoom(Math.min(19, Math.max(12, lmap.getZoom() + delta)));
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if ((e.target as HTMLElement)?.closest('button, a')) return;

      if (e.touches.length === 1) {
        isDraggingOneFinger = true;
        isTwoFingerGesture = false;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        totalDragDist = 0;
      } else if (e.touches.length >= 2) {
        isDraggingOneFinger = false;
        isTwoFingerGesture = true;
        setIsTouchInteracting(true);
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        lastTwoFingerAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
        lastTwoFingerDist = Math.hypot(dx, dy);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDraggingOneFinger && e.touches.length === 1) {
        const curX = e.touches[0].clientX;
        const curY = e.touches[0].clientY;
        const dx = curX - lastX;
        const dy = curY - lastY;
        lastX = curX;
        lastY = curY;
        totalDragDist += Math.hypot(dx, dy);

        if (totalDragDist > 8) {
          if (e.cancelable) e.preventDefault();
          userManualPanUntilRef.current = Date.now() + 8000;
          hasActiveGpsFollowRef.current = false;
          setIsFollowingGps(false);
          setIsTouchInteracting(true);
          panMapInScreenSpace(dx, dy);
        }
      } else if (isTwoFingerGesture && e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        userManualPanUntilRef.current = Date.now() + 8000;
        hasActiveGpsFollowRef.current = false;
        setIsFollowingGps(false);

        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const curAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const curDist = Math.hypot(dx, dy);

        const deltaAngle = signedAngleDeltaDeg(lastTwoFingerAngle, curAngle);
        lastTwoFingerAngle = curAngle;
        const nextBearing = (mapBearingDegRef.current - deltaAngle + 360) % 360;
        mapBearingDegRef.current = nextBearing;
        setMapBearingDeg(nextBearing);

        if (
          googleMapRef.current &&
          useOfficialGoogleMapRef.current &&
          useNativeVectorHeadingRef.current
        ) {
          try {
            googleMapRef.current.moveCamera({ heading: nextBearing });
          } catch {}
        }

        if (Math.abs(curDist - lastTwoFingerDist) > 42) {
          const zoomDelta = curDist > lastTwoFingerDist ? 1 : -1;
          lastTwoFingerDist = curDist;
          adjustMapZoom(zoomDelta);
        }
      }
    };

    const handleTouchEnd = () => {
      isDraggingOneFinger = false;
      isTwoFingerGesture = false;
      setIsTouchInteracting(false);
    };

    let isMouseDown = false;
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement)?.closest('button, a')) return;
      isMouseDown = true;
      lastX = e.clientX;
      lastY = e.clientY;
      totalDragDist = 0;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      totalDragDist += Math.hypot(dx, dy);
      if (totalDragDist > 6) {
        userManualPanUntilRef.current = Date.now() + 8000;
        hasActiveGpsFollowRef.current = false;
        setIsTouchInteracting(true);
        setIsFollowingGps(false);
        panMapInScreenSpace(dx, dy);
      }
    };

    const handleMouseUp = () => {
      if (isMouseDown) {
        isMouseDown = false;
        setIsTouchInteracting(false);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!useOfficialGoogleMapRef.current) return;
      e.preventDefault();
      adjustMapZoom(e.deltaY < 0 ? 1 : -1);
    };

    viewportEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    viewportEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewportEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    viewportEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    viewportEl.addEventListener('mousedown', handleMouseDown);
    viewportEl.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      viewportEl.removeEventListener('touchstart', handleTouchStart);
      viewportEl.removeEventListener('touchmove', handleTouchMove);
      viewportEl.removeEventListener('touchend', handleTouchEnd);
      viewportEl.removeEventListener('touchcancel', handleTouchEnd);
      viewportEl.removeEventListener('mousedown', handleMouseDown);
      viewportEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    if (leafletDestMarkerRef.current) {
      const destIcon = L.divIcon({
        html: createPinBadge('#10b981', '#ffffff', destLabel.slice(0, 22)),
        className: 'vagou-leaflet-badge',
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });
      leafletDestMarkerRef.current.setIcon(destIcon);
    }
  }, [destLabel]);

  useEffect(() => {
    if (leafletUserMarkerRef.current) {
      const { container, rotor } = createDirectionalUserMarkerElement(effectiveUserAvatar);
      userMarkerRotorRef.current = rotor;
      rotor.style.transform = `rotate(${forwardHeadingRef.current.toFixed(1)}deg)`;
      const userDivIcon = L.divIcon({
        html: container,
        className: 'vagou-leaflet-user-puck',
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
      leafletUserMarkerRef.current.setIcon(userDivIcon);
    }
  }, [effectiveUserAvatar]);

  const applyRoadGeometry = useCallback(
    (
      roadPath: Array<{ lat: number; lng: number }>,
      stepsOverride?: GoogleRouteStep[],
      metaOverride?: { totalDistanceKm: number; totalDurationMinutes: number }
    ) => {
      if (!roadPath || roadPath.length <= 2) return;
      roadPathRef.current = roadPath;

      if (stepsOverride) {
        routeStepsRef.current = stepsOverride;
      }
      if (metaOverride) {
        routeMetaRef.current = metaOverride;
      }

      const startPt = roadPath[0];
      const endPt = roadPath[roadPath.length - 1];
      effectiveDestRef.current = endPt;
      setOriginMarkerPos(startPt);
      setDestMarkerPos(endPt);

      const currentPos = liveUserPosRef.current;

      const { forwardBearingDeg, snappedLat, snappedLng, remainingPath, closestIndex } =
        findForwardRouteBearingAndRemainingPath(
          currentPos.lat,
          currentPos.lng,
          roadPath,
          endPt.lat,
          endPt.lng
        );

      const polyToDraw = remainingPath.length > 2 ? remainingPath : roadPath;
      setActivePolylinePath(polyToDraw);

      routeLookAheadBearingRef.current = forwardBearingDeg;
      forwardHeadingRef.current = forwardBearingDeg;

      if (leafletOuterPolylineRef.current) {
        leafletOuterPolylineRef.current.setLatLngs(
          polyToDraw.map((p) => [p.lat, p.lng] as [number, number])
        );
      }
      if (leafletInnerPolylineRef.current) {
        leafletInnerPolylineRef.current.setLatLngs(
          polyToDraw.map((p) => [p.lat, p.lng] as [number, number])
        );
      }
      if (leafletOriginMarkerRef.current) {
        leafletOriginMarkerRef.current.setLatLng([startPt.lat, startPt.lng]);
      }
      if (leafletDestMarkerRef.current) {
        leafletDestMarkerRef.current.setLatLng([endPt.lat, endPt.lng]);
      }

      syncPositionAndOrientation(snappedLat, snappedLng, forwardBearingDeg, true, true);

      const liveDistKm =
        polyToDraw.length >= 2
          ? computePolylineLengthKm(polyToDraw)
          : computeRoadDistanceKm(snappedLat, snappedLng, endPt.lat, endPt.lng);

      const nextEta = computeRealisticRemainingMinutes({
        remainingKm: liveDistKm,
        routeTotalKm: routeMetaRef.current.totalDistanceKm,
        routeTotalMinutes: routeMetaRef.current.totalDurationMinutes,
        smoothedSpeedKmh: smoothedSpeedKmhRef.current,
        mode,
      });

      setRemainingDistanceKm(liveDistKm);
      setRemainingMinutes(nextEta);
      onTelemetryUpdateRef.current?.(liveDistKm, nextEta);

      const nextManeuver = resolveLiveManeuverFromGps(
        snappedLat,
        snappedLng,
        closestIndex,
        roadPath,
        routeStepsRef.current,
        destLabel
      );
      updateManeuver(nextManeuver);
    },
    [syncPositionAndOrientation, destLabel, mode, updateManeuver]
  );

  const fetchRealRoadNetwork = useCallback(
    async (startLat: number, startLng: number, targetLat: number, targetLng: number) => {
      const detailed = await computeGoogleDetailedRoute({
        originLat: startLat,
        originLng: startLng,
        destLat: targetLat,
        destLng: targetLng,
        destAddress: destAddress || destLabel,
        mode,
      });

      if (detailed && detailed.decodedPath.length > 2) {
        applyRoadGeometry(detailed.decodedPath, detailed.steps, {
          totalDistanceKm: detailed.distanceKm,
          totalDurationMinutes: detailed.etaMinutes,
        });
        onRouteResolvedRef.current?.(detailed);
        return true;
      }

      return false;
    },
    [applyRoadGeometry, destAddress, destLabel, mode]
  );

  useEffect(() => {
    let active = true;

    const initRoadGeometry = async () => {
      if (routeData?.decodedPath && routeData.decodedPath.length >= 2) {
        const firstPt = routeData.decodedPath[0];
        liveUserPosRef.current = { lat: firstPt.lat, lng: firstPt.lng };
        applyRoadGeometry(routeData.decodedPath, routeData.steps, {
          totalDistanceKm: routeData.distanceKm,
          totalDurationMinutes: routeData.etaMinutes,
        });
        return;
      }

      if (!active) return;
      await fetchRealRoadNetwork(
        originLat,
        originLng,
        effectiveDestRef.current.lat,
        effectiveDestRef.current.lng
      );
    };

    initRoadGeometry();

    return () => {
      active = false;
    };
  }, [routeData, originLat, originLng, destLat, destLng, applyRoadGeometry, fetchRealRoadNetwork]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastCompassTs = 0;

    const handleOrientation = (event: any) => {
      const now = Date.now();
      if (now - lastCompassTs < 250) return;

      if (isCourseUpRef.current && hasActiveGpsFollowRef.current) {
        const courseDeg = routeLookAheadBearingRef.current;
        setUserHeadingDeg(courseDeg);
        if (userMarkerRotorRef.current) {
          userMarkerRotorRef.current.style.transform = `rotate(${courseDeg.toFixed(1)}deg)`;
        }
        return;
      }

      let rawHeading: number | null = null;
      if (
        typeof event.webkitCompassHeading === 'number' &&
        !Number.isNaN(event.webkitCompassHeading)
      ) {
        rawHeading = event.webkitCompassHeading;
      } else if (typeof event.alpha === 'number' && !Number.isNaN(event.alpha)) {
        const screenAngle =
          typeof window.screen?.orientation?.angle === 'number'
            ? window.screen.orientation.angle
            : 0;
        rawHeading = (360 - event.alpha + screenAngle + 360) % 360;
      }

      if (rawHeading === null) return;
      lastCompassTs = now;

      const nextHeading = smoothAngleDeg(forwardHeadingRef.current, rawHeading, 0.2);
      if (angleDiffDeg(nextHeading, forwardHeadingRef.current) < 4.5) return;

      forwardHeadingRef.current = nextHeading;
      setUserHeadingDeg(nextHeading);
      if (userMarkerRotorRef.current) {
        userMarkerRotorRef.current.style.transform = `rotate(${nextHeading.toFixed(1)}deg)`;
      }
    };

    window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const handleGpsFix = async (pos: GeolocationPosition, isInitial = false) => {
      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const gpsSpeedMps = pos.coords.speed;
      const targetDest = effectiveDestRef.current;

      // 1. Se o usuário configurou um ponto de partida distante do seu GPS físico atual (ex.: está fisicamente
      // no destino Rua Serrana testando a rota desde a Polícia Rodoviária - Base Guarulhos), preserva a rota simulada intacta!
      const distGpsToConfiguredOriginKm = computeHaversineKm(
        rawLat,
        rawLng,
        originLat,
        originLng
      );
      const distConfiguredOriginToDestKm = computeHaversineKm(
        originLat,
        originLng,
        targetDest.lat,
        targetDest.lng
      );
      if (distGpsToConfiguredOriginKm > 0.38 && distConfiguredOriginToDestKm > 0.38) {
        return;
      }

      // 2. Se o usuário já está fisicamente no destino (<= 150m), reconhece chegada imediata sem pedir para retornar
      const distGpsToDestKm = computeHaversineKm(
        rawLat,
        rawLng,
        targetDest.lat,
        targetDest.lng
      );
      if (distGpsToDestKm <= 0.15) {
        liveUserPosRef.current = { lat: rawLat, lng: rawLng };
        setRemainingDistanceKm(0);
        setRemainingMinutes(0);
        onTelemetryUpdateRef.current?.(0, 0);
        onDestinationReachedRef.current?.(true);
        updateManeuver({
          instruction: `Você chegou em ${destLabel}`,
          distanceText: '0 m',
          maneuver: 'STRAIGHT',
        });
        syncPositionAndOrientation(
          rawLat,
          rawLng,
          routeLookAheadBearingRef.current,
          isInitial,
          isInitial
        );
        return;
      }

      const prev = lastGpsFixRef.current;
      const now = Date.now();
      const movedMeters = prev
        ? computeHaversineKm(prev.lat, prev.lng, rawLat, rawLng) * 1000
        : 9999;

      let kmh = 0;
      if (typeof gpsSpeedMps === 'number' && Number.isFinite(gpsSpeedMps) && gpsSpeedMps >= 0) {
        kmh = Math.round(gpsSpeedMps * 3.6);
      } else if (prev && now - prev.ts >= 1500 && movedMeters >= 6) {
        const dtHours = (now - prev.ts) / 3600000;
        kmh = Math.min(130, Math.round(movedMeters / 1000 / dtHours));
      }

      if (kmh >= 6) {
        smoothedSpeedKmhRef.current =
          smoothedSpeedKmhRef.current > 0
            ? smoothedSpeedKmhRef.current * 0.65 + kmh * 0.35
            : kmh;
      }
      onSpeedUpdateRef.current?.(kmh);

      if (!isInitial && prev && movedMeters < 4.5 && now - prev.ts < 4000) {
        return;
      }

      lastGpsFixRef.current = { lat: rawLat, lng: rawLng, ts: now };

      const {
        forwardBearingDeg,
        snappedLat,
        snappedLng,
        remainingPath,
        closestIndex,
        isOffRoute,
      } = findForwardRouteBearingAndRemainingPath(
        rawLat,
        rawLng,
        roadPathRef.current,
        targetDest.lat,
        targetDest.lng
      );

      liveUserPosRef.current = { lat: snappedLat, lng: snappedLng };
      routeLookAheadBearingRef.current = forwardBearingDeg;
      forwardHeadingRef.current = forwardBearingDeg;

      if (remainingPath.length > 2) {
        setActivePolylinePath(remainingPath);
        leafletOuterPolylineRef.current?.setLatLngs(
          remainingPath.map((p) => [p.lat, p.lng] as [number, number])
        );
        leafletInnerPolylineRef.current?.setLatLngs(
          remainingPath.map((p) => [p.lat, p.lng] as [number, number])
        );
      }

      if (isOffRoute && now - lastRerouteTsRef.current >= 6000) {
        lastRerouteTsRef.current = now;
        fetchRealRoadNetwork(rawLat, rawLng, targetDest.lat, targetDest.lng);
      }

      if (roadPathRef.current.length > 2) {
        const liveManeuver = resolveLiveManeuverFromGps(
          snappedLat,
          snappedLng,
          closestIndex,
          roadPathRef.current,
          routeStepsRef.current,
          destLabel
        );
        updateManeuver(liveManeuver);
      }

      const shouldPan = isInitial || movedMeters >= 4.0;
      syncPositionAndOrientation(
        snappedLat,
        snappedLng,
        forwardBearingDeg,
        shouldPan,
        isInitial
      );

      const liveDistKm =
        remainingPath.length >= 2
          ? computePolylineLengthKm(remainingPath)
          : computeRoadDistanceKm(snappedLat, snappedLng, targetDest.lat, targetDest.lng);

      if (liveDistKm <= 400) {
        const nextMin = computeRealisticRemainingMinutes({
          remainingKm: liveDistKm,
          routeTotalKm: routeMetaRef.current.totalDistanceKm,
          routeTotalMinutes: routeMetaRef.current.totalDurationMinutes,
          smoothedSpeedKmh: smoothedSpeedKmhRef.current,
          mode,
        });
        setRemainingDistanceKm(liveDistKm);
        setRemainingMinutes(nextMin);
        onTelemetryUpdateRef.current?.(liveDistKm, nextMin);
      }

      if (isInitial || now - lastSnappedApiTsRef.current >= 15000) {
        lastSnappedApiTsRef.current = now;
        const snapped = await snapAndReverseGeocodeGps(rawLat, rawLng);
        if (snapped?.streetName) {
          onLiveGpsUpdateRef.current?.(snappedLat, snappedLng, snapped.streetName);
          return;
        }
        onLiveGpsUpdateRef.current?.(snappedLat, snappedLng);
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => handleGpsFix(pos, true),
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => handleGpsFix(pos, false),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [originLat, originLng, destLabel, mode, syncPositionAndOrientation, fetchRealRoadNetwork, updateManeuver]);

  const handleRecenterGps = () => {
    hapticLight();
    userManualPanUntilRef.current = 0;
    setIsFollowingGps(true);
    hasActiveGpsFollowRef.current = true;
    const pos = liveUserPosRef.current;
    syncPositionAndOrientation(
      pos.lat,
      pos.lng,
      routeLookAheadBearingRef.current,
      true,
      false
    );
  };

  const effectiveConeAngleDeg = useNativeVectorHeading
    ? (userHeadingDeg - mapBearingDeg + 360) % 360
    : userHeadingDeg;

  const stageStyle: React.CSSProperties = useNativeVectorHeading
    ? {
        '--map-counter-rotate': '0deg',
      }
    : {
        '--map-counter-rotate': `${mapBearingDeg.toFixed(1)}deg`,
        transform: `rotate(${-mapBearingDeg.toFixed(1)}deg)`,
        transition: isTouchInteracting
          ? 'none'
          : 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'transform',
      };

  return (
    <div
      ref={viewportRef}
      className={`relative flex-1 w-full h-full min-h-[340px] overflow-hidden flex flex-col select-none touch-none ${
        isDark ? 'bg-slate-950' : 'bg-slate-100'
      }`}
    >
      {/* PALCO CARTOGRÁFICO (VETORIAL NATIVO 100% COM GOOGLE MAPS OU ESTÁGIO 164% COURSE-UP) */}
      <div
        className={`absolute z-0 ${
          useNativeVectorHeading
            ? 'inset-0 w-full h-full'
            : 'inset-[-32%] w-[164%] h-[164%]'
        } ${!useOfficialGoogleMap && isDark ? 'vagou-map-dark' : ''}`}
        style={stageStyle}
      >
        {useOfficialGoogleMap ? (
          <APIProvider
            apiKey={googleApiKey}
            language="pt-BR"
            region="BR"
            solutionChannel="gmp_mcp_codeassist_v1_aistudio"
            onError={handleGoogleAuthFailure}
          >
            <GoogleMapCanvas
              defaultCenter={{ lat: originLat, lng: originLng }}
              defaultZoom={17}
              defaultHeading={initialBearing}
              mapId="DEMO_MAP_ID"
              renderingType={RenderingType.VECTOR}
              colorScheme={isDark ? ColorScheme.DARK : ColorScheme.LIGHT}
              disableDefaultUI={true}
              clickableIcons={false}
              gestureHandling="none"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            >
              <GoogleMapRuntimeSync
                mapRef={googleMapRef}
                onVectorModeChange={setIsGoogleVectorMap}
                onAuthFailure={handleGoogleAuthFailure}
                initialCenter={userMarkerPos}
                initialHeading={mapBearingDeg}
              />

              {activePolylinePath.length > 1 && (
                <>
                  <GooglePolyline
                    path={activePolylinePath}
                    strokeColor="#064e3b"
                    strokeOpacity={0.9}
                    strokeWeight={9}
                    zIndex={10}
                    clickable={false}
                  />
                  <GooglePolyline
                    path={activePolylinePath}
                    strokeColor="#10b981"
                    strokeOpacity={1.0}
                    strokeWeight={5.5}
                    zIndex={11}
                    clickable={false}
                  />
                </>
              )}

              <AdvancedMarker
                position={originMarkerPos}
                anchorLeft="-50%"
                anchorTop="-50%"
                zIndex={20}
              >
                <div
                  className={`px-2 py-0.5 rounded-[4px] text-[10px] font-extrabold whitespace-nowrap shadow-md border ${
                    isDark
                      ? 'bg-slate-900 text-white border-white/80'
                      : 'bg-white text-slate-900 border-slate-200'
                  }`}
                  style={{
                    transform: useNativeVectorHeading
                      ? 'none'
                      : 'rotate(var(--map-counter-rotate, 0deg))',
                  }}
                >
                  Saída
                </div>
              </AdvancedMarker>

              <AdvancedMarker
                position={destMarkerPos}
                anchorLeft="-50%"
                anchorTop="-50%"
                zIndex={25}
              >
                <div
                  className="px-2 py-0.5 rounded-[4px] bg-emerald-500 text-white text-[10px] font-extrabold whitespace-nowrap shadow-md border border-white/90"
                  style={{
                    transform: useNativeVectorHeading
                      ? 'none'
                      : 'rotate(var(--map-counter-rotate, 0deg))',
                  }}
                >
                  {destLabel.slice(0, 22)}
                </div>
              </AdvancedMarker>

              <AdvancedMarker
                position={userMarkerPos}
                anchorLeft="-50%"
                anchorTop="-50%"
                zIndex={1000}
              >
                <DirectionalUserPuck
                  avatarUrl={effectiveUserAvatar}
                  coneAngleDeg={effectiveConeAngleDeg}
                  counterRotateCssVar={!useNativeVectorHeading}
                />
              </AdvancedMarker>
            </GoogleMapCanvas>
          </APIProvider>
        ) : (
          <div ref={mapContainerRef} className="w-full h-full" />
        )}
      </div>

      {/* BOTÃO FLUTUANTE RECENTRALIZAR NO GPS */}
      {!isFollowingGps && (
        <button
          type="button"
          onClick={handleRecenterGps}
          className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center gap-1.5 shadow-xl active:scale-95 transition cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5 text-white" />
          <span className="text-white">Recentralizar</span>
        </button>
      )}
    </div>
  );
};
