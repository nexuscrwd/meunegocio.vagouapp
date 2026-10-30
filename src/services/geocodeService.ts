/**
 * Serviço de Geocodificação Brasil — VagouApp Meu Negócio
 * 
 * Extraído de transportService para separação de responsabilidades.
 * Responsável exclusivamente por resolver endereços/CEPs em coordenadas.
 * 
 * Provedores em cascata (ordem de prioridade):
 * 1. AwesomeAPI CEP — coordenadas diretas, mais rápido
 * 2. BrasilAPI CEP v2 — coordenadas oficiais IBGE/Correios
 * 3. ViaCEP + Nominatim OpenStreetMap — busca estruturada
 * 4. Nominatim livre — endereço textual qualquer
 * 
 * Features:
 * - Cache em memória (TTL configurável)
 * - Timeout + AbortController por request
 * - Retry exponencial
 * - Formatação consistente de endereços (abreviações PT-BR)
 */

import type { GeocodeResult, Coordinates } from '../types/booking';

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const GEOCODE_TIMEOUT_MS = 5000;
const GEOCODE_MAX_RETRIES = 2;
const GEOCODE_RETRY_DELAY_MS = 500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CacheEntry {
  result: GeocodeResult;
  timestamp: number;
}

const geocodeCache = new Map<string, CacheEntry>();

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function toCacheKey(query: string): string {
  const onlyDigits = query.replace(/\D/g, '');
  return onlyDigits.length === 8 ? `cep:${onlyDigits}` : `addr:${query.toLowerCase()}`;
}

function getCached(key: string): GeocodeResult | null {
  const entry = geocodeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    geocodeCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: GeocodeResult): void {
  geocodeCache.set(key, { result, timestamp: Date.now() });
}

// ============================================================================
// FETCH COM TIMEOUT E RETRY
// ============================================================================

interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

async function fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = GEOCODE_TIMEOUT_MS, maxRetries = GEOCODE_MAX_RETRIES, retryDelayMs = GEOCODE_RETRY_DELAY_MS, ...fetchOptions } = options;
  
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
// FORMATAÇÃO DE ENDEREÇOS (ABREVIAÇÕES PT-BR)
// ============================================================================

const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  'Avenida': 'Av.', 'Praça': 'Pça.', 'Alameda': 'Al.', 'Travessa': 'Trav.',
  'Rua': 'R.', 'Estrada': 'Estr.', 'Rodovia': 'Rod.', 'Largo': 'Lg.',
  'Viela': 'Vl.', 'Beco': 'Bc.', 'Conjunto': 'Conj.', 'Condomínio': 'Cond.',
  'Parque': 'Pq.', 'Jardim': 'Jd.', 'Vila': 'Vl.',
  'Doutor': 'Dr.', 'Doutora': 'Dra.', 'Professora': 'Prof.', 'Professor': 'Prof.',
  'Engenheiro': 'Eng.', 'Capitão': 'Cap.', 'Coronel': 'Cel.', 'General': 'Gen.',
  'Marechal': 'Mal.', 'Presidente': 'Pres.', 'Governador': 'Gov.',
  'Senador': 'Sen.', 'Deputado': 'Dep.',
};

function abbreviateAddress(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/\b(Avenida|Praça|Alameda|Travessa|Rua|Estrada|Rodovia|Largo|Viela|Beco|Conjunto|Condomínio|Parque|Jardim|Vila|Doutor|Doutora|Professora|Professor|Engenheiro|Capitão|Coronel|General|Marechal|Presidente|Governador|Senador|Deputado)\b/gi, 
      (match) => ADDRESS_ABBREVIATIONS[match] || match);
}

function formatCepAddress(street: string, neighborhood: string, city: string, state: string, fallback: string): string {
  const parts = [
    abbreviateAddress(street),
    abbreviateAddress(neighborhood),
    city?.trim(),
    state?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : fallback;
}

// ============================================================================
// PROVEDORES DE CEP (8 DÍGITOS)
// ============================================================================

async function geocodeViaAwesomeAPI(cep: string): Promise<GeocodeResult | null> {
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
  return null;
}

async function geocodeViaBrasilAPI(cep: string): Promise<GeocodeResult | null> {
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
  return null;
}

async function geocodeViaViaCEPNominatim(cep: string): Promise<GeocodeResult | null> {
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

// ============================================================================
// ENDEREÇO TEXTUAL LIVRE
// ============================================================================

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

// ============================================================================
// API PÚBLICA
// ============================================================================

/**
 * Geocodifica CEP ou endereço textual usando provedores brasileiros em cascata.
 * Retorna null se não encontrar.
 * 
 * @param query - CEP (8 dígitos) ou endereço textual (ex: "Av. Paulista, 1000, São Paulo")
 * @returns GeocodeResult com lat, lng, formattedAddress, cep (opcional)
 */
export async function geocodeBrazilLocation(query: string): Promise<GeocodeResult | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;
  
  const cacheKey = toCacheKey(cleanQuery);
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  const onlyDigits = cleanQuery.replace(/\D/g, '');
  let result: GeocodeResult | null = null;
  
  // FLUXO A: CEP de 8 dígitos — cascata de provedores
  if (onlyDigits.length === 8) {
    result = await geocodeViaAwesomeAPI(onlyDigits);
    if (!result) result = await geocodeViaBrasilAPI(onlyDigits);
    if (!result) result = await geocodeViaViaCEPNominatim(onlyDigits);
  }
  
  // FLUXO B: Endereço textual livre
  if (!result) {
    result = await geocodeFreeText(cleanQuery);
  }
  
  if (result) {
    setCache(cacheKey, result);
    return result;
  }
  
  return null;
}

/**
 * Geocodifica múltiplos endereços em paralelo (para batch).
 * Útil para pré-carregar destinos conhecidos.
 */
export async function geocodeBatch(queries: string[]): Promise<Map<string, GeocodeResult | null>> {
  const results = new Map<string, GeocodeResult | null>();
  await Promise.all(
    queries.map(async (q) => {
      const result = await geocodeBrazilLocation(q);
      results.set(q, result);
    })
  );
  return results;
}

/**
 * Limpa o cache de geocodificação.
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}

/**
 * Retorna estatísticas do cache.
 */
export function getGeocodeCacheStats(): { size: number; keys: string[] } {
  return {
    size: geocodeCache.size,
    keys: Array.from(geocodeCache.keys()),
  };
}

/**
 * Pré-aquece o cache com CEPs/endereços conhecidos.
 * Útil no bootstrap da aplicação.
 */
export async function warmupGeocodeCache(queries: string[]): Promise<void> {
  await geocodeBatch(queries);
}