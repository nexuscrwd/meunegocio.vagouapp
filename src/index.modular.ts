// ============================================================================
// EXPORTS CENTRALIZADOS — VagouApp Meu Negócio (Modular)
// ============================================================================

// Types (re-export explícito para evitar duplicatas)
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
  BookingConfirmData,
  BookingConfirmResult,
  BookingDraftItem,
  BookingSlotItem,
  SlotGenerationOptions,
  BusySlotRecord,
  SalonProfessionalItem,
  CatalogServiceItem,
  UserFamilyDependent,
  RelationshipType,
  PeriodKey,
} from './types/booking';

export {
  PREP_BUFFER_MINUTES,
  STORAGE_KEYS,
  BOOKING_DRAFT_STORAGE_KEY,
  TRANSPORT_MODE_DB_MAP,
  TRANSPORT_MODE_UI_LABELS,
  TRANSPORT_MODE_META,
  mapUiTransportModeToDb,
} from './types/booking';

// Services
export * from './services/transportService';
export * from './services/geocodeService';
export * from './services/bookingService';

// Hooks
export * from './hooks/useTransportCalculator';
export * from './hooks/useBookingFlow';

// Components - Modals
export { BeneficiaryModal } from './components/modals/BeneficiaryModal';
export { OriginModal } from './components/modals/OriginModal';
export { SummaryModal } from './components/modals/SummaryModal';
export { ConfirmIntentModal } from './components/modals/ConfirmIntentModal';

// Components - Steps
export { ServiceSelectionStep } from './components/steps/ServiceSelectionStep';
export { DateSelectionStep } from './components/steps/DateSelectionStep';
export { ProfessionalTimeStep } from './components/steps/ProfessionalTimeStep';

// Components - Main
export { SalonBookingModal } from './components/SalonBookingModal.new';
export { SalonClientAuthModal } from './components/SalonClientAuthModal';

// Utils
export { hapticLight, hapticMedium, hapticSuccess } from './utils/haptics';
export { formatMaxDepartureTime, formatDistanceKm, formatEtaMinutes, buildTransportDeepLinks, TRANSPORT_MODE_META, mapUiTransportModeToDb } from './services/transportService';
export { geocodeBrazilLocation, clearGeocodeCache, getGeocodeCacheStats, warmupGeocodeCache } from './services/geocodeService';
export { validateBookingConfirmData, validateDraftData, getSavedBookingDraft, saveBookingDraft, createBookingDraftFromState, confirmAppointmentInDatabase, loadClientDependents, saveDependentToDatabase, fetchBusySlotsDirectly, fetchAvailableProfessionalsForDate, getAvailableSlotsForDate } from './services/bookingService';
export { PREP_BUFFER_MINUTES, STORAGE_KEYS, BOOKING_DRAFT_STORAGE_KEY } from './types/booking';