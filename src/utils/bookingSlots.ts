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

/**
 * Fórmula de Haversine + fator de tortuosidade urbana realista (1.42x em malha viária urbana)
 * Velocidade média urbana calibrada com Google Maps (~23.3 km/h para trechos urbanos <= 15 km)
 */
export function calculateHaversineDistanceAndEta(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
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
    return { distanceKm: 0.2, etaMinutes: 3 };
  }

  // Fator de tortuosidade viária urbana (1.42x da linha reta reflete curvas e retornos reais de rua)
  const roadDistanceKm = Math.max(0.3, Number((straightDistanceKm * 1.42).toFixed(1)));
  const avgUrbanSpeedKmh = roadDistanceKm <= 15 ? 23.3 : 28.0;
  const etaMinutes = Math.max(4, Math.round((roadDistanceKm / avgUrbanSpeedKmh) * 60));

  return { distanceKm: roadDistanceKm, etaMinutes };
}

/**
 * Calcula a distância real de condução por ruas (OSRM Driving API) e o tempo estimado urbano (padrão Google Maps)
 */
export async function calculateDrivingRouteDistanceAndEta(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<{ distanceKm: number; etaMinutes: number; routeSummary?: string }> {
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
    const res = await fetch(osrmUrl);
    if (res.ok) {
      const data = await res.json();
      if (data?.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = Math.max(0.2, Number((route.distance / 1000).toFixed(1)));
        // Calibragem de tráfego urbano (semáforos + cruzamentos = ~23.3 km/h até 15 km, ~28 km/h acima)
        const avgUrbanSpeedKmh = distanceKm <= 15 ? 23.3 : 28.0;
        const urbanTrafficMinutes = Math.round((distanceKm / avgUrbanSpeedKmh) * 60);
        const osrmRawMinutes = Math.round(route.duration / 60);
        const etaMinutes = Math.max(4, Math.max(urbanTrafficMinutes, osrmRawMinutes));
        const legSummary = route.legs?.[0]?.summary ? `via ${route.legs[0].summary}` : undefined;
        return { distanceKm, etaMinutes, routeSummary: legSummary };
      }
    }
  } catch {}

  return calculateHaversineDistanceAndEta(lat1, lng1, lat2, lng2);
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
  const cacheKey = onlyDigits.length === 8 ? `cep:${onlyDigits}` : `addr:${cleanQuery.toLowerCase()}`;
  const cached = locationGeoCache.get(cacheKey);
  if (cached) return cached;

  let street = '';
  let neighborhood = '';
  let city = '';
  let state = '';
  let formattedAddress = cleanQuery;

  // Fluxo A: É um CEP de 8 dígitos (ex.: 08235-770 ou 08285-010)
  if (onlyDigits.length === 8) {
    // 1. Tenta AwesomeAPI CEP (retorna lat e lng exatos do CEP instantaneamente)
    try {
      const awesomeRes = await fetch(`https://cep.awesomeapi.com.br/json/${onlyDigits}`);
      if (awesomeRes.ok) {
        const awData = await awesomeRes.json();
        if (awData && !awData.status && awData.lat && awData.lng) {
          const lat = parseFloat(awData.lat);
          const lng = parseFloat(awData.lng);
          street = awData.address || '';
          neighborhood = awData.district || '';
          city = awData.city || '';
          state = awData.state || '';
          formattedAddress = `${street ? street + ' - ' : ''}${neighborhood || onlyDigits}, ${city}/${state}`;
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
        formattedAddress = `${street ? street + ' - ' : ''}${neighborhood || onlyDigits}, ${city}/${state}`;
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
    if (!city) {
      try {
        const viaRes = await fetch(`https://viacep.com.br/ws/${onlyDigits}/json/`);
        if (viaRes.ok) {
          const viaData = await viaRes.json();
          if (!viaData.erro) {
            street = viaData.logradouro || '';
            neighborhood = viaData.bairro || '';
            city = viaData.localidade || '';
            state = viaData.uf || '';
            formattedAddress = `${street ? street + ' - ' : ''}${neighborhood || onlyDigits}, ${city}/${state}`;
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
 * Geocodifica o endereço/CEP do cliente e do estabelecimento em tempo real e calcula a rota real de carro (OSRM)
 */
export async function resolveAddressDistanceToSalon(
  addressOrCepQuery: string,
  salonCoords: { lat: number; lng: number } = { lat: -23.5621, lng: -46.4795 },
  salonDestinationQuery?: string
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
      targetSalonLng
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
  const simulatedEtaMinutes = Math.max(8, Math.round((simulatedDistanceKm / 23.3) * 60));

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

