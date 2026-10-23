import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface BookingSlotItem {
  time: string;
  available: boolean;
  period: 'manha' | 'tarde' | 'noite';
  reason?: 'busy' | 'past' | 'travel_buffer';
}

export interface BookingDraftItem {
  id: string;
  salonId?: string;
  salonName: string;
  salonAddress: string;
  services: Array<{
    id: string;
    title: string;
    price: number;
    duration: string;
    category: string;
  }>;
  combinedServiceTitle: string;
  totalPrice: number;
  professional: string;
  professionalAvatar?: string;
  dateIso: string;
  dateFormatted: string;
  timeSlot: string;
  isDependentBooking: boolean;
  dependentId?: string;
  dependentName?: string;
  clientPhone?: string;
  clientAddressQuery?: string;
  distanceKm?: number;
  etaMinutes?: number;
  prepBufferMinutes: number;
  savedAt: string;
}

export const BOOKING_DRAFT_STORAGE_KEY = 'vagou_booking_draft_v1';

export function getSavedBookingDraft(): BookingDraftItem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.combinedServiceTitle && parsed.dateIso && parsed.timeSlot) {
      return parsed as BookingDraftItem;
    }
  } catch {}
  return null;
}

export function saveBookingDraft(draft: BookingDraftItem | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!draft) {
      localStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
    } else {
      localStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
    window.dispatchEvent(new CustomEvent('vagou:booking-draft-updated', { detail: draft }));
  } catch {}
}

/**
 * Busca horários ocupados no banco de dados (combinando RPC get_busy_slots + leitura direta de public.appointments)
 */
export async function fetchBusySlotsDirectly(
  salonId: string,
  dateStr: string
): Promise<Array<{ start_time: string; end_time: string; professional_id?: string; professional_name?: string }>> {
  if (!dateStr) return [];
  const results: Array<{ start_time: string; end_time: string; professional_id?: string; professional_name?: string }> = [];

  // 1. Consulta no Supabase (RPC + Tabela public.appointments)
  if (isSupabaseConfigured && supabase && salonId) {
    try {
      const { data: rpcData, error: rpcErr } = await (supabase as any).rpc('get_busy_slots', {
        p_salon_id: salonId,
        p_date_str: dateStr,
      });
      if (!rpcErr && Array.isArray(rpcData)) {
        rpcData.forEach((row: any) => {
          if (row?.start_time) {
            results.push({
              start_time: String(row.start_time).slice(0, 5),
              end_time: String(row.end_time || row.start_time).slice(0, 5),
              professional_id: row.professional_id,
            });
          }
        });
      }
    } catch {}

    try {
      const { data: aptRows } = await (supabase.from('appointments') as any)
        .select('start_time, end_time, professional_id, status')
        .eq('salon_id', salonId)
        .eq('date_str', dateStr)
        .neq('status', 'CANCELADO')
        .neq('status', 'cancelado');

      if (Array.isArray(aptRows)) {
        aptRows.forEach((row: any) => {
          if (row?.start_time) {
            const st = String(row.start_time).slice(0, 5);
            if (!results.some((r) => r.start_time === st)) {
              results.push({
                start_time: st,
                end_time: String(row.end_time || row.start_time).slice(0, 5),
                professional_id: row.professional_id,
              });
            }
          }
        });
      }
    } catch {}
  }

  // 2. Complementa com agendamentos confirmados localmente na sessão para resposta imediata
  if (typeof window !== 'undefined') {
    try {
      const localApts = JSON.parse(localStorage.getItem('vagou_user_appointments') || '[]');
      if (Array.isArray(localApts)) {
        const [, m, d] = dateStr.split('-');
        const shortFormatted = `${d}/${m}`;
        localApts.forEach((apt: any) => {
          const isCancelled = String(apt?.status || '').toUpperCase() === 'CANCELADO';
          if (isCancelled) return;
          const matchesDate =
            apt?.dateIso === dateStr ||
            apt?.dayGroup === shortFormatted ||
            (typeof apt?.dateTime === 'string' && apt.dateTime.includes(shortFormatted));
          if (matchesDate && apt?.time) {
            const st = String(apt.time).slice(0, 5);
            if (!results.some((r) => r.start_time === st)) {
              results.push({
                start_time: st,
                end_time: st,
                professional_name: apt.professional || apt.professionalName,
              });
            }
          }
        });
      }
    } catch {}
  }

  return results;
}

