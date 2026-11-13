import { LiveRouteCheckpoint, TransportMode as TrackingTransportMode } from '../types';
import { TransportMode as BookingTransportMode } from '../utils/bookingSlots';
import { formatCurrentClockTime } from '../hooks/useLiveRouteTracker';

export interface GoogleRouteStep {
  instruction: string;
  maneuver: string;
  streetName: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
}

export interface GoogleComputedRouteResult {
  distanceKm: number;
  etaMinutes: number;
  durationSeconds: number;
  description: string;
  encodedPolyline: string;
  decodedPath: Array<{ lat: number; lng: number }>;
  steps: GoogleRouteStep[];
  checkpoints: LiveRouteCheckpoint[];
  resolvedOrigin?: { lat: number; lng: number };
  resolvedDestination?: { lat: number; lng: number };
}

export interface GooglePlaceSuggestion {
  id: string;
  title: string;
  formattedAddress: string;
  lat: number;
  lng: number;
}

export type ModalMatrixMap = Partial<
  Record<
    BookingTransportMode,
    {
      distanceKm: number;
      etaMinutes: number;
      description?: string;
    }
  >
>;

let cachedMapsApiKey: string | null = null;
let mapsScriptLoadPromise: Promise<boolean> | null = null;

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get('content-type') || '';
  return res.ok && ct.toLowerCase().includes('application/json');
}

export function isPlaceholderCoordinates(lat?: number, lng?: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return true;
  }
  return (
    (Math.abs(lat - -23.5621) < 0.0008 && Math.abs(lng - -46.4795) < 0.0008) ||
    (Math.abs(lat - -23.5592) < 0.0008 && Math.abs(lng - -46.6589) < 0.0008) ||
    (Math.abs(lat - -23.5505) < 0.0008 && Math.abs(lng - -46.6333) < 0.0008)
  );
}

export function formatDistanceMeters(meters: number): string {
  const safe = Math.max(10, Math.round(meters));
  if (safe >= 1000) {
    return `${(safe / 1000).toFixed(1).replace('.', ',')} km`;
  }
  return `${Math.round(safe / 10) * 10} m`;
}

/**
 * Obtém a chave do Google Maps Platform a partir do Vite env ou do endpoint seguro /api/maps/config
 */
