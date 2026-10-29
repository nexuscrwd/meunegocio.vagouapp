import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  ArrowUp,
  CornerUpRight,
  CornerUpLeft,
  RotateCcw,
  ExternalLink,
  Compass,
  Loader2,
} from 'lucide-react';
import {
  GoogleComputedRouteResult,
  snapAndReverseGeocodeGps,
  decodeGooglePolyline,
} from '../../services/googleMapsService';
import { isValidAvatarUrlString } from '../../lib/supabase';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight, hapticSuccess } from '../../utils/haptics';

interface InteractiveGoogleRouteMapProps {
  originLat?: number;
  originLng?: number;
  originLabel: string;
  destLat?: number;
  destLng?: number;
  destLabel: string;
  userAvatarUrl?: string;
  routeData: GoogleComputedRouteResult | null;
  initialDistanceKm: number;
  initialEtaMinutes: number;
  fallbackEmbedUrl?: string;
  onLiveGpsUpdate?: (lat: number, lng: number, snappedStreetName?: string) => void;
  onDestinationReachedChange?: (reached: boolean) => void;
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
  if (straightKm < 0.05) return 0;
  return Number((straightKm * 1.35).toFixed(1));
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
  const diff = ((((targetDeg - currentDeg) % 360) + 540) % 360) - 180;
  return (currentDeg + diff * factor + 360) % 360;
}