/**
 * Cache em memória para geocodificação instantânea de CEPs e endereços já consultados
 */
const locationGeoCache = new Map<
  string,
  { lat: number; lng: number; formattedAddress: string; cep?: string }
>();

export type TransportMode = 'car' | 'motorcycle' | 'transit' | 'rideshare';

export const TRANSPORT_MODE_META: Record<
  TransportMode,
  { label: string; shortLabel: string; safetyBufferMinutes: number; description: string }
> = {
  car: {
    label: 'Carro',
    shortLabel: 'Carro',
    safetyBufferMinutes: 6,
    description: 'Trânsito urbano + 6 min de folga para semáforos/estacionar',
  },
  motorcycle: {
    label: 'Moto',
    shortLabel: 'Moto',
    safetyBufferMinutes: 4,
    description: 'Rota rápida (corredor) + 4 min de margem de segurança',
  },
  transit: {
    label: 'Transporte Público',
    shortLabel: 'Transp. Público',
    safetyBufferMinutes: 12,
    description: 'Ônibus/Metrô + caminhada e tempo de espera/baldeação',
  },
  rideshare: {
    label: 'App (Uber / 99)',
    shortLabel: 'Uber / 99',
    safetyBufferMinutes: 10,
    description: 'Tempo de chamada do motorista + trajeto urbano com folga',
  },
};

/**
 * Aplica calibragem de tráfego real (padrão Google Maps em horário comercial) + margem de folga
 * para garantir que o app NUNCA subestime o tempo real da rota.
 */
export function computeCalibratedEtaForMode(
  distanceKm: number,
  osrmRawMinutes: number | null,
  mode: TransportMode = 'car'
): number {
  const safeDist = Math.max(0.2, distanceKm);

  if (mode === 'motorcycle') {
    const urbanMotoMinutes = (safeDist / (safeDist <= 15 ? 24.5 : 32.0)) * 60;
    const baseMoto = osrmRawMinutes ? Math.max(urbanMotoMinutes, osrmRawMinutes * 1.12) : urbanMotoMinutes;
    return Math.max(5, Math.ceil(baseMoto + TRANSPORT_MODE_META.motorcycle.safetyBufferMinutes));
  }

  if (mode === 'transit') {
    const urbanTransitMinutes = (safeDist / (safeDist <= 12 ? 12.5 : 15.5)) * 60;
    const baseTransit = osrmRawMinutes ? Math.max(urbanTransitMinutes, osrmRawMinutes * 1.85) : urbanTransitMinutes;
    return Math.max(12, Math.ceil(baseTransit + TRANSPORT_MODE_META.transit.safetyBufferMinutes));
  }

  // Base de Carro (trânsito urbano severo/moderado estilo Google Maps: ~16.8 km/h até 15km, ~22 km/h acima)
  const urbanCarMinutes = (safeDist / (safeDist <= 15 ? 16.8 : 22.0)) * 60;
  const baseCar = osrmRawMinutes ? Math.max(urbanCarMinutes, osrmRawMinutes * 1.42) : urbanCarMinutes;

  if (mode === 'rideshare') {
    return Math.max(8, Math.ceil(baseCar + TRANSPORT_MODE_META.rideshare.safetyBufferMinutes));
  }

  return Math.max(6, Math.ceil(baseCar + TRANSPORT_MODE_META.car.safetyBufferMinutes));
}

/**
 * Fórmula de Haversine + fator de tortuosidade urbana realista (1.42x em malha viária urbana)
 * Com calibragem Google Maps + margem de segurança por modal de transporte.
 */
export function calculateHaversineDistanceAndEta(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  mode: TransportMode = 'car'
): { distanceKm: number; etaMinutes: number } {
  const R = 6371; // Raio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistanceKm = R * c;

  if (straightDistanceKm < 0.08) {
    return { distanceKm: 0.2, etaMinutes: mode === 'transit' ? 8 : 5 };
  }

  // Fator de tortuosidade viária urbana (1.42x da linha reta reflete curvas e retornos reais de rua)
  const roadDistanceKm = Math.max(0.3, Number((straightDistanceKm * 1.42).toFixed(1)));
  const etaMinutes = computeCalibratedEtaForMode(roadDistanceKm, null, mode);

  return { distanceKm: roadDistanceKm, etaMinutes };
}