export async function getGoogleMapsApiKey(): Promise<string> {
  if (cachedMapsApiKey !== null) return cachedMapsApiKey;

  const envKey = (
    (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || ''
  ).trim();
  if (envKey) {
    cachedMapsApiKey = envKey;
    return envKey;
  }

  try {
    const res = await fetch('/api/maps/config');
    if (isJsonResponse(res)) {
      const data = await res.json();
      if (data?.apiKey) {
        cachedMapsApiKey = String(data.apiKey).trim();
        return cachedMapsApiKey;
      }
    }
  } catch {}

  cachedMapsApiKey = '';
  return '';
}

/**
 * Carrega o Google Maps JavaScript SDK dinamicamente (com suporte a AdvancedMarkerElement)
 */
export async function loadGoogleMapsJsSdk(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).google?.maps?.Map) return true;
  if (mapsScriptLoadPromise) return mapsScriptLoadPromise;

  mapsScriptLoadPromise = (async () => {
    const apiKey = await getGoogleMapsApiKey();
    if (!apiKey) return false;

    if ((window as any).google?.maps?.Map) return true;

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const safeResolve = (val: boolean) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      (window as any).gm_authFailure = () => {
        console.warn('[Vagou GPS] Google Maps JS auth failure: chave restrita ou domínio não autorizado.');
        safeResolve(false);
      };

      const checkReady = () => {
        const gmaps = (window as any).google?.maps;
        if (gmaps?.Map) {
          safeResolve(true);
          return true;
        }
        return false;
      };

      if (checkReady()) return;

      const existing = document.getElementById('vagou-google-maps-sdk') as HTMLScriptElement | null;
      if (existing) {
        const startTime = Date.now();
        const poll = setInterval(() => {
          if (checkReady()) {
            clearInterval(poll);
          } else if (Date.now() - startTime > 2500) {
            clearInterval(poll);
            safeResolve(false);
          }
        }, 60);
        return;
      }

      const script = document.createElement('script');
      script.id = 'vagou-google-maps-sdk';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        apiKey
      )}&v=weekly&language=pt-BR&region=BR&libraries=marker&solution_channel=gmp_mcp_codeassist_v1_aistudio`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if (checkReady()) return;
        const startTime = Date.now();
        const poll = setInterval(() => {
          if (checkReady()) {
            clearInterval(poll);
          } else if (Date.now() - startTime > 2000) {
            clearInterval(poll);
            safeResolve(false);
          }
        }, 50);
      };

      script.onerror = () => safeResolve(false);
      document.head.appendChild(script);

      setTimeout(() => {
        if (!resolved) {
          safeResolve(Boolean((window as any).google?.maps?.Map));
        }
      }, 3500);
    });
  })();

  return mapsScriptLoadPromise;
}

/**
 * Decodifica uma string encodedPolyline oficial do Google Routes API v2 / OSRM (1e5) em coordenadas {lat, lng}[]
 */
export function decodeGooglePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  if (!encoded) return [];
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index <= len);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index <= len);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/**
 * Converte modalidade do Vagou para o TravelMode oficial da Routes API v2
 */
export function toGoogleTravelMode(
  mode?: BookingTransportMode | TrackingTransportMode
): 'DRIVE' | 'TWO_WHEELER' | 'BICYCLE' | 'WALK' | 'TRANSIT' {
  if (mode === 'walking') return 'WALK';
  if (mode === 'bicycling') return 'BICYCLE';
  if (mode === 'motorcycle') return 'TWO_WHEELER';
  if (mode === 'transit') return 'TRANSIT';
  return 'DRIVE';
}

/**
 * Extrai um nome enxuto de rua/avenida/rodovia a partir da instrução de navegação
 */
function extractStreetFromInstruction(instruction: string, index: number): string {
  const clean = String(instruction || '')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' — ')
    .trim();
  if (!clean) return `Trecho ${index + 1}`;

  const match = clean.match(
    /(?:na|para a|para|pela|pelo|em direção à|em direção a|pegue a|pegue o|continue na|siga pela|siga por|em)\s+((?:R\.|Rua|Av\.|Avenida|Al\.|Alameda|Pça\.|Praça|Rod\.|Rodovia|Estr\.|Estrada|Marginal|Viaduto|Ponte|Túnel|Largo|Travessa|BR-|SP-|AMG-)[^,.—•\n]+)/i
  );
  if (match && match[1]) {
    return match[1].trim();
  }

  return clean.length > 64 ? `${clean.slice(0, 61)}...` : clean;
}

/**
 * Consolida passos consecutivos na mesma via para gerar um Itinerário limpo e fiel às ruas reais
 */
export function buildConsolidatedCheckpoints(steps: GoogleRouteStep[]): LiveRouteCheckpoint[] {
  const nowClock = formatCurrentClockTime(0);
  if (!steps.length) return [];

  const merged: Array<{ label: string; streetKey: string; meters: number }> = [];

  for (const step of steps) {
    const label = (step.streetName || step.instruction || '').trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const prev = merged[merged.length - 1];
    if (prev && prev.streetKey === key) {
      prev.meters += Math.max(0, step.distanceMeters || 0);
    } else {
      merged.push({
        label: step.instruction || label,
        streetKey: key,
        meters: Math.max(10, step.distanceMeters || 0),
      });
    }
  }

  return merged.slice(0, 14).map((item, idx) => ({
    street: item.label,
    distanceText: formatDistanceMeters(item.meters),
    status: idx === 0 ? 'current' : 'upcoming',
    timestamp: idx === 0 ? nowClock : undefined,
  }));
}

function mapOsrmStepToGoogleStep(st: any, nextSt: any, idx: number): GoogleRouteStep | null {
  const stepMeters = Math.round(Number(st?.distance || 0));
  const mType = String(st?.maneuver?.type || '').toLowerCase();
  if (stepMeters <= 12 && mType !== 'arrive') return null;

  const mod = String(st?.maneuver?.modifier || '').toLowerCase();
  const roadName = String(st?.name || st?.ref || st?.destinations || '').trim();
  const viaSuffix = roadName ? ` em ${roadName}` : '';

  let maneuver = 'STRAIGHT';
  let instruction = roadName ? `Siga por ${roadName}` : `Continue pela via (${idx + 1})`;

  if (mType === 'arrive') {
    maneuver = 'STRAIGHT';
    instruction = roadName ? `Chegada em ${roadName}` : 'Chegada ao destino';
  } else if (mod.includes('uturn')) {
    maneuver = 'UTURN_LEFT';
    instruction = `Faça o retorno${viaSuffix}`;
  } else if (mType === 'roundabout' || mType === 'rotary') {
    maneuver = mod.includes('left') ? 'ROUNDABOUT_LEFT' : 'ROUNDABOUT_RIGHT';
    instruction = `Na rotatória, pegue a saída${viaSuffix}`;
  } else if (mType === 'on ramp' || mType === 'off ramp' || mType === 'fork') {
    maneuver = mod.includes('left') ? 'RAMP_LEFT' : 'RAMP_RIGHT';
    instruction = mod.includes('left')
      ? `Pegue o acesso à esquerda${viaSuffix}`
      : `Pegue o acesso à direita${viaSuffix}`;
  } else if (mod === 'sharp left') {
    maneuver = 'TURN_SHARP_LEFT';
    instruction = `Curva acentuada à esquerda${viaSuffix}`;
  } else if (mod === 'left') {
    maneuver = 'TURN_LEFT';
    instruction = `Vire à esquerda${viaSuffix}`;
  } else if (mod === 'slight left') {
    maneuver = 'TURN_SLIGHT_LEFT';
    instruction = `Mantenha-se à esquerda${viaSuffix}`;
  } else if (mod === 'sharp right') {
    maneuver = 'TURN_SHARP_RIGHT';
    instruction = `Curva acentuada à direita${viaSuffix}`;
  } else if (mod === 'right') {
    maneuver = 'TURN_RIGHT';
    instruction = `Vire à direita${viaSuffix}`;
  } else if (mod === 'slight right') {
    maneuver = 'TURN_SLIGHT_RIGHT';
    instruction = `Mantenha-se à direita${viaSuffix}`;
  }

  const stepSec = Math.max(5, Math.round(Number(st?.duration || 0)));
  const loc = Array.isArray(st?.maneuver?.location) ? st.maneuver.location : null;
  const endLoc = Array.isArray(nextSt?.maneuver?.location) ? nextSt.maneuver.location : null;

  return {
    instruction,
    maneuver,
    streetName: roadName || extractStreetFromInstruction(instruction, idx),
    distanceMeters: Math.max(10, stepMeters),
    distanceText: formatDistanceMeters(stepMeters),
    durationSeconds: stepSec,
    durationText: `${Math.max(1, Math.round(stepSec / 60))} min`,
    startLat: loc && loc.length >= 2 ? Number(loc[1]) : undefined,
    startLng: loc && loc.length >= 2 ? Number(loc[0]) : undefined,
    endLat: endLoc && endLoc.length >= 2 ? Number(endLoc[1]) : undefined,
    endLng: endLoc && endLoc.length >= 2 ? Number(endLoc[0]) : undefined,
  };
}

async function geocodeAddressClientNominatim(
  addressQuery: string,
  biasLat?: number,
  biasLng?: number
): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
  const clean = String(addressQuery || '')
    .replace(/^local atual\s*\(gps\)$/i, '')
    .replace(/^estabelecimento$/i, '')
    .trim();
  if (clean.length < 3) return null;

  try {
    const hasBias =
      typeof biasLat === 'number' &&
      typeof biasLng === 'number' &&
      !isPlaceholderCoordinates(biasLat, biasLng);
    const viewboxParam = hasBias
      ? `&viewbox=${(biasLng! - 0.3).toFixed(4)},${(biasLat! + 0.3).toFixed(4)},${(biasLng! + 0.3).toFixed(4)},${(biasLat! - 0.3).toFixed(4)}&bounded=0`
      : '';
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&accept-language=pt-BR${viewboxParam}&q=${encodeURIComponent(
        clean
      )}`
    );
    if (!isJsonResponse(res)) return null;
    const arr = await res.json();
    const first = Array.isArray(arr) ? arr[0] : null;
    if (first?.lat && first?.lon) {
      return {
        lat: Number(first.lat),
        lng: Number(first.lon),
        formattedAddress: String(first.display_name || clean),
      };
    }
  } catch {}
  return null;
}

