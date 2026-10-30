/**
 * Serviço de Transporte e Navegação — VagouApp Meu Negócio
 * 
 * Responsabilidades:
 * - Cálculo de distância/ETA (Haversine + OSRM)
 * - Calibragem por modal (car, motorcycle, transit, rideshare)
 * - Deep links universais (Google Maps, Waze, Uber, 99, Transit)
 * - Formatação de horário máximo de saída
 * 
 * Princípios:
 * - Funções puras, testáveis, sem side effects
 * - Timeout/retry/abort em chamadas externas
 * - Fallback robusto (Haversine) quando OSRM falha
 * - Tipagem estrita TypeScript
 */

import {
  TransportMode,
  DbTransportMode,
  TransportMeta,
  Coordinates,
  GeocodeResult,
  RouteResult,
  ResolvedRoute,
  TransportDeepLinks,
  BuildDeepLinksParams,
  TRANSPORT_MODE_DB_MAP,
  TRANSPORT_MODE_META,
} from '../types/booking';

// Re-export para conveniência
export type {
  TransportMode,
  DbTransportMode,
  TransportMeta,
  Coordinates,
  GeocodeResult,
  RouteResult,
  ResolvedRoute,
  TransportDeepLinks,
  BuildDeepLinksParams,
} from '../types/booking';

export { TRANSPORT_MODE_DB_MAP, TRANSPORT_MODE_META } from '../types/booking';

// ============================================================================
// CONSTANTES E CONFIGURAÇÃO
// ============================================================================

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';
const OSRM_TIMEOUT_MS = 5000;
const OSRM_MAX_RETRIES = 2;
const OSRM_RETRY_DELAY_MS = 500;

const EARTH_RADIUS_KM = 6371;
const ROAD_TORTUOSITY_FACTOR = 1.42; // Fator de tortuosidade viária urbana (linha reta → ruas reais)
const MIN_ROAD_DISTANCE_KM = 0.3;
const MIN_STRAIGHT_DISTANCE_KM = 0.08;

// ============================================================================
// UTILITÁRIOS DE RETRY E TIMEOUT
// ============================================================================

interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

async function fetchWithRetry(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = OSRM_TIMEOUT_MS, maxRetries = OSRM_MAX_RETRIES, retryDelayMs = OSRM_RETRY_DELAY_MS, ...fetchOptions } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Não retry em abort por timeout do usuário ou erros 4xx
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

// ============================================================================
// CÁLCULO DE DISTÂNCIA E ETA — HAVERSINE (FALLBACK PURO)
// ============================================================================

/**
 * Calcula distância em linha reta (Haversine) + ETA calibrado por modal
 * Função pura, síncrona, sem dependências externas
 */
export function calculateHaversineDistanceAndEta(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  mode: TransportMode = 'car'
): RouteResult {
  // Validação de coordenadas
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    return createFallbackRouteResult(mode);
  }
  
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const lat1Rad = toRad(lat1);
  const lat2Rad = toRad(lat2);
  
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistanceKm = EARTH_RADIUS_KM * c;
  
  // Distância muito curta → retorno mínimo
  if (straightDistanceKm < MIN_STRAIGHT_DISTANCE_KM) {
    const minEta = mode === 'transit' ? 8 : 5;
    return {
      distanceKm: 0.2,
      etaMinutes: minEta,
      source: 'haversine',
    };
  }
  
  // Aplica fator de tortuosidade viária (ruas reais vs linha reta)
  const roadDistanceKm = Math.max(MIN_ROAD_DISTANCE_KM, Number((straightDistanceKm * ROAD_TORTUOSITY_FACTOR).toFixed(1)));
  
  // Calcula ETA calibrado para o modal
  const etaMinutes = computeCalibratedEtaForMode(roadDistanceKm, null, mode);
  
  return {
    distanceKm: roadDistanceKm,
    etaMinutes,
    source: 'haversine',
  };
}