/**
 * Calcula a distância real de condução por ruas (OSRM Driving API) e o tempo estimado urbano (padrão Google Maps + margem de folga)
 */
export async function calculateDrivingRouteDistanceAndEta(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  mode: TransportMode = 'car'
): Promise<{ distanceKm: number; etaMinutes: number; routeSummary?: string }> {
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    const res = await fetch(osrmUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = Math.max(0.2, Number((route.distance / 1000).toFixed(1)));
        const osrmRawMinutes = Math.round(route.duration / 60);
        const etaMinutes = computeCalibratedEtaForMode(distanceKm, osrmRawMinutes, mode);
        const legSummary = route.legs?.[0]?.summary ? `via ${route.legs[0].summary}` : undefined;
        return { distanceKm, etaMinutes, routeSummary: legSummary };
      }
    }
  } catch {}

  return calculateHaversineDistanceAndEta(lat1, lng1, lat2, lng2, mode);
}

/**
 * Geocodifica qualquer CEP brasileiro (8 dígitos) ou endereço textual usando 3 provedores reais em cascata:
 * 1. AwesomeAPI CEP (coordenadas diretas do CEP)
 * 2. BrasilAPI CEP v2 (coordenadas oficiais IBGE/Correios)
 * 3. ViaCEP + Nominatim OpenStreetMap (busca estruturada sem bloqueio de bairro)
 */