/**
 * Fallback viário direto no cliente (CORS-safe) para builds estáticos (ex.: Cloudflare Pages dist)
 * Busca steps=true reais, manobras de conversão, durações reais e ruas reais.
 */
async function computeClientOsrmDetailedRoute(params: {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  destAddress?: string;
  mode?: BookingTransportMode | TrackingTransportMode;
}): Promise<GoogleComputedRouteResult | null> {
  let targetLat = params.destLat;
  let targetLng = params.destLng;

  if (params.destAddress && isPlaceholderCoordinates(targetLat, targetLng)) {
    const geocoded = await geocodeAddressClientNominatim(
      params.destAddress,
      params.originLat,
      params.originLng
    );
    if (geocoded) {
      targetLat = geocoded.lat;
      targetLng = geocoded.lng;
    }
  }

  const travelMode = toGoogleTravelMode(params.mode);
  const fossgisCluster =
    travelMode === 'WALK'
      ? 'routed-foot'
      : travelMode === 'BICYCLE'
      ? 'routed-bike'
      : 'routed-car';
  const stdProfile =
    travelMode === 'WALK' ? 'foot' : travelMode === 'BICYCLE' ? 'bike' : 'driving';

  const modeDurationFactor =
    travelMode === 'TWO_WHEELER' ? 0.82 : travelMode === 'TRANSIT' ? 1.45 : 1.0;

  const endpoints = [
    `https://routing.openstreetmap.de/${fossgisCluster}/route/v1/driving/${params.originLng},${params.originLat};${targetLng},${targetLat}?overview=full&geometries=polyline&steps=true`,
    `https://router.project-osrm.org/route/v1/${stdProfile}/${params.originLng},${params.originLat};${targetLng},${targetLat}?overview=full&geometries=polyline&steps=true`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (!isJsonResponse(res)) continue;
      const data = await res.json();
      const osrmRoute = data?.routes?.[0];
      if (!osrmRoute?.geometry) continue;

      const decodedPath = decodeGooglePolyline(osrmRoute.geometry);
      if (decodedPath.length <= 2) continue;

      const distMeters = Math.max(50, Number(osrmRoute.distance || 0));
      const rawDurationSec = Math.max(60, Number(osrmRoute.duration || 0) * modeDurationFactor);
      const distanceKm = Math.max(0.1, Number((distMeters / 1000).toFixed(1)));
      const etaMinutes = Math.max(1, Math.round(rawDurationSec / 60));

      const rawSteps: any[] = Array.isArray(osrmRoute.legs?.[0]?.steps)
        ? osrmRoute.legs[0].steps
        : [];
      const steps: GoogleRouteStep[] = rawSteps
        .map((st, idx) => mapOsrmStepToGoogleStep(st, rawSteps[idx + 1], idx))
        .filter((s): s is GoogleRouteStep => Boolean(s));

      const checkpoints = buildConsolidatedCheckpoints(steps);
      const summary = osrmRoute.legs?.[0]?.summary;

      return {
        distanceKm,
        etaMinutes,
        durationSeconds: Math.round(rawDurationSec),
        description: summary ? `via ${summary}` : 'Malha Viária Principal',
        encodedPolyline: osrmRoute.geometry,
        decodedPath,
        steps,
        checkpoints,
        resolvedOrigin: { lat: params.originLat, lng: params.originLng },
        resolvedDestination: { lat: targetLat, lng: targetLng },
      };
    } catch {}
  }

  return null;
}

