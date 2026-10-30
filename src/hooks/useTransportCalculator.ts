/**
 * Hook de Transporte — VagouApp Meu Negócio
 * 
 * Encapsula toda a lógica de cálculo de rota, ETA, deep links e formatação
 * para uso fácil em componentes React. Isola side effects (fetch OSRM) e
 * expõe estado reativo + ações tipadas.
 * 
 * Responsabilidades:
 * - Gerenciar estado de origem/destino/transporte
 * - Calcular rota real (OSRM) ou fallback (Haversine)
 * - Gerar deep links de navegação
 * - Formatar dados para UI (distância, ETA, horário máx saída)
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type {
  TransportMode,
  Coordinates,
  RouteResult,
  ResolvedRoute,
  TransportDeepLinks,
  BuildDeepLinksParams,
} from '../types/booking';
import {
  calculateDrivingRouteDistanceAndEta,
  resolveAddressDistanceToSalon,
  formatMaxDepartureTime,
  buildTransportDeepLinks,
  formatDistanceKm,
  formatEtaMinutes,
  TRANSPORT_MODE_META,
  mapUiTransportModeToDb,
  type TransportMeta,
} from '../services/transportService';
import { geocodeBrazilLocation } from '../services/geocodeService';

// ============================================================================
// TIPOS DO HOOK
// ============================================================================

export interface UseTransportCalculatorState {
  // Entrada do usuário
  transportMode: TransportMode;
  originAddress: string;
  originCoords: Coordinates | null;
  salonCoords: Coordinates;
  salonAddress: string;
  
  // Resultado do cálculo
  route: RouteResult | null;
  resolvedRoute: ResolvedRoute | null;
  
  // Estado de loading/erro
  isCalculating: boolean;
  error: string | null;
  
  // Deep links gerados
  deepLinks: TransportDeepLinks | null;
  
  // Horário máximo de saída
  maxDepartureTime: string | null;
}

export interface UseTransportCalculatorActions {
  // Setters de entrada
  setTransportMode: (mode: TransportMode) => void;
  setOriginAddress: (address: string) => void;
  setSalonCoords: (coords: Coordinates) => void;
  setSalonAddress: (address: string) => void;
  
  // Ações principais
  calculateRoute: () => Promise<void>;
  geocodeOrigin: () => Promise<void>;
  geocodeSalon: () => Promise<void>;
  
  // Utilitários
  clearError: () => void;
  reset: () => void;
}

export interface UseTransportCalculatorReturn extends UseTransportCalculatorState, UseTransportCalculatorActions {
  // Helpers de formatação (memoizados)
  formatDistance: (km: number) => string;
  formatEta: (minutes: number) => string;
  getModeMeta: (mode: TransportMode) => TransportMeta;
  mapModeToDb: (uiMode: TransportMode) => 'driving' | 'motorcycle' | 'walking' | 'transit';
  
  // Estado derivado
  isReady: boolean;
  hasValidRoute: boolean;
}

// ============================================================================
// ESTADO INICIAL
// ============================================================================

const initialState: UseTransportCalculatorState = {
  transportMode: 'car',
  originAddress: '',
  originCoords: null,
  salonCoords: { lat: -23.5621, lng: -46.4795 }, // Default GRU
  salonAddress: '',
  route: null,
  resolvedRoute: null,
  isCalculating: false,
  error: null,
  deepLinks: null,
  maxDepartureTime: null,
};

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useTransportCalculator(
  initialOriginAddress?: string,
  initialSalonCoords?: Coordinates,
  initialSalonAddress?: string
): UseTransportCalculatorReturn {
  const [state, setState] = useState<UseTransportCalculatorState>(() => ({
    ...initialState,
    originAddress: initialOriginAddress || '',
    salonCoords: initialSalonCoords || initialState.salonCoords,
    salonAddress: initialSalonAddress || '',
  }));
  
  // ============================================================================
  // SETTERS SIMPLES
  // ============================================================================
  
  const setTransportMode = useCallback((mode: TransportMode) => {
    setState(prev => ({ ...prev, transportMode: mode, error: null }));
  }, []);
  
  const setOriginAddress = useCallback((address: string) => {
    setState(prev => ({ ...prev, originAddress: address, error: null }));
  }, []);
  
  const setSalonCoords = useCallback((coords: Coordinates) => {
    setState(prev => ({ ...prev, salonCoords: coords }));
  }, []);
  
  const setSalonAddress = useCallback((address: string) => {
    setState(prev => ({ ...prev, salonAddress: address }));
  }, []);
  
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);
  
  const reset = useCallback(() => {
    setState(initialState);
  }, []);
  
  // ============================================================================
  // GEOCODIFICAÇÃO
  // ============================================================================
  
  const geocodeOrigin = useCallback(async () => {
    if (!state.originAddress.trim()) {
      setState(prev => ({ ...prev, error: 'Informe um endereço ou CEP de origem' }));
      return;
    }
    
    setState(prev => ({ ...prev, isCalculating: true, error: null }));
    
    try {
      const result = await geocodeBrazilLocation(state.originAddress);
      if (result) {
        setState(prev => ({
          ...prev,
          originCoords: { lat: result.lat, lng: result.lng },
          originAddress: result.formattedAddress,
          isCalculating: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Não foi possível localizar o endereço. Verifique o CEP/endereço.',
          isCalculating: false,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Erro ao buscar endereço. Tente novamente.',
        isCalculating: false,
      }));
    }
  }, [state.originAddress]);
  
  const geocodeSalon = useCallback(async () => {
    if (!state.salonAddress.trim()) {
      setState(prev => ({ ...prev, error: 'Informe endereço/CEP do salão' }));
      return;
    }
    
    setState(prev => ({ ...prev, isCalculating: true, error: null }));
    
    try {
      const result = await geocodeBrazilLocation(state.salonAddress);
      if (result) {
        setState(prev => ({
          ...prev,
          salonCoords: { lat: result.lat, lng: result.lng },
          salonAddress: result.formattedAddress,
          isCalculating: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Não foi possível localizar o salão.',
          isCalculating: false,
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Erro ao buscar salão. Tente novamente.',
        isCalculating: false,
      }));
    }
  }, [state.salonAddress]);
  
  // ============================================================================
  // CÁLCULO DE ROTA PRINCIPAL
  // ============================================================================
  
  const calculateRoute = useCallback(async () => {
    if (!state.originAddress.trim()) {
      setState(prev => ({ ...prev, error: 'Informe endereço de origem' }));
      return;
    }
    
    // Se não tem coords da origem, tenta geocodificar primeiro
    if (!state.originCoords) {
      await geocodeOrigin();
      if (!state.originCoords) return; // geocodeOrigin já setou erro
    }
    
    setState(prev => ({ ...prev, isCalculating: true, error: null }));
    
    try {
      // Usa resolveAddressDistanceToSalon que já faz geocode do salão se necessário
      const resolved = await resolveAddressDistanceToSalon(
        state.originAddress,
        state.salonCoords,
        state.salonAddress || undefined,
        state.transportMode
      );
      
      // Gera deep links
      const deepLinks = buildTransportDeepLinks({
        originAddress: resolved.formattedAddress,
        originLat: resolved.originCoords.lat,
        originLng: resolved.originCoords.lng,
        salonName: 'Salão',
        salonAddress: resolved.salonFormattedAddress,
        salonLat: resolved.salonCoords.lat,
        salonLng: resolved.salonCoords.lng,
        transportMode: state.transportMode,
      });
      
      setState(prev => ({
        ...prev,
        route: {
          distanceKm: resolved.distanceKm,
          etaMinutes: resolved.etaMinutes,
          routeSummary: resolved.routeSummary,
          source: resolved.source,
          rawOsrmMinutes: resolved.rawOsrmMinutes,
        },
        resolvedRoute: resolved,
        deepLinks,
        maxDepartureTime: null, // Será calculado quando houver timeSlot
        isCalculating: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Erro ao calcular rota. Verifique os endereços e tente novamente.',
        isCalculating: false,
      }));
    }
  }, [state.originAddress, state.originCoords, state.salonCoords, state.salonAddress, state.transportMode]);
  
  // ============================================================================
  // EFEITO: Recalcular quando modalidade muda
  // ============================================================================
  
  useEffect(() => {
    if (state.originCoords && state.salonCoords && !state.isCalculating) {
      calculateRoute();
    }
  }, [state.transportMode, calculateRoute]);
  
  // ============================================================================
  // HELPERS MEMOIZADOS
  // ============================================================================
  
  const formatDistance = useCallback((km: number) => formatDistanceKm(km), []);
  const formatEta = useCallback((minutes: number) => formatEtaMinutes(minutes), []);
  const getModeMeta = useCallback((mode: TransportMode) => TRANSPORT_MODE_META[mode], []);
  const mapModeToDb = useCallback((uiMode: TransportMode) => mapUiTransportModeToDb(uiMode), []);
  
  // ============================================================================
  // ESTADO DERIVADO
  // ============================================================================
  
  const isReady = state.originCoords !== null && state.salonCoords !== null;
  const hasValidRoute = state.route !== null && state.route.distanceKm > 0;
  
  // ============================================================================
  // ATUALIZAÇÃO DE MAX DEPARTURE TIME (quando timeSlot muda externamente)
  // ============================================================================
  
  const updateMaxDepartureTime = useCallback((timeSlot: string | null) => {
    if (timeSlot && state.route) {
      const maxDep = formatMaxDepartureTime(timeSlot, state.route.etaMinutes);
      setState(prev => ({ ...prev, maxDepartureTime: maxDep }));
    } else {
      setState(prev => ({ ...prev, maxDepartureTime: null }));
    }
  }, [state.route]);
  
  // ============================================================================
  // RETORNO
  // ============================================================================
  
  return {
    // Estado
    ...state,
    
    // Actions
    setTransportMode,
    setOriginAddress,
    setSalonCoords,
    setSalonAddress,
    calculateRoute,
    geocodeOrigin,
    geocodeSalon,
    clearError,
    reset,
    updateMaxDepartureTime, // Exposto para componente pai chamar quando timeSlot muda
    
    // Helpers
    formatDistance,
    formatEta,
    getModeMeta,
    mapModeToDb,
    
    // Derivado
    isReady,
    hasValidRoute,
  };
}

// ============================================================================
// HOOK SIMPLIFICADO — Apenas cálculo síncrono (Haversine) para preview rápido
// ============================================================================

import { calculateHaversineDistanceAndEta } from '../services/transportService';

export function useQuickEta(
  originCoords: Coordinates | null,
  salonCoords: Coordinates | null,
  mode: TransportMode = 'car'
): { distanceKm: number; etaMinutes: number } | null {
  return useMemo(() => {
    if (!originCoords || !salonCoords) return null;
    return calculateHaversineDistanceAndEta(
      originCoords.lat,
      originCoords.lng,
      salonCoords.lat,
      salonCoords.lng,
      mode
    );
  }, [originCoords, salonCoords, mode]);
}