export async function geocodeBrazilLocation(
  query: string
): Promise<{ lat: number; lng: number; formattedAddress: string; cep?: string } | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  const onlyDigits = cleanQuery.replace(/\D/g, '');
  const cacheKey = onlyDigits.length === 8 ? `cep_v2:${onlyDigits}` : `addr_v2:${cleanQuery.toLowerCase()}`;
  const cached = locationGeoCache.get(cacheKey);
  if (cached) return cached;

  let street = '';
  let neighborhood = '';
  let city = '';
  let state = '';
  let formattedAddress = cleanQuery;

  const abbreviateAddressPrefixes = (text: string): string => {
    if (!text) return '';
    return text
      .trim()
      .replace(/\bAvenida\b/gi, 'Av.')
      .replace(/\bPraça\b/gi, 'Pça.')
      .replace(/\bAlameda\b/gi, 'Al.')
      .replace(/\bTravessa\b/gi, 'Trav.')
      .replace(/\bRua\b/gi, 'R.')
      .replace(/\bEstrada\b/gi, 'Estr.')
      .replace(/\bRodovia\b/gi, 'Rod.')
      .replace(/\bLargo\b/gi, 'Lg.')
      .replace(/\bViela\b/gi, 'Vl.')
      .replace(/\bBeco\b/gi, 'Bc.')
      .replace(/\bConjunto\b/gi, 'Conj.')
      .replace(/\bCondomínio\b/gi, 'Cond.')
      .replace(/\bParque\b/gi, 'Pq.')
      .replace(/\bJardim\b/gi, 'Jd.')
      .replace(/\bVila\b/gi, 'Vl.')
      .replace(/\bDoutora?\b/gi, 'Dr.')
      .replace(/\bProfessora?\b/gi, 'Prof.')
      .replace(/\bEngenheiro\b/gi, 'Eng.')
      .replace(/\bCapitão\b/gi, 'Cap.')
      .replace(/\bCoronel\b/gi, 'Cel.')
      .replace(/\bGeneral\b/gi, 'Gen.')
      .replace(/\bMarechal\b/gi, 'Mal.')
      .replace(/\bPresidente\b/gi, 'Pres.')
      .replace(/\bGovernador\b/gi, 'Gov.')
      .replace(/\bSenador\b/gi, 'Sen.')
      .replace(/\bDeputado\b/gi, 'Dep.');
  };

  const formatCepAddressString = (st: string, nb: string, ct: string, uf: string, fallback: string) => {
    const abbrSt = abbreviateAddressPrefixes(st);
    const abbrNb = abbreviateAddressPrefixes(nb);
    const parts = [abbrSt, abbrNb, ct.trim(), uf.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join('-') : fallback;
  };

  // Fluxo A: É um CEP de 8 dígitos (ex.: 08235-770 ou 08285-010)
  if (onlyDigits.length === 8) {
    // 1. Tenta AwesomeAPI CEP (retorna lat e lng exatos do CEP instantaneamente)
    try {
      const awesomeRes = await fetch(`https://cep.awesomeapi.com.br/json/${onlyDigits}`);
      if (awesomeRes.ok) {
        const awData = await awesomeRes.json();
        if (awData && !awData.status) {
          street = awData.address || street;
          neighborhood = awData.district || neighborhood;
          city = awData.city || city;
          state = awData.state || state;
          formattedAddress = formatCepAddressString(street, neighborhood, city, state, onlyDigits);
          const lat = parseFloat(awData.lat);
          const lng = parseFloat(awData.lng);
          if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0) {
            const resolved = { lat, lng, formattedAddress, cep: onlyDigits };
            locationGeoCache.set(cacheKey, resolved);
            return resolved;
          }
        }
      }
    } catch {}

    // 2. Tenta BrasilAPI CEP v2 (retorna location.coordinates.latitude / longitude)
    try {
      const brRes = await fetch(`https://brasilapi.com.br/api/cep/v2/${onlyDigits}`);
      if (brRes.ok) {
        const brData = await brRes.json();
        street = brData.street || street;
        neighborhood = brData.neighborhood || neighborhood;
        city = brData.city || city;
        state = brData.state || state;
        formattedAddress = formatCepAddressString(street, neighborhood, city, state, onlyDigits);
        const lat = parseFloat(brData?.location?.coordinates?.latitude);
        const lng = parseFloat(brData?.location?.coordinates?.longitude);
        if (!Number.isNaN(lat) && !Number.isNaN(lng) && lat !== 0 && lng !== 0) {
          const resolved = { lat, lng, formattedAddress, cep: onlyDigits };
          locationGeoCache.set(cacheKey, resolved);
          return resolved;
        }
      }
    } catch {}

    // 3. Tenta ViaCEP para enriquecer logradouro/bairro caso ainda não tenhamos
    if (!street || !neighborhood || !city) {
      try {
        const viaRes = await fetch(`https://viacep.com.br/ws/${onlyDigits}/json/`);
        if (viaRes.ok) {
          const viaData = await viaRes.json();
          if (!viaData.erro) {
            street = viaData.logradouro || street;
            neighborhood = viaData.bairro || neighborhood;
            city = viaData.localidade || city;
            state = viaData.uf || state;
            formattedAddress = formatCepAddressString(street, neighborhood, city, state, onlyDigits);
          }
        }
      } catch {}
    }

    // 4. Consulta Nominatim com queries estruturadas (logradouro+cidade, depois CEP, depois bairro+cidade)
    const candidateQueries = [
      street && city ? `${street}, ${city} - ${state}, Brasil` : '',
      `${onlyDigits.slice(0, 5)}-${onlyDigits.slice(5)}, Brasil`,
      neighborhood && city ? `${neighborhood}, ${city} - ${state}, Brasil` : '',
      city ? `${city} - ${state}, Brasil` : '',
    ].filter(Boolean);

    for (const q of candidateQueries) {
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
          { headers: { 'Accept-Language': 'pt-BR' } }
        );
        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (Array.isArray(nomData) && nomData.length > 0) {
            const lat = parseFloat(nomData[0].lat);
            const lng = parseFloat(nomData[0].lon);
            if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
              const resolved = { lat, lng, formattedAddress, cep: onlyDigits };
              locationGeoCache.set(cacheKey, resolved);
              return resolved;
            }
          }
        }
      } catch {}
    }

    if (city || street || neighborhood) {
      const resolved = { lat: -23.5505, lng: -46.6333, formattedAddress, cep: onlyDigits };
      locationGeoCache.set(cacheKey, resolved);
      return resolved;
    }
  }

  // Fluxo B: Endereço textual livre (ex.: "Av. Itaquera, São Paulo" ou "Parque Guarani, SP")
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(cleanQuery)}`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    );
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const lat = parseFloat(nomData[0].lat);
        const lng = parseFloat(nomData[0].lon);
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          const shortName = nomData[0].display_name
            ? nomData[0].display_name.split(',').slice(0, 3).join(',').trim()
            : cleanQuery;
          const resolved = { lat, lng, formattedAddress: shortName };
          locationGeoCache.set(cacheKey, resolved);
          return resolved;
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Geocodifica o endereço/CEP do cliente e do estabelecimento em tempo real e calcula a rota real com calibragem por modal e margem de folga
 */
export async function resolveAddressDistanceToSalon(
  addressOrCepQuery: string,
  salonCoords: { lat: number; lng: number } = { lat: -23.5621, lng: -46.4795 },
  salonDestinationQuery?: string,
  transportMode: TransportMode = 'car'
): Promise<{
  formattedAddress: string;
  salonFormattedAddress?: string;
  lat: number;
  lng: number;
  salonLat: number;
  salonLng: number;
  distanceKm: number;
  etaMinutes: number;
  routeSummary?: string;
}> {
  // 1. Resolver coordenadas reais do Salão se houver CEP/endereço do salão
  let targetSalonLat = salonCoords.lat;
  let targetSalonLng = salonCoords.lng;
  let salonFormattedAddress: string | undefined;

  if (salonDestinationQuery && salonDestinationQuery.trim().length >= 5) {
    const salonGeo = await geocodeBrazilLocation(salonDestinationQuery);
    if (salonGeo) {
      targetSalonLat = salonGeo.lat;
      targetSalonLng = salonGeo.lng;
      salonFormattedAddress = salonGeo.formattedAddress;
    }
  }

  // 2. Resolver coordenadas reais da Origem do Cliente (CEP ou Endereço)
  const originGeo = await geocodeBrazilLocation(addressOrCepQuery);

  if (originGeo) {
    const route = await calculateDrivingRouteDistanceAndEta(
      originGeo.lat,
      originGeo.lng,
      targetSalonLat,
      targetSalonLng,
      transportMode
    );

    return {
      formattedAddress: originGeo.formattedAddress,
      salonFormattedAddress,
      lat: originGeo.lat,
      lng: originGeo.lng,
      salonLat: targetSalonLat,
      salonLng: targetSalonLng,
      distanceKm: route.distanceKm,
      etaMinutes: route.etaMinutes,
      routeSummary: route.routeSummary,
    };
  }

  // 3. Fallback determinístico apenas se o usuário digitar texto sem correspondência geográfica
  const cleanQuery = addressOrCepQuery.trim();
  const seed = cleanQuery.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const simulatedDistanceKm = Number((3.5 + (seed % 85) / 10).toFixed(1));
  const simulatedEtaMinutes = computeCalibratedEtaForMode(simulatedDistanceKm, null, transportMode);

  return {
    formattedAddress: cleanQuery,
    salonFormattedAddress,
    lat: targetSalonLat - 0.03,
    lng: targetSalonLng - 0.03,
    salonLat: targetSalonLat,
    salonLng: targetSalonLng,
    distanceKm: simulatedDistanceKm,
    etaMinutes: simulatedEtaMinutes,
  };
}

/**
 * Calcula o Horário Máximo de Saída (ex: "13H20") com base no horário agendado (ex: "14:00") e no tempo de trajeto (etaMinutes)
 */
export function formatMaxDepartureTime(timeSlot: string, etaMinutes: number): string {
  const [sh, sm] = String(timeSlot || '').split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm)) return '--H--';
  const totalAppointmentMinutes = sh * 60 + sm;
  const departureMinutes = Math.max(0, totalAppointmentMinutes - Math.max(0, etaMinutes));
  const clamped = Math.min(23 * 60 + 59, departureMinutes);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}H${String(m).padStart(2, '0')}`;
}

