import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Navigation } from 'lucide-react';
import {
  GoogleComputedRouteResult,
  loadGoogleMapsJsSdk,
  snapAndReverseGeocodeGps,
  decodeGooglePolyline,
} from '../../services/googleMapsService';
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

function findForwardRouteBearingAndRemainingPath(
  userLat: number,
  userLng: number,
  roadPath: Array<{ lat: number; lng: number }>,
  destLat: number,
  destLng: number
): {
  forwardBearingDeg: number;
  remainingPath: Array<{ lat: number; lng: number }>;
} {
  if (!roadPath || roadPath.length < 2) {
    return {
      forwardBearingDeg: computeBearingDeg(userLat, userLng, destLat, destLng),
      remainingPath: [
        { lat: userLat, lng: userLng },
        { lat: destLat, lng: destLng },
      ],
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

  const aheadPt = roadPath[lookAheadIdx] || { lat: destLat, lng: destLng };
  const bearingFromUser = computeBearingDeg(userLat, userLng, aheadPt.lat, aheadPt.lng);
  const remainingSlice = [
    { lat: userLat, lng: userLng },
    ...roadPath.slice(Math.min(closestIdx + 1, roadPath.length - 1)),
  ];

  return {
    forwardBearingDeg: bearingFromUser,
    remainingPath: remainingSlice.length >= 2 ? remainingSlice : roadPath,
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
  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.28)';
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
  visionCone.style.top = '-15px';
  visionCone.style.left = '50%';
  visionCone.style.transform = 'translateX(-50%)';
  visionCone.style.width = '40px';
  visionCone.style.height = '38px';
  visionCone.style.background =
    'linear-gradient(to top, rgba(16, 185, 129, 0.50) 0%, rgba(16, 185, 129, 0.0) 100%)';
  visionCone.style.clipPath = 'polygon(0% 0%, 100% 0%, 62% 100%, 38% 100%)';
  visionCone.style.borderRadius = '50% 50% 0 0';

  const defaultPuck = document.createElement('div');
  defaultPuck.style.position = 'relative';
  defaultPuck.style.width = '24px';
  defaultPuck.style.height = '24px';
  defaultPuck.style.borderRadius = '9999px';
  defaultPuck.style.background = '#10b981';
  defaultPuck.style.border = '3px solid #ffffff';
  defaultPuck.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.35), 0 0 0 4px rgba(16, 185, 129, 0.28)';
  defaultPuck.style.display = hasValidPhoto ? 'none' : 'flex';
  defaultPuck.style.alignItems = 'center';
  defaultPuck.style.justifyContent = 'center';

  const arrow = document.createElement('div');
  arrow.style.width = '0';
  arrow.style.height = '0';
  arrow.style.borderLeft = '4.5px solid transparent';
  arrow.style.borderRight = '4.5px solid transparent';
  arrow.style.borderBottom = '8px solid #ffffff';
  arrow.style.transform = 'translateY(-1px)';

  defaultPuck.appendChild(arrow);
  rotor.appendChild(visionCone);
  rotor.appendChild(defaultPuck);

  if (hasValidPhoto && avatarUrl) {
    const directionTip = document.createElement('div');
    directionTip.style.position = 'absolute';
    directionTip.style.top = '3px';
    directionTip.style.left = '50%';
    directionTip.style.transform = 'translateX(-50%)';
    directionTip.style.width = '0';
    directionTip.style.height = '0';
    directionTip.style.borderLeft = '5px solid transparent';
    directionTip.style.borderRight = '5px solid transparent';
    directionTip.style.borderBottom = '8px solid #10b981';
    directionTip.style.filter = 'drop-shadow(0 -1px 2px rgba(255,255,255,0.95))';
    rotor.appendChild(directionTip);

    const avatarBadge = document.createElement('div');
    avatarBadge.style.position = 'absolute';
    avatarBadge.style.width = '32px';
    avatarBadge.style.height = '32px';
    avatarBadge.style.borderRadius = '9999px';
    avatarBadge.style.border = '2.5px solid #10b981';
    avatarBadge.style.boxShadow =
      '0 2px 10px rgba(0, 0, 0, 0.4), 0 0 0 2px #ffffff, 0 0 0 5px rgba(16, 185, 129, 0.28)';
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
  originLabel,
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

  // Engine: 'google' ou 'leaflet'
  const [activeEngine, setActiveEngine] = useState<'google' | 'leaflet'>('leaflet');
  const [isFollowingGps, setIsFollowingGps] = useState<boolean>(true);

  // Instâncias Google Maps
  const gmapRef = useRef<any>(null);
  const gmapOuterPolylineRef = useRef<any>(null);
  const gmapInnerPolylineRef = useRef<any>(null);
  const gmapOriginMarkerRef = useRef<any>(null);
  const gmapDestMarkerRef = useRef<any>(null);
  const gmapUserMarkerRef = useRef<any>(null);

  // Instâncias Leaflet
  const leafletMapRef = useRef<L.Map | null>(null);
  const leafletOuterPolylineRef = useRef<L.Polyline | null>(null);
  const leafletInnerPolylineRef = useRef<L.Polyline | null>(null);
  const leafletOriginMarkerRef = useRef<L.Marker | null>(null);
  const leafletDestMarkerRef = useRef<L.Marker | null>(null);
  const leafletUserMarkerRef = useRef<L.Marker | null>(null);

  // Elementos HTML do marcador direcional (rotor e avatar)
  const userMarkerRotorRef = useRef<HTMLDivElement | null>(null);

  // Estado de Rota e Rastreamento
  const roadPathRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const lastFittedKeyRef = useRef<string>('');
  const lastGpsFixRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const lastSnappedApiTsRef = useRef<number>(0);
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
   * Atualização imperativa de posição e rotação em ambos os motores
   */
  const syncPositionAndOrientation = useCallback(
    (userLat: number, userLng: number, headingDeg: number, shouldPanCamera: boolean) => {
      liveUserPosRef.current = { lat: userLat, lng: userLng };

      // 1. Projeta o centro da câmera ~65 metros à frente na direção do movimento (Look-Ahead Uber)
      const lookAheadCenter = projectPointAhead(userLat, userLng, headingDeg, 0.065);
      const isManualPan = Date.now() < userManualPanUntilRef.current;

      // 2. Atualiza motor Google Maps se ativo
      if (activeEngine === 'google' && gmapRef.current) {
        const map = gmapRef.current;
        if (gmapUserMarkerRef.current) {
          gmapUserMarkerRef.current.position = { lat: userLat, lng: userLng };
        }
        if (shouldPanCamera && !isManualPan) {
          try {
            const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 17;
            const targetZoom = !currentZoom || currentZoom < 17 ? 17.5 : currentZoom;
            if (typeof map.moveCamera === 'function') {
              map.moveCamera({
                center: lookAheadCenter,
                zoom: targetZoom,
                heading: headingDeg,
                tilt: 45,
              });
            } else if (typeof map.panTo === 'function') {
              map.panTo(lookAheadCenter);
            }
          } catch {
            try {
              map.panTo(lookAheadCenter);
            } catch {}
          }
        }
        const currentMapHeading =
          typeof map.getHeading === 'function' ? Number(map.getHeading() || 0) : 0;
        const relativeRotorDeg = (headingDeg - currentMapHeading + 360) % 360;
        if (userMarkerRotorRef.current) {
          userMarkerRotorRef.current.style.transform = `rotate(${relativeRotorDeg.toFixed(1)}deg)`;
        }
      }

      // 3. Atualiza motor Leaflet se ativo
      if (activeEngine === 'leaflet' && leafletMapRef.current) {
        const lmap = leafletMapRef.current;
        if (leafletUserMarkerRef.current) {
          leafletUserMarkerRef.current.setLatLng([userLat, userLng]);
        }
        if (shouldPanCamera && !isManualPan) {
          try {
            lmap.panTo([lookAheadCenter.lat, lookAheadCenter.lng], {
              animate: true,
              duration: 0.45,
            });
          } catch {}
        }
        if (userMarkerRotorRef.current) {
          userMarkerRotorRef.current.style.transform = `rotate(${headingDeg.toFixed(1)}deg)`;
        }
      }
    },
    [activeEngine]
  );

  /**
   * Recentraliza a câmera no usuário imediatamente (botão de mira)
   */
  const handleRecenterGps = () => {
    hapticLight();
    userManualPanUntilRef.current = 0;
    setIsFollowingGps(true);
    hasActiveGpsFollowRef.current = true;
    const pos = liveUserPosRef.current;
    syncPositionAndOrientation(pos.lat, pos.lng, forwardHeadingRef.current, true);
  };

  /**
   * Inicialização do Motor Leaflet
   */
  const initLeafletEngine = useCallback(() => {
    if (!mapContainerRef.current) return;
    if (leafletMapRef.current) {
      leafletMapRef.current.remove();
      leafletMapRef.current = null;
    }

    const initialPos = liveUserPosRef.current;
    const lmap = L.map(mapContainerRef.current, {
      center: [initialPos.lat, initialPos.lng],
      zoom: 16.5,
      zoomControl: false,
      attributionControl: false,
    });

    // Camada de Tiles de alta performance: CartoDB Dark Matter para modo escuro ou CartoDB Voyager para claro
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(lmap);

    // Linha viária externa e interna
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

    // Marcador Direcional do Usuário (com foto ou disco direcional)
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

    // Pausa do auto-follow caso o usuário interaja manualmente
    lmap.on('dragstart', () => {
      userManualPanUntilRef.current = Date.now() + 6000;
      setIsFollowingGps(false);
    });

    leafletMapRef.current = lmap;
    setActiveEngine('leaflet');

    // Se já houver geometria viária calculada, aplica imediatamente no Leaflet
    if (roadPathRef.current.length >= 2) {
      const latlngs = roadPathRef.current.map((p) => [p.lat, p.lng] as [number, number]);
      outerPoly.setLatLngs(latlngs);
      innerPoly.setLatLngs(latlngs);
      const bounds = L.latLngBounds(latlngs);
      lmap.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [isDark, originLat, originLng, destLat, destLabel, effectiveUserAvatar]);

  /**
   * Tenta carregar o Google Maps JS SDK; se falhar ou demorar > 1.8s, ativa imediatamente o Leaflet
   */
  useEffect(() => {
    let active = true;

    const timer = setTimeout(() => {
      if (active && activeEngine !== 'google') {
        initLeafletEngine();
      }
    }, 1800);

    loadGoogleMapsJsSdk().then((ok) => {
      if (!active) return;
      clearTimeout(timer);
      const gmaps = (window as any).google?.maps;
      if (ok && gmaps?.Map && mapContainerRef.current) {
        try {
          if (leafletMapRef.current) {
            leafletMapRef.current.remove();
            leafletMapRef.current = null;
          }

          const initialHeading = computeBearingDeg(originLat, originLng, destLat, destLng);
          forwardHeadingRef.current = initialHeading;
          routeLookAheadBearingRef.current = initialHeading;

          const map = new gmaps.Map(mapContainerRef.current, {
            center: { lat: originLat, lng: originLng },
            zoom: 16.5,
            heading: initialHeading,
            tilt: 45,
            mapId: 'DEMO_MAP_ID',
            colorScheme: isDark ? 'DARK' : 'LIGHT',
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            rotateControl: false,
            gestureHandling: 'greedy',
            internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
          });

          gmapRef.current = map;

          map.addListener('dragstart', () => {
            userManualPanUntilRef.current = Date.now() + 6000;
            setIsFollowingGps(false);
          });

          gmapOuterPolylineRef.current = new gmaps.Polyline({
            path: [],
            geodesic: true,
            strokeColor: '#064e3b',
            strokeOpacity: 0.85,
            strokeWeight: 8,
            map,
          });

          gmapInnerPolylineRef.current = new gmaps.Polyline({
            path: [],
            geodesic: true,
            strokeColor: '#10b981',
            strokeOpacity: 1.0,
            strokeWeight: 5,
            map,
          });

          const AdvancedMarker = gmaps.marker?.AdvancedMarkerElement;
          if (AdvancedMarker) {
            gmapOriginMarkerRef.current = new AdvancedMarker({
              map,
              position: { lat: originLat, lng: originLng },
              title: originLabel,
              content: createPinBadge(
                isDark ? '#0f172a' : '#ffffff',
                isDark ? '#ffffff' : '#0f172a',
                'Saída'
              ),
            });

            gmapDestMarkerRef.current = new AdvancedMarker({
              map,
              position: { lat: destLat, lng: destLng },
              title: destLabel,
              content: createPinBadge('#10b981', '#ffffff', destLabel.slice(0, 22)),
            });

            const { container, rotor } = createDirectionalUserMarkerElement(effectiveUserAvatar);
            userMarkerRotorRef.current = rotor;
            gmapUserMarkerRef.current = new AdvancedMarker({
              map,
              position: liveUserPosRef.current,
              title: 'Sua Posição',
              content: container,
            });
          }

          setActiveEngine('google');
          return;
        } catch (e) {
          console.warn('[Vagou GPS] Falha ao inicializar Google Maps JS. Ativando Leaflet...', e);
          initLeafletEngine();
        }
      } else {
        initLeafletEngine();
      }
    });

    return () => {
      active = false;
      clearTimeout(timer);
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [isDark, initLeafletEngine, originLat, originLng, destLat, destLabel, originLabel, effectiveUserAvatar]);

  /**
   * Atualização de polilinha viária sem recriar os mapas
   */
  const applyRoadGeometry = useCallback(
    (roadPath: Array<{ lat: number; lng: number }>) => {
      if (!roadPath || roadPath.length < 2) return;
      roadPathRef.current = roadPath;

      const currentPos = liveUserPosRef.current;
      const endPt = roadPath[roadPath.length - 1];

      const { forwardBearingDeg, remainingPath } =
        findForwardRouteBearingAndRemainingPath(
          currentPos.lat,
          currentPos.lng,
          roadPath,
          endPt.lat,
          endPt.lng
        );

      routeLookAheadBearingRef.current = forwardBearingDeg;
      forwardHeadingRef.current = forwardBearingDeg;

      // Google Maps
      if (gmapOuterPolylineRef.current) {
        gmapOuterPolylineRef.current.setPath(remainingPath);
      }
      if (gmapInnerPolylineRef.current) {
        gmapInnerPolylineRef.current.setPath(remainingPath);
      }
      if (gmapOriginMarkerRef.current) {
        gmapOriginMarkerRef.current.position = currentPos;
      }
      if (gmapDestMarkerRef.current) {
        gmapDestMarkerRef.current.position = endPt;
      }

      // Leaflet
      if (leafletOuterPolylineRef.current) {
        leafletOuterPolylineRef.current.setLatLngs(
          remainingPath.map((p) => [p.lat, p.lng] as [number, number])
        );
      }
      if (leafletInnerPolylineRef.current) {
        leafletInnerPolylineRef.current.setLatLngs(
          remainingPath.map((p) => [p.lat, p.lng] as [number, number])
        );
      }
      if (leafletOriginMarkerRef.current) {
        leafletOriginMarkerRef.current.setLatLng([currentPos.lat, currentPos.lng]);
      }
      if (leafletDestMarkerRef.current) {
        leafletDestMarkerRef.current.setLatLng([endPt.lat, endPt.lng]);
      }

      syncPositionAndOrientation(currentPos.lat, currentPos.lng, forwardBearingDeg, true);

      // Ajuste inicial de bounds (apenas na carga inicial da rota)
      const routeFitKey = `${currentPos.lat.toFixed(3)},${currentPos.lng.toFixed(3)}->${endPt.lat.toFixed(3)},${endPt.lng.toFixed(3)}`;
      if (!hasActiveGpsFollowRef.current && lastFittedKeyRef.current !== routeFitKey) {
        lastFittedKeyRef.current = routeFitKey;
        if (gmapRef.current && (window as any).google?.maps?.LatLngBounds) {
          const bounds = new (window as any).google.maps.LatLngBounds();
          roadPath.forEach((pt) => bounds.extend(pt));
          gmapRef.current.fitBounds(bounds, { top: 40, right: 35, bottom: 60, left: 35 });
        }
        if (leafletMapRef.current) {
          const bounds = L.latLngBounds(roadPath.map((p) => [p.lat, p.lng]));
          leafletMapRef.current.fitBounds(bounds, { padding: [40, 40] });
        }
      }
    },
    [syncPositionAndOrientation]
  );

  /**
   * Busca da geometria viária real via backend Google Routes API v2 com fallback OSRM
   */
  useEffect(() => {
    let active = true;

    const fetchRoadGeometry = async () => {
      const startLat = liveUserPosRef.current.lat;
      const startLng = liveUserPosRef.current.lng;

      if (routeData?.decodedPath && routeData.decodedPath.length > 2) {
        const firstPt = routeData.decodedPath[0];
        const distFromGps = computeHaversineKm(startLat, startLng, firstPt.lat, firstPt.lng) * 1000;
        if (distFromGps <= 60) {
          applyRoadGeometry(routeData.decodedPath);
          return;
        }
      }

      // Camada 1: Backend /api/geo/route (Google Routes API v2)
      try {
        const routeRes = await fetch('/api/geo/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originLat: startLat,
            originLng: startLng,
            destLat,
            destLng,
            travelMode: 'DRIVE',
          }),
        });
        if (routeRes.ok) {
          const routeJson = await routeRes.json();
          const encoded = routeJson?.routes?.[0]?.polyline?.encodedPolyline;
          if (encoded && active) {
            const pts = decodeGooglePolyline(encoded);
            if (pts.length > 2) {
              applyRoadGeometry(pts);
              return;
            }
          }
        }
      } catch {}

      // Camada 2: Fallback Viário OSRM Direto no Browser
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=polyline`;
        const res = await fetch(osrmUrl);
        if (res.ok && active) {
          const data = await res.json();
          const encoded = data?.routes?.[0]?.geometry;
          if (encoded) {
            const pts = decodeGooglePolyline(encoded);
            if (pts.length > 2) {
              applyRoadGeometry(pts);
              return;
            }
          }
        }
      } catch {}

      // Linha reta como fallback mínimo
      if (active) {
        applyRoadGeometry([
          { lat: startLat, lng: startLng },
          { lat: destLat, lng: destLng },
        ]);
      }
    };

    fetchRoadGeometry();

    return () => {
      active = false;
    };
  }, [routeData, destLat, destLng, applyRoadGeometry]);

  /**
   * Bússola do Celular (DeviceOrientation: iOS + Android)
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

      // Trava anti-inversão ao longo da rota
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
   * Rastreamento GPS ao vivo (navigator.geolocation.watchPosition) com acompanhamento estilo Uber
   */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const avgMinutesPerKm = baseDistanceKm > 0 ? baseEtaMinutes / baseDistanceKm : 4.2;

    const handleGpsFix = async (pos: GeolocationPosition, isInitial = false) => {
      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const gpsCourse = pos.coords.heading;
      const gpsSpeed = pos.coords.speed ?? 0;

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

      // 1. Calcula vetor da rota à frente e apara a polilinha percorrida
      const { forwardBearingDeg, remainingPath } =
        findForwardRouteBearingAndRemainingPath(
          rawLat,
          rawLng,
          roadPathRef.current,
          destLat,
          destLng
        );
      routeLookAheadBearingRef.current = forwardBearingDeg;

      if (remainingPath.length >= 2) {
        if (gmapOuterPolylineRef.current) gmapOuterPolylineRef.current.setPath(remainingPath);
        if (gmapInnerPolylineRef.current) gmapInnerPolylineRef.current.setPath(remainingPath);
        if (leafletOuterPolylineRef.current) {
          leafletOuterPolylineRef.current.setLatLngs(
            remainingPath.map((p) => [p.lat, p.lng] as [number, number])
          );
        }
        if (leafletInnerPolylineRef.current) {
          leafletInnerPolylineRef.current.setLatLngs(
            remainingPath.map((p) => [p.lat, p.lng] as [number, number])
          );
        }
      }

      // 2. Determina o heading do usuário
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

      // 3. Move o marcador e centraliza a câmera com Look-Ahead
      syncPositionAndOrientation(rawLat, rawLng, forwardHeadingRef.current, true);

      // 4. Atualiza km e minutos restantes em tempo real
      const liveDistKm = computeRoadDistanceKm(rawLat, rawLng, destLat, destLng);
      if (liveDistKm <= 250) {
        setRemainingDistanceKm(liveDistKm);
        const nextMin =
          liveDistKm <= 0.15 ? 0 : Math.max(1, Math.round(liveDistKm * avgMinutesPerKm));
        setRemainingMinutes(nextMin);
      }

      // 5. Snap-to-Road via backend com throttle de 15s
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

    // Fix imediato de geolocalização ao abrir o mapa
    navigator.geolocation.getCurrentPosition(
      (pos) => handleGpsFix(pos, true),
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );

    // Watch contínuo de alta precisão
    const watchId = navigator.geolocation.watchPosition(
      (pos) => handleGpsFix(pos, false),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [destLat, destLng, baseDistanceKm, baseEtaMinutes, syncPositionAndOrientation]);

  const formattedKm = useMemo(
    () => remainingDistanceKm.toFixed(1).replace('.', ','),
    [remainingDistanceKm]
  );

  const formattedHhMm = useMemo(
    () => formatCountdownHhMm(remainingMinutes),
    [remainingMinutes]
  );

  return (
    <div
      className={`relative flex-1 w-full h-full min-h-[340px] overflow-hidden flex flex-col ${
        isDark ? 'bg-slate-950' : 'bg-slate-100'
      }`}
    >
      {/* SUPERFÍCIE INTERATIVA ÚNICA DO MAPA (LEAFLET OU GOOGLE MAPS JS VETORIAL) */}
      <div
        ref={mapContainerRef}
        className="w-full flex-1 min-h-[340px] z-0"
        style={{ minHeight: '340px', height: '100%' }}
      />

      {/* BOTÃO FLUTUANTE RECENTRALIZAR NO GPS ESTILO UBER (APARECE QUANDO O USUÁRIO ARRASTA O MAPA) */}
      {!isFollowingGps && (
        <button
          type="button"
          onClick={handleRecenterGps}
          className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer"
        >
          <Navigation className="w-3.5 h-3.5 text-white animate-pulse" />
          <span className="text-white">Recentralizar</span>
        </button>
      )}

      {/* INDICADOR DISCRETO DO MOTOR ATIVO */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] bg-black/50 backdrop-blur-xs text-[9.5px] font-mono text-emerald-400 font-bold">
        <Compass className="w-3 h-3 text-emerald-400 animate-spin-slow" />
        <span>GPS AO VIVO</span>
      </div>

      {/* CANTO INFERIOR DIREITO DO MAPA: KM RESTANTE E HH:MM REGRESSIVO COM COR ALPHA TRANSLÚCIDA */}
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
        className={`absolute bottom-3 right-3 z-10 px-3 py-1.5 rounded-[4px] backdrop-blur-[2px] flex items-baseline gap-3 select-none cursor-pointer transition ${
          isDark
            ? 'bg-slate-950/50 text-white/80 border border-slate-800/40'
            : 'bg-white/60 text-slate-900/80 border border-slate-200/50'
        }`}
      >
        <div className="flex items-baseline gap-1">
          <span className="text-lg sm:text-xl font-black font-mono tabular-nums tracking-tight opacity-90">
            {formattedKm}
          </span>
          <span className="text-[11px] font-extrabold uppercase opacity-75">km</span>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-lg sm:text-xl font-black font-mono tabular-nums tracking-tight text-emerald-400">
            {formattedHhMm}
          </span>
        </div>
      </button>
    </div>
  );
};
