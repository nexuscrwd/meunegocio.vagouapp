import { createClient, User } from '@supabase/supabase-js';
import type { Database, AppointmentStatus, OfferStatus } from '../types/database.types';

const DEFAULT_SUPABASE_URL = 'https://xemenxdhuoekytyhmgyt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbWVueGRodW9la3l0eWhtZ3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMDE2MzAsImV4cCI6MjEwNTc3NzYzMH0.P-q6bQspwuQNhub08hjWmsjLrugr3CVA1NIdznWJxuo';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  supabaseUrl !== 'https://your-project-id.supabase.co'
);

// Instância oficial do cliente Supabase tipado
export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Autenticação via Google OAuth no Supabase (compatível com Iframe e Popup)
 */
export async function signInWithGoogle(customRedirectTo?: string) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase não configurado') };
  }

  const redirectUrl = customRedirectTo || (typeof window !== 'undefined' ? window.location.origin : '');

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      return { data: null, error };
    }

    if (data?.url && typeof window !== 'undefined') {
      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.url,
        'google_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        // Se popup foi bloqueado pelo navegador, redireciona em nova aba
        window.open(data.url, '_blank');
      }
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Desconectar do Supabase
 */
export async function signOutFromSupabase() {
  if (!supabase) return { error: null };
  return await supabase.auth.signOut();
}

/**
 * Autenticação via Email/Usuário e Senha com Supabase
 */
export async function signInWithSupabase(userOrEmail: string, password: string) {
  if (!supabase || !isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase não conectado') };
  }

  // Normalizar email se o usuário inseriu apenas o username/slug
  const emailToUse = userOrEmail.includes('@')
    ? userOrEmail.trim().toLowerCase()
    : `${userOrEmail.trim().toLowerCase()}@vagou.app`;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: password.trim(),
    });

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Cadastro de Usuário no Supabase Auth
 */
export async function signUpWithSupabase(email: string, password: string, metadata?: Record<string, any>) {
  if (!supabase || !isSupabaseConfigured) {
    return { data: null, error: new Error('Supabase não conectado') };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      options: {
        data: metadata || {},
      },
    });

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Obter usuário atual autenticado
 */
export async function getSupabaseUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Buscar estabelecimento pelo slug ou pelo owner_id
 */