/**
 * Gera Deep Links Universais (Google Maps com modo exato e baldeações, Waze, Uber e 99) já com origem e destino preenchidos
 */
export function buildTransportDeepLinks(params: {
  originAddress?: string;
  originLat?: number;
  originLng?: number;
  salonName?: string;
  salonAddress?: string;
  salonLat?: number;
  salonLng?: number;
  transportMode?: TransportMode;
}) {
  const originCoordStr =
    typeof params.originLat === 'number' && typeof params.originLng === 'number'
      ? `${params.originLat},${params.originLng}`
      : '';
  const salonCoordStr =
    typeof params.salonLat === 'number' && typeof params.salonLng === 'number'
      ? `${params.salonLat},${params.salonLng}`
      : '';

  const originQuery = (params.originAddress || originCoordStr || '').trim();
  const destLabel = [params.salonName, params.salonAddress].filter(Boolean).join(' - ').trim() || salonCoordStr;
  const destAddressOnly = (params.salonAddress || params.salonName || salonCoordStr || 'Estabelecimento').trim();

  const googleTravelMode =
    params.transportMode === 'transit'
      ? 'transit'
      : params.transportMode === 'motorcycle'
      ? 'two-wheeler'
      : 'driving';

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    originQuery || originCoordStr
  )}&destination=${encodeURIComponent(destAddressOnly || salonCoordStr)}&travelmode=${googleTravelMode}`;

  const googleMapsTransitUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    originQuery || originCoordStr
  )}&destination=${encodeURIComponent(destAddressOnly || salonCoordStr)}&travelmode=transit`;

  const wazeUrl = salonCoordStr
    ? `https://waze.com/ul?ll=${salonCoordStr}&q=${encodeURIComponent(destAddressOnly)}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(destAddressOnly)}&navigate=yes`;

  // Deep Link Oficial Universal Uber (pré-preenche origem e endereço/coordenadas exatas do salão)
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

  // Deep Link 99 App com coordenadas e endereço do destino
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

