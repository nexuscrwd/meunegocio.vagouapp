export interface ServiceOffer {
  id: string;
  salonName: string;
  salonLogo?: string;
  professionalName: string;
  professionalAvatar?: string;
  serviceTitle: string;
  serviceCategory: 'cabelo' | 'barba' | 'unhas' | 'beleza' | 'estetica';
  price: number;
  originalPrice?: number;
  rating: number;
  ratingCount: number;
  distance: string;
  distanceMeters?: number;
  neighborhood: string;
  timeSlot: string;
  dayLabel: string;
  duration: string;
  imageUrl: string;
  lat: number;
  lng: number;
  featured?: boolean;

  mediaLevel?: 1 | 2 | 3;
  videoUrl?: string;
  galleryImages?: string[];
  expiresInMinutes?: number;
  expiresTimestamp?: number;
  activeViewers?: number;
  isFlashDeal?: boolean;
  isRecurring?: boolean;
  recurringCount?: number;
  brandColor?: string;
  brandGradient?: string;
  categoryIconKey?: 'cabelo' | 'barba' | 'unhas' | 'sobrancelha' | 'estetica' | 'beleza';
  description?: string;
  reviewsCount?: number;
  salonAddress?: string;
}

export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'vagou_app';

export interface BookingAppointment {
  id?: string;
  protocolCode: string;
  service?: string;
  serviceTitle?: string;
  serviceName?: string;
  professional?: string;
  professionalName?: string;
  professionalAvatar?: string | null;
  salonName: string;
  salonLogo?: string | null;
  dateTime: string;
  dayGroup?: string;
  time?: string;
  duration?: string;
  durationMinutes?: number;
  totalPrice: number;
  status: 'EM ANDAMENTO' | 'CONFIRMADO' | 'AGENDADO' | 'CONCLUÍDO' | 'CANCELADO' | 'PENDENTE' | 'ALTERADO' | 'BLOQUEADO' | 'concluido' | 'confirmado' | 'cancelado' | 'agendado' | 'em andamento' | 'pendente' | 'alterado' | 'bloqueado' | string;
  address?: string;
  qrCodeUrl?: string;
  customerName?: string;
  clientName?: string;
  customerPhone?: string;
  clientPhone?: string;
  customerEmail?: string;
  customerAvatar?: string | null;
  clientAvatar?: string | null;
  dateIso?: string;
  createdAt?: string;

  is_dependent?: boolean;
  dependent_id?: string;
  dependent_name?: string;
  client_user_id?: string;

  paymentMethod?: PaymentMethod;
  isPaid?: boolean;
  paidAt?: string;
  commissionRate?: number;
  commissionAmount?: number;
  platformFee?: number;

  isBlockedSlot?: boolean;
  blockReason?: string;

  swapRequest?: {
    isClientSwap: boolean;
    message?: string;
    clientA: {
      name: string;
      originalTime: string;
      requestedTime: string;
      phone?: string;
    };
    clientB: {
      name: string;
      originalTime: string;
      accepted: boolean;
      rejected?: boolean;
      phone?: string;
    };
    status: 'pending_client_b' | 'pending_salon_confirmation' | 'confirmed' | 'rejected' | 'completed';
    rejectedSlots?: string[];

    cascadeTargets?: SwapTargetQueueItem[];
    currentCascadeIndex?: number;
    timeoutSecondsPerTarget?: number;
    lastTargetUpdatedAt?: number;
  };

  service_location_type?: ServiceLocationType;
  transport_mode?: TransportMode;
  tracking_status?: LiveTrackingStatus;
  selected_route_summary?: string;
  route_polyline?: string;
  current_street_name?: string;
  route_checkpoints?: LiveRouteCheckpoint[];
  active_adversity?: LiveAdversityReport | null;
  delay_minutes?: number;
  client_lat?: number;
  client_lng?: number;
  distance_km?: number;
  eta_minutes?: number;
  prep_buffer_minutes?: number;
  cancellation_reason?: string;
  last_location_update?: string;
}

export type ServiceLocationType = 'in_salon' | 'home_delivery';

export type TransportMode = 'walking' | 'bicycling' | 'motorcycle' | 'car' | 'driving' | 'transit' | 'rideshare';

export type LiveTrackingStatus =
  | 'idle'
  | 'alerted'
  | 'hurry_confirmed'
  | 'on_way_no_map'
  | 'live_sharing'
  | 'arriving_5min'
  | 'arrived'
  | 'rescheduled'
  | 'cancelled';

export interface LiveAdversityReport {
  type: 'traffic' | 'roadwork' | 'parking' | 'other';
  label: string;
  street: string;
  addedMinutes: number;
  reportedAt: string;
}

export interface LiveRouteCheckpoint {
  street: string;
  distanceText?: string;
  status: 'passed' | 'current' | 'upcoming';
  timestamp?: string;
  adversity?: {
    type: string;
    label: string;
    addedMinutes: number;
  };
}

