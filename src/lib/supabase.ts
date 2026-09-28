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

  const cleanEmail = userOrEmail.trim().toLowerCase();
  if (!cleanEmail.includes('@')) {
    return { data: null, error: new Error('Informe um endereço de e-mail válido.') };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
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

export interface UnifiedLoginResult {
  success: boolean;
  user?: User;
  salonData?: any;
  professionalData?: any;
  clientData?: any;
  persona: 'pro' | 'cliente';
  role: 'pro' | 'cliente' | 'admin';
  userName: string;
  userEmail: string;
  userPhone?: string;
  userAvatarUrl?: string;
  salonName?: string;
  salonSlug?: string;
  errorMessage?: string;
}

/**
 * Verificação Soberana de Papel e Vínculo com Estabelecimento (RBAC)
 * Regra Inegociável: Consulta salon_members estritamente por user_id E pelo salão do targetSalonSlug.
 * Sem usar owner_id, e-mail ou ilike. Retorna 'cliente' quando não houver vínculo naquele salão específico.
 */
export async function checkUserSalonMembership(
  userId: string,
  salonIdentifier?: string
): Promise<{
  isMember: boolean;
  role: 'owner' | 'manager' | 'professional' | 'cliente';
  salonId?: string;
  salonData?: any;
}> {
  if (!supabase || !isSupabaseConfigured || !userId) {
    return { isMember: false, role: 'cliente' };
  }

  // (a) Se salonIdentifier vier vazio, retorne { isMember: false, role: 'cliente' } (nunca consulte vínculos de todos os salões)
  if (!salonIdentifier || !salonIdentifier.trim()) {
    return { isMember: false, role: 'cliente' };
  }

  const cleanIdent = salonIdentifier.trim().toLowerCase();

  // (c) Valide o slug com /^[a-z0-9-]+$/ (ou UUID) antes de usar na consulta; se inválido, retorne 'cliente'
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanIdent);
  const isValidSlug = /^[a-z0-9-]+$/.test(cleanIdent);

  if (!isUuid && !isValidSlug) {
    return { isMember: false, role: 'cliente' };
  }

  try {
    // (b) Confirmação: a coluna subdomain NÃO existe na tabela salons, usamos estritamente slug ou id.
    // Verificamos o campo error; se houver erro, logamos no console e retornamos 'cliente'.
    let salonQuery = supabase.from('salons').select('id, trade_name, slug, is_active');
    if (isUuid) {
      salonQuery = salonQuery.eq('id', cleanIdent);
    } else {
      salonQuery = salonQuery.eq('slug', cleanIdent);
    }

    const { data: salonRes, error: salonErr } = await (salonQuery.maybeSingle() as any);
    if (salonErr) {
      console.warn('Erro ao consultar salão por identificador:', salonErr.message);
      return { isMember: false, role: 'cliente' };
    }

    if (!salonRes) {
      return { isMember: false, role: 'cliente' };
    }

    const targetSalonId = salonRes.id;
    const targetSalonData = salonRes;

    // Consulta soberana na tabela salon_members por user_id E salon_id (sem owner_id, sem email, sem ilike)
    const { data: members, error: memErr } = await (supabase
      .from('salon_members')
      .select('id, salon_id, user_id, role, salon:salons(*)')
      .eq('user_id', userId)
      .eq('salon_id', targetSalonId) as any);

    if (memErr) {
      console.warn('Erro ao consultar salon_members:', memErr.message);
      return { isMember: false, role: 'cliente' };
    }

    if (members && members.length > 0) {
      const mem = members[0];
      const memberRole = mem.role === 'owner' ? 'owner' : mem.role === 'manager' ? 'manager' : 'professional';
      return {
        isMember: true,
        role: memberRole,
        salonId: mem.salon_id,
        salonData: mem.salon || targetSalonData,
      };
    }
  } catch (err) {
    console.warn('Erro inesperado ao consultar salon_members:', err);
  }

  // Sem linha em salon_members para este salão = cliente estrito
  return { isMember: false, role: 'cliente' };
}