export interface SlotGenerationOptions {
  travelMinutes?: number;
  prepMinutes?: number;
  busySlots?: Array<{ start_time: string; end_time?: string; professional_id?: string; professional_name?: string }>;
  nowOverride?: Date;
}

/**
 * Gera os horários do dia classificados por período (manhã, tarde, noite),
 * aplicando bloqueio de banco de dados (busySlots) e a regra preditiva:
 * Disponível apenas se Horário >= Hora Atual + Tempo de Deslocamento + 15 min (preparação)
 */
export function getAvailableSlotsForDate(
  dateStr?: string,
  _serviceOrProId?: string,
  options?: SlotGenerationOptions
): BookingSlotItem[] {
  const baseSlots: Array<{ time: string; period: 'manha' | 'tarde' | 'noite' }> = [
    { time: '08:00', period: 'manha' },
    { time: '08:30', period: 'manha' },
    { time: '09:00', period: 'manha' },
    { time: '09:30', period: 'manha' },
    { time: '10:00', period: 'manha' },
    { time: '10:30', period: 'manha' },
    { time: '11:00', period: 'manha' },
    { time: '11:30', period: 'manha' },
    { time: '12:00', period: 'tarde' },
    { time: '12:30', period: 'tarde' },
    { time: '13:00', period: 'tarde' },
    { time: '13:30', period: 'tarde' },
    { time: '14:00', period: 'tarde' },
    { time: '14:30', period: 'tarde' },
    { time: '15:00', period: 'tarde' },
    { time: '15:30', period: 'tarde' },
    { time: '16:00', period: 'tarde' },
    { time: '16:30', period: 'tarde' },
    { time: '17:00', period: 'tarde' },
    { time: '17:30', period: 'tarde' },
    { time: '18:00', period: 'noite' },
    { time: '18:30', period: 'noite' },
    { time: '19:00', period: 'noite' },
    { time: '19:30', period: 'noite' },
    { time: '20:00', period: 'noite' },
    { time: '20:30', period: 'noite' },
  ];

  const now = options?.nowOverride || new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = Boolean(dateStr && dateStr === todayIso);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const travelMinutes = Math.max(0, options?.travelMinutes ?? 15);
  const prepMinutes = Math.max(0, options?.prepMinutes ?? 15);
  const minAllowedMinutesForToday = nowMinutes + travelMinutes + prepMinutes;

  const busySet = new Set(
    (options?.busySlots || []).map((b) => String(b.start_time).slice(0, 5))
  );

  return baseSlots.map((slot) => {
    const [h, m] = slot.time.split(':').map(Number);
    const slotMinutes = h * 60 + m;

    // 1. Verifica ocupação no banco de dados
    if (busySet.has(slot.time)) {
      return {
        ...slot,
        available: false,
        reason: 'busy',
      };
    }

    // 2. Se for para Hoje, bloqueia horas passadas e slots inferiores a (Hora Atual + Deslocamento + 15 min preparo)
    if (isToday) {
      if (slotMinutes <= nowMinutes) {
        return {
          ...slot,
          available: false,
          reason: 'past',
        };
      }
      if (slotMinutes < minAllowedMinutesForToday) {
        return {
          ...slot,
          available: false,
          reason: 'travel_buffer',
        };
      }
    }

    return {
      ...slot,
      available: true,
    };
  });
}

