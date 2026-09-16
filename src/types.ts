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

  // Extensões de mídia e urgência
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
}

export interface BookingAppointment {
  protocolCode: string;
  service: string;
  professional: string;
  salonName: string;
  dateTime: string;
  dayGroup: string;
  time: string;
  totalPrice: number;
  status: 'EM ANDAMENTO' | 'CONFIRMADO' | 'AGENDADO' | 'CONCLUÍDO' | 'CANCELADO';
  address: string;
  qrCodeMock?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  address: string;
  avatarUrl?: string;
}
