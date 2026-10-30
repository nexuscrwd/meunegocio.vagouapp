/**
 * Tipos centralizados do sistema de agendamento e navegação
 * VagouApp — Meu Negócio
 */

// ============================================================================
// MODAIS DE TRANSPORTE (UI + DB unificados)
// ============================================================================

export type TransportMode = 'car' | 'motorcycle' | 'transit' | 'rideshare';

export type DbTransportMode = 'driving' | 'motorcycle' | 'walking' | 'transit';

export const TRANSPORT_MODE_DB_MAP: Record<TransportMode, DbTransportMode> = {
  car: 'driving',
  motorcycle: 'motorcycle',
  transit: 'transit',
  rideshare: 'driving', // Uber/99 usam modo driving no banco
};

export function mapUiTransportModeToDb(uiMode: TransportMode): DbTransportMode {
  return TRANSPORT_MODE_DB_MAP[uiMode] || 'driving';
}

export const TRANSPORT_MODE_UI_LABELS: Record<TransportMode, { label: string; shortLabel: string; icon: string }> = {
  car: { label: 'Carro', shortLabel: 'Carro', icon: 'Car' },
  motorcycle: { label: 'Moto', shortLabel: 'Moto', icon: 'Bike' },
  transit: { label: 'Transporte Público', shortLabel: 'Transp. Público', icon: 'Bus' },
  rideshare: { label: 'App (Uber / 99)', shortLabel: 'Uber / 99', icon: 'Smartphone' },
};

// ============================================================================
// METADADOS DE CALIBRAGEM POR MODAL
// ============================================================================

export interface TransportMeta {
  label: string;
  shortLabel: string;
  safetyBufferMinutes: number;
  description: string;
  // Calibragem Google Maps (velocidade média urbana por faixa de distância)
  urbanSpeedKmh: { max15km: number; above15km: number };
  // Multiplicador sobre OSRM raw (1.0 = confia no OSRM, >1.0 = adiciona margem)
  osrmMultiplier: number;
  // Velocidade base moto/transit para fallback Haversine
  fallbackSpeedKmh?: { maxKm: number; speed: number };
}

export const TRANSPORT_MODE_META: Record<TransportMode, TransportMeta> = {
  car: {
    label: 'Carro',
    shortLabel: 'Carro',
    safetyBufferMinutes: 6,
    description: 'Trânsito urbano + 6 min de folga para semáforos/estacionar',
    urbanSpeedKmh: { max15km: 16.8, above15km: 22.0 },
    osrmMultiplier: 1.42,
  },
  motorcycle: {
    label: 'Moto',
    shortLabel: 'Moto',
    safetyBufferMinutes: 4,
    description: 'Rota rápida (corredor) + 4 min de margem de segurança',
    urbanSpeedKmh: { max15km: 24.5, above15km: 32.0 },
    osrmMultiplier: 1.12,
    fallbackSpeedKmh: { maxKm: 15, speed: 24.5 },
  },
  transit: {
    label: 'Transporte Público',
    shortLabel: 'Transp. Público',
    safetyBufferMinutes: 12,
    description: 'Ônibus/Metrô + caminhada e tempo de espera/baldeação',
    urbanSpeedKmh: { max15km: 12.5, above15km: 15.5 },
    osrmMultiplier: 1.85,
    fallbackSpeedKmh: { maxKm: 12, speed: 12.5 },
  },
  rideshare: {
    label: 'App (Uber / 99)',
    shortLabel: 'Uber / 99',
    safetyBufferMinutes: 10,
    description: 'Tempo de chamada do motorista + trajeto urbano com folga',
    urbanSpeedKmh: { max15km: 16.8, above15km: 22.0 },
    osrmMultiplier: 1.42,
  },
};

// ============================================================================
// RESULTADOS DE ROTA E GEOCODIFICAÇÃO
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  cep?: string;
}

export interface RouteResult {
  distanceKm: number;
  etaMinutes: number;
  routeSummary?: string;
  source: 'osrm' | 'haversine' | 'fallback';
  rawOsrmMinutes?: number;
}

export interface ResolvedRoute extends RouteResult {
  formattedAddress: string;
  salonFormattedAddress?: string;
  originCoords: Coordinates;
  salonCoords: Coordinates;
}

// ============================================================================
// DEEP LINKS DE NAVEGAÇÃO
// ============================================================================

export interface TransportDeepLinks {
  googleMapsUrl: string;
  googleMapsTransitUrl: string;
  wazeUrl: string;
  uberUrl: string;
  app99Url: string;
  destAddressOnly: string;
}