/**
 * Garante a linha do cliente em public.clients sem sobrescrever dados existentes.
 * Trata concorrência com retry no erro 23505 (unique constraint).
 */
export async function ensureClientRow(
  userId: string,
  userEmail?: string | null,
  userMetadata?: Record<string, any> | null
): Promise<{ client: any; error: any }> {
  if (!supabase || !isSupabaseConfigured || !userId) {
    return { client: null, error: new Error('Sessão ou Supabase indisponível') };
  }

  try {
    // 1. Verifica se já existe
    const { data: existingClient } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingClient) {
      return { client: existingClient, error: null };
    }

    // 2. Se não existir, insere com metadados reais
    const resolvedName = userMetadata?.full_name || userMetadata?.name || (userEmail ? userEmail.split('@')[0] : 'Usuário');
    const { data: insertedClient, error: insertErr } = await (supabase.from('clients') as any)
      .insert({
        user_id: userId,
        name: resolvedName.trim(),
        phone: userMetadata?.phone || null,
        email: userEmail || null,
        avatar_url: userMetadata?.avatar_url || null,
      })
      .select()
      .single();

    // Se colidiu em corrida concorrente (23505), reconsulta e retorna a linha existente
    if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('duplicate'))) {
      const { data: reFetched } = await (supabase.from('clients') as any).select('*').eq('user_id', userId).maybeSingle();
      return { client: reFetched, error: null };
    }

    return { client: insertedClient, error: insertErr };
  } catch (err: any) {
    return { client: null, error: err };
  }
}

/**
 * Protocolo de Autenticação Unificada Global do Ecossistema Vagou
 * Integra Supabase Auth estrito + Validação de RBAC em salon_members
 */
