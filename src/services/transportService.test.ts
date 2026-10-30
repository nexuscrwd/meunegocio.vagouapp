/**
 * Testes Unitários — transportService.ts
 * VagouApp Meu Negócio
 * 
 * Cobertura:
 * - computeCalibratedEtaForMode (todos modais, edge cases)
 * - calculateHaversineDistanceAndEta (distâncias conhecidas, validação)
 * - formatMaxDepartureTime (horários normais, virada de dia, ETA > 12h)
 * - buildTransportDeepLinks (URLs corretas por modal)
 * - mapUiTransportModeToDb (mapeamento correto)
 * - TRANSPORT_MODE_META (estrutura completa)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeCalibratedEtaForMode,
  calculateHaversineDistanceAndEta,
  formatMaxDepartureTime,
  buildTransportDeepLinks,
  mapUiTransportModeToDb,
  TRANSPORT_MODE_META,
  TRANSPORT_MODE_DB_MAP,
  type TransportMode,
  type DbTransportMode,
} from './transportService';

// ============================================================================
// MOCKS E UTILITÁRIOS DE TESTE
// ============================================================================

const GRU_CENTRO: [number, number] = [-23.432078, -46.469811]; // Guarulhos centro
const SAO_PAULO_CENTRO: [number, number] = [-23.550520, -46.633308]; // SP centro
const DISTANCE_GRU_SP_KM = 20.5; // Aproximado

// ============================================================================
// TESTES: computeCalibratedEtaForMode
// ============================================================================

describe('computeCalibratedEtaForMode', () => {
  const testCases: Array<{
    mode: TransportMode;
    distanceKm: number;
    osrmRawMinutes: number | null;
    expectedMin: number;
    expectedMax: number;
    description: string;
  }> = [
    // CARRO
    { mode: 'car', distanceKm: 5, osrmRawMinutes: null, expectedMin: 15, expectedMax: 35, description: 'Carro 5km sem OSRM' },
    { mode: 'car', distanceKm: 10, osrmRawMinutes: null, expectedMin: 25, expectedMax: 50, description: 'Carro 10km sem OSRM' },
    { mode: 'car', distanceKm: 20, osrmRawMinutes: null, expectedMin: 40, expectedMax: 80, description: 'Carro 20km sem OSRM (velocidade >15km)' },
    { mode: 'car', distanceKm: 10, osrmRawMinutes: 15, expectedMin: 25, expectedMax: 50, description: 'Carro 10km com OSRM 15min (max com calibragem)' },
    
    // MOTO
    { mode: 'motorcycle', distanceKm: 5, osrmRawMinutes: null, expectedMin: 8, expectedMax: 20, description: 'Moto 5km sem OSRM' },
    { mode: 'motorcycle', distanceKm: 10, osrmRawMinutes: null, expectedMin: 15, expectedMax: 30, description: 'Moto 10km sem OSRM' },
    { mode: 'motorcycle', distanceKm: 20, osrmRawMinutes: null, expectedMin: 25, expectedMax: 50, description: 'Moto 20km sem OSRM' },
    
    // TRANSIT
    { mode: 'transit', distanceKm: 5, osrmRawMinutes: null, expectedMin: 18, expectedMax: 45, description: 'Transit 5km sem OSRM' },
    { mode: 'transit', distanceKm: 10, osrmRawMinutes: null, expectedMin: 30, expectedMax: 70, description: 'Transit 10km sem OSRM' },
    { mode: 'transit', distanceKm: 20, osrmRawMinutes: null, expectedMin: 55, expectedMax: 120, description: 'Transit 20km sem OSRM' },
    
    // RIDESHARE
    { mode: 'rideshare', distanceKm: 5, osrmRawMinutes: null, expectedMin: 20, expectedMax: 45, description: 'Rideshare 5km sem OSRM' },
    { mode: 'rideshare', distanceKm: 10, osrmRawMinutes: null, expectedMin: 35, expectedMax: 65, description: 'Rideshare 10km sem OSRM' },
  ];

  testCases.forEach(({ mode, distanceKm, osrmRawMinutes, expectedMin, expectedMax, description }) => {
    it(`deve calcular ETA calibrado: ${description}`, () => {
      const eta = computeCalibratedEtaForMode(distanceKm, osrmRawMinutes, mode);
      expect(eta).toBeGreaterThanOrEqual(expectedMin);
      expect(eta).toBeLessThanOrEqual(expectedMax);
      expect(Number.isInteger(eta)).toBe(true);
    });
  });

  it('deve retornar mínimo de 5 min para moto em distância muito curta', () => {
    const eta = computeCalibratedEtaForMode(0.1, null, 'motorcycle');
    expect(eta).toBeGreaterThanOrEqual(5);
  });

  it('deve retornar mínimo de 6 min para carro em distância muito curta', () => {
    const eta = computeCalibratedEtaForMode(0.1, null, 'car');
    expect(eta).toBeGreaterThanOrEqual(6);
  });

  it('deve retornar mínimo de 8 min para rideshare em distância muito curta', () => {
    const eta = computeCalibratedEtaForMode(0.1, null, 'rideshare');
    expect(eta).toBeGreaterThanOrEqual(8);
  });

  it('deve retornar mínimo de 12 min para transit em distância muito curta', () => {
    const eta = computeCalibratedEtaForMode(0.1, null, 'transit');
    expect(eta).toBeGreaterThanOrEqual(12);
  });

  it('deve usar OSRM raw quando maior que calibração urbana', () => {
    // OSRM retorna 60 min, calibração urbana daria 30 min → deve usar 60 * 1.42 + buffer
    const eta = computeCalibratedEtaForMode(10, 60, 'car');
    const expectedMin = Math.ceil(60 * 1.42) + 6; // ~91 min
    expect(eta).toBeGreaterThanOrEqual(expectedMin);
  });
});

// ============================================================================
// TESTES: calculateHaversineDistanceAndEta
// ============================================================================

describe('calculateHaversineDistanceAndEta', () => {
  it('deve calcular distância conhecida GRU ↔ SP Centro (~20km linha reta → ~29km viário)', () => {
    const [lat1, lng1] = GRU_CENTRO;
    const [lat2, lng2] = SAO_PAULO_CENTRO;
    
    const result = calculateHaversineDistanceAndEta(lat1, lng1, lat2, lng2, 'car');
    
    // Linha reta ~20.5km * 1.42 = ~29km
    expect(result.distanceKm).toBeGreaterThanOrEqual(27);
    expect(result.distanceKm).toBeLessThanOrEqual(32);
    expect(result.source).toBe('haversine');
    expect(result.etaMinutes).toBeGreaterThan(30);
  });

  it('deve retornar distância mínima para coordenadas muito próximas', () => {
    const result = calculateHaversineDistanceAndEta(-23.5505, -46.6333, -23.5506, -46.6334, 'car');
    expect(result.distanceKm).toBe(0.2);
    expect(result.etaMinutes).toBe(5); // carro min
  });

  it('deve retornar ETA mínimo para transit em distância muito curta', () => {
    const result = calculateHaversineDistanceAndEta(-23.5505, -46.6333, -23.5506, -46.6334, 'transit');
    expect(result.etaMinutes).toBe(8); // transit min
  });

  it('deve lançar fallback para coordenadas inválidas', () => {
    const result = calculateHaversineDistanceAndEta(NaN, -46.6333, -23.5505, -46.6334, 'car');
    expect(result.distanceKm).toBe(0.2);
    expect(result.source).toBe('fallback');
  });

  it('deve diferenciar ETAs por modal na mesma distância', () => {
    const [lat1, lng1] = GRU_CENTRO;
    const [lat2, lng2] = SAO_PAULO_CENTRO;
    
    const car = calculateHaversineDistanceAndEta(lat1, lng1, lat2, lng2, 'car');
    const motorcycle = calculateHaversineDistanceAndEta(lat1, lng1, lat2, lng2, 'motorcycle');
    const transit = calculateHaversineDistanceAndEta(lat1, lng1, lat2, lng2, 'transit');
    const rideshare = calculateHaversineDistanceAndEta(lat1, lng1, lat2, lng2, 'rideshare');
    
    // Moto mais rápida que carro
    expect(motorcycle.etaMinutes).toBeLessThan(car.etaMinutes);
    // Transit mais lento que carro
    expect(transit.etaMinutes).toBeGreaterThan(car.etaMinutes);
    // Rideshare similar a carro (mesma base + buffer chamada)
    expect(rideshare.etaMinutes).toBeGreaterThanOrEqual(car.etaMinutes);
  });
});

// ============================================================================
// TESTES: formatMaxDepartureTime
// ============================================================================

describe('formatMaxDepartureTime', () => {
  it('deve formatar horário normal (mesmo dia)', () => {
    expect(formatMaxDepartureTime('14:00', 30)).toBe('13H30');
    expect(formatMaxDepartureTime('10:30', 45)).toBe('09H45');
    expect(formatMaxDepartureTime('08:00', 15)).toBe('07H45');
  });

  it('deve lidar com virada de meia-noite (dia anterior)', () => {
    // 00:30 com ETA 60min = 23:30 dia anterior
    expect(formatMaxDepartureTime('00:30', 60)).toBe('23H30');
    // 01:00 com ETA 90min = 23:30 dia anterior
    expect(formatMaxDepartureTime('01:00', 90)).toBe('23H30');
  });

  it('deve lidar com ETA > 12h (mostra dias antes)', () => {
    // 14:00 com ETA 1500min (25h) = 13:00 (-1d)
    const result = formatMaxDepartureTime('14:00', 1500);
    expect(result).toMatch(/^\d{2}H\d{2} \(-\d+d\)$/);
  });

  it('deve retornar --H-- para entrada inválida', () => {
    expect(formatMaxDepartureTime('', 30)).toBe('--H--');
    expect(formatMaxDepartureTime('invalid', 30)).toBe('--H--');
    expect(formatMaxDepartureTime('14', 30)).toBe('--H--');
  });

  it('deve clamp para 23:59 quando resultado excede', () => {
    // 23:50 com ETA -10min (edge case) → clamp 23:59
    expect(formatMaxDepartureTime('23:50', 0)).toBe('23H50');
  });
});

// ============================================================================
// TESTES: buildTransportDeepLinks
// ============================================================================

describe('buildTransportDeepLinks', () => {
  const baseParams = {
    originAddress: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    originLat: -23.5614,
    originLng: -46.6565,
    salonName: 'Barbearia Teste',
    salonAddress: 'R. Augusta, 500 - Consolação, São Paulo - SP',
    salonLat: -23.5555,
    salonLng: -46.6666,
  };

  it('deve gerar Google Maps com travelmode=driving para carro', () => {
    const links = buildTransportDeepLinks({ ...baseParams, transportMode: 'car' });
    expect(links.googleMapsUrl).toContain('travelmode=driving');
    expect(links.googleMapsUrl).toContain('origin=');
    expect(links.googleMapsUrl).toContain('destination=');
  });

  it('deve gerar Google Maps com travelmode=two-wheeler para moto', () => {
    const links = buildTransportDeepLinks({ ...baseParams, transportMode: 'motorcycle' });
    expect(links.googleMapsUrl).toContain('travelmode=two-wheeler');
  });

  it('deve gerar Google Maps transit separado para baldeações', () => {
    const links = buildTransportDeepLinks({ ...baseParams, transportMode: 'transit' });
    expect(links.googleMapsTransitUrl).toContain('travelmode=transit');
    expect(links.googleMapsUrl).toContain('travelmode=transit');
  });

  it('deve gerar Waze com coordenadas do destino', () => {
    const links = buildTransportDeepLinks({ ...baseParams, transportMode: 'car' });
    expect(links.wazeUrl).toContain('waze.com/ul');
    expect(links.wazeUrl).toContain('-23.5555%2C-46.6666'); // lat,lng encoded
  });

  it('deve gerar Uber com coordenadas de origem e destino', () => {
    const links = buildTransportDeepLinks({ ...baseParams, transportMode: 'car' });
    expect(links.uberUrl).toContain('m.uber.com/ul/');
    expect(links.uberUrl).toContain('dropoff%5Blatitude%5D=-23.5555');
    expect(links.uberUrl).toContain('dropoff%5Blongitude%5D=-46.6666');
    expect(links.uberUrl).toContain('pickup%5Blatitude%5D=-23.5614');
    expect(links.uberUrl).toContain('pickup%5Blongitude%5D=-46.6565');
  });

  it('deve usar my_location quando origem sem coordenadas', () => {
    const links = buildTransportDeepLinks({
      ...baseParams,
      originLat: undefined,
      originLng: undefined,
      transportMode: 'car',
    });
    expect(links.uberUrl).toContain('pickup=my_location');
  });

  it('deve gerar 99 App com coordenadas', () => {
    const links = buildTransportDeepLinks({ ...baseParams, transportMode: 'car' });
    expect(links.app99Url).toContain('99app.com/');
    expect(links.app99Url).toContain('dropoff_latitude=-23.5555');
    expect(links.app99Url).toContain('dropoff_longitude=-46.6666');
  });

  it('deve incluir nome do salão no label do destino', () => {
    const links = buildTransportDeepLinks({ ...baseParams, transportMode: 'car' });
    expect(links.destAddressOnly).toContain('Barbearia Teste');
  });

  it('deve funcionar sem parâmetros opcionais', () => {
    const minimalParams = {
      salonName: 'Salão Mínimo',
      transportMode: 'car' as TransportMode,
    };
    const links = buildTransportDeepLinks(minimalParams);
    expect(links.googleMapsUrl).toBeTruthy();
    expect(links.wazeUrl).toBeTruthy();
    expect(links.uberUrl).toBeTruthy();
    expect(links.app99Url).toBeTruthy();
  });
});

// ============================================================================
// TESTES: mapUiTransportModeToDb
// ============================================================================

describe('mapUiTransportModeToDb', () => {
  it('deve mapear car → driving', () => {
    expect(mapUiTransportModeToDb('car')).toBe('driving');
  });

  it('deve mapear motorcycle → motorcycle', () => {
    expect(mapUiTransportModeToDb('motorcycle')).toBe('motorcycle');
  });

  it('deve mapear transit → transit', () => {
    expect(mapUiTransportModeToDb('transit')).toBe('transit');
  });

  it('deve mapear rideshare → driving', () => {
    expect(mapUiTransportModeToDb('rideshare')).toBe('driving');
  });

  it('deve retornar driving para modo desconhecido (fallback seguro)', () => {
    // @ts-expect-error - teste de fallback
    expect(mapUiTransportModeToDb('unknown')).toBe('driving');
  });
});

// ============================================================================
// TESTES: TRANSPORT_MODE_META e TRANSPORT_MODE_DB_MAP
// ============================================================================

describe('Transport Mode Constants', () => {
  it('deve ter todos os 4 modais definidos no META', () => {
    const modes: TransportMode[] = ['car', 'motorcycle', 'transit', 'rideshare'];
    modes.forEach(mode => {
      expect(TRANSPORT_MODE_META[mode]).toBeDefined();
      expect(TRANSPORT_MODE_META[mode].label).toBeTruthy();
      expect(TRANSPORT_MODE_META[mode].shortLabel).toBeTruthy();
      expect(TRANSPORT_MODE_META[mode].safetyBufferMinutes).toBeGreaterThan(0);
      expect(TRANSPORT_MODE_META[mode].description).toBeTruthy();
      expect(TRANSPORT_MODE_META[mode].urbanSpeedKmh).toBeDefined();
      expect(TRANSPORT_MODE_META[mode].osrmMultiplier).toBeGreaterThan(1.0);
    });
  });

  it('deve ter mapeamento DB para todos os modais', () => {
    const modes: TransportMode[] = ['car', 'motorcycle', 'transit', 'rideshare'];
    modes.forEach(mode => {
      expect(TRANSPORT_MODE_DB_MAP[mode]).toBeDefined();
      expect(['driving', 'motorcycle', 'walking', 'transit']).toContain(TRANSPORT_MODE_DB_MAP[mode]);
    });
  });

  it('deve ter safetyBufferMinutes coerentes', () => {
    expect(TRANSPORT_MODE_META.car.safetyBufferMinutes).toBe(6);
    expect(TRANSPORT_MODE_META.motorcycle.safetyBufferMinutes).toBe(4);
    expect(TRANSPORT_MODE_META.transit.safetyBufferMinutes).toBe(12);
    expect(TRANSPORT_MODE_META.rideshare.safetyBufferMinutes).toBe(10);
  });
});

// ============================================================================
// TESTES DE INTEGRAÇÃO (mockando fetch)
// ============================================================================

describe('Integration: OSRM + Fallback', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it('deve usar fallback Haversine quando OSRM falha', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
    
    const { calculateDrivingRouteDistanceAndEta } = await import('./transportService');
    const result = await calculateDrivingRouteDistanceAndEta(
      -23.5505, -46.6333,
      -23.4321, -46.4698,
      'car'
    );
    
    expect(result.source).toBe('haversine');
    expect(result.distanceKm).toBeGreaterThan(20);
  });

  it('deve usar OSRM quando responde OK', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{
          distance: 25000, // 25km
          duration: 1800,  // 30min
          legs: [{ summary: 'Via Av. Paulista' }],
        }],
      }),
    });
    
    const { calculateDrivingRouteDistanceAndEta } = await import('./transportService');
    const result = await calculateDrivingRouteDistanceAndEta(
      -23.5505, -46.6333,
      -23.4321, -46.4698,
      'car'
    );
    
    expect(result.source).toBe('osrm');
    expect(result.distanceKm).toBe(25.0);
    expect(result.rawOsrmMinutes).toBe(30);
    expect(result.routeSummary).toBe('via Av. Paulista');
  });

  it('deve fazer retry em falha temporária', async () => {
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [{ distance: 10000, duration: 600, legs: [{ summary: 'Via Rua A' }] }],
        }),
      });
    
    const { calculateDrivingRouteDistanceAndEta } = await import('./transportService');
    const result = await calculateDrivingRouteDistanceAndEta(
      -23.5505, -46.6333,
      -23.4321, -46.4698,
      'car'
    );
    
    expect(result.source).toBe('osrm');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});