export async function fetchSalonData(identifier: { slug?: string; ownerUserId?: string }) {
  if (!supabase) return null;
  try {
    let query = supabase.from('salons').select('*');
    if (identifier.ownerUserId) {
      query = query.eq('owner_id', identifier.ownerUserId);
    } else if (identifier.slug) {
      query = query.eq('slug', identifier.slug);
    } else {
      return null;
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.warn('Erro ao buscar salão:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Falha ao consultar salão no Supabase:', e);
    return null;
  }
}

/**
 * Sincronizar dados do estabelecimento no Supabase
 */
export async function syncSalonDataToSupabase(salonData: {
  slug: string;
  tradeName: string;
  legalName?: string;
  documentType?: string;
  documentNumber?: string;
  phoneWhatsapp: string;
  phoneLandline?: string;
  email: string;
  address: string;
  neighborhood: string;
  city: string;
  state?: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
  operatingModel: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  appIconUrl?: string;
  primaryColor?: string;
  ownerUserId?: string;
  homeDeliverySettings?: {
    enabled: boolean;
    areaDescription?: string;
    maxDistanceKm?: number;
    travelFee?: number;
    isFreeForCondo?: boolean;
  };
}) {
  if (!supabase || !isSupabaseConfigured) {
    return { success: true, mode: 'local' as const };
  }

  try {
    const payload: any = {
      slug: salonData.slug,
      trade_name: salonData.tradeName,
      legal_name: salonData.legalName || salonData.tradeName,
      document_type: salonData.documentType || 'CNPJ',
      document_number: salonData.documentNumber || null,
      phone_whatsapp: salonData.phoneWhatsapp,
      email: salonData.email,
      address: salonData.address,
      neighborhood: salonData.neighborhood,
      city: salonData.city,
      state: salonData.state || 'SP',
      cep: salonData.postalCode || null,
      latitude: salonData.latitude,
      longitude: salonData.longitude,
      operating_model: salonData.operatingModel,
      logo_light_url: salonData.logoLightUrl || null,
      logo_dark_url: salonData.logoDarkUrl || null,
      primary_color: salonData.primaryColor || '#20C933',
      secondary_color: '#0F172A',
      branding: {
        primaryColor: salonData.primaryColor || '#20C933',
        secondaryColor: '#0F172A',
        themeMode: 'light',
      },
      home_delivery_enabled: salonData.homeDeliverySettings?.enabled ?? false,
      home_delivery_area: salonData.homeDeliverySettings?.areaDescription || null,
      home_delivery_travel_fee: salonData.homeDeliverySettings?.travelFee || 0,
      is_verified: true,
      is_active: true,
    };

    if (salonData.ownerUserId) {
      payload.owner_id = salonData.ownerUserId;
    }

    const { data, error } = await supabase.from('salons').upsert(payload, { onConflict: 'slug' }).select().single();

    if (error) {
      console.warn('Erro ao sincronizar salão no Supabase:', error.message);
      return { success: false, error: error.message, mode: 'supabase' as const };
    }

    return { success: true, data, mode: 'supabase' as const };
  } catch (err: any) {
    console.warn('Falha inesperada na sincronização Supabase:', err?.message);
    return { success: false, error: err?.message, mode: 'fallback' as const };
  }
}

/**
 * Buscar membros da equipe / profissionais do salão
 */
export async function fetchSalonProfessionals(salonId: string) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('Erro ao carregar profissionais:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Buscar catálogo de serviços do salão
 */
export async function fetchSalonServices(salonId: string) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('Erro ao carregar serviços:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Salvar / Criar serviço no Supabase
 */
export async function upsertSalonService(service: {
  id?: string;
  salonId: string;
  title: string;
  category: string;
  price: number;
  promotionalPrice?: number | null;
  durationMinutes: number;
  durationEstimated?: string;
  description?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}) {
  if (!supabase) return null;
  try {
    const payload = {
      ...(service.id ? { id: service.id } : {}),
      salon_id: service.salonId,
      title: service.title,
      category: service.category,
      price: service.price,
      promotional_price: service.promotionalPrice ?? null,
      duration_minutes: service.durationMinutes,
      duration_estimated: service.durationEstimated || `${service.durationMinutes} min`,
      description: service.description || null,
      image_url: service.imageUrl || null,
      video_url: service.videoUrl || null,
      is_active: true,
    };
    const { data, error } = await (supabase.from('services') as any).upsert(payload).select().single();
    if (error) {
      console.warn('Erro ao salvar serviço:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Falha ao salvar serviço:', e);
    return null;
  }
}

/**
 * Buscar vagas relâmpago ativas do salão
 */
export async function fetchSalonOffers(salonId: string) {
  if (!supabase) return [];
  try {
    const { data, error } = await (supabase.from('service_offers') as any)
      .select('*')
      .eq('salon_id', salonId)
      .eq('status', 'AVAILABLE')
      .order('created_at', { ascending: false });
    if (error) {
      console.warn('Erro ao buscar ofertas:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Criar vaga relâmpago no Supabase
 */
export async function createSalonOffer(offer: {
  salonId: string;
  professionalId: string;
  serviceId?: string | null;
  serviceTitle: string;
  category: string;
  originalPrice: number;
  price: number;
  dateStr: string;
  startTime: string;
  endTime: string;
  mediaLevel?: number;
  videoUrl?: string | null;
  galleryImages?: string[];
  expiresAt: string;
}) {
  if (!supabase) return null;
  try {
    const payload = {
      salon_id: offer.salonId,
      professional_id: offer.professionalId,
      service_id: offer.serviceId || null,
      service_title: offer.serviceTitle,
      category: offer.category,
      original_price: offer.originalPrice,
      price: offer.price,
      date_str: offer.dateStr,
      start_time: offer.startTime,
      end_time: offer.endTime,
      media_level: offer.mediaLevel || 1,
      video_url: offer.videoUrl || null,
      gallery_images: offer.galleryImages || [],
      expires_at: offer.expiresAt,
      status: 'AVAILABLE' as OfferStatus,
    };
    const { data, error } = await (supabase.from('service_offers') as any).insert(payload).select().single();
    if (error) {
      console.warn('Erro ao criar vaga:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error('Falha ao criar vaga:', e);
    return null;
  }
}

/**
 * Buscar agendamentos do salão
 */
export async function fetchSalonAppointments(salonId: string) {
  if (!supabase) return [];
  try {
    const { data, error } = await (supabase.from('appointments') as any)
      .select('*')
      .eq('salon_id', salonId)
      .order('date_str', { ascending: true });
    if (error) {
      console.warn('Erro ao buscar agendamentos:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Atualizar status do agendamento
 */
export async function updateAppointmentStatusInDb(appointmentId: string, status: AppointmentStatus) {
  if (!supabase) return false;
  try {
    const { error } = await (supabase.from('appointments') as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', appointmentId);
    if (error) {
      console.warn('Erro ao atualizar status do agendamento:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