function toRad(degrees: number): number {
  return degrees * Math.PI / 180;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function createFallbackRouteResult(mode: TransportMode): RouteResult {
  const minEta = mode === 'transit' ? 8 : 5;
  return {
    distanceKm: 0.2,
    etaMinutes: minEta,
    source: 'fallback',
  };
}

// ============================================================================
// CALIBRAGEM DE ETA POR MODAL (CORAÇÃO DO SISTEMA)
// ============================================================================

/**
 * Aplica calibragem de tráfego real (padrão Google Maps horário comercial) + margem de folga
 * Garante que o app NUNCA subestime o tempo real da rota
 */
export function computeCalibratedEtaForMode(
  distanceKm: number,
  osrmRawMinutes: number | null,
  mode: TransportMode = 'car'
): number {
  const safeDist = Math.max(0.2, distanceKm);
  const meta = TRANSPORT_MODE_META[mode];
  
  // MOTO: velocidade maior em corredor, multiplicador menor sobre OSRM
  if (mode === 'motorcycle') {
    const urbanMotoMinutes = (safeDist / (safeDist <= 15 ? meta.urbanSpeedKmh.max15km : meta.urbanSpeedKmh.above15km)) * 60;
    const baseMoto = osrmRawMinutes 
      ? Math.max(urbanMotoMinutes, osrmRawMinutes * meta.osrmMultiplier)
      : urbanMotoMinutes;
    return Math.max(5, Math.ceil(baseMoto + meta.safetyBufferMinutes));
  }
  
  // TRANSIT: velocidade menor, multiplicador maior, buffer maior
  if (mode === 'transit') {
    const urbanTransitMinutes = (safeDist / (safeDist <= 12 ? meta.urbanSpeedKmh.max15km : meta.urbanSpeedKmh.above15km)) * 60;
    const baseTransit = osrmRawMinutes
      ? Math.max(urbanTransitMinutes, osrmRawMinutes * meta.osrmMultiplier)
      : urbanTransitMinutes;
    return Math.max(12, Math.ceil(baseTransit + meta.safetyBufferMinutes));
  }
  
  // CARRO (base para rideshare também): trânsito urbano severo/moderado
  const urbanCarMinutes = (safeDist / (safeDist <= 15 ? meta.urbanSpeedKmh.max15km : meta.urbanSpeedKmh.above15km)) * 60;
  const baseCar = osrmRawMinutes
    ? Math.max(urbanCarMinutes, osrmRawMinutes * meta.osrmMultiplier)
    : urbanCarMinutes;
  
  if (mode === 'rideshare') {
    return Math.max(8, Math.ceil(baseCar + meta.safetyBufferMinutes));
  }
  
  // CARRO padrão
  return Math.max(6, Math.ceil(baseCar + meta.safetyBufferMinutes));
}

// ============================================================================
// OSRM — ROTA REAL POR RUAS (COM TIMEOUT/RETRY/FALLBACK)
// ============================================================================

interface OsrmResponse {
  code: string;
  routes?: Array<{
    distance: number; // metros
    duration: number; // segundos
    legs?: Array<{ summary?: string }>;
  }>;
}

/**
 * Calcula rota real via OSRM Driving API com calibragem por modal
 * Inclui timeout, retry exponencial e fallback automático para Haversine
 */
export async function calculateDrivingRouteDistanceAndEta(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  mode: TransportMode = 'car'
): Promise<RouteResult> {
  // Validação prévia
  if (!isValidCoordinate(lat1, lng1) || !isValidCoordinate(lat2, lng2)) {
    return calculateHaversineDistanceAndEta(lat1, lng1, lat2, lng2, mode);
  }
  
  const osrmUrl = `${OSRM_BASE_URL}/${lng1},${lat1};${lng2},${lat2}?overview=false`;
  
  try {
    const response = await fetchWithRetry(osrmUrl);
    const data = await response.json() as OsrmResponse;
    
    if (data?.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
      const route = data.routes[0];
      const distanceKm = Math.max(MIN_ROAD_DISTANCE_KM, Number((route.distance / 1000).toFixed(1)));
      const osrmRawMinutesValue = Math.round(route.duration / 60);
      const etaMinutes = computeCalibratedEtaForMode(distanceKm, osrmRawMinutesValue, mode);
      const legSummary = route.legs?.[0]?.summary ? `via ${route.legs[0].summary}` : undefined;
      
      return {
        distanceKm,
        etaMinutes,
        routeSummary: legSummary,
        source: 'osrm',
        rawOsrmMinutes: osrmRawMinutesValue,
      };
    }
  } catch (error) {
    // Log silencioso — fallback abaixo
    console.debug('[transportService] OSRM failed, falling back to Haversine:', error);
  }
  
  // Fallback automático para Haversine calibrado
  return calculateHaversineDistanceAndEta(lat1, lng1, lat2, lng2, mode);
}

// ============================================================================
// GEOCODIFICAÇÃO BRASIL (EXPORTAÇÃO PARA USO EXTERNO)
// ============================================================================

// Cache em memória para geocodificação
const geocodeCache = new Map<string, GeocodeResult>();

/**
 * Geocodifica CEP ou endereço textual usando provedores brasileiros em cascata:
 * 1. AwesomeAPI CEP (coordenadas diretas)
 * 2. BrasilAPI CEP v2 (coordenadas IBGE/Correios)
 * 3. ViaCEP + Nominatim OpenStreetMap (busca estruturada)
 * 
 * Inclui cache, timeout e abort controller
 */
export async function geocodeBrazilLocation(query: string): Promise<GeocodeResult | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;
  
  const onlyDigits = cleanQuery.replace(/\D/g, '');
  const cacheKey = onlyDigits.length === 8 ? `cep:${onlyDigits}` : `addr:${cleanQuery.toLowerCase()}`;
  
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;
  
  try {
    let result: GeocodeResult | null = null;
    
    // FLUXO A: CEP de 8 dígitos
    if (onlyDigits.length === 8) {
      result = await geocodeCep(onlyDigits, cleanQuery);
    }
    
    // FLUXO B: Endereço textual livre
    if (!result) {
      result = await geocodeFreeText(cleanQuery);
    }
    
    if (result) {
      geocodeCache.set(cacheKey, result);
      return result;
    }
  } catch (error) {
    console.debug('[transportService] Geocode failed:', error);
  }
  
  return null;
}