export interface SwapTargetQueueItem {
  slotTime: string;
  customerName?: string;
  customerPhone?: string;
  status: 'pending' | 'timeout' | 'rejected' | 'accepted';
  sentAt?: number;
  expiresAt?: number;
}

export interface ClientSwapGovernance {
  optIn: boolean;
  monthlyQuota: number;
  usedThisMonth: number;
  activeRejections: number;
  consecutiveTimeouts: number;
  isBannedFromRequesting: boolean;
}

export type UserPersona = 'cliente' | 'pro' | 'profissional' | 'admin';

export type FamilyRelationship = 'filho' | 'filha' | 'esposo' | 'esposa' | 'pai' | 'mae' | 'outro';
export type FamilyAutonomyLevel = 'parent_controlled' | 'teen_assisted' | 'emancipated';

export interface FamilyMember {
  id: string;
  name: string;
  relationship: FamilyRelationship;
  birthDate?: string;
  avatarUrl?: string;
  avatarEmoji?: string;
  gender?: 'M' | 'F' | 'O';
  notes?: string;
  autonomyLevel: FamilyAutonomyLevel;
  phone?: string;
  email?: string;
  emancipatedUserId?: string;
  createdAt?: string;
}

export interface UserFamilyDependent {
  id: string;
  parent_client_id?: string;
  full_name: string;
  relationship: 'son' | 'daughter' | 'spouse' | 'parent' | 'other';
  birth_date?: string;
  notes?: string;
  is_unlinked?: boolean;
  unlinked_at?: string;
  created_at?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  cpf?: string;
  address: string;
  avatarUrl?: string;
  swapGovernance?: ClientSwapGovernance;
  familyMembers?: FamilyMember[];
}

export type PixKeyType = 'cpf' | 'cnpj' | 'phone' | 'email' | 'evp';

export interface SalonPixKeyItem {
  id: string;
  type: PixKeyType;
  key: string;
  holderName?: string;
  institution?: string;
  isPrimary: boolean;
  verified?: boolean;
}

export interface DayOperatingHours {
  dayKey: 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';
  dayLabel: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  hasBreak?: boolean;
  breakStart?: string;
  breakEnd?: string;
  pauseReason?: string;
}

export interface OperatingSchedule {
  preset: 'salao' | 'comercial' | 'todos' | 'personalizado';
  days: DayOperatingHours[];
  defaultOpenTime?: string;
  defaultCloseTime?: string;
  professionalSchedules?: Record<string, DayOperatingHours[]>;
}

export interface SalonAdminSettings {
  salonName: string;
  salonSlug?: string;
  category?: string;
  email?: string;
  phoneLandline?: string;
  salonPhone: string;
  salonAddress: string;
  openingHours: string;
  isOpenNow: boolean;
  pinCode?: string;
  accentColor?: string;
  primaryColor?: string;
  secondaryColor?: string;
  themePresetId?: string;
  themeExplicitlyCustomized?: boolean;
  salonLogo?: string;
  salonLogoLight?: string;
  salonLogoDark?: string;
  salonIcon?: string;
  facadePhotoUrl?: string;
  interiorPhotoUrl?: string;
  pwaName?: string;
  slogan?: string;
  showSlogan?: boolean;
  logoTextFallback?: string;
  logoTextColor?: string;
  showHomeTab?: boolean;
  showHeroSlides?: boolean;
  brandFont?: 'Poppins' | 'Cormorant Garamond' | 'Oswald' | 'Plus Jakarta Sans' | string;
  defaultTheme?: 'dark' | 'light';
  navStyle?: 'minimal' | 'solid' | 'boxed';
  navShape?: 'square' | 'circle';
  navBorder?: 'bordered' | 'none';
  navIconBorder?: 'bordered' | 'none';
  navBgStyle?: 'solid' | 'glass' | 'transparent';
  navBgColor?: string;
  navBtnBgColor?: string;
  navBtnActiveBgColor?: string;
  navActiveColor?: string;
  navTextColor?: string;
  navBtnShadow?: 'none' | 'subtle' | 'medium' | 'glow';
  navBtnBlur?: 'none' | 'sm' | 'md' | 'lg';
  navBtnFont?: 'Poppins' | 'Inter' | 'Plus Jakarta Sans' | 'Oswald' | 'Cormorant Garamond' | string;
  welcomeStyle?: 'atmospheric' | 'glass';