export interface BuildDeepLinksParams {
  originAddress?: string;
  originLat?: number;
  originLng?: number;
  salonName?: string;
  salonAddress?: string;
  salonLat?: number;
  salonLng?: number;
  transportMode?: TransportMode;
}

// ============================================================================
// DADOS DE AGENDAMENTO (para confirmação no banco)
// ============================================================================

export interface BookingConfirmData {
  service: {
    id: string;
    title: string;
    price: number;
    duration: string;
    category: string;
  };
  professional: string;
  professionalAvatar?: string;
  dateIso: string;
  dateFormatted: string;
  timeSlot: string;
  salonName: string;
  salonAddress: string;
  price: number;
  offerId?: string;
  isDependentBooking?: boolean;
  dependentId?: string;
  dependentName?: string;
  clientPhone?: string;
  notes?: string;
  // Campos preditivos (BOL-020)
  distanceKm?: number;
  etaMinutes?: number;
  prepBufferMinutes?: number;
  transportMode?: DbTransportMode;
  uiTransportMode?: TransportMode;
  maxDepartureTime?: string;
  originFormattedAddress?: string;
  originLat?: number;
  originLng?: number;
  salonLat?: number;
  salonLng?: number;
  selectedRouteSummary?: string;
}

export interface BookingConfirmResult {
  success: boolean;
  error?: string;
  appointmentId?: string;
}

// ============================================================================
// RASCUNHO DE AGENDAMENTO (localStorage)
// ============================================================================

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

// ============================================================================
// SLOTS DE HORÁRIO
// ============================================================================

export type PeriodKey = 'manha' | 'tarde' | 'noite';

export interface BookingSlotItem {
  time: string;
  available: boolean;
  period: PeriodKey;
  reason?: 'busy' | 'past' | 'travel_buffer';
}

export interface SlotGenerationOptions {
  travelMinutes?: number;
  prepMinutes?: number;
  busySlots?: BusySlotRecord[];
  availableProfessionals?: SalonProfessionalItem[];
  nowOverride?: Date;
}

export interface BusySlotRecord {
  start_time: string;
  end_time?: string;
  professional_id?: string;
  professional_name?: string;
  status?: string;
  notes?: string;
  service_title?: string;
}

// ============================================================================
// PROFISSIONAIS E SERVIÇOS (tipos existentes reexportados)
// ============================================================================

export interface SalonProfessionalItem {
  id: string;
  name: string;
  role: string;
  systemRole: 'admin' | 'member';
  avatar?: string;
  avatarUrl?: string;
  rating?: number;
  specialties: string[];
  workSchedule?: {
    startTime?: string;
    endTime?: string;
    days?: string[];
    status?: string;
    daysOff?: string[];
    absences?: string[];
    folgas?: string[];
  };
  isActive?: boolean;
}

export interface CatalogServiceItem {
  id: string;
  title: string;
  price: number;
  duration: string;
  category: string;
  displayMode?: 'image' | 'video' | 'slideshow';
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  photos?: string[];
}

// ============================================================================
// DEPENDENTES (Conta Família)
// ============================================================================

export type RelationshipType = 'son' | 'daughter' | 'spouse' | 'parent' | 'other';

export interface UserFamilyDependent {
  id: string;
  parent_client_id?: string;
  guardian_client_id?: string;
  full_name: string;
  relationship: RelationshipType;
  birth_date?: string;
  notes?: string;
  is_unlinked?: boolean;
  created_at: string;
}

// ============================================================================
// CONSTANTES DE NEGÓCIO
// ============================================================================

export const PREP_BUFFER_MINUTES = 15;
export const MIN_SLOT_INTERVAL_MINUTES = 30;
export const MAX_ADVANCE_BOOKING_DAYS = 60;

// Chaves localStorage unificadas
export const STORAGE_KEYS = {
  USER_CEP: 'vagou_user_cep',
  USER_ADDRESS: 'vagou_user_address',
  USER_PHONE: 'vagou_user_phone',
  USER_EMAIL: 'vagou_user_email',
  USER_DEPENDENTS: 'vagou_user_dependents',
  CLIENT_SESSION: 'vagou_client_session',
  SALON_DB_ID: 'vagou_salon_db_id',
  SALON_SLUG: 'vagou_salon_slug',
  TEAM_MEMBERS: 'vagou_salon_team_members',
  BOOKING_DRAFT: BOOKING_DRAFT_STORAGE_KEY,
} as const;