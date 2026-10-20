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
export function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Verificação Soberana Multi-Camada de Papel e Vínculo com Estabelecimento (RBAC)
 * Suporta login direto Supabase Auth e login cross-subdomain via iframe do admvapp:
 * Camada 1: Vínculo direto de Titular/Dono em public.salons (owner_id, email, owner_cpf, branding)
 * Camada 2: Vínculo formal em public.salon_members (user_id + salon_id)
 * Camada 3: Vínculo de equipe em public.professionals (salon_id + email)
 */
export async function checkUserSalonMembership(
  userId: string,
  salonIdentifier?: string,
  userEmail?: string,
  userCpf?: string
): Promise<{
  isMember: boolean;
  role: 'owner' | 'manager' | 'professional' | 'cliente';
  salonId?: string;
  salonData?: any;
}> {
  if (!supabase || !isSupabaseConfigured || (!userId && !userEmail && !userCpf)) {
    return { isMember: false, role: 'cliente' };
  }

  if (!salonIdentifier || !salonIdentifier.trim()) {
    return { isMember: false, role: 'cliente' };
  }

  const cleanIdent = salonIdentifier.trim().toLowerCase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanIdent);
  const isValidSlug = /^[a-z0-9-]+$/.test(cleanIdent);

  if (!isUuid && !isValidSlug) {
    return { isMember: false, role: 'cliente' };
  }

  try {
    let salonQuery = (supabase.from('salons') as any).select('*');
    if (isUuid) {
      salonQuery = salonQuery.eq('id', cleanIdent);
    } else {
      salonQuery = salonQuery.eq('slug', cleanIdent);
    }

    const { data: salonRes, error: salonErr } = await salonQuery.maybeSingle();
    if (salonErr || !salonRes) {
      if (salonErr) console.warn('Erro ao consultar salão por identificador:', salonErr.message);
      return { isMember: false, role: 'cliente' };
    }

    const targetSalonId = salonRes.id;
    const targetSalonData = salonRes;
    const cleanEmail = (userEmail || '').trim().toLowerCase();

    // Coletar todos os IDs candidatos do usuário (auth.uid, clients.user_id, clients.id, profiles.id)
    const candidateIds = new Set<string>();
    if (userId && userId.trim()) {
      candidateIds.add(userId.trim());
    }
    let userCpfDigits = (userCpf || '').replace(/\D/g, '');
    let resolvedClientEmail = cleanEmail;

    if (userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId.trim())) {
      try {
        const { data: clientById } = await (supabase.from('clients') as any)
          .select('id, user_id, cpf, email')
          .or(`id.eq.${userId.trim()},user_id.eq.${userId.trim()}`)
          .limit(3);
        if (Array.isArray(clientById)) {
          for (const c of clientById) {
            if (c?.id) candidateIds.add(String(c.id));
            if (c?.user_id) candidateIds.add(String(c.user_id));
            if (c?.cpf && !userCpfDigits) userCpfDigits = String(c.cpf).replace(/\D/g, '');
            if (c?.email && (!resolvedClientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedClientEmail))) {
              resolvedClientEmail = String(c.email).trim().toLowerCase();
            }
          }
        }
      } catch {}
    }

    if (cleanEmail) {
      try {
        const isRealEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
        const { data: clientRows } = await (supabase.from('clients') as any)
          .select('id, user_id, cpf, email, username')
          .ilike(isRealEmail ? 'email' : 'username', cleanEmail)
          .limit(5);
        if (Array.isArray(clientRows)) {
          for (const c of clientRows) {
            if (c?.id) candidateIds.add(String(c.id));
            if (c?.user_id) candidateIds.add(String(c.user_id));
            if (c?.cpf && !userCpfDigits) userCpfDigits = String(c.cpf).replace(/\D/g, '');
            if (c?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedClientEmail)) {
              resolvedClientEmail = String(c.email).trim().toLowerCase();
            }
          }
        }
      } catch {}

      try {
        const { data: profileRows } = await (supabase.from('profiles') as any)
          .select('id')
          .ilike('email', resolvedClientEmail || cleanEmail)
          .limit(2);
        if (Array.isArray(profileRows)) {
          for (const p of profileRows) {
            if (p?.id) candidateIds.add(String(p.id));
          }
        }
      } catch {}
    }

    if (userCpfDigits) {
      try {
        localStorage.setItem('vagou_user_cpf', userCpfDigits);
      } catch {}
    }

    // CAMADA 1: Checagem Direta de Dono em public.salons (owner_id, email, branding, owner_cpf)
    if (targetSalonData.owner_id && candidateIds.has(String(targetSalonData.owner_id))) {
      return {
        isMember: true,
        role: 'owner',
        salonId: targetSalonId,
        salonData: targetSalonData,
      };
    }

    const effectiveEmailsToCheck = Array.from(
      new Set([cleanEmail, resolvedClientEmail].filter(Boolean))
    );
    if (effectiveEmailsToCheck.length > 0) {
      const salonEmails = [
        targetSalonData.email,
        targetSalonData.branding?.ownerEmail,
        targetSalonData.branding?.legalManagerEmail,
        targetSalonData.branding?.email,
      ]
        .filter(Boolean)
        .map((e) => String(e).trim().toLowerCase());

      if (effectiveEmailsToCheck.some((em) => salonEmails.includes(em))) {
        return {
          isMember: true,
          role: 'owner',
          salonId: targetSalonId,
          salonData: targetSalonData,
        };
      }
    }

    const salonOwnerCpfDigits = String(
      targetSalonData.owner_cpf ||
      targetSalonData.branding?.ownerCpf ||
      targetSalonData.branding?.legalManagerCpf ||
      ''
    ).replace(/\D/g, '');
    if (userCpfDigits.length === 11 && salonOwnerCpfDigits.length === 11 && userCpfDigits === salonOwnerCpfDigits) {
      return {
        isMember: true,
        role: 'owner',
        salonId: targetSalonId,
        salonData: targetSalonData,
      };
    }

    // CAMADA 2: Consulta na tabela salon_members por user_id E salon_id
    if (candidateIds.size > 0) {
      const { data: members } = await (supabase
        .from('salon_members')
        .select('id, salon_id, user_id, role')
        .eq('salon_id', targetSalonId)
        .in('user_id', Array.from(candidateIds)) as any);

      if (members && members.length > 0) {
        const mem = members[0];
        const memberRole = mem.role === 'owner' ? 'owner' : mem.role === 'manager' ? 'manager' : 'professional';
        return {
          isMember: true,
          role: memberRole,
          salonId: targetSalonId,
          salonData: targetSalonData,
        };
      }
    }

    // CAMADA 3: Consulta na tabela professionals (Equipe do Salão) por salon_id + email
    const emailForPro = resolvedClientEmail || cleanEmail;
    if (emailForPro) {
      const { data: pros } = await (supabase
        .from('professionals')
        .select('id, role, email, is_active')
        .eq('salon_id', targetSalonId)
        .ilike('email', emailForPro) as any);

      if (pros && pros.length > 0) {
        const activePro = pros.find((p: any) => p.is_active !== false) || pros[0];
        const rawProRole = String(activePro.role || '').toLowerCase();
        const mappedProRole: 'owner' | 'manager' | 'professional' =
          rawProRole.includes('admin') || rawProRole.includes('owner') || rawProRole.includes('dono')
            ? 'owner'
            : rawProRole.includes('gerente') || rawProRole.includes('manager')
            ? 'manager'
            : 'professional';
        return {
          isMember: true,
          role: mappedProRole,
          salonId: targetSalonId,
          salonData: targetSalonData,
        };
      }
    }
  } catch (err) {
    console.warn('Erro inesperado ao consultar vínculo do salão:', err);
  }

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
    // 1. Verifica se já existe por user_id ou id
    const { data: existingClient } = await (supabase
      .from('clients') as any)
      .select('*')
      .or(`user_id.eq.${userId},id.eq.${userId}`)
      .limit(1)
      .maybeSingle();

    if (existingClient) {
      return { client: existingClient, error: null };
    }

    // 2. Se não existir, insere com metadados reais
    const resolvedName = userMetadata?.full_name || userMetadata?.name || (userEmail ? userEmail.split('@')[0] : 'Usuário');
    const insertPayload: Record<string, any> = {
      user_id: userId,
      name: resolvedName.trim(),
      phone: userMetadata?.phone || null,
      email: userEmail || null,
      avatar_url: userMetadata?.avatar_url || null,
      ...(userMetadata?.username ? { username: String(userMetadata.username).trim() } : {}),
      ...(userMetadata?.password_hash ? { password_hash: String(userMetadata.password_hash) } : {}),
      ...(userMetadata?.cpf ? { cpf: String(userMetadata.cpf).trim() } : {}),
    };
    const { data: insertedClient, error: insertErr } = await (supabase.from('clients') as any)
      .insert(insertPayload)
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
  ownerCpf?: string;
  pixKey?: string;
  pixKeys?: any[];
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
  faviconUrl?: string;
  primaryColor?: string;
  slogan?: string;
  brandFont?: string;
  bio?: string;
  instagramUrl?: string;
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
    const resolvedIcon = salonData.appIconUrl || salonData.faviconUrl || salonData.logoDarkUrl || salonData.logoLightUrl || null;
    const rawDocDigits = (salonData.documentNumber || '').replace(/\D/g, '');
    const isCnpj14 = rawDocDigits.length === 14;
    const resolvedDocumentNumber = isCnpj14 ? (salonData.documentNumber || '').trim() : '';
    const resolvedLegalName = isCnpj14 ? (salonData.legalName || '').trim() : '';
    const resolvedOwnerCpf = (salonData.ownerCpf || (rawDocDigits.length === 11 ? salonData.documentNumber : '') || '').trim();
    const resolvedPixKeys = Array.isArray(salonData.pixKeys) ? salonData.pixKeys : [];
    const primaryPixFromList = resolvedPixKeys.find((k: any) => k?.isPrimary)?.key || resolvedPixKeys[0]?.key || '';
    const resolvedPixKey = (salonData.pixKey || primaryPixFromList || '').trim();

    const payload: any = {
      slug: salonData.slug,
      trade_name: salonData.tradeName,
      legal_name: resolvedLegalName,
      document_type: isCnpj14 ? 'CNPJ' : '',
      document_number: resolvedDocumentNumber,
      owner_cpf: resolvedOwnerCpf || undefined,
      pix_key: resolvedPixKey || undefined,
      pix_keys: resolvedPixKeys.length > 0 ? resolvedPixKeys : undefined,
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
      favicon_url: resolvedIcon,
      slogan: salonData.slogan ?? undefined,
      brand_font: salonData.brandFont || 'Poppins',
      bio: salonData.bio ?? undefined,
      primary_color: salonData.primaryColor || '#20C933',
      secondary_color: '#0F172A',
      branding: {
        primaryColor: salonData.primaryColor || '#20C933',
        secondaryColor: '#0F172A',
        pwaName: salonData.tradeName,
        themeMode: 'dark',
        faviconUrl: resolvedIcon || '',
        salonIcon: resolvedIcon || '',
        slogan: salonData.slogan || '',
        brandFont: salonData.brandFont || 'Poppins',
        ownerCpf: resolvedOwnerCpf,
        pixKey: resolvedPixKey,
        pixKeys: resolvedPixKeys,
        ...(salonData.instagramUrl ? { instagramUrl: salonData.instagramUrl } : {}),
        ...(salonData.bio ? { bio: salonData.bio } : {}),
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

    let { data, error } = await (supabase.from('salons') as any).upsert(payload, { onConflict: 'slug' }).select().single();

    if (error && (error.message?.includes('column') || error.code === '42703' || error.code === 'PGRST204')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.favicon_url;
      delete fallbackPayload.slogan;
      delete fallbackPayload.brand_font;
      delete fallbackPayload.owner_cpf;
      delete fallbackPayload.pix_key;
      delete fallbackPayload.pix_keys;
      const retry = await (supabase.from('salons') as any).upsert(fallbackPayload, { onConflict: 'slug' }).select().single();
      data = retry.data;
      error = retry.error;
    }

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
    const isRealEmailTerm = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term);

    // 1. Procurar em perfis (profiles) por correspondência exata de e-mail ou nome
    if (!isGenericTerm) {
      let query = supabase.from('profiles').select('*');
      if (isRealEmailTerm) {
        query = query.ilike('email', term);
      } else {
        query = query.ilike('full_name', term);
      }
      const { data: profiles } = await (query as any).limit(1);
      if (profiles && profiles.length > 0) {
        const prof = profiles[0];
        return {
          type: 'client' as const,
          id: prof.id,
          name: prof.full_name || term,
          email: prof.email || (isRealEmailTerm ? term : ''),
          phone: prof.phone_whatsapp || '',
          avatarUrl: prof.avatar_url || '',
        };
      }
    }

    // 2. Procurar em profissionais por correspondência exata
    if (!isGenericTerm) {
      let query = supabase.from('professionals').select('*');
      if (isRealEmailTerm) {
        query = query.ilike('email', term);
      } else {
        query = query.ilike('name', term);
      }
      const { data: pros } = await (query as any).limit(1);
      if (pros && pros.length > 0) {
        const p = pros[0];
        return {
          type: 'professional' as const,
          id: p.id,
          name: p.name || term,
          email: p.email || (isRealEmailTerm ? term : ''),
          phone: p.phone || '',
          avatarUrl: p.avatar_url || '',
          salonId: p.salon_id,
        };
      }
    }

    // 3. Procurar em clientes por correspondência exata (email, username ou name)
    if (!isGenericTerm) {
      let matchedClient: any = null;
      if (isRealEmailTerm) {
        const { data: byEmail } = await (supabase.from('clients') as any)
          .select('*')
          .ilike('email', term)
          .limit(1);
        matchedClient = byEmail?.[0];
      } else {
        const { data: byUser } = await (supabase.from('clients') as any)
          .select('*')
          .ilike('username', term)
          .limit(1);
        matchedClient = byUser?.[0];

        if (!matchedClient) {
          const { data: byName } = await (supabase.from('clients') as any)
            .select('*')
            .ilike('name', term)
            .limit(1);
          matchedClient = byName?.[0];
        }
      }

      if (matchedClient) {
        return {
          type: 'client' as const,
          id: matchedClient.id,
          name: matchedClient.name || matchedClient.username || term,
          email: matchedClient.email || (isRealEmailTerm ? term : ''),
          phone: matchedClient.phone || '',
          avatarUrl: matchedClient.avatar_url || '',
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
  cpf?: string;
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
    const cleanCpf = profile.cpf?.trim() || '';
    const cleanAvatar = profile.avatarUrl || '';

    // 1. Espelhar metadados globais no auth.users (Fonte da Verdade Global da Tríade)
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: cleanName,
          phone: cleanPhone,
          ...(cleanCpf ? { cpf: cleanCpf } : {}),
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

    // 3. Atualizar ou inserir na tabela clients (Unificada para Single Source of Truth, incluindo clients.cpf)
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
            ...(cleanCpf ? { cpf: cleanCpf } : {}),
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
            ...(cleanCpf ? { cpf: cleanCpf } : {}),
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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonIdOrSlug);

    // Obter registro atual para preservar o objeto JSONB branding existente sem perda de chaves
    let existingRow: any = null;
    try {
      const { data: currentSalon } = await (supabase.from('salons') as any)
        .select('owner_id, branding, primary_color, trade_name, logo_url, logo_dark_url, logo_light_url')
        .match(isUuid ? { id: salonIdOrSlug } : { slug: salonIdOrSlug })
        .maybeSingle();
      existingRow = currentSalon;
    } catch {}

    const existingBranding = (existingRow?.branding && typeof existingRow.branding === 'object') ? existingRow.branding : {};

    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (settings.salonName || settings.tradeName) payload.trade_name = settings.salonName || settings.tradeName;

    // Separação Comercial vs Fiscal (CNPJ 14 dígitos): Quando Autônomo (sem CNPJ), document_number e legal_name permanecem ''
    if (settings.cnpj !== undefined || settings.documentNumber !== undefined || settings.razaoSocial !== undefined || settings.legalName !== undefined) {
      const rawDoc = (settings.cnpj ?? settings.documentNumber ?? '').replace(/\D/g, '');
      const isCnpj14 = rawDoc.length === 14;
      payload.document_number = isCnpj14 ? (settings.cnpj ?? settings.documentNumber ?? '').trim() : '';
      payload.legal_name = isCnpj14 ? (settings.razaoSocial ?? settings.legalName ?? '').trim() : '';
      payload.document_type = isCnpj14 ? 'CNPJ' : '';
    }

    // Isolamento do CPF Pessoal do Titular (salons.owner_cpf + espelho em clients.cpf)
    const rawOwnerCpf = settings.ownerCpf ?? settings.legalManagerCpf;
    if (rawOwnerCpf !== undefined) {
      payload.owner_cpf = String(rawOwnerCpf).trim();
      // Espelha o CPF na tabela public.clients do proprietário/titular
      try {
        const ownerUserId = existingRow?.owner_id;
        const ownerEmail = settings.legalManagerEmail || settings.email;
        if (ownerUserId) {
          await (supabase.from('clients') as any)
            .update({ cpf: String(rawOwnerCpf).trim(), updated_at: new Date().toISOString() })
            .eq('user_id', ownerUserId);
        } else if (ownerEmail) {
          await (supabase.from('clients') as any)
            .update({ cpf: String(rawOwnerCpf).trim(), updated_at: new Date().toISOString() })
            .ilike('email', ownerEmail.trim().toLowerCase());
        }
      } catch {}
    }

    // Suporte a Múltiplas Chaves PIX (pix_keys JSONB) e Chave PIX Principal (pix_key text)
    if (settings.pixKeys !== undefined || settings.pixKey !== undefined) {
      const pixKeysList = Array.isArray(settings.pixKeys)
        ? settings.pixKeys
        : (Array.isArray(existingBranding.pixKeys) ? existingBranding.pixKeys : []);
      const primaryFromArray = pixKeysList.find((k: any) => k?.isPrimary)?.key || pixKeysList[0]?.key || '';
      const resolvedPrimaryPix = settings.pixKey !== undefined
        ? (settings.pixKey || primaryFromArray || '')
        : primaryFromArray;

      payload.pix_key = resolvedPrimaryPix;
      if (settings.pixKeys !== undefined) {
        payload.pix_keys = pixKeysList;
      }
    }

    if (settings.salonPhone || settings.phoneWhatsapp || settings.legalManagerPhone) {
      payload.phone_whatsapp = settings.salonPhone || settings.phoneWhatsapp || settings.legalManagerPhone;
    }
    if (settings.phoneLandline !== undefined || settings.phone_landline !== undefined) {
      payload.phone_landline = settings.phoneLandline ?? settings.phone_landline ?? '';
    }
    if (settings.category !== undefined) {
      payload.category = settings.category;
    }
    if (settings.email !== undefined || settings.legalManagerEmail !== undefined) {
      payload.email = settings.email || settings.legalManagerEmail || '';
    }
    if (settings.salonAddress !== undefined || settings.address !== undefined || settings.logradouro !== undefined) {
      payload.address = settings.salonAddress ?? settings.address ?? settings.logradouro ?? '';
    }
    if (settings.numero !== undefined || settings.streetNumber !== undefined) {
      payload.street_number = settings.numero ?? settings.streetNumber ?? '';
    }
    if (settings.complemento !== undefined || settings.complement !== undefined) {
      payload.complement = settings.complemento ?? settings.complement ?? '';
    }
    if (settings.bairro !== undefined || settings.neighborhood !== undefined) {
      payload.neighborhood = settings.bairro ?? settings.neighborhood ?? '';
    }
    if (settings.cidade !== undefined || settings.city !== undefined) {
      payload.city = settings.cidade ?? settings.city ?? '';
    }
    if (settings.uf !== undefined || settings.state !== undefined) {
      payload.state = settings.uf ?? settings.state ?? '';
    }
    if (settings.cep !== undefined || settings.postalCode !== undefined) {
      payload.cep = settings.cep ?? settings.postalCode ?? '';
    }
    if (settings.operatingHoursJson !== undefined) {
      payload.operating_hours = settings.operatingHoursJson;
    }
    if (settings.salonLogoLight !== undefined) payload.logo_light_url = settings.salonLogoLight || null;
    if (settings.salonLogoDark !== undefined) payload.logo_dark_url = settings.salonLogoDark || null;
    if (settings.salonLogo !== undefined || settings.logoUrl !== undefined) {
      payload.logo_url = settings.salonLogo || settings.logoUrl || settings.salonLogoDark || settings.salonLogoLight || null;
    }

    // Colunas sincronizadas pelo Boletim bol-017 (favicon_url, slogan, brand_font)
    if (settings.salonIcon !== undefined || settings.faviconUrl !== undefined) {
      payload.favicon_url = settings.salonIcon || settings.faviconUrl || settings.salonLogo || null;
    }
    if (settings.slogan !== undefined) {
      payload.slogan = settings.slogan ?? undefined;
    }
    if (settings.brandFont !== undefined) {
      payload.brand_font = settings.brandFont || 'Poppins';
    }
    if (settings.accentColor || settings.primaryColor) {
      payload.primary_color = settings.accentColor || settings.primaryColor;
    }
    if (settings.bio !== undefined) payload.bio = settings.bio;

    const resolvedIcon =
      settings.salonIcon !== undefined
        ? (settings.salonIcon || settings.salonLogo || '')
        : (settings.faviconUrl !== undefined
            ? settings.faviconUrl
            : (existingBranding.salonIcon || existingBranding.faviconUrl || existingRow?.logo_url || ''));

    payload.branding = {
      ...existingBranding,
      primaryColor: settings.accentColor || settings.primaryColor || existingBranding.primaryColor || existingRow?.primary_color || '#20C933',
      pwaName: settings.pwaName || settings.salonName || existingBranding.pwaName || existingRow?.trade_name,
      themeMode: 'dark',
      faviconUrl: resolvedIcon,
      salonIcon: resolvedIcon,
      slogan: settings.slogan !== undefined ? (settings.slogan || '') : (existingBranding.slogan || ''),
      brandFont: settings.brandFont || existingBranding.brandFont || 'Poppins',
      navStyle: settings.navStyle || existingBranding.navStyle || 'minimal',
      welcomeStyle: settings.welcomeStyle || existingBranding.welcomeStyle || 'atmospheric',
      ...(rawOwnerCpf !== undefined ? { ownerCpf: String(rawOwnerCpf).trim() } : {}),
      ...(payload.pix_key !== undefined ? { pixKey: payload.pix_key } : {}),
      ...(payload.pix_keys !== undefined ? { pixKeys: payload.pix_keys } : {}),
      ...(settings.category !== undefined ? { category: settings.category } : {}),
      ...(settings.email !== undefined || settings.legalManagerEmail !== undefined
        ? { email: settings.email || settings.legalManagerEmail || '', ownerEmail: settings.email || settings.legalManagerEmail || '' }
        : {}),
      ...(settings.phoneLandline !== undefined ? { phoneLandline: settings.phoneLandline } : {}),
      ...(settings.cep !== undefined ? { cep: settings.cep } : {}),
      ...(settings.numero !== undefined ? { numero: settings.numero } : {}),
      ...(settings.complemento !== undefined ? { complemento: settings.complemento } : {}),
      ...(settings.openingHours !== undefined ? { openingHours: settings.openingHours } : {}),
      ...(settings.operatingHoursJson !== undefined ? { operatingHoursJson: settings.operatingHoursJson } : {}),
      ...(settings.holidays !== undefined ? { holidays: settings.holidays } : {}),
      ...(settings.cancellationPolicy !== undefined ? { cancellationPolicy: settings.cancellationPolicy } : {}),
      ...(settings.spacePhotos !== undefined ? { spacePhotos: settings.spacePhotos } : {}),
      ...(settings.instagramUrl !== undefined ? { instagramUrl: settings.instagramUrl || '' } : {}),
      ...(settings.bio !== undefined ? { bio: settings.bio || '' } : {}),
    };

    let { data, error } = await (supabase.from('salons') as any)
      .update(payload)
      .match(isUuid ? { id: salonIdOrSlug } : { slug: salonIdOrSlug })
      .select()
      .maybeSingle();

    // Fallback resiliente caso alguma coluna física ainda não exista no banco remoto
    if (error && (error.message?.includes('column') || error.code === '42703' || error.code === 'PGRST204')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.favicon_url;
      delete fallbackPayload.slogan;
      delete fallbackPayload.brand_font;
      delete fallbackPayload.owner_cpf;
      delete fallbackPayload.pix_key;
      delete fallbackPayload.pix_keys;
      delete fallbackPayload.phone_landline;
      delete fallbackPayload.operating_hours;
      delete fallbackPayload.street_number;
      delete fallbackPayload.complement;
      delete fallbackPayload.cep;
      const retry = await (supabase.from('salons') as any)
        .update(fallbackPayload)
        .match(isUuid ? { id: salonIdOrSlug } : { slug: salonIdOrSlug })
        .select()
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.warn('Erro ao atualizar configurações do salão no Supabase:', error.message);
      return { success: false, error: error.message };
    }

    if (!data) {
      console.warn('Aviso Supabase: Nenhuma linha do salão foi atualizada no banco remoto (RLS impediu a gravação sem sessão de proprietário). Dados preservados localmente.');
      return {
        success: false,
        error: 'Gravado localmente no dispositivo. (Aviso: Para sincronizar permanentemente na nuvem Supabase, efetue o login no painel de gestão).',
        isRlsBlocked: true,
        localOnly: true,
      };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Falha ao atualizar salão no Supabase:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Sincroniza a lista completa de serviços do Salão com o Supabase (CRUD Total: Upsert + Remoção Real)
 */
export async function syncAllServicesToDb(salonId: string, services: any[]) {
  if (!supabase || !isSupabaseConfigured || !salonId) return { success: false };
  try {
    // 1. Buscar serviços atualmente ativos deste salão no banco para detectar exclusões
    const { data: existingRows } = await (supabase.from('services') as any)
      .select('id')
      .eq('salon_id', salonId);

    const activeServiceIds: string[] = [];

    // 2. Para cada serviço fornecido, garante UUID v4 e realiza upsert por 'id'
    for (const s of services) {
      const durationMinutes = typeof s.duration === 'string'
        ? parseInt(s.duration.replace(/\D/g, '')) || 40
        : (s.duration_minutes || s.durationMinutes || 40);

      const isUuid = s.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s.id));
      const serviceUuid = isUuid ? String(s.id) : generateUuidV4();
      s.id = serviceUuid;
      activeServiceIds.push(serviceUuid);

      const payload: any = {
        id: serviceUuid,
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

      await (supabase.from('services') as any).upsert(payload, { onConflict: 'id' });
    }

    // 3. Remover/desativar no banco os serviços que foram excluídos pelo proprietário
    const activeSet = new Set(activeServiceIds);
    const removedIds = (existingRows || [])
      .map((r: any) => r.id)
      .filter((id: string) => id && !activeSet.has(id));

    if (removedIds.length > 0) {
      const { error: delError } = await (supabase.from('services') as any)
        .delete()
        .eq('salon_id', salonId)
        .in('id', removedIds);

      if (delError) {
        // Fallback seguro (soft-delete) caso o serviço já tenha agendamentos históricos vinculados por FK
        await (supabase.from('services') as any)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('salon_id', salonId)
          .in('id', removedIds);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Falha ao sincronizar catálogo de serviços no Supabase:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Sincroniza a lista de profissionais da equipe no Supabase (public.professionals + espelho em salons.branding.teamMembers)
 */
export async function syncAllProfessionalsToDb(salonId: string, professionals: any[]) {
  if (!supabase || !isSupabaseConfigured || !salonId) return { success: false };
  try {
    const { data: existingPros } = await (supabase.from('professionals') as any)
      .select('id')
      .eq('salon_id', salonId);

    const activeProIds: string[] = [];

    for (const p of professionals) {
      const isUuid = p.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(p.id));
      const proUuid = isUuid ? String(p.id) : generateUuidV4();
      p.id = proUuid;
      activeProIds.push(proUuid);

      const payload: any = {
        id: proUuid,
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

      const { error: upsertErr } = await (supabase.from('professionals') as any).upsert(payload, { onConflict: 'id' });
      if (upsertErr) {
        // Fallback resiliente caso alguma coluna opcional não exista na tabela professionals
        await (supabase.from('professionals') as any).upsert(
          {
            id: proUuid,
            salon_id: salonId,
            name: p.name || 'Profissional',
            role: p.role || 'Profissional',
            avatar_url: p.avatarUrl || p.avatar || null,
            is_active: p.isActive !== false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    }

    const activeProSet = new Set(activeProIds);
    const removedProIds = (existingPros || [])
      .map((r: any) => r.id)
      .filter((id: string) => id && !activeProSet.has(id));

    if (removedProIds.length > 0) {
      const { error: delErr } = await (supabase.from('professionals') as any)
        .delete()
        .eq('salon_id', salonId)
        .in('id', removedProIds);
      if (delErr) {
        await (supabase.from('professionals') as any)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('salon_id', salonId)
          .in('id', removedProIds);
      }
    }

    // Espelhar metadados completos da equipe (comissões, turnos, especialidades) em salons.branding.teamMembers
    try {
      const isSalonUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonId);
      const { data: currentSalon } = await (supabase.from('salons') as any)
        .select('branding')
        .match(isSalonUuid ? { id: salonId } : { slug: salonId })
        .maybeSingle();

      const existingBranding = (currentSalon?.branding && typeof currentSalon.branding === 'object') ? currentSalon.branding : {};
      await (supabase.from('salons') as any)
        .update({
          branding: {
            ...existingBranding,
            teamMembers: professionals,
          },
          updated_at: new Date().toISOString(),
        })
        .match(isSalonUuid ? { id: salonId } : { slug: salonId });
    } catch {}

    return { success: true };
  } catch (err: any) {
    console.error('Falha ao sincronizar profissionais no Supabase:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Persiste as configurações de Espaço, Horário de Funcionamento (operating_hours), Feriados, Regras e Galeria no Supabase
 */
export async function updateSalonSpaceConfigInDb(
  salonIdOrSlug: string,
  spaceConfig: {
    operatingHours?: Record<string, any>;
    openingHoursSummary?: string;
    holidays?: any[];
    cancellationPolicy?: any;
    spacePhotos?: any[];
  }
) {
  if (!supabase || !isSupabaseConfigured || !salonIdOrSlug) {
    return { success: false, error: 'Supabase não configurado ou identificador vazio' };
  }
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonIdOrSlug);
    const { data: currentSalon } = await (supabase.from('salons') as any)
      .select('branding, operating_hours')
      .match(isUuid ? { id: salonIdOrSlug } : { slug: salonIdOrSlug })
      .maybeSingle();

    const existingBranding = (currentSalon?.branding && typeof currentSalon.branding === 'object') ? currentSalon.branding : {};

    const nextBranding: Record<string, any> = {
      ...existingBranding,
      ...(spaceConfig.operatingHours !== undefined ? { operatingHoursJson: spaceConfig.operatingHours } : {}),
      ...(spaceConfig.openingHoursSummary !== undefined ? { openingHours: spaceConfig.openingHoursSummary } : {}),
      ...(spaceConfig.holidays !== undefined ? { holidays: spaceConfig.holidays } : {}),
      ...(spaceConfig.cancellationPolicy !== undefined ? { cancellationPolicy: spaceConfig.cancellationPolicy } : {}),
      ...(spaceConfig.spacePhotos !== undefined ? { spacePhotos: spaceConfig.spacePhotos } : {}),
    };

    const payload: Record<string, any> = {
      branding: nextBranding,
      updated_at: new Date().toISOString(),
      ...(spaceConfig.operatingHours !== undefined ? { operating_hours: spaceConfig.operatingHours } : {}),
    };

    let { error } = await (supabase.from('salons') as any)
      .update(payload)
      .match(isUuid ? { id: salonIdOrSlug } : { slug: salonIdOrSlug });

    if (error && (error.message?.includes('column') || error.code === '42703' || error.code === 'PGRST204')) {
      const fallbackPayload = { ...payload };
      delete fallbackPayload.operating_hours;
      const retry = await (supabase.from('salons') as any)
        .update(fallbackPayload)
        .match(isUuid ? { id: salonIdOrSlug } : { slug: salonIdOrSlug });
      error = retry.error;
    }

    if (error) {
      console.warn('Erro ao salvar configurações do espaço no Supabase:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Falha ao salvar espaço no Supabase:', err);
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