function angleDiffDeg(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

/**
 * Encontra o ponto mais próximo na malha viária e retorna o trecho restante.
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
  remainingPath: Array<{ lat: number; lng: number }>;
  closestIndex: number;
  isOffRoute: boolean;
} {
  if (!roadPath || roadPath.length <= 2) {
    return {
      forwardBearingDeg: computeBearingDeg(userLat, userLng, destLat, destLng),
      remainingPath: [],
      closestIndex: 0,
      isOffRoute: true,
    };
  }

  let closestIdx = 0;
  let minDistKm = Infinity;
  for (let i = 0; i < roadPath.length; i++) {
    const d = computeHaversineKm(userLat, userLng, roadPath[i].lat, roadPath[i].lng);
    if (d < minDistKm) {
      minDistKm = d;
      closestIdx = i;
    }
  }

  // Se o GPS real do usuário estiver a mais de 220m da rota calculada originalmente,
  // sinaliza recálculo viário mantendo a geometria atual até a nova rota chegar (sem linha reta).
  if (minDistKm > 0.22) {
    const nextPt = roadPath[Math.min(1, roadPath.length - 1)];
    return {
      forwardBearingDeg: computeBearingDeg(roadPath[0].lat, roadPath[0].lng, nextPt.lat, nextPt.lng),
      remainingPath: roadPath,
      closestIndex: 0,
      isOffRoute: true,
    };
  }

  let lookAheadIdx = Math.min(closestIdx + 1, roadPath.length - 1);
  for (let j = closestIdx + 1; j < roadPath.length; j++) {
    const dAhead = computeHaversineKm(
      roadPath[closestIdx].lat,
      roadPath[closestIdx].lng,
      roadPath[j].lat,
      roadPath[j].lng
    );
    lookAheadIdx = j;
    if (dAhead >= 0.035) break;
  }

  const aheadPt = roadPath[lookAheadIdx] || roadPath[roadPath.length - 1];
  const bearingFromUser = computeBearingDeg(userLat, userLng, aheadPt.lat, aheadPt.lng);

  const tailPoints = roadPath.slice(Math.min(closestIdx + 1, roadPath.length - 1));
  const remainingSlice =
    tailPoints.length >= 2
      ? [{ lat: userLat, lng: userLng }, ...tailPoints]
      : roadPath;

  return {
    forwardBearingDeg: bearingFromUser,
    remainingPath: remainingSlice,
    closestIndex: closestIdx,
    isOffRoute: false,
  };
}

function formatCountdownHhMm(totalMinutes: number): string {
  const safeMin = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMin / 60);
  const mins = safeMin % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
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
  rotor.style.transition = 'transform 180ms linear';
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
    directionTip.style.top = '2px';
    directionTip.style.left = '50%';
    directionTip.style.transform = 'translateX(-50%)';
    directionTip.style.width = '0';
    directionTip.style.height = '0';
    directionTip.style.borderLeft = '5px solid transparent';
    directionTip.style.borderRight = '5px solid transparent';
    directionTip.style.borderBottom = '9px solid #10b981';
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

export const InteractiveGoogleRouteMap: React.FC<InteractiveGoogleRouteMapProps> = ({
  originLat = -23.5505,
  originLng = -46.6333,
  destLat = -23.5621,
  destLng = -46.4795,
  destLabel,
  userAvatarUrl,
  routeData,
  initialDistanceKm,
  initialEtaMinutes,
  onLiveGpsUpdate,
  onDestinationReachedChange,
}) => {
  const { isDark } = useTheme();
  const effectiveUserAvatar = useMemo(
    () => resolveActiveUserAvatarUrl(userAvatarUrl),
    [userAvatarUrl]
  );

  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  // Instâncias persistentes do Leaflet Map
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletTileLayerRef = useRef<L.TileLayer | null>(null);
  const leafletOuterPolylineRef = useRef<L.Polyline | null>(null);
  const leafletInnerPolylineRef = useRef<L.Polyline | null>(null);
  const leafletOriginMarkerRef = useRef<L.Marker | null>(null);
  const leafletDestMarkerRef = useRef<L.Marker | null>(null);
  const leafletUserMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRotorRef = useRef<HTMLDivElement | null>(null);

  const [isFollowingGps, setIsFollowingGps] = useState<boolean>(true);
  const [isCalculatingRoad, setIsCalculatingRoad] = useState<boolean>(true);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [activeManeuver, setActiveManeuver] = useState<{
    instruction: string;
    distanceText: string;
    maneuver: string;
  }>({
    instruction: `Em direção a ${destLabel}`,
    distanceText: 'Em rota',
    maneuver: 'STRAIGHT',
  });

  const roadPathRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const lastFittedKeyRef = useRef<string>('');
  const lastGpsFixRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const lastSnappedApiTsRef = useRef<number>(0);
  const lastRerouteTsRef = useRef<number>(0);
  const hasActiveGpsFollowRef = useRef<boolean>(true);
  const userManualPanUntilRef = useRef<number>(0);

  const forwardHeadingRef = useRef<number>(
    computeBearingDeg(originLat, originLng, destLat, destLng)
  );
  const routeLookAheadBearingRef = useRef<number>(
    computeBearingDeg(originLat, originLng, destLat, destLng)
  );
  const liveUserPosRef = useRef<{ lat: number; lng: number }>({
    lat: originLat,
    lng: originLng,
  });

  const onLiveGpsUpdateRef = useRef(onLiveGpsUpdate);
  onLiveGpsUpdateRef.current = onLiveGpsUpdate;

  const onDestinationReachedRef = useRef(onDestinationReachedChange);
  onDestinationReachedRef.current = onDestinationReachedChange;

  const baseDistanceKm = routeData?.distanceKm ?? initialDistanceKm ?? 3.2;
  const baseEtaMinutes = routeData?.etaMinutes ?? initialEtaMinutes ?? 14;

  const [remainingDistanceKm, setRemainingDistanceKm] = useState<number>(baseDistanceKm);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(baseEtaMinutes);

  useEffect(() => {
    setRemainingDistanceKm(baseDistanceKm);
    setRemainingMinutes(baseEtaMinutes);
  }, [baseDistanceKm, baseEtaMinutes]);

  const hasReachedDestination = remainingDistanceKm <= 0.15 || remainingMinutes <= 0;

  useEffect(() => {
    onDestinationReachedRef.current?.(hasReachedDestination);
  }, [hasReachedDestination]);

  /**
   * Atualização de câmera e marcador imperativa (Uber-style Look-Ahead)
   */
  const syncPositionAndOrientation = useCallback(
    (userLat: number, userLng: number, headingDeg: number, shouldPanCamera: boolean) => {
      liveUserPosRef.current = { lat: userLat, lng: userLng };

      const lmap = leafletMapRef.current;
      if (!lmap) return;

      // 1. Atualiza posição do marcador
      if (leafletUserMarkerRef.current) {
        leafletUserMarkerRef.current.setLatLng([userLat, userLng]);
      }

      // 2. Gira a ponteira e cone de visão
      if (userMarkerRotorRef.current) {
        userMarkerRotorRef.current.style.transform = `rotate(${headingDeg.toFixed(1)}deg)`;
      }

      // 3. Projeta a câmera ~65m à frente na direção do movimento (Look-Ahead)
      const isManualPan = Date.now() < userManualPanUntilRef.current;
      if (shouldPanCamera && !isManualPan) {
        const lookAheadCenter = projectPointAhead(userLat, userLng, headingDeg, 0.065);
        try {
          lmap.panTo([lookAheadCenter.lat, lookAheadCenter.lng], {
            animate: true,
            duration: 0.45,
          });
        } catch {}
      }
    },
    []
  );

  /**
   * Inicialização ÚNICA do motor de mapa com Multi-CDN Tile Fallback & ResizeObserver
   * Não destrói o mapa quando coordenadas mudam!
   */
  useEffect(() => {
    const containerEl = mapContainerRef.current;
    if (!containerEl) return;

    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const initialPos = liveUserPosRef.current;
    const lmap = L.map(containerEl, {
      center: [initialPos.lat, initialPos.lng],
      zoom: 16.5,
      zoomControl: false,
      attributionControl: false,
    });

    // Provedores de tiles multi-CDN com recuperação automática caso haja falha de rede/bloqueio
    const tileProviders = [
      {
        url: 'https://mt{s}.google.com/vt/lyrs=m&hl=pt-BR&x={x}&y={y}&z={z}',
        subdomains: ['0', '1', '2', '3'],
      },
      {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c'],
      },
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        subdomains: ['a'],
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
        subdomains: provider.subdomains,
        maxZoom: 20,
        className: isDark ? 'vagou-nav-dark-tiles' : '',
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

    // Linha de rota dupla (outer dark glow + inner emerald road)
    const outerPoly = L.polyline([], {
      color: '#064e3b',
      weight: 8,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(lmap);

    const innerPoly = L.polyline([], {
      color: '#10b981',
      weight: 5,
      opacity: 1.0,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(lmap);

    leafletOuterPolylineRef.current = outerPoly;
    leafletInnerPolylineRef.current = innerPoly;

    // Marcador de Saída
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
    leafletOriginMarkerRef.current = L.marker([originLat, originLng], {
      icon: originIcon,
    }).addTo(lmap);

    // Marcador de Destino
    const destIcon = L.divIcon({
      html: createPinBadge('#10b981', '#ffffff', destLabel.slice(0, 22)),
      className: 'vagou-leaflet-badge',
      iconSize: [120, 24],
      iconAnchor: [60, 12],
    });
    leafletDestMarkerRef.current = L.marker([destLat, destLng], {
      icon: destIcon,
    }).addTo(lmap);

    // Marcador Direcional do Usuário (Avatar com anel esmeralda e rotor)
    const { container, rotor } = createDirectionalUserMarkerElement(effectiveUserAvatar);
    userMarkerRotorRef.current = rotor;
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

    // Detecção de arrasto manual do mapa
    lmap.on('dragstart', () => {
      userManualPanUntilRef.current = Date.now() + 6000;
      setIsFollowingGps(false);
    });

    leafletMapRef.current = lmap;

    // Garante que o container do modal já tenha dimensões calculadas para carregar 100% dos tiles
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

    // Reaplica geometria viária existente imediatamente se já disponível
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
  }, [isDark]);

  // Atualiza ícone do destino ou avatar sem recriar o mapa
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

  /**
   * Aplicação da geometria viária da rota (Exige > 2 pontos — Proibido Linha Reta)
   */
  const applyRoadGeometry = useCallback(
    (roadPath: Array<{ lat: number; lng: number }>) => {
      if (!roadPath || roadPath.length <= 2) return;
      roadPathRef.current = roadPath;
      setIsCalculatingRoad(false);

      const startPt = roadPath[0];
      const endPt = roadPath[roadPath.length - 1];
      const currentPos = liveUserPosRef.current;

      const { forwardBearingDeg, remainingPath } =
        findForwardRouteBearingAndRemainingPath(
          currentPos.lat,
          currentPos.lng,
          roadPath,
          endPt.lat,
          endPt.lng
        );

      const polyToDraw = remainingPath.length > 2 ? remainingPath : roadPath;

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

      syncPositionAndOrientation(currentPos.lat, currentPos.lng, forwardBearingDeg, true);

      // Atualiza primeira instrução da rota se disponível
      if (routeData?.steps && routeData.steps.length > 0) {
        const step = routeData.steps[0];
        setActiveManeuver({
          instruction: step.instruction,
          distanceText: step.distanceText,
          maneuver: step.maneuver,
        });
      }

      // Enquadramento se não estiver em modo follow
      const routeFitKey = `${startPt.lat.toFixed(3)},${startPt.lng.toFixed(3)}->${endPt.lat.toFixed(3)},${endPt.lng.toFixed(3)}`;
      if (!hasActiveGpsFollowRef.current && lastFittedKeyRef.current !== routeFitKey) {
        lastFittedKeyRef.current = routeFitKey;
        if (leafletMapRef.current) {
          const bounds = L.latLngBounds(roadPath.map((p) => [p.lat, p.lng]));
          leafletMapRef.current.fitBounds(bounds, { padding: [40, 40] });
        }
      }
    },
    [syncPositionAndOrientation, routeData]
  );

  /**
   * Função reutilizável para buscar malha viária real (Backend 5-Layer Cascade + FOSSGIS OSRM + Global OSRM)
   * Jamais desenha linha reta de 2 pontos.
   */
  const fetchRealRoadNetwork = useCallback(
    async (startLat: number, startLng: number, targetLat: number, targetLng: number) => {
      setIsCalculatingRoad(true);

      // 1. Backend /api/geo/route (5-Layer Real-Road Cascade + Smart Landmark Geocoding)
      try {
        const routeRes = await fetch('/api/geo/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originLat: startLat,
            originLng: startLng,
            destLat: targetLat,
            destLng: targetLng,
            destAddress: destLabel,
            travelMode: 'DRIVE',
          }),
        });
        if (routeRes.ok) {
          const routeJson = await routeRes.json();
          const encoded = routeJson?.routes?.[0]?.polyline?.encodedPolyline;
          if (encoded) {
            const pts = decodeGooglePolyline(encoded);
            if (pts.length > 2) {
              applyRoadGeometry(pts);
              return true;
            }
          }
        }
      } catch {}

      // 2. FOSSGIS OpenStreetMap DE + Project OSRM Global direto do cliente
      const directOsrmUrls = [
        `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startLng},${startLat};${targetLng},${targetLat}?overview=full&geometries=polyline`,
        `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${targetLng},${targetLat}?overview=full&geometries=polyline`,
      ];

      for (const osrmUrl of directOsrmUrls) {
        try {
          const res = await fetch(osrmUrl);
          if (res.ok) {
            const data = await res.json();
            const encoded = data?.routes?.[0]?.geometry;
            if (encoded) {
              const pts = decodeGooglePolyline(encoded);
              if (pts.length > 2) {
                applyRoadGeometry(pts);
                return true;
              }
            }
          }
        } catch {}
      }

      setIsCalculatingRoad(false);
      return false;
    },
    [applyRoadGeometry, destLabel]
  );

  /**
   * Cálculo viário real ao abrir ou receber routeData
   */
  useEffect(() => {
    let active = true;

    const initRoadGeometry = async () => {
      // Se routeData já trouxe a malha viária decodificada (> 2 pontos), aplica imediatamente!
      if (routeData?.decodedPath && routeData.decodedPath.length > 2) {
        applyRoadGeometry(routeData.decodedPath);
        const firstPt = routeData.decodedPath[0];
        const distFromGpsKm = computeHaversineKm(
          liveUserPosRef.current.lat,
          liveUserPosRef.current.lng,
          firstPt.lat,
          firstPt.lng
        );
        // Se o ponto inicial da rota estiver próximo (< 350m), não precisa recalcular
        if (distFromGpsKm <= 0.35) {
          return;
        }
      }

      if (!active) return;
      await fetchRealRoadNetwork(
        liveUserPosRef.current.lat,
        liveUserPosRef.current.lng,
        destLat,
        destLng
      );
    };

    initRoadGeometry();

    return () => {
      active = false;
    };
  }, [routeData, destLat, destLng, applyRoadGeometry, fetchRealRoadNetwork]);

  /**
   * Bússola do celular (DeviceOrientation)
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let lastCompassTs = 0;

    const handleOrientation = (event: any) => {
      const now = Date.now();
      if (now - lastCompassTs < 120) return;

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

      const routeForward = routeLookAheadBearingRef.current;
      const diffToRoute = angleDiffDeg(rawHeading, routeForward);
      const targetHeading =
        diffToRoute > 135 && hasActiveGpsFollowRef.current ? routeForward : rawHeading;

      const nextHeading = smoothAngleDeg(forwardHeadingRef.current, targetHeading, 0.25);
      if (angleDiffDeg(nextHeading, forwardHeadingRef.current) < 1.5) return;

      forwardHeadingRef.current = nextHeading;
      const pos = liveUserPosRef.current;
      syncPositionAndOrientation(pos.lat, pos.lng, nextHeading, hasActiveGpsFollowRef.current);
    };

    window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener('deviceorientationabsolute' as any, handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [syncPositionAndOrientation]);

  /**
   * Rastreamento GPS ao vivo contínuo (Sem jamais sobrescrever a polilinha com linha reta)
   */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const avgMinutesPerKm = baseDistanceKm > 0 ? baseEtaMinutes / baseDistanceKm : 4.2;

    const handleGpsFix = async (pos: GeolocationPosition, isInitial = false) => {
      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const gpsCourse = pos.coords.heading;
      const gpsSpeed = pos.coords.speed ?? 0;

      const kmh = Math.max(0, Math.round(gpsSpeed * 3.6));
      setCurrentSpeedKmh(kmh);

      const prev = lastGpsFixRef.current;
      const now = Date.now();
      const movedMeters = prev
        ? computeHaversineKm(prev.lat, prev.lng, rawLat, rawLng) * 1000
        : 9999;

      if (!isInitial && prev && movedMeters < 3 && now - prev.ts < 2500) {
        return;
      }

      hasActiveGpsFollowRef.current = true;
      setIsFollowingGps(true);
      lastGpsFixRef.current = { lat: rawLat, lng: rawLng, ts: now };
      liveUserPosRef.current = { lat: rawLat, lng: rawLng };

      // 1. Recorta rota percorrida APENAS se a malha viária (> 2 pontos) já existir
      const { forwardBearingDeg, remainingPath, closestIndex, isOffRoute } =
        findForwardRouteBearingAndRemainingPath(
          rawLat,
          rawLng,
          roadPathRef.current,
          destLat,
          destLng
        );
      routeLookAheadBearingRef.current = forwardBearingDeg;

      if (remainingPath.length > 2) {
        leafletOuterPolylineRef.current?.setLatLngs(
          remainingPath.map((p) => [p.lat, p.lng] as [number, number])
        );
        leafletInnerPolylineRef.current?.setLatLngs(
          remainingPath.map((p) => [p.lat, p.lng] as [number, number])
        );
      }

      // Se o GPS real acabou de chegar e está fora da rota pré-calculada, recalcula a malha viária real a partir do GPS
      if (isOffRoute && now - lastRerouteTsRef.current >= 6000) {
        lastRerouteTsRef.current = now;
        const targetEnd =
          roadPathRef.current.length > 2
            ? roadPathRef.current[roadPathRef.current.length - 1]
            : { lat: destLat, lng: destLng };
        fetchRealRoadNetwork(rawLat, rawLng, targetEnd.lat, targetEnd.lng);
      }

      // 2. Atualiza instrução da próxima manobra com base no progresso na rota
      if (routeData?.steps && routeData.steps.length > 0 && roadPathRef.current.length > 2) {
        const stepIdx = Math.min(
          routeData.steps.length - 1,
          Math.floor((closestIndex / Math.max(1, roadPathRef.current.length)) * routeData.steps.length)
        );
        const currentStep = routeData.steps[stepIdx];
        if (currentStep) {
          setActiveManeuver({
            instruction: currentStep.instruction,
            distanceText: currentStep.distanceText,
            maneuver: currentStep.maneuver,
          });
        }
      }

      // 3. Determina heading frontal
      let resolvedHeading = forwardBearingDeg;
      if (
        typeof gpsCourse === 'number' &&
        !Number.isNaN(gpsCourse) &&
        gpsCourse >= 0 &&
        gpsSpeed >= 0.8
      ) {
        resolvedHeading =
          angleDiffDeg(gpsCourse, forwardBearingDeg) <= 120
            ? smoothAngleDeg(forwardBearingDeg, gpsCourse, 0.5)
            : forwardBearingDeg;
      } else if (prev && movedMeters >= 5) {
        const stepBearing = computeBearingDeg(prev.lat, prev.lng, rawLat, rawLng);
        resolvedHeading =
          angleDiffDeg(stepBearing, forwardBearingDeg) <= 115
            ? smoothAngleDeg(forwardBearingDeg, stepBearing, 0.45)
            : forwardBearingDeg;
      }

      forwardHeadingRef.current = smoothAngleDeg(
        forwardHeadingRef.current,
        resolvedHeading,
        0.45
      );

      // 4. Move o marcador e a câmera Look-Ahead
      syncPositionAndOrientation(rawLat, rawLng, forwardHeadingRef.current, true);

      // 5. Atualiza km e minutos restantes até o ponto final real da rota
      const endPt =
        roadPathRef.current.length > 2
          ? roadPathRef.current[roadPathRef.current.length - 1]
          : { lat: destLat, lng: destLng };
      const liveDistKm = computeRoadDistanceKm(rawLat, rawLng, endPt.lat, endPt.lng);
      if (liveDistKm <= 250) {
        setRemainingDistanceKm(liveDistKm);
        const nextMin =
          liveDistKm <= 0.15 ? 0 : Math.max(1, Math.round(liveDistKm * avgMinutesPerKm));
        setRemainingMinutes(nextMin);
      }

      // 6. Snap-to-Road no backend com throttle de 15s
      if (isInitial || now - lastSnappedApiTsRef.current >= 15000) {
        lastSnappedApiTsRef.current = now;
        const snapped = await snapAndReverseGeocodeGps(rawLat, rawLng);
        if (snapped) {
          liveUserPosRef.current = { lat: snapped.lat, lng: snapped.lng };
          syncPositionAndOrientation(snapped.lat, snapped.lng, forwardHeadingRef.current, true);
          onLiveGpsUpdateRef.current?.(snapped.lat, snapped.lng, snapped.streetName);
          return;
        }
        onLiveGpsUpdateRef.current?.(rawLat, rawLng);
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
  }, [destLat, destLng, baseDistanceKm, baseEtaMinutes, routeData, syncPositionAndOrientation, fetchRealRoadNetwork]);

  const handleRecenterGps = () => {
    hapticLight();
    userManualPanUntilRef.current = 0;
    setIsFollowingGps(true);
    hasActiveGpsFollowRef.current = true;
    const pos = liveUserPosRef.current;
    syncPositionAndOrientation(pos.lat, pos.lng, forwardHeadingRef.current, true);
  };

  const formattedKm = useMemo(
    () => remainingDistanceKm.toFixed(1).replace('.', ','),
    [remainingDistanceKm]
  );

  const formattedHhMm = useMemo(
    () => formatCountdownHhMm(remainingMinutes),
    [remainingMinutes]
  );

  // Links externos oficiais para abrir em aplicativos de navegação no painel do carro
  const wazeNavUrl = `https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes`;
  const googleMapsNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;

  const renderManeuverIcon = () => {
    const m = (activeManeuver.maneuver || '').toUpperCase();
    if (m.includes('RIGHT')) return <CornerUpRight className="w-5 h-5 text-white stroke-[2.5]" />;
    if (m.includes('LEFT')) return <CornerUpLeft className="w-5 h-5 text-white stroke-[2.5]" />;
    if (m.includes('U_TURN')) return <RotateCcw className="w-5 h-5 text-white stroke-[2.5]" />;
    return <ArrowUp className="w-5 h-5 text-white stroke-[2.5]" />;
  };

  return (
    <div
      className={`relative flex-1 w-full h-full min-h-[340px] overflow-hidden flex flex-col ${
        isDark ? 'bg-slate-950' : 'bg-slate-100'
      }`}
    >
      {/* 1. CARTÃO SUPERIOR DE NAVEGAÇÃO ESTILO UBER / WAZE */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex flex-col gap-1.5 pointer-events-auto">
        <div
          className={`w-full p-2.5 rounded-[6px] border flex items-center justify-between gap-3 shadow-xl backdrop-blur-md transition ${
            isDark
              ? 'bg-slate-900/95 border-slate-800 text-white'
              : 'bg-white/95 border-slate-200 text-slate-900 shadow-md'
          }`}
        >
          {/* Ícone de manobra com fundo verde sólido (Regra do Fundo Verde = Texto/Ícone Branco Puro) */}
          <div className="w-9 h-9 rounded-[4px] bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-xs">
            {isCalculatingRoad ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              renderManeuverIcon()
            )}
          </div>

          {/* Instrução da Manobra */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-emerald-400 font-mono">
                {activeManeuver.distanceText}
              </span>
              <span className="text-[10px] text-slate-400">• Rumo ao destino</span>
            </div>
            <h4 className="text-xs font-black truncate leading-tight">
              {activeManeuver.instruction}
            </h4>
          </div>

          {/* Atalhos rápidos para Waze ou Google Maps externo */}
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={wazeNavUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no aplicativo Waze"
              className="px-2 py-1 rounded-[3px] bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold flex items-center gap-1 transition"
            >
              <span>Waze</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <a
              href={googleMapsNavUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no aplicativo Google Maps"
              className="px-2 py-1 rounded-[3px] bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition"
            >
              <span>Maps</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      </div>

      {/* 2. SUPERFÍCIE INTERATIVA DO MAPA (CANVAS NATIVO LEAFLET COM AUTO-FOLLOW E LOOK-AHEAD) */}
      <div
        ref={mapContainerRef}
        className="w-full flex-1 min-h-[340px] z-0"
        style={{ minHeight: '340px', height: '100%' }}
      />

      {/* 3. BOTÃO FLUTUANTE RECENTRALIZAR NO GPS (APARECE SE O USUÁRIO ARRASTAR O MAPA) */}
      {!isFollowingGps && (
        <button
          type="button"
          onClick={handleRecenterGps}
          className="absolute bottom-16 right-3 z-20 px-3 py-1.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center gap-1.5 shadow-xl active:scale-95 transition cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5 text-white animate-pulse" />
          <span className="text-white">Recentralizar</span>
        </button>
      )}

      {/* 4. MEDIDOR DE VELOCIDADE REAL DO GPS (CANTO INFERIOR ESQUERDO) */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
        <div
          className={`px-2.5 py-1.5 rounded-[4px] border backdrop-blur-md flex flex-col items-center justify-center leading-none ${
            isDark
              ? 'bg-slate-900/90 border-slate-800 text-white'
              : 'bg-white/90 border-slate-200 text-slate-900'
          }`}
        >
          <span className="text-sm font-black font-mono tabular-nums text-emerald-400">
            {currentSpeedKmh}
          </span>
          <span className="text-[9px] font-bold text-slate-400 uppercase">km/h</span>
        </div>

        <div className="flex items-center gap-1 px-2 py-1 rounded-[3px] bg-black/60 backdrop-blur-xs text-[9.5px] font-mono text-emerald-400 font-bold">
          <Compass className="w-3 h-3 text-emerald-400 animate-spin-slow" />
          <span>GPS ATIVO</span>
        </div>
      </div>

      {/* 5. CANTO INFERIOR DIREITO DO MAPA: KM RESTANTE E HH:MM REGRESSIVO (HUD UBER) */}
      <button
        type="button"
        onClick={() => {
          hapticLight();
          if (remainingDistanceKm > 0.15) {
            const stepKm = Math.max(0.4, Number((baseDistanceKm / 4).toFixed(1)));
            const nextKm = Math.max(0, Number((remainingDistanceKm - stepKm).toFixed(1)));
            const ratio = baseDistanceKm > 0 ? nextKm / baseDistanceKm : 0;
            setRemainingDistanceKm(nextKm);
            setRemainingMinutes(
              nextKm <= 0.15 ? 0 : Math.max(1, Math.round(baseEtaMinutes * ratio))
            );

            // Simula avanço suave ao longo da rota
            const path = roadPathRef.current;
            if (path.length > 2) {
              const progress = Math.min(0.95, Math.max(0.05, 1 - ratio));
              const idx = Math.min(
                path.length - 1,
                Math.floor(progress * (path.length - 1))
              );
              const simPt = path[idx];
              hasActiveGpsFollowRef.current = true;
              setIsFollowingGps(true);
              liveUserPosRef.current = simPt;
              const { forwardBearingDeg } = findForwardRouteBearingAndRemainingPath(
                simPt.lat,
                simPt.lng,
                path,
                destLat,
                destLng
              );
              syncPositionAndOrientation(simPt.lat, simPt.lng, forwardBearingDeg, true);
            }
          } else {
            setRemainingDistanceKm(baseDistanceKm);
            setRemainingMinutes(baseEtaMinutes);
            if (roadPathRef.current.length >= 2) {
              const startPt = roadPathRef.current[0];
              liveUserPosRef.current = startPt;
              syncPositionAndOrientation(
                startPt.lat,
                startPt.lng,
                routeLookAheadBearingRef.current,
                true
              );
            }
          }
        }}
        title="Distância e tempo restantes até o destino (toque para simular aproximação)"
        className={`absolute bottom-3 right-3 z-10 px-3.5 py-2 rounded-[4px] backdrop-blur-md flex items-baseline gap-3 select-none cursor-pointer transition shadow-xl ${
          isDark
            ? 'bg-slate-900/95 text-white border border-slate-800'
            : 'bg-white/95 text-slate-900 border border-slate-200'
        }`}
      >
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black font-mono tabular-nums tracking-tight">
            {formattedKm}
          </span>
          <span className="text-[11px] font-extrabold uppercase text-slate-400">km</span>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black font-mono tabular-nums tracking-tight text-emerald-400">
            {formattedHhMm}
          </span>
        </div>
      </button>
    </div>
  );
};
