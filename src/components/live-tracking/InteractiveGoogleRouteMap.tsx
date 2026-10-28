import React, { useEffect, useRef, useState, useMemo } from 'react';
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
  fallbackEmbedUrl: string;
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

/**
 * Calcula o azimute (bearing) em graus [0..360) do ponto 1 para o ponto 2 (0° = Norte, 90° = Leste)
 */
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

/**
 * Projeta uma coordenada `distanceKm` à frente na direção `bearingDeg` (Look-Ahead Offset)
 * para manter o marcador no terço inferior e exibir sempre o caminho adiante na tela.
 */
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

/**
 * Interpolação circular suave entre dois ângulos [0..360) evitando giros bruscos no limite 359° -> 0°
 */
function smoothAngleDeg(currentDeg: number, targetDeg: number, factor = 0.3): number {
  const diff = ((((targetDeg - currentDeg) % 360) + 540) % 360) - 180;
  return (currentDeg + diff * factor + 360) % 360;
}

/**
 * Menor diferença absoluta entre dois ângulos [0..180]
 */
function angleDiffDeg(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

/**
 * Encontra o ponto mais próximo na polilinha da rota e calcula o vetor apontando SEMPRE
 * para frente rumo aos próximos vértices da rota (Look-Ahead Vector), evitando apontar para trás.
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

  // Busca um vértice pelo menos 35 metros à frente na rota para garantir orientação firme para frente
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

/**
 * Formata minutos restantes no padrão regressivo HH:MM (ex.: 14 min -> "00:14", 75 min -> "01:15")
 */
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

/**
 * Resolve a foto real de perfil do usuário (prop ou localStorage), ignorando placeholders/cliparts.
 */
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

/**
 * Cria o marcador direcional de navegação:
 * - Se houver foto de perfil válida (`avatarUrl`), exibe a foto circular do usuário sempre em pé (0°)
 *   no centro com borda Emerald + cone de visão e ponteira direcional girando ao redor no `.vagou-nav-rotor`.
 * - Se não houver foto (ou se a imagem falhar no carregamento), exibe o marcador direcional padrão (disco verde com seta branca).
 */
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
  container.style.transform = 'translateY(28px)'; // Alinha o centro do marcador exatamente na coordenada GPS

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

  // Cone translúcido de visão à frente (sempre aponta para o topo 0° do rotor)
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

  // Disco padrão de navegação com seta apontando para frente (usado quando não há foto ou como fallback de erro)
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

  // Seta frontal branca apontando estritamente para cima (0°)
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
    // Ponteira direcional frontal que gira junto com o cone na borda externa da foto
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

    // Moldura circular da foto de perfil (mantida fora do rotor para que o rosto nunca fique de cabeça para baixo)
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
      // Fallback automático para o marcador atual caso a URL da foto falhe ao carregar
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
  fallbackEmbedUrl,
  onLiveGpsUpdate,
  onDestinationReachedChange,
}) => {
  const { isDark } = useTheme();
  const effectiveUserAvatar = useMemo(
    () => resolveActiveUserAvatarUrl(userAvatarUrl),
    [userAvatarUrl]
  );

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const outerPolylineRef = useRef<any>(null);
  const innerPolylineRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const liveUserMarkerRef = useRef<any>(null);
  const liveUserRotorRef = useRef<HTMLDivElement | null>(null);

  const roadPathRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const lastFittedKeyRef = useRef<string>('');
  const lastGpsFixRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const lastSnappedApiTsRef = useRef<number>(0);
  const hasActiveGpsFollowRef = useRef<boolean>(false);
  const userManualPanUntilRef = useRef<number>(0);

  // Heading unificado (Fusão: Vetor da Rota à Frente + Curso GPS + Bússola do Celular)
  const forwardHeadingRef = useRef<number>(
    computeBearingDeg(originLat, originLng, destLat, destLng)
  );
  const routeLookAheadBearingRef = useRef<number>(
    computeBearingDeg(originLat, originLng, destLat, destLng)
  );
  const liveUserPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const onLiveGpsUpdateRef = useRef(onLiveGpsUpdate);
  onLiveGpsUpdateRef.current = onLiveGpsUpdate;

  const onDestinationReachedRef = useRef(onDestinationReachedChange);
  onDestinationReachedRef.current = onDestinationReachedChange;

  const [sdkReady, setSdkReady] = useState<boolean>(false);
  const [sdkFailed, setSdkFailed] = useState<boolean>(false);

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
   * Atualiza de forma imperativa a rotação do marcador e a câmera do mapa (Heading-Up + Look-Ahead)
   * garantindo que o marcador NUNCA saia da tela e sempre mostre o caminho adiante.
   */
  const syncCameraAndMarkerOrientation = (
    userLat: number,
    userLng: number,
    headingDeg: number,
    shouldPanCamera: boolean
  ) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Move o marcador do usuário para a coordenada atual
    if (liveUserMarkerRef.current) {
      liveUserMarkerRef.current.position = { lat: userLat, lng: userLng };
    }

    // 2. Projeta o centro da câmera ~65 metros à frente na direção do movimento/rota
    // Isso mantém o marcador no terço inferior da tela e libera 70% da tela para o caminho adiante!
    const lookAheadCenter = projectPointAhead(userLat, userLng, headingDeg, 0.065);

    if (shouldPanCamera && Date.now() >= userManualPanUntilRef.current) {
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

    // 3. Ajusta a rotação do marcador em relação ao heading efetivo do mapa
    // Se o mapa vetorial girou a câmera para `headingDeg`, mapHeading === headingDeg -> seta aponta 0° (para cima na tela).
    // Se o mapa estiver em modo 2D sem girar o canvas, mapHeading === 0 -> seta gira para `headingDeg` apontando para a rua à frente!
    const currentMapHeading =
      typeof map.getHeading === 'function' ? Number(map.getHeading() || 0) : 0;
    const relativeRotorDeg = (headingDeg - currentMapHeading + 360) % 360;

    if (liveUserRotorRef.current) {
      liveUserRotorRef.current.style.transform = `rotate(${relativeRotorDeg.toFixed(1)}deg)`;
    }
  };

  // 1. Carrega Google Maps JS SDK apenas uma vez
  useEffect(() => {
    let mounted = true;
    loadGoogleMapsJsSdk().then((loaded) => {
      if (!mounted) return;
      if (loaded) {
        setSdkReady(true);
      } else {
        setSdkFailed(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Inicializa a instância do Google Map APENAS quando o SDK fica pronto ou o tema muda (ZERO piscar!)
  useEffect(() => {
    if (!sdkReady || !mapContainerRef.current) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;

    const initialHeading = computeBearingDeg(originLat, originLng, destLat, destLng);
    forwardHeadingRef.current = initialHeading;
    routeLookAheadBearingRef.current = initialHeading;

    const map = new gmaps.Map(mapContainerRef.current, {
      center: { lat: originLat, lng: originLng },
      zoom: 16,
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

    mapInstanceRef.current = map;

    // Se o usuário arrastar manualmente o mapa, pausa o auto-follow por 6s e depois retoma sozinho
    map.addListener('dragstart', () => {
      userManualPanUntilRef.current = Date.now() + 6000;
    });

    // Solicita permissão de bússola no iOS 13+ no primeiro toque no mapa
    const requestIosCompassOnTouch = () => {
      const DevOrient = (window as any).DeviceOrientationEvent;
      if (DevOrient && typeof DevOrient.requestPermission === 'function') {
        DevOrient.requestPermission().catch(() => {});
      }
    };
    const containerEl = mapContainerRef.current;
    containerEl.addEventListener('touchstart', requestIosCompassOnTouch, {
      once: true,
      passive: true,
    });

    outerPolylineRef.current = new gmaps.Polyline({
      path: [],
      geodesic: true,
      strokeColor: '#064e3b',
      strokeOpacity: 0.78,
      strokeWeight: 8,
      map,
    });

    innerPolylineRef.current = new gmaps.Polyline({
      path: [],
      geodesic: true,
      strokeColor: '#10b981',
      strokeOpacity: 1.0,
      strokeWeight: 5,
      map,
    });

    const AdvancedMarker = gmaps.marker?.AdvancedMarkerElement;
    if (AdvancedMarker) {
      originMarkerRef.current = new AdvancedMarker({
        map,
        position: { lat: originLat, lng: originLng },
        title: originLabel,
        content: createPinBadge(
          isDark ? '#0f172a' : '#ffffff',
          isDark ? '#ffffff' : '#0f172a',
          'Saída'
        ),
      });

      destMarkerRef.current = new AdvancedMarker({
        map,
        position: { lat: destLat, lng: destLng },
        title: destLabel,
        content: createPinBadge('#10b981', '#ffffff', destLabel.slice(0, 22)),
      });

      // Inicializa o marcador direcional (com foto do usuário se disponível, ou marcador padrão caso contrário)
      const { container, rotor } = createDirectionalUserMarkerElement(effectiveUserAvatar);
      liveUserRotorRef.current = rotor;
      liveUserMarkerRef.current = new AdvancedMarker({
        map,
        position: liveUserPosRef.current || { lat: originLat, lng: originLng },
        title: 'Sua Posição',
        content: container,
      });
    }

    lastFittedKeyRef.current = '';

    return () => {
      containerEl.removeEventListener('touchstart', requestIosCompassOnTouch);
    };
  }, [sdkReady, isDark]);

  // 2.1 Atualiza o conteúdo do marcador imperativamente caso a foto de perfil mude (sem recriar o mapa)
  useEffect(() => {
    if (!liveUserMarkerRef.current) return;
    const { container, rotor } = createDirectionalUserMarkerElement(effectiveUserAvatar);
    liveUserRotorRef.current = rotor;
    liveUserMarkerRef.current.content = container;
  }, [effectiveUserAvatar]);

  // 3. Atualiza a geometria da rota (Polilinha Seguindo as Ruas Reais) sem recriar o mapa
  useEffect(() => {
    if (!sdkReady || !mapInstanceRef.current) return;
    const gmaps = (window as any).google?.maps;
    if (!gmaps) return;

    let cancelled = false;
    const map = mapInstanceRef.current;

    const applyRoadPathToMap = (roadPath: Array<{ lat: number; lng: number }>) => {
      if (cancelled || !roadPath || roadPath.length < 2) return;

      const startPt = roadPath[0];
      const endPt = roadPath[roadPath.length - 1];

      // Se o GPS real do dispositivo já foi identificado em um local diferente (> 35m) da origem antiga de roadPath,
      // ignora polilinhas obsoletas que partiriam do endereço antigo do agendamento
      if (liveUserPosRef.current) {
        const distFromPathStartMeters =
          computeHaversineKm(
            liveUserPosRef.current.lat,
            liveUserPosRef.current.lng,
            startPt.lat,
            startPt.lng
          ) * 1000;
        if (distFromPathStartMeters > 60 && roadPathRef.current.length > 2) {
          const currentPathStart = roadPathRef.current[0];
          const currentPathDistMeters =
            computeHaversineKm(
              liveUserPosRef.current.lat,
              liveUserPosRef.current.lng,
              currentPathStart.lat,
              currentPathStart.lng
            ) * 1000;
          if (currentPathDistMeters <= 60) {
            return;
          }
        }
      }

      roadPathRef.current = roadPath;

      // Usa SEMPRE a coordenada real do dispositivo (liveUserPosRef) se já detectada
      const currentPos = liveUserPosRef.current || startPt;
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

      const activePath = hasActiveGpsFollowRef.current ? remainingPath : roadPath;

      if (outerPolylineRef.current) {
        outerPolylineRef.current.setPath(activePath);
      }
      if (innerPolylineRef.current) {
        innerPolylineRef.current.setPath(activePath);
      }

      if (originMarkerRef.current) {
        originMarkerRef.current.position = currentPos;
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.position = endPt;
        destMarkerRef.current.content = createPinBadge(
          '#10b981',
          '#ffffff',
          destLabel.slice(0, 22)
        );
      }

      if (liveUserMarkerRef.current) {
        liveUserMarkerRef.current.position = currentPos;
      }

      // Orienta imediatamente o marcador para o caminho à frente na rota
      syncCameraAndMarkerOrientation(
        currentPos.lat,
        currentPos.lng,
        forwardBearingDeg,
        hasActiveGpsFollowRef.current
      );

      // Só faz fitBounds geral antes do usuário começar a se deslocar com GPS ativo
      const routeFitKey = `${currentPos.lat.toFixed(3)},${currentPos.lng.toFixed(3)}->${endPt.lat.toFixed(3)},${endPt.lng.toFixed(3)}:${roadPath.length > 2 ? 'road' : 'init'}`;
      if (!hasActiveGpsFollowRef.current && lastFittedKeyRef.current !== routeFitKey) {
        lastFittedKeyRef.current = routeFitKey;
        const bounds = new gmaps.LatLngBounds();
        roadPath.forEach((pt) => bounds.extend(pt));
        map.fitBounds(bounds, { top: 44, right: 40, bottom: 64, left: 40 });
      }
    };

    const effectiveOriginLat = liveUserPosRef.current?.lat ?? originLat;
    const effectiveOriginLng = liveUserPosRef.current?.lng ?? originLng;

    if (routeData?.decodedPath && routeData.decodedPath.length > 2) {
      const firstPt = routeData.decodedPath[0];
      const deltaFromEffectiveMeters =
        computeHaversineKm(
          effectiveOriginLat,
          effectiveOriginLng,
          firstPt.lat,
          firstPt.lng
        ) * 1000;
      // Só usa routeData.decodedPath diretamente se ela partir do mesmo local (<= 50m) onde o usuário realmente está
      if (deltaFromEffectiveMeters <= 50) {
        applyRoadPathToMap(routeData.decodedPath);
        return;
      }
    }

    const fetchRoadGeometryPoints = async (
      startLat: number,
      startLng: number,
      endLat: number,
      endLng: number
    ): Promise<Array<{ lat: number; lng: number }>> => {
      // Camada 1: Google Routes API v2 via Backend (/api/geo/route com Referer + fallback OSRM server-side)
      try {
        const routeRes = await fetch('/api/geo/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originLat: startLat,
            originLng: startLng,
            destLat: endLat,
            destLng: endLng,
            travelMode: 'DRIVE',
          }),
        });
        if (routeRes.ok) {
          const routeJson = await routeRes.json();
          const encoded = routeJson?.routes?.[0]?.polyline?.encodedPolyline;
          if (encoded) {
            const pts = decodeGooglePolyline(encoded);
            if (pts.length > 2) return pts;
          }
        }
      } catch {}

      // Camada 2: Fallback Viário Direto OSRM no Browser
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=polyline`;
        const res = await fetch(osrmUrl);
        if (res.ok) {
          const data = await res.json();
          const encoded = data?.routes?.[0]?.geometry;
          if (encoded) {
            const pts = decodeGooglePolyline(encoded);
            if (pts.length > 2) return pts;
          }
        }
      } catch {}

      return [];
    };

    const fetchBrowserRoadGeometry = async () => {
      const pts = await fetchRoadGeometryPoints(
        effectiveOriginLat,
        effectiveOriginLng,
        destLat,
        destLng
      );
      if (pts.length > 2) {
        applyRoadPathToMap(pts);
      }
    };

    fetchBrowserRoadGeometry();

    return () => {
      cancelled = true;
    };
  }, [sdkReady, isDark, routeData, originLat, originLng, destLat, destLng, destLabel]);

  // 4. Bússola do Celular (DeviceOrientation API: webkitCompassHeading / deviceorientationabsolute)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastCompassUpdateTs = 0;

    const handleOrientation = (event: any) => {
      const now = Date.now();
      if (now - lastCompassUpdateTs < 120) return; // ~8 fps suave sem sobrecarregar GPU

      let rawCompassHeading: number | null = null;

      // iOS: webkitCompassHeading (0..360 relativo ao Norte verdadeiro/magnético)
      if (
        typeof event.webkitCompassHeading === 'number' &&
        !Number.isNaN(event.webkitCompassHeading)
      ) {
        rawCompassHeading = event.webkitCompassHeading;
      } else if (typeof event.alpha === 'number' && !Number.isNaN(event.alpha)) {
        // Android / Padrão W3C: alpha mede rotação anti-horária, converte-se com (360 - alpha)
        const screenAngle =
          typeof window.screen?.orientation?.angle === 'number'
            ? window.screen.orientation.angle
            : 0;
        rawCompassHeading = (360 - event.alpha + screenAngle + 360) % 360;
      }

      if (rawCompassHeading === null) return;
      lastCompassUpdateTs = now;

      // Trava Anti-Inversão (Nunca apontar para trás quando alinhado à rota):
      const routeForward = routeLookAheadBearingRef.current;
      const diffToRoute = angleDiffDeg(rawCompassHeading, routeForward);
      const targetHeading =
        diffToRoute > 135 && hasActiveGpsFollowRef.current
          ? routeForward
          : rawCompassHeading;

      const nextHeading = smoothAngleDeg(forwardHeadingRef.current, targetHeading, 0.25);
      if (angleDiffDeg(nextHeading, forwardHeadingRef.current) < 1.5) return;

      forwardHeadingRef.current = nextHeading;
      const pos = liveUserPosRef.current || { lat: originLat, lng: originLng };
      syncCameraAndMarkerOrientation(
        pos.lat,
        pos.lng,
        nextHeading,
        hasActiveGpsFollowRef.current
      );
    };

    window.addEventListener('deviceorientationabsolute' as any, handleOrientation, true);
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener(
        'deviceorientationabsolute' as any,
        handleOrientation,
        true
      );
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [originLat, originLng]);

  // 5. Reconhecimento Imediato da Georreferência Real do Dispositivo + Rastreamento GPS Contínuo
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const avgMinutesPerKm =
      baseDistanceKm > 0 ? baseEtaMinutes / baseDistanceKm : 4.2;

    // Recalcula a malha viária real quando o usuário parte de um local diferente do cadastrado no agendamento
    const recalculateRoadFromRealGpsIfNeeded = async (gpsLat: number, gpsLng: number) => {
      const currentStart = roadPathRef.current[0];
      const distFromStartMeters = currentStart
        ? computeHaversineKm(gpsLat, gpsLng, currentStart.lat, currentStart.lng) * 1000
        : 9999;

      if (distFromStartMeters <= 35 && roadPathRef.current.length > 2) {
        return;
      }

      try {
        const routeRes = await fetch('/api/geo/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originLat: gpsLat,
            originLng: gpsLng,
            destLat,
            destLng,
            travelMode: 'DRIVE',
          }),
        });
        if (routeRes.ok) {
          const routeJson = await routeRes.json();
          const encoded = routeJson?.routes?.[0]?.polyline?.encodedPolyline;
          if (encoded) {
            const pts = decodeGooglePolyline(encoded);
            if (pts.length > 2) {
              roadPathRef.current = pts;
              const { forwardBearingDeg, remainingPath } =
                findForwardRouteBearingAndRemainingPath(
                  gpsLat,
                  gpsLng,
                  pts,
                  destLat,
                  destLng
                );
              routeLookAheadBearingRef.current = forwardBearingDeg;
              forwardHeadingRef.current = forwardBearingDeg;
              outerPolylineRef.current?.setPath(remainingPath);
              innerPolylineRef.current?.setPath(remainingPath);
              syncCameraAndMarkerOrientation(gpsLat, gpsLng, forwardBearingDeg, true);
              return;
            }
          }
        }
      } catch {}

      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${gpsLng},${gpsLat};${destLng},${destLat}?overview=full&geometries=polyline`;
        const res = await fetch(osrmUrl);
        if (res.ok) {
          const data = await res.json();
          const encoded = data?.routes?.[0]?.geometry;
          if (encoded) {
            const pts = decodeGooglePolyline(encoded);
            if (pts.length > 2) {
              roadPathRef.current = pts;
              const { forwardBearingDeg, remainingPath } =
                findForwardRouteBearingAndRemainingPath(
                  gpsLat,
                  gpsLng,
                  pts,
                  destLat,
                  destLng
                );
              routeLookAheadBearingRef.current = forwardBearingDeg;
              forwardHeadingRef.current = forwardBearingDeg;
              outerPolylineRef.current?.setPath(remainingPath);
              innerPolylineRef.current?.setPath(remainingPath);
              syncCameraAndMarkerOrientation(gpsLat, gpsLng, forwardBearingDeg, true);
            }
          }
        }
      } catch {}
    };

    const handleDevicePositionFix = async (pos: GeolocationPosition, isInitialFix = false) => {
      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const gpsCourse = pos.coords.heading;
      const gpsSpeed = pos.coords.speed ?? 0;

      const prev = lastGpsFixRef.current;
      const now = Date.now();
      const movedMeters = prev
        ? computeHaversineKm(prev.lat, prev.lng, rawLat, rawLng) * 1000
        : 9999;

      if (!isInitialFix && prev && movedMeters < 3 && now - prev.ts < 2500) {
        return;
      }

      hasActiveGpsFollowRef.current = true;
      liveUserPosRef.current = { lat: rawLat, lng: rawLng };
      lastGpsFixRef.current = { lat: rawLat, lng: rawLng, ts: now };

      // Posiciona o marcador de Saída e o marcador do usuário exatamente onde o dispositivo está
      if (originMarkerRef.current && isInitialFix) {
        originMarkerRef.current.position = { lat: rawLat, lng: rawLng };
      }

      // Se o usuário partiu de um endereço diferente do informado antes, recalcula a rota a partir do GPS real
      recalculateRoadFromRealGpsIfNeeded(rawLat, rawLng);

      // 1. Calcula o vetor da rota à frente (Look-Ahead) e apara a polilinha já percorrida
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
        outerPolylineRef.current?.setPath(remainingPath);
        innerPolylineRef.current?.setPath(remainingPath);
      }

      // 2. Determina o heading frontal verdadeiro
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

      // 3. Move o marcador para a georreferência exata e centraliza a câmera com Look-Ahead
      syncCameraAndMarkerOrientation(
        rawLat,
        rawLng,
        forwardHeadingRef.current,
        true
      );

      // 4. Atualiza km e HH:MM regressivos com base na localização exata do dispositivo
      const liveDistKm = computeRoadDistanceKm(rawLat, rawLng, destLat, destLng);
      if (liveDistKm <= 250) {
        setRemainingDistanceKm(liveDistKm);
        const nextMin =
          liveDistKm <= 0.15
            ? 0
            : Math.max(1, Math.round(liveDistKm * avgMinutesPerKm));
        setRemainingMinutes(nextMin);
      }

      // 5. Snap-to-Road na API do servidor com throttle de 15s (ou imediato no primeiro fix)
      if (isInitialFix || now - lastSnappedApiTsRef.current >= 15000) {
        lastSnappedApiTsRef.current = now;
        const snapped = await snapAndReverseGeocodeGps(rawLat, rawLng);
        if (snapped) {
          liveUserPosRef.current = { lat: snapped.lat, lng: snapped.lng };
          if (originMarkerRef.current && isInitialFix) {
            originMarkerRef.current.position = { lat: snapped.lat, lng: snapped.lng };
          }
          syncCameraAndMarkerOrientation(
            snapped.lat,
            snapped.lng,
            forwardHeadingRef.current,
            true
          );
          onLiveGpsUpdateRef.current?.(
            snapped.lat,
            snapped.lng,
            snapped.streetName
          );
          return;
        }
        onLiveGpsUpdateRef.current?.(rawLat, rawLng);
      }
    };

    // Captura imediata da georreferência exata do dispositivo assim que a navegação inicia
    navigator.geolocation.getCurrentPosition(
      (pos) => handleDevicePositionFix(pos, true),
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 8000,
      }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => handleDevicePositionFix(pos, false),
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [destLat, destLng, baseDistanceKm, baseEtaMinutes]);

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
        isDark ? 'bg-slate-900' : 'bg-slate-100'
      }`}
    >
      {/* SUPERFÍCIE DO MAPA LIMPO */}
      {!sdkFailed ? (
        <div
          ref={mapContainerRef}
          className="w-full flex-1 min-h-[340px]"
          style={{ minHeight: '340px', height: '100%' }}
        />
      ) : (
        <iframe
          title={`Mapa da Rota - ${destLabel}`}
          src={fallbackEmbedUrl}
          className="w-full flex-1 min-h-[340px] border-0"
          allowFullScreen
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}

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

            // Simula avanço ao longo dos vértices reais da rota mantendo câmera e seta para frente
            const path = roadPathRef.current;
            if (path.length > 2) {
              const progress = Math.min(0.95, Math.max(0.05, 1 - ratio));
              const idx = Math.min(
                path.length - 1,
                Math.floor(progress * (path.length - 1))
              );
              const simPt = path[idx];
              hasActiveGpsFollowRef.current = true;
              liveUserPosRef.current = simPt;
              const { forwardBearingDeg, remainingPath } =
                findForwardRouteBearingAndRemainingPath(
                  simPt.lat,
                  simPt.lng,
                  path,
                  destLat,
                  destLng
                );
              routeLookAheadBearingRef.current = forwardBearingDeg;
              forwardHeadingRef.current = forwardBearingDeg;
              outerPolylineRef.current?.setPath(remainingPath);
              innerPolylineRef.current?.setPath(remainingPath);
              syncCameraAndMarkerOrientation(
                simPt.lat,
                simPt.lng,
                forwardBearingDeg,
                true
              );
            }
          } else {
            setRemainingDistanceKm(baseDistanceKm);
            setRemainingMinutes(baseEtaMinutes);
            hasActiveGpsFollowRef.current = false;
            if (roadPathRef.current.length >= 2) {
              const startPt = roadPathRef.current[0];
              liveUserPosRef.current = startPt;
              outerPolylineRef.current?.setPath(roadPathRef.current);
              innerPolylineRef.current?.setPath(roadPathRef.current);
              syncCameraAndMarkerOrientation(
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
            ? 'bg-slate-950/40 text-white/75'
            : 'bg-white/50 text-slate-900/75'
        }`}
      >
        <div className="flex items-baseline gap-1">
          <span className="text-lg sm:text-xl font-black font-mono tabular-nums tracking-tight opacity-85">
            {formattedKm}
          </span>
          <span className="text-[11px] font-extrabold uppercase opacity-70">km</span>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-lg sm:text-xl font-black font-mono tabular-nums tracking-tight text-emerald-500/80">
            {formattedHhMm}
          </span>
        </div>
      </button>
    </div>
  );
};