/**
 * Calcula rota detalhada real via Routes API v2 (/api/geo/route) + fallback viário CORS no cliente,
 * retornando distância real, ETA realista, geometria da rota (polyline), manobras reais e ruas reais para o Itinerário.
 */
export async function computeGoogleDetailedRoute(params: {
  originLat?: number;
  originLng?: number;
  originAddress?: string;
  destLat?: number;
  destLng?: number;
  destAddress?: string;
  mode?: BookingTransportMode | TrackingTransportMode;
}): Promise<GoogleComputedRouteResult | null> {
  const safeOriginLat =
    typeof params.originLat === 'number' && Number.isFinite(params.originLat)
      ? params.originLat
      : -23.5505;
  const safeOriginLng =
    typeof params.originLng === 'number' && Number.isFinite(params.originLng)
      ? params.originLng
      : -46.6333;
  const safeDestLat =
    typeof params.destLat === 'number' && Number.isFinite(params.destLat)
      ? params.destLat
      : -23.5621;
  const safeDestLng =
    typeof params.destLng === 'number' && Number.isFinite(params.destLng)
      ? params.destLng
      : -46.4795;

  // 1. Tenta o proxy backend oficial (Google Routes API v2 + Google Geocoding API)
  try {
    const travelMode = toGoogleTravelMode(params.mode);
    const res = await fetch('/api/geo/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originLat: params.originLat,
        originLng: params.originLng,
        originAddress: params.originAddress,
        destLat: params.destLat,
        destLng: params.destLng,
        destAddress: params.destAddress,
        travelMode,
      }),
    });

    if (isJsonResponse(res)) {
      const data = await res.json();
      const route = data?.routes?.[0];
      if (route?.polyline?.encodedPolyline) {
        const leg = route.legs?.[0];
        const distMeters = Number(route.distanceMeters || leg?.distanceMeters || 0);
        const durSec =
          Number(String(route.duration || leg?.duration || '0s').replace('s', '')) || 0;

        const distanceKm = Math.max(0.1, Number((distMeters / 1000).toFixed(1)));
        const etaMinutes = Math.max(1, Math.round(durSec / 60));
        const encodedPolyline = route.polyline.encodedPolyline;
        const decodedPath = decodeGooglePolyline(encodedPolyline);

        if (decodedPath.length > 2) {
          const rawSteps: any[] = Array.isArray(leg?.steps) ? leg.steps : [];
          const steps: GoogleRouteStep[] = rawSteps
            .map((s, idx) => {
              const rawInstruction = String(
                s?.navigationInstruction?.instructions || ''
              )
                .replace(/\n+/g, ' • ')
                .trim();
              const maneuver = String(s?.navigationInstruction?.maneuver || 'STRAIGHT');
              const stepMeters = Number(s?.distanceMeters || 0);
              const stepSec =
                Number(String(s?.staticDuration || '0s').replace('s', '')) || 0;
              const distanceText =
                s?.localizedValues?.distance?.text || formatDistanceMeters(stepMeters);
              const durationText =
                s?.localizedValues?.staticDuration?.text ||
                `${Math.max(1, Math.round(stepSec / 60))} min`;

              const streetName = extractStreetFromInstruction(rawInstruction, idx);

              return {
                instruction: rawInstruction || streetName,
                maneuver,
                streetName,
                distanceMeters: stepMeters,
                distanceText,
                durationSeconds: stepSec,
                durationText,
                startLat: s?.startLocation?.latLng?.latitude,
                startLng: s?.startLocation?.latLng?.longitude,
                endLat: s?.endLocation?.latLng?.latitude,
                endLng: s?.endLocation?.latLng?.longitude,
              };
            })
            .filter((s) => Boolean(s.instruction));

          const checkpoints = buildConsolidatedCheckpoints(steps);
          const endPt = decodedPath[decodedPath.length - 1];

          return {
            distanceKm,
            etaMinutes,
            durationSeconds: durSec,
            description: route.description ? `via ${route.description}` : 'Rota Google Maps',
            encodedPolyline,
            decodedPath,
            steps,
            checkpoints,
            resolvedOrigin: data?.resolvedOrigin || {
              lat: decodedPath[0].lat,
              lng: decodedPath[0].lng,
            },
            resolvedDestination: data?.resolvedDestination || {
              lat: endPt.lat,
              lng: endPt.lng,
            },
          };
        }
      }
    }
  } catch {}

  // 2. Fallback direto no cliente para deploy estático (Cloudflare Pages / PWA offline-backend)
  return computeClientOsrmDetailedRoute({
    originLat: safeOriginLat,
    originLng: safeOriginLng,
    destLat: safeDestLat,
    destLng: safeDestLng,
    destAddress: params.destAddress,
    mode: params.mode,
  });
}

/**
 * Calcula simultaneamente a matriz dos 5 modais (A pé, Bicicleta, Moto, Carro, Transp. Público) via Routes API v2
 */
export async function fetchGoogleModalRouteMatrix(params: {
  originLat?: number;
  originLng?: number;
  originAddress?: string;
  destLat?: number;
  destLng?: number;
  destAddress?: string;
}): Promise<ModalMatrixMap> {
  try {
    const res = await fetch('/api/maps/route-matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!isJsonResponse(res)) return {};
    const data = await res.json();
    return (data?.modes || {}) as ModalMatrixMap;
  } catch {
    return {};
  }
}

/**
 * Busca sugestões reais de endereços, ruas e estabelecimentos via Places API (New v1)
 */
export async function searchGooglePlacesSuggestions(
  query: string
): Promise<GooglePlaceSuggestion[]> {
  const clean = String(query || '').trim();
  if (clean.length < 3) return [];

  try {
    const res = await fetch('/api/maps/places-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: clean }),
    });
    if (isJsonResponse(res)) {
      const data = await res.json();
      if (Array.isArray(data?.places) && data.places.length > 0) {
        return data.places.filter(
          (p: any) => typeof p?.lat === 'number' && typeof p?.lng === 'number'
        );
      }
    }
  } catch {}

  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(
        clean
      )}`
    );
    if (isJsonResponse(nomRes)) {
      const arr = await nomRes.json();
      if (Array.isArray(arr)) {
        return arr
          .filter((item: any) => item?.lat && item?.lon)
          .map((item: any, idx: number) => ({
            id: String(item.place_id || idx),
            title: String(item.name || String(item.display_name || '').split(',')[0] || clean),
            formattedAddress: String(item.display_name || clean),
            lat: Number(item.lat),
            lng: Number(item.lon),
          }));
      }
    }
  } catch {}

  return [];
}

/**
 * Faz o Snap-to-Road via Roads API + Reverse Geocode via Geocoding API (com fallback Nominatim no cliente)
 */
export async function snapAndReverseGeocodeGps(
  lat: number,
  lng: number
): Promise<{ lat: number; lng: number; streetName: string; formattedAddress: string } | null> {
  try {
    const res = await fetch(
      `/api/maps/snap-and-reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    );
    if (isJsonResponse(res)) {
      return await res.json();
    }
  } catch {}

  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1&accept-language=pt-BR`
    );
    if (isJsonResponse(nomRes)) {
      const nomData = await nomRes.json();
      const addr = nomData?.address || {};
      const road =
        addr.road || addr.pedestrian || addr.highway || addr.suburb || addr.neighbourhood || '';
      const num = addr.house_number ? `, ${addr.house_number}` : '';
      const city = addr.city || addr.town || addr.municipality || '';
      const streetName = road ? `${road}${num}` : 'Local Atual (GPS)';
      const formattedAddress =
        [streetName, city].filter(Boolean).join(' - ') ||
        nomData?.display_name ||
        'Local Atual (GPS)';
      return {
        lat,
        lng,
        streetName,
        formattedAddress,
      };
    }
  } catch {}

  return null;
}

/**
 * Geocodificação em 3 Camadas (/api/geo/geocode: Google Geocoding API com Referer ➔ Nominatim ➔ fallback cliente)
 */
export async function geocodeAddressThreeLayers(params: {
  address?: string;
  streetNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  biasLat?: number;
  biasLng?: number;
}): Promise<{
  lat: number;
  lng: number;
  formattedAddress: string;
  googlePlaceId?: string;
  source: string;
} | null> {
  try {
    const res = await fetch('/api/geo/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (isJsonResponse(res)) {
      return await res.json();
    }
  } catch {}

  const fullQuery = [
    params.address ? `${params.address}${params.streetNumber ? `, ${params.streetNumber}` : ''}` : '',
    params.neighborhood,
    params.city,
    params.state,
    params.cep,
  ]
    .filter(Boolean)
    .join(', ');

  const fallback = await geocodeAddressClientNominatim(fullQuery, params.biasLat, params.biasLng);
  if (fallback) {
    return {
      lat: fallback.lat,
      lng: fallback.lng,
      formattedAddress: fallback.formattedAddress,
      googlePlaceId: '',
      source: 'nominatim_client',
    };
  }

  return null;
}