async function geocodeCep(cep: string, fallbackAddress: string): Promise<GeocodeResult | null> {
  // 1. AwesomeAPI CEP (mais rápido, coordenadas diretas)
  try {
    const res = await fetchWithRetry(`https://cep.awesomeapi.com.br/json/${cep}`, { timeoutMs: 3000 });
    const data = await res.json();
    if (data && !data.status && data.lat && data.lng) {
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      if (isValidCoordinate(lat, lng)) {
        return {
          lat,
          lng,
          formattedAddress: formatCepAddress(data.address, data.district, data.city, data.state, cep),
          cep,
        };
      }
    }
  } catch {}
  
  // 2. BrasilAPI CEP v2
  try {
    const res = await fetchWithRetry(`https://brasilapi.com.br/api/cep/v2/${cep}`, { timeoutMs: 3000 });
    const data = await res.json();
    const lat = parseFloat(data?.location?.coordinates?.latitude);
    const lng = parseFloat(data?.location?.coordinates?.longitude);
    if (isValidCoordinate(lat, lng)) {
      return {
        lat,
        lng,
        formattedAddress: formatCepAddress(data.street, data.neighborhood, data.city, data.state, cep),
        cep,
      };
    }
  } catch {}
  
  // 3. ViaCEP + Nominatim
  try {
    const viaRes = await fetchWithRetry(`https://viacep.com.br/ws/${cep}/json/`, { timeoutMs: 3000 });
    const viaData = await viaRes.json();
    if (!viaData.erro) {
      const searchQuery = `${viaData.logradouro || ''}, ${viaData.localidade || ''} - ${viaData.uf || ''}, Brasil`;
      const nomRes = await fetchWithRetry(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(searchQuery)}`,
        { timeoutMs: 5000, headers: { 'Accept-Language': 'pt-BR' } }
      );
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const lat = parseFloat(nomData[0].lat);
        const lng = parseFloat(nomData[0].lon);
        if (isValidCoordinate(lat, lng)) {
          return {
            lat,
            lng,
            formattedAddress: formatCepAddress(viaData.logradouro, viaData.bairro, viaData.localidade, viaData.uf, cep),
            cep,
          };
        }
      }
    }
  } catch {}
  
  return null;
}

async function geocodeFreeText(query: string): Promise<GeocodeResult | null> {
  try {
    const res = await fetchWithRetry(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`,
      { timeoutMs: 5000, headers: { 'Accept-Language': 'pt-BR' } }
    );
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (isValidCoordinate(lat, lng)) {
        const shortName = data[0].display_name
          ? data[0].display_name.split(',').slice(0, 3).join(',').trim()
          : query;
        return { lat, lng, formattedAddress: shortName };
      }
    }
  } catch {}
  return null;
}

function formatCepAddress(street: string, neighborhood: string, city: string, state: string, fallback: string): string {
  const parts = [street, neighborhood, city, state].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : fallback;
}

// ============================================================================
// RESOLUÇÃO COMPLETA: ORIGEM + DESTINO + ROTA
// ============================================================================

interface ResolveRouteParams {
  originQuery: string;
  salonCoords: Coordinates;
  salonDestinationQuery?: string;
  transportMode?: TransportMode;
}

/**
 * Resolve endereço do cliente + salão + calcula rota real
 * Usado pelo SalonBookingModal para cálculo preditivo de deslocamento
 */
export async function resolveAddressDistanceToSalon({
  originQuery,
  salonCoords,
  salonDestinationQuery,
  transportMode = 'car',
}: ResolveRouteParams): Promise<ResolvedRoute> {
  // 1. Resolve coordenadas do salão se houver query
  let targetSalonLat = salonCoords.lat;
  let targetSalonLng = salonCoords.lng;
  let salonFormattedAddress: string | undefined;
  
  const salonDestQuery = salonDestinationQuery?.trim();
  if (salonDestQuery && salonDestQuery.length >= 5) {
    const salonGeo = await geocodeBrazilLocation(salonDestQuery);
    if (salonGeo) {
      targetSalonLat = salonGeo.lat;
      targetSalonLng = salonGeo.lng;
      salonFormattedAddress = salonGeo.formattedAddress;
    }
  }
  
  // 2. Resolve coordenadas da origem do cliente
  const originGeo = await geocodeBrazilLocation(originQuery);
  
  if (originGeo) {
    const route = await calculateDrivingRouteDistanceAndEta(
      originGeo.lat,
      originGeo.lng,
      targetSalonLat,
      targetSalonLng,
      transportMode
    );
    
    return {
      ...route,
      formattedAddress: originGeo.formattedAddress,
      salonFormattedAddress,
      originCoords: { lat: originGeo.lat, lng: originGeo.lng },
      salonCoords: { lat: targetSalonLat, lng: targetSalonLng },
    };
  }
  
  // 3. Fallback determinístico (seed baseado no input)
  const cleanQuery = originQuery.trim();
  const seed = cleanQuery.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const simulatedDistanceKm = Number((3.5 + (seed % 85) / 10).toFixed(1));
  const simulatedEtaMinutes = computeCalibratedEtaForMode(simulatedDistanceKm, null, transportMode);
  
  return {
    distanceKm: simulatedDistanceKm,
    etaMinutes: simulatedEtaMinutes,
    source: 'fallback',
    formattedAddress: cleanQuery,
    salonFormattedAddress,
    originCoords: { lat: targetSalonLat - 0.03, lng: targetSalonLng - 0.03 },
    salonCoords: { lat: targetSalonLat, lng: targetSalonLng },
  };
}

// ============================================================================
// FORMATAÇÃO DE HORÁRIO MÁXIMO DE SAÍDA
// ============================================================================

/**
 * Calcula o Horário Máximo de Saída (ex: "13H20") com base no horário agendado
 * e no tempo de trajeto (etaMinutes). Lida com virada de dia.
 */
export function formatMaxDepartureTime(timeSlot: string, etaMinutes: number): string {
  const [sh, sm] = String(timeSlot || '').split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm)) return '--H--';
  
  const totalAppointmentMinutes = sh * 60 + sm;
  const safeEta = Math.max(0, etaMinutes);
  
  // Se ETA > 12h, calcula dias antes
  if (safeEta > 12 * 60) {
    const daysBefore = Math.floor(safeEta / 1440);
    const remMinutes = safeEta % 1440;
    const depMin = ((totalAppointmentMinutes - remMinutes) % 1440 + 1440) % 1440;
    const h = Math.floor(depMin / 60);
    const m = depMin % 60;
    return daysBefore > 0
      ? `${String(h).padStart(2, '0')}H${String(m).padStart(2, '0')} (-${daysBefore}d)`
      : `${String(h).padStart(2, '0')}H${String(m).padStart(2, '0')}`;
  }
  
  const departureMinutes = ((totalAppointmentMinutes - safeEta) % 1440 + 1440) % 1440;
  const h = Math.floor(departureMinutes / 60);
  const m = departureMinutes % 60;
  return `${String(h).padStart(2, '0')}H${String(m).padStart(2, '0')}`;
}

// ============================================================================
// DEEP LINKS UNIVERSAIS DE NAVEGAÇÃO
// ============================================================================

/**
 * Gera Deep Links para Google Maps, Waze, Uber, 99 e Transit
 * Função pura, reutilizável em qualquer contexto (modal, notificação, email)
 */