export async function unifiedGlobalLogin(
  identifier: string, 
  pass: string,
  targetSalonSlug?: string
): Promise<UnifiedLoginResult> {
  const cleanUser = identifier.trim().toLowerCase();
  const cleanPass = pass.trim();

  if (!cleanUser || !cleanPass) {
    return {
      success: false,
      persona: 'cliente',
      role: 'cliente',
      userName: '',
      userEmail: '',
      errorMessage: 'Informe seu e-mail e sua senha de acesso.',
    };
  }

  if (!cleanUser.includes('@')) {
    return {
      success: false,
      persona: 'cliente',
      role: 'cliente',
      userName: '',
      userEmail: cleanUser,
      errorMessage: 'Informe um endereço de e-mail válido.',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      persona: 'cliente',
      role: 'cliente',
      userName: '',
      userEmail: cleanUser,
      errorMessage: 'Erro: O cliente Supabase não está configurado. Conexão necessária.',
    };
  }

  // 1. Autenticação REAL exclusivamente via Supabase Auth (sem atalhos, sem PIN, sem variações)
  let supabaseAuthUser: User | null = null;
  let authError: any = null;

  try {
    const { data: authData, error: err } = await supabase.auth.signInWithPassword({
      email: cleanUser,
      password: cleanPass,
    });

    if (!err && authData?.user) {
      supabaseAuthUser = authData.user;
    } else {
      authError = err;
    }
  } catch (e: any) {
    authError = e;
  }

  // Se falhou no Supabase Auth, exibe a mensagem amigável ou o erro real do Supabase
  if (!supabaseAuthUser) {
    const message = authError?.message || 'Falha na autenticação com o Supabase.';
    let friendlyMessage = message;
    if (message.includes('Invalid login credentials')) {
      friendlyMessage = 'E-mail ou senha incorretos.';
    } else if (message.includes('Email not confirmed')) {
      friendlyMessage = 'E-mail pendente de confirmação. Verifique sua caixa de entrada.';
    }
    return {
      success: false,
      persona: 'cliente',
      role: 'cliente',
      userName: '',
      userEmail: cleanUser,
      errorMessage: friendlyMessage,
    };
  }

  // 2. Consulta o papel do usuário no banco por user_id e salon_id via salon_members
  const membership = await checkUserSalonMembership(supabaseAuthUser.id, targetSalonSlug);

  // 3. Obter dados pessoais do perfil estritamente por user_id (igualdade exata, sem ilike)
  let profileName = '';
  let profileAvatar = '';
  let profilePhone = '';

  try {
    const { data: profile } = await (supabase.from('profiles') as any)
      .select('*')
      .eq('id', supabaseAuthUser.id)
      .maybeSingle();

    if (profile) {
      profileName = profile.full_name || '';
      profileAvatar = (profile.avatar_url && !profile.avatar_url.includes('unsplash.com')) ? profile.avatar_url : '';
      profilePhone = profile.phone_whatsapp || '';
    }
  } catch {}

  // Se não encontrou em profiles, busca na tabela clients estritamente por user_id
  if (!profileName) {
    try {
      const { data: clientRow } = await (supabase.from('clients') as any)
        .select('*')
        .eq('user_id', supabaseAuthUser.id)
        .maybeSingle();

      if (clientRow) {
        profileName = clientRow.name || '';
        profilePhone = profilePhone || clientRow.phone || '';
      }
    } catch {}
  }

  const metaAvatar = supabaseAuthUser.user_metadata?.avatar_url || supabaseAuthUser.user_metadata?.avatar;
  const resolvedName = profileName || 
                       supabaseAuthUser.user_metadata?.full_name || 
                       supabaseAuthUser.user_metadata?.name || 
                       cleanUser.split('@')[0];
  const resolvedEmail = supabaseAuthUser.email || cleanUser;
  const resolvedPhone = profilePhone || supabaseAuthUser.user_metadata?.phone || '';
  const resolvedAvatar = profileAvatar || (metaAvatar && !metaAvatar.includes('unsplash.com') ? metaAvatar : '');

  const isPro = membership.isMember;
  const salon = membership.salonData;

  return {
    success: true,
    user: supabaseAuthUser,
    salonData: salon || null,
    persona: isPro ? 'pro' : 'cliente',
    role: isPro ? 'pro' : 'cliente',
    userName: resolvedName,
    userEmail: resolvedEmail,
    userPhone: resolvedPhone,
    userAvatarUrl: resolvedAvatar,
    salonName: salon?.trade_name || 'Meu Negócio',
    salonSlug: salon?.slug || targetSalonSlug || 'meu-negocio',
  };
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

/**
 * Vagou Family: Buscar dependentes de um cliente responsável
 */
export async function fetchClientFamilyMembers(guardianClientId: string) {
  if (!supabase) return [];
  try {
    const { data, error } = await (supabase.from('client_family_members') as any)
      .select('*')
      .eq('guardian_client_id', guardianClientId)
      .order('created_at', { ascending: true });
    if (error) {
      console.warn('Erro ao buscar dependentes:', error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Vagou Family: Adicionar ou Atualizar Dependente
 */
export async function saveClientFamilyMember(member: {
  id?: string;
  guardianClientId: string;
  name: string;
  relationship: string;
  birthDate?: string | null;
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  gender?: string | null;
  notes?: string | null;
  autonomyLevel?: string;
  phone?: string | null;
  email?: string | null;
}) {
  if (!supabase) return null;
  try {
    const payload = {
      guardian_client_id: member.guardianClientId,
      name: member.name,
      relationship: member.relationship,
      birth_date: member.birthDate || null,
      avatar_url: member.avatarUrl || null,
      avatar_emoji: member.avatarEmoji || null,
      gender: member.gender || null,
      notes: member.notes || null,
      autonomy_level: member.autonomyLevel || 'parent_controlled',
      phone: member.phone || null,
      email: member.email || null,
      updated_at: new Date().toISOString(),
    };

    if (member.id) {
      const { data, error } = await (supabase.from('client_family_members') as any)
        .update(payload)
        .eq('id', member.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await (supabase.from('client_family_members') as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  } catch (err: any) {
    console.warn('Erro ao salvar dependente:', err.message);
    return null;
  }
}

/**
 * Vagou Family: Emancipar dependente para conta própria (Migração de Histórico)
 */
export async function emancipateFamilyMemberToUser(memberId: string, newUserId: string) {
  if (!supabase) return false;
  try {
    // 1. Atualiza o status do dependente para emancipado
    const { error: memberError } = await (supabase.from('client_family_members') as any)
      .update({
        autonomy_level: 'emancipated',
        emancipated_user_id: newUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId);

    if (memberError) throw memberError;

    // 2. Transfere os agendamentos históricos desse dependente para o novo perfil
    const { error: aptError } = await (supabase.from('appointments') as any)
      .update({
        client_id: newUserId,
        is_dependent: false,
        updated_at: new Date().toISOString(),
      })
      .eq('dependent_id', memberId);

    if (aptError) {
      console.warn('Aviso: Alguns agendamentos não puderam ser migrados automaticamente:', aptError.message);
    }

    return true;
  } catch (err: any) {
    console.error('Erro na emancipação digital do dependente:', err);
    return false;
  }
}

/**
 * Consulta e identifica dados de perfil do usuário diretamente no banco Supabase
 * Suporta profissionais, salões, clientes e histórico de agendamentos com fallback automático para foto gravada
 */
export async function fetchUserProfileFromDb(identifier?: { email?: string; name?: string }) {
  if (!supabase || !isSupabaseConfigured) return null;
  const term = (identifier?.email || identifier?.name || '').trim();

  try {
    // 0. Procurar no usuário autenticado ativo no Supabase Auth
    try {
      const { data: authUserResp } = await supabase.auth.getUser();
      const authUser = authUserResp?.user;
      if (authUser) {
        const metaAvatar = authUser.user_metadata?.avatar_url || authUser.user_metadata?.avatar || '';
        const metaName = authUser.user_metadata?.full_name || authUser.user_metadata?.name;

        // Também busca na tabela profiles para o usuário autenticado
        const { data: profile } = await (supabase.from('profiles') as any)
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        const avatar = profile?.avatar_url || (metaAvatar && !metaAvatar.includes('unsplash.com') ? metaAvatar : '');
        const name = profile?.full_name || metaName || authUser.email?.split('@')[0] || 'Usuário';

        return {
          type: (authUser.user_metadata?.role === 'pro' ? 'professional' : 'client') as any,
          id: authUser.id,
          name: name,
          email: authUser.email || '',
          phone: profile?.phone_whatsapp || authUser.user_metadata?.phone || '',
          avatarUrl: avatar || '',
        };
      }
    } catch {}

    const isGenericTerm = !term || term === 'Profissional' || term === 'Usuário' || term === 'Visitante' || term === 'Cliente';

    // 1. Procurar em perfis (profiles) por correspondência exata de e-mail ou nome
    if (!isGenericTerm) {
      let query = supabase.from('profiles').select('*');
      if (term.includes('@')) {
        query = query.ilike('email', term);
      } else {
        query = query.or(`email.ilike.${term}@%,full_name.ilike.${term}`);
      }
      const { data: profiles } = await (query as any).limit(1);
      if (profiles && profiles.length > 0) {
        const prof = profiles[0];
        return {
          type: 'client' as const,
          id: prof.id,
          name: prof.full_name || term,
          email: prof.email || (term.includes('@') ? term : ''),
          phone: prof.phone_whatsapp || '',
          avatarUrl: prof.avatar_url || '',
        };
      }
    }

    // 2. Procurar em profissionais por correspondência exata
    if (!isGenericTerm) {
      let query = supabase.from('professionals').select('*');
      if (term.includes('@')) {
        query = query.ilike('email', term);
      } else {
        query = query.or(`email.ilike.${term}@%,name.ilike.${term}`);
      }
      const { data: pros } = await (query as any).limit(1);
      if (pros && pros.length > 0) {
        const p = pros[0];
        return {
          type: 'professional' as const,
          id: p.id,
          name: p.name || term,
          email: p.email || (term.includes('@') ? term : ''),
          phone: p.phone || '',
          avatarUrl: p.avatar_url || '',
          salonId: p.salon_id,
        };
      }
    }

    // 3. Procurar em clientes por correspondência exata
    if (!isGenericTerm) {
      let query = supabase.from('clients').select('*');
      if (term.includes('@')) {
        query = query.ilike('email', term);
      } else {
        query = query.or(`email.ilike.${term}@%,name.ilike.${term}`);
      }
      const { data: clients } = await (query as any).limit(1);
      if (clients && clients.length > 0) {
        const c = clients[0];
        return {
          type: 'client' as const,
          id: c.id,
          name: c.name || term,
          email: c.email || (term.includes('@') ? term : ''),
          phone: c.phone || '',
          avatarUrl: c.avatar_url || '',
        };
      }
    }

  } catch (err) {
    console.warn('Erro ao consultar perfil no Supabase:', err);
  }

  return null;
}

/**
 * Resolução universal e canônica de foto de perfil na Tríade VagouApp
 * Homologada pela Engenharia da Tríade (pvapp ⇄ mnvapp ⇄ admvapp)
 */
export function resolveTriadeAvatar(params: {
  professionalAvatar?: string | null;
  clientAvatar?: string | null;
  authMetadataAvatar?: string | null;
  salonLogo?: string | null;
  isBusinessContext?: boolean; // true apenas em cards institucionais do salão
}): string {
  // 1. Prioridade absoluta: Foto real da pessoa física (aceita qualquer URL válida ou Base64)
  const personalPhoto =
    params.professionalAvatar ||
    params.clientAvatar ||
    params.authMetadataAvatar ||
    '';

  if (personalPhoto && personalPhoto.trim() !== '') {
    return personalPhoto;
  }

  // 2. Se e somente se o contexto for institucional do salão (ex: logo do espaço)
  if (params.isBusinessContext && params.salonLogo) {
    return params.salonLogo;
  }

  // 3. Fallback neutro: Retorna string vazia para renderizar o ícone oficial User da lucide-react
  return '';
}

/**
 * Resolução universal de avatar do usuário no Supabase (Tríade Sync — Fonte Única da Verdade)
 * Boletim Técnico: bol-008-mobile-avatar-sync-storage-resolution
 */
export async function getUniversalUserAvatar(userEmail: string, authMetadataAvatar?: string): Promise<string | null> {
  if (authMetadataAvatar && !authMetadataAvatar.includes('unsplash.com')) {
    return authMetadataAvatar;
  }

  if (!supabase || !isSupabaseConfigured || !userEmail) {
    return authMetadataAvatar || null;
  }

  try {
    const cleanEmail = userEmail.trim().toLowerCase();

    // 1. Busca na tabela clients
    const { data: client } = await (supabase.from('clients') as any)
      .select('avatar_url')
      .ilike('email', `%${cleanEmail}%`)
      .maybeSingle();

    if (client?.avatar_url && !client.avatar_url.includes('unsplash.com')) {
      return client.avatar_url;
    }

    // 2. Fallback inteligente: se não achou em clients, busca em professionals
    const { data: prof } = await (supabase.from('professionals') as any)
      .select('avatar_url')
      .ilike('email', `%${cleanEmail}%`)
      .maybeSingle();

    if (prof?.avatar_url && !prof.avatar_url.includes('unsplash.com')) {
      return prof.avatar_url;
    }
  } catch (err) {
    console.warn('Erro em getUniversalUserAvatar:', err);
  }

  return null;
}

/**
 * Atualiza ou sincroniza dados de perfil do usuário diretamente no banco Supabase
 * Atualiza tabela relacional (clients/professionals) e espelha em auth.users.user_metadata
 */
export async function updateUserProfileInDb(profile: {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  type?: 'client' | 'pro' | 'admin';
}) {
  if (!supabase || !isSupabaseConfigured) {
    return { success: true, localOnly: true };
  }

  try {
    const cleanEmail = profile.email.trim().toLowerCase();
    const cleanName = profile.name.trim();
    const cleanPhone = profile.phone?.trim() || '';
    const cleanAvatar = profile.avatarUrl || '';

    // 1. Espelhar metadados globais no auth.users (Fonte da Verdade Global da Tríade)
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: cleanName,
          phone: cleanPhone,
          avatar_url: cleanAvatar || undefined,
        },
      });
    } catch (authErr) {
      console.warn('Aviso: Não foi possível atualizar auth.users.user_metadata:', authErr);
    }

    // 2. Atualizar tabela professionals (Unificada para Single Source of Truth)
    if (cleanEmail) {
      await (supabase.from('professionals') as any)
        .update({
          name: cleanName,
          phone: cleanPhone,
          avatar_url: cleanAvatar || null,
          updated_at: new Date().toISOString(),
        })
        .ilike('email', `%${cleanEmail}%`);
    }

    // 3. Atualizar ou inserir na tabela clients (Unificada para Single Source of Truth)
    if (cleanEmail) {
      const { data: existingClient } = await (supabase.from('clients') as any)
        .select('id')
        .ilike('email', `%${cleanEmail}%`)
        .maybeSingle();

      if (existingClient?.id) {
        await (supabase.from('clients') as any)
          .update({
            name: cleanName,
            phone: cleanPhone,
            avatar_url: cleanAvatar || null,
            default_address: profile.address || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingClient.id);
      } else {
        await (supabase.from('clients') as any)
          .insert({
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            avatar_url: cleanAvatar || null,
            default_address: profile.address || null,
          });
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro ao salvar perfil unificado no Supabase:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Busca completa de dados do Salão pelo slug, nome, email ou owner_id
 */
export async function fetchCompleteSalonData(identifier: { slug?: string; name?: string; email?: string; ownerId?: string }) {
  if (!supabase || !isSupabaseConfigured) return null;
  try {
    let query = (supabase.from('salons') as any).select('*');
    if (identifier.ownerId) {
      query = query.eq('owner_id', identifier.ownerId);
    } else if (identifier.slug) {
      query = query.eq('slug', identifier.slug);
    } else if (identifier.email) {
      query = query.ilike('email', `%${identifier.email}%`);
    } else if (identifier.name) {
      query = query.or(`trade_name.ilike.%${identifier.name}%,slug.ilike.%${identifier.name.toLowerCase().replace(/\s+/g, '-')}%`);
    } else {
      return null;
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.warn('Erro ao carregar dados completos do salão:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Falha ao consultar salão no Supabase:', err);
    return null;
  }
}

/**
 * Atualiza configurações, identidade visual e dados cadastrais do Salão no Supabase
 */
export async function updateSalonSettingsInDb(salonIdOrSlug: string, settings: any) {
  if (!supabase || !isSupabaseConfigured || !salonIdOrSlug) {
    return { success: false, error: 'Supabase não configurado ou identificador vazio' };
  }
  try {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (settings.salonName || settings.tradeName) payload.trade_name = settings.salonName || settings.tradeName;
    if (settings.razaoSocial || settings.legalName) payload.legal_name = settings.razaoSocial || settings.legalName;
    if (settings.cnpj || settings.documentNumber) payload.document_number = settings.cnpj || settings.documentNumber;
    if (settings.salonPhone || settings.phoneWhatsapp || settings.legalManagerPhone) {
      payload.phone_whatsapp = settings.salonPhone || settings.phoneWhatsapp || settings.legalManagerPhone;
    }
    if (settings.email || settings.legalManagerEmail) payload.email = settings.email || settings.legalManagerEmail;
    if (settings.salonAddress || settings.address || settings.logradouro) {
      payload.address = settings.salonAddress || settings.address || settings.logradouro;
    }
    if (settings.numero || settings.streetNumber) payload.street_number = settings.numero || settings.streetNumber;
    if (settings.complemento || settings.complement) payload.complement = settings.complemento || settings.complement;
    if (settings.bairro || settings.neighborhood) payload.neighborhood = settings.bairro || settings.neighborhood;
    if (settings.cidade || settings.city) payload.city = settings.cidade || settings.city;
    if (settings.uf || settings.state) payload.state = settings.uf || settings.state;
    if (settings.cep || settings.postalCode) payload.cep = settings.cep || settings.postalCode;
    if (settings.salonLogoLight !== undefined) payload.logo_light_url = settings.salonLogoLight || null;
    if (settings.salonLogoDark !== undefined) payload.logo_dark_url = settings.salonLogoDark || null;
    if (settings.salonLogo !== undefined || settings.logoUrl !== undefined) {
      payload.logo_url = settings.salonLogo || settings.logoUrl || settings.salonLogoDark || settings.salonLogoLight || null;
    }
    if (settings.accentColor || settings.primaryColor) {
      payload.primary_color = settings.accentColor || settings.primaryColor;
      payload.branding = {
        primaryColor: settings.accentColor || settings.primaryColor,
        pwaName: settings.pwaName || settings.salonName,
        themeMode: 'dark',
      };
    }
    if (settings.bio !== undefined) payload.bio = settings.bio;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonIdOrSlug);
    let { data, error } = await (supabase.from('salons') as any)
      .update(payload)
      .match(isUuid ? { id: salonIdOrSlug } : { slug: salonIdOrSlug })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('Erro ao atualizar configurações do salão no Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err: any) {
    console.error('Falha ao atualizar salão no Supabase:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Sincroniza a lista completa de serviços do Salão com o Supabase (CRUD Total)
 */
export async function syncAllServicesToDb(salonId: string, services: any[]) {
  if (!supabase || !isSupabaseConfigured || !salonId) return { success: false };
  try {
    // 1. Para cada serviço fornecido, realiza upsert no banco
    for (const s of services) {
      const durationMinutes = typeof s.duration === 'string' 
        ? parseInt(s.duration.replace(/\D/g, '')) || 40 
        : (s.duration_minutes || s.durationMinutes || 40);

      const payload: any = {
        salon_id: salonId,
        title: s.title || s.name || 'Serviço',
        category: s.category || 'Geral',
        price: Number(s.price) || 0,
        duration_minutes: durationMinutes,
        description: s.description || null,
        image_url: s.image || s.image_url || (s.photos && s.photos.length > 0 ? s.photos[0] : null),
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      const isUuid = s.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id);
      if (isUuid) {
        payload.id = s.id;
      }

      await (supabase.from('services') as any).upsert(payload, { onConflict: isUuid ? 'id' : undefined });
    }

    return { success: true };
  } catch (err: any) {
    console.error('Falha ao sincronizar catálogo de serviços no Supabase:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Sincroniza a lista de profissionais da equipe no Supabase
 */
export async function syncAllProfessionalsToDb(salonId: string, professionals: any[]) {
  if (!supabase || !isSupabaseConfigured || !salonId) return { success: false };
  try {
    for (const p of professionals) {
      const payload: any = {
        salon_id: salonId,
        name: p.name || 'Profissional',
        role: p.role || 'Profissional',
        avatar_url: p.avatarUrl || p.avatar || null,
        phone: p.phone || null,
        email: p.email || null,
        specialties: Array.isArray(p.specialties) ? p.specialties : ['Geral'],
        is_active: p.isActive !== false,
        updated_at: new Date().toISOString(),
      };

      const isUuid = p.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id);
      if (isUuid) {
        payload.id = p.id;
      }

      await (supabase.from('professionals') as any).upsert(payload, { onConflict: isUuid ? 'id' : undefined });
    }
    return { success: true };
  } catch (err: any) {
    console.error('Falha ao sincronizar profissionais no Supabase:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Faz upload de imagem de avatar diretamente para o Supabase Storage bucket 'avatars' (Tríade Sync)
 */
export async function uploadAvatarToSupabaseStorage(file: File, userIdOrEmail: string): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const cleanId = userIdOrEmail.replace(/[^a-zA-Z0-9-_]/g, '_');
    const fileName = `${cleanId}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { contentType: file.type, upsert: true });

    if (error || !data) {
      console.warn('Aviso: Falha ao enviar avatar para Supabase Storage:', error);
      return null;
    }

    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(data.path);
    return publicData.publicUrl || null;
  } catch (err) {
    console.warn('Erro no upload de avatar para o Storage:', err);
    return null;
  }
}