  sectionHeaderBgColor?: string;
  sectionHeaderTextColor?: string;
  sectionHeaderIconColor?: string;
  sectionHeaderBgStyle?: 'solid' | 'glass' | 'transparent';
  sectionHeaderBorder?: 'bordered' | 'none';
  sectionHeaderBtnBgColor?: string;
  sectionHeaderBtnActiveBgColor?: string;
  sectionHeaderBtnBorder?: 'bordered' | 'none';
  sectionHeaderBtnShadow?: 'none' | 'subtle' | 'medium' | 'glow';
  sectionHeaderBtnBlur?: 'none' | 'sm' | 'md' | 'lg';
  sectionHeaderBtnFont?: 'Poppins' | 'Inter' | 'Plus Jakarta Sans' | 'Oswald' | 'Cormorant Garamond' | string;

  bio?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  mapsUrl?: string;

  razaoSocial?: string;
  cnpj?: string;

  pixKey?: string;
  pixKeys?: SalonPixKeyItem[];

  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;

  operatingSchedule?: OperatingSchedule;
  operatingHoursJson?: Record<string, any>;
  holidays?: Array<{ id: string; date: string; name: string }>;
  cancellationPolicy?: {
    minAdvanceHours: number;
    chargeCancellationFee: boolean;
    cancellationFeePercent: number;
    allowAutoReschedule: boolean;
    maxNoShowsBeforeBlock: number;
  };
  spacePhotos?: Array<{ id: string; url: string; caption: string }>;
  spaceDescription?: string;
  amenities?: string[];
  serviceCategories?: string[];
  workingDays?: string[];
  openTime?: string;
  closeTime?: string;
  closedOnHolidays?: boolean;

  ownerCpf?: string;
  legalManagerName?: string;
  legalManagerCpf?: string;
  legalManagerPhone?: string;
  legalManagerEmail?: string;

  operatingModel?: 'solo' | 'team' | 'home_delivery' | 'hybrid';
  homeDeliverySettings?: {
    enabled: boolean;
    areaDescription?: string;
    maxDistanceKm?: number;
    travelFee?: number;
    isFreeForCondo?: boolean;
  };

  status?: 'active' | 'pending' | 'incomplete' | 'suspended';
  isVerified?: boolean;
  moderationNotes?: string;
}

export interface ProfessionalDayScheduleSlot {
  dayKey: string;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  isOpen?: boolean;
  openTime?: string;
  closeTime?: string;
  hasBreak?: boolean;
  breakStart?: string;
  breakEnd?: string;
}

export type ProfessionalAccessType = 'professional' | 'admin' | 'superadmin';
export type ProfessionalJobFunctionType = 'atendente' | 'recepcionista' | 'autonomo' | 'outros';

export interface SalonProfessionalItem {
  id?: string;
  name: string;
  role?: string;
  systemRole?: 'admin' | 'member' | 'superadmin';
  accessType?: ProfessionalAccessType;
  jobFunctionType?: ProfessionalJobFunctionType;
  customJobFunction?: string;
  categories?: string[];
  serviceIds?: string[];
  serviceNames?: string[];
  avatar?: string;
  avatarUrl?: string;
  rating?: number;
  phone?: string;
  email?: string;
  commissionRate?: number;
  specialties?: string[];
  workSchedule?: ProfessionalWorkSchedule;
  isActive?: boolean;
}

export interface CatalogServiceItem {
  id: string;
  title: string;
  duration: string;
  price: number;
  description: string;
  category: string;
  categoryId?: string;
  image?: string;
  photos?: string[];
  mediaType?: 'image' | 'video';
  videoUrl?: string;
  videoDurationSeconds?: number;
  displayMode?: 'static' | 'slideshow' | 'video';
  aspectRatio?: string;
  professionalId?: string;
}

export type ProfessionalRole = 'admin' | 'professional' | 'receptionist' | 'superadmin';

export interface FinancialExpense {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  category: 'fixed' | 'variable';
  status: 'paid' | 'pending' | 'overdue';
  scope: 'salon' | 'personal';
  createdAt: string;
}

export interface ProfessionalWorkSchedule {
  shiftType: 'manha' | 'tarde' | 'integral' | 'sabados' | 'personalizado';
  shiftLabel?: string;
  days: string[];
  startTime: string;
  endTime: string;
  dailySchedules?: Record<string, ProfessionalDayScheduleSlot>;
}

export interface ProfessionalTeamMember {
  id: string;
  name: string;
  role: ProfessionalRole;
  accessType?: ProfessionalAccessType;
  jobFunctionType?: ProfessionalJobFunctionType;
  customJobFunction?: string;
  categories?: string[];
  serviceIds?: string[];
  serviceNames?: string[];
  avatarUrl?: string;
  phone?: string;
  email?: string;
  specialties: string[];
  commissionRate?: number;
  workSchedule?: ProfessionalWorkSchedule;
  isActive: boolean;
  joinedAt: string;
}

export const hapticLight = () => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(10); } catch {}
  }
};

export const hapticMedium = () => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(25); } catch {}
  }
};

export const hapticSuccess = () => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate([15, 50, 20]); } catch {}
  }
};