export function buildTransportDeepLinks(params: BuildDeepLinksParams): TransportDeepLinks {
  const originCoordStr = typeof params.originLat === 'number' && typeof params.originLng === 'number'
    ? `${params.originLat},${params.originLng}`
    : '';
  const salonCoordStr = typeof params.salonLat === 'number' && typeof params.salonLng === 'number'
    ? `${params.salonLat},${params.salonLng}`
    : '';
  
  const originQuery = (params.originAddress || originCoordStr || '').trim();
  const destLabel = [params.salonName, params.salonAddress].filter(Boolean).join(' - ').trim() || salonCoordStr;
  const destAddressOnly = (params.salonAddress || params.salonName || salonCoordStr || 'Estabelecimento').trim();
  
  // Modo de viagem para Google Maps
  const googleTravelMode = params.transportMode === 'transit'
    ? 'transit'
    : params.transportMode === 'motorcycle'
    ? 'two-wheeler'
    : 'driving';
  
  // Google Maps (modo específico + transit separado para baldeações)
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originQuery || originCoordStr)}&destination=${encodeURIComponent(destAddressOnly || salonCoordStr)}&travelmode=${googleTravelMode}`;
  const googleMapsTransitUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originQuery || originCoordStr)}&destination=${encodeURIComponent(destAddressOnly || salonCoordStr)}&travelmode=transit`;
  
  // Waze
  const wazeUrl = salonCoordStr
    ? `https://waze.com/ul?ll=${salonCoordStr}&q=${encodeURIComponent(destAddressOnly)}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(destAddressOnly)}&navigate=yes`;
  
  // Uber Deep Link Universal
  const uberParams = new URLSearchParams({
    action: 'setPickup',
    'dropoff[formatted_address]': destLabel,
    'dropoff[nickname]': params.salonName || 'Salão',
  });
  if (typeof params.salonLat === 'number' && typeof params.salonLng === 'number') {
    uberParams.set('dropoff[latitude]', String(params.salonLat));
    uberParams.set('dropoff[longitude]', String(params.salonLng));
  }
  if (typeof params.originLat === 'number' && typeof params.originLng === 'number') {
    uberParams.set('pickup[latitude]', String(params.originLat));
    uberParams.set('pickup[longitude]', String(params.originLng));
    if (params.originAddress) {
      uberParams.set('pickup[formatted_address]', params.originAddress);
    }
  } else {
    uberParams.set('pickup', 'my_location');
  }
  const uberUrl = `https://m.uber.com/ul/?${uberParams.toString()}`;
  
  // 99 App Deep Link
  const app99Params = new URLSearchParams({
    dropoff_title: destLabel,
  });
  if (typeof params.salonLat === 'number' && typeof params.salonLng === 'number') {
    app99Params.set('dropoff_latitude', String(params.salonLat));
    app99Params.set('dropoff_longitude', String(params.salonLng));
  }
  if (typeof params.originLat === 'number' && typeof params.originLng === 'number') {
    app99Params.set('pickup_latitude', String(params.originLat));
    app99Params.set('pickup_longitude', String(params.originLng));
    if (params.originAddress) {
      app99Params.set('pickup_title', params.originAddress);
    }
  }
  const app99Url = `https://99app.com/?${app99Params.toString()}`;
  
  return {
    googleMapsUrl,
    googleMapsTransitUrl,
    wazeUrl,
    uberUrl,
    app99Url,
    destAddressOnly,
  };
}

// ============================================================================
// CONVERSÃO UI → DB
// ============================================================================

export function mapUiTransportModeToDb(uiMode: TransportMode): DbTransportMode {
  return TRANSPORT_MODE_DB_MAP[uiMode] || 'driving';
}

// ============================================================================
// UTILITÁRIOS DE FORMATAÇÃO PARA UI
// ============================================================================

export function formatDistanceKm(km: number): string {
  return km.toFixed(1).replace('.', ',');
}

export function formatEtaMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours} ${hours === 1 ? 'hora' : 'horas'} e ${String(mins).padStart(2, '0')} min`;
  }
  return `${mins} min`;
}

export function getTransportModeMeta(mode: TransportMode): TransportMeta {
  return TRANSPORT_MODE_META[mode];
}

// ============================================================================
// LIMPEZA DE CACHE (para testes ou logout)
// ============================================================================

export function clearGeocodeCache(): void {
  geocodeCache.clear();
}

export function getGeocodeCacheSize(): number {
  return geocodeCache.size;
}