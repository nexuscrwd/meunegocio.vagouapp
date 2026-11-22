import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import type { BookingAppointment } from '../types';
import { DEFAULT_NEUTRAL_HEX, resolveThemePresetId } from '../utils/themePalette';
import { formatDurationFromMinutes, parseDurationToMinutes } from '../utils/duration';
import {
  isGenericTemplateName,
  sanitizeSalonMediaUrlForDb,
  TEMPLATE_APP_NAME,
} from '../utils/templateBranding';

const DEFAULT_SUPABASE_URL = 'https://xemenxdhuoekytyhmgyt.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlbWVueGRodW9la3l0eWhtZ3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMDE2MzAsImV4cCI6MjEwNTc3NzYzMH0.P-q6bQspwuQNhub08hjWmsjLrugr3CVA1NIdznWJxuo';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env) || {};
const rawEnvUrl = (env as any).VITE_SUPABASE_URL;
const supabaseUrl = (rawEnvUrl && String(rawEnvUrl).startsWith('https://') && rawEnvUrl !== 'https://your-project-id.supabase.co')
  ? String(rawEnvUrl)
  : DEFAULT_SUPABASE_URL;
const rawEnvKey = (env as any).VITE_SUPABASE_ANON_KEY;
const supabaseAnonKey = (rawEnvKey && String(rawEnvKey).length > 20 && rawEnvKey !== 'your-anon-key-here')
  ? String(rawEnvKey)
  : DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  supabaseUrl !== 'https://your-project-id.supabase.co'
);

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabaseAdmin = supabase;

export const getDbClient = () => supabase;

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

  const cleanIdent = (salonIdentifier || '').trim().toLowerCase();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanIdent);
  const isValidSlug = /^[a-z0-9-]+$/.test(cleanIdent);

  try {
    let salonRes: any = null;

    if (cleanIdent && (isUuid || isValidSlug)) {
      let salonQuery = (supabase.from('salons') as any).select('*');
      if (isUuid) {
        salonQuery = salonQuery.eq('id', cleanIdent);
      } else {
        salonQuery = salonQuery.eq('slug', cleanIdent);
      }
      const { data } = await salonQuery.maybeSingle();
      if (data) salonRes = data;
    }

    if (!salonRes) {
      const { data: allSalons } = await (supabase.from('salons') as any)
        .select('*')
        .order('created_at', { ascending: true })
        .limit(20);

      if (Array.isArray(allSalons) && allSalons.length > 0) {
        if (cleanIdent) {
          salonRes =
            allSalons.find((s: any) => {
              const sSlug = String(s.slug || '').toLowerCase();
              const sNameSlug = String(s.trade_name || '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
              return (
                (sSlug && (cleanIdent.includes(sSlug) || sSlug.includes(cleanIdent))) ||
                (sNameSlug && (cleanIdent.includes(sNameSlug) || sNameSlug.includes(cleanIdent)))
              );
            }) || allSalons[0];
        } else {
          salonRes = allSalons.find((s: any) => s.is_active !== false) || allSalons[0];
        }
      }
    }

    const targetSalonId = salonRes?.id;
    const targetSalonData = salonRes || null;
    const cleanEmail = (userEmail || '').trim().toLowerCase();

    const candidateIds = new Set<string>();
    if (userId && userId.trim()) {
      candidateIds.add(userId.trim());
    }
    let userCpfDigits = (userCpf || '').replace(/\D/g, '');
    let resolvedClientEmail = cleanEmail;
    let isSuperadminMaster =
      typeof window !== 'undefined' && localStorage.getItem('vagou_is_superadmin') === 'true';

    const matchSuperadminRecord = (sa: any, cleanUserNoAt: string): boolean => {
      if (!sa || sa.is_active === false) return false;
      const saId = String(sa.id || '').trim();
      const saUserId = String(sa.user_id || '').trim();
      const saEmail = String(sa.email || '').trim().toLowerCase();
      const saUser = String(sa.username || '').trim().toLowerCase();
      const saUserNoAt = saUser.replace(/^[@#&]+|[@#&]+$/g, '');
      const saCpf = String(sa.cpf || '').replace(/\D/g, '');

      if ((saId && candidateIds.has(saId)) || (saUserId && candidateIds.has(saUserId))) {
        return true;
      }
      if (
        cleanEmail &&
        (saEmail === cleanEmail ||
          saUser === cleanEmail ||
          (cleanUserNoAt && saUserNoAt === cleanUserNoAt && !/[#&]$/.test(cleanEmail)))
      ) {
        return true;
      }
      if (userCpfDigits && userCpfDigits.length === 11 && saCpf === userCpfDigits) {
        return true;
      }
      return false;
    };

    try {
      const { data: sysAdmins } = await (supabase.from('system_admins' as any) as any)
        .select('id, user_id, username, email, cpf, phone_whatsapp, role, is_active')
        .limit(50);

      if (Array.isArray(sysAdmins)) {
        const cleanUserNoAt = cleanEmail.replace(/^[@#&]+|[@#&]+$/g, '');
        const matchedAdmin = sysAdmins.find((sa: any) => matchSuperadminRecord(sa, cleanUserNoAt));

        if (matchedAdmin) {
          isSuperadminMaster = true;
          if (matchedAdmin.id) candidateIds.add(String(matchedAdmin.id));
          if (matchedAdmin.user_id) candidateIds.add(String(matchedAdmin.user_id));
          if (matchedAdmin.email) resolvedClientEmail = String(matchedAdmin.email).trim().toLowerCase();
          if (matchedAdmin.cpf && !userCpfDigits) {
            userCpfDigits = String(matchedAdmin.cpf).replace(/\D/g, '');
          }
        }
      }
    } catch {}

    if (!isSuperadminMaster) {
      try {
        const { data: globalPref } = await (supabase.from('admin_preferences' as any) as any)
          .select('preferences')
          .eq('id', 'global')
          .maybeSingle();
        const authDirectory = globalPref?.preferences?.auth_directory;
        if (Array.isArray(authDirectory)) {
          const cleanUserNoAt = cleanEmail.replace(/^[@#&]+|[@#&]+$/g, '');
          const matchedDirAdmin = authDirectory.find(
            (r: any) =>
              (r?.isSuperadmin || r?.sourceTable === 'system_admins') &&
              matchSuperadminRecord(r, cleanUserNoAt)
          );
          if (matchedDirAdmin) {
            isSuperadminMaster = true;
            if (matchedDirAdmin.id) candidateIds.add(String(matchedDirAdmin.id));
            if (matchedDirAdmin.user_id) candidateIds.add(String(matchedDirAdmin.user_id));
            if (matchedDirAdmin.email) {
              resolvedClientEmail = String(matchedDirAdmin.email).trim().toLowerCase();
            }
          }
        }
      } catch {}
    }

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

      try {
        const { data: profById } = await (supabase.from('profiles') as any)
          .select('id, email, cpf, role')
          .eq('id', userId.trim())
          .maybeSingle();
        if (profById) {
          if (profById.id) candidateIds.add(String(profById.id));
          if (profById.cpf && !userCpfDigits) userCpfDigits = String(profById.cpf).replace(/\D/g, '');
          if (profById.email && (!resolvedClientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedClientEmail))) {
            resolvedClientEmail = String(profById.email).trim().toLowerCase();
          }
          if (String(profById.role || '').toLowerCase() === 'super_admin') {
            isSuperadminMaster = true;
          }
        }
      } catch {}
    }

    if (cleanEmail) {
      try {
        const isRealEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
        if (isRealEmail) {
          const { data: clientRows } = await (supabase.from('clients') as any)
            .select('id, user_id, cpf, email')
            .ilike('email', cleanEmail)
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
        }
      } catch {}

      try {
        const isRealEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
        const { data: profileRows } = await (supabase.from('profiles') as any)
          .select('id, email, cpf, role')
          .ilike(isRealEmail ? 'email' : 'username', resolvedClientEmail || cleanEmail)
          .limit(3);
        if (Array.isArray(profileRows)) {
          for (const p of profileRows) {
            if (p?.id) candidateIds.add(String(p.id));
            if (p?.cpf && !userCpfDigits) userCpfDigits = String(p.cpf).replace(/\D/g, '');
            if (p?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedClientEmail)) {
              resolvedClientEmail = String(p.email).trim().toLowerCase();
            }
            if (String(p?.role || '').toLowerCase() === 'super_admin') {
              isSuperadminMaster = true;
            }
          }
        }
      } catch {}
    }

    if (userCpfDigits) {
      try {
        localStorage.setItem('vagou_user_cpf', userCpfDigits);
      } catch {}
    }

    if (isSuperadminMaster) {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('vagou_is_superadmin', 'true');
        }
      } catch {}
      return {
        isMember: true,
        role: 'owner',
        salonId: targetSalonId,
        salonData: targetSalonData,
      };
    }

    if (!targetSalonData || !targetSalonId) {
      return { isMember: false, role: 'cliente' };
    }

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

    if (candidateIds.size > 0) {
      try {
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
      } catch {}
    }

    const emailForPro = resolvedClientEmail || cleanEmail;
    if (emailForPro) {
      const { data: pros } = await (supabase
        .from('professionals')
        .select('id, role, access_level, email, is_active')
        .eq('salon_id', targetSalonId)
        .ilike('email', emailForPro) as any);

      if (pros && pros.length > 0) {
        const activePro = pros.find((p: any) => p.is_active !== false) || pros[0];
        const rawProRole = String(activePro.access_level || activePro.role || '').toLowerCase();
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

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findExistingClientRow(params: {
  clientId?: string | null;
  userId?: string | null;
  email?: string | null;
  username?: string | null;
}): Promise<any | null> {
  if (!supabase || !isSupabaseConfigured) return null;
  const db = getDbClient() || supabase;

  const cleanClientId = String(params.clientId || '').trim();
  if (cleanClientId && UUID_V4_RE.test(cleanClientId)) {
    try {
      const { data } = await (db.from('clients') as any)
        .select('*')
        .or(`id.eq.${cleanClientId},user_id.eq.${cleanClientId}`)
        .limit(1)
        .maybeSingle();
      if (data?.id) return data;
    } catch {}
  }

  const cleanUserId = String(params.userId || '').trim();
  if (cleanUserId && UUID_V4_RE.test(cleanUserId) && cleanUserId !== cleanClientId) {
    try {
      const { data } = await (db.from('clients') as any)
        .select('*')
        .or(`user_id.eq.${cleanUserId},id.eq.${cleanUserId}`)
        .limit(1)
        .maybeSingle();
      if (data?.id) return data;
    } catch {}
  }

  const cleanEmail = String(params.email || '').trim().toLowerCase();
  if (cleanEmail && cleanEmail.includes('@')) {
    try {
      const { data } = await (db.from('clients') as any)
        .select('*')
        .ilike('email', cleanEmail)
        .limit(1)
        .maybeSingle();
      if (data?.id) return data;
    } catch {}
  }

  const cleanUsername = String(params.username || '').trim();
  if (cleanUsername && cleanUsername.length >= 2) {
    try {
      const { data: prof } = await (db.from('profiles') as any)
        .select('id, email')
        .ilike('username', cleanUsername)
        .limit(1)
        .maybeSingle();
      if (prof?.id) {
        const { data: clientByProf } = await (db.from('clients') as any)
          .select('*')
          .eq('user_id', prof.id)
          .limit(1)
          .maybeSingle();
        if (clientByProf?.id) return clientByProf;
      }
    } catch {}
  }

  return null;
}

export async function ensureClientRow(
  userId: string,
  userEmail?: string | null,
  userMetadata?: Record<string, any> | null
): Promise<{ client: any; error: any }> {
  if (!supabase || !isSupabaseConfigured) {
    return { client: null, error: new Error('Sessão ou Supabase indisponível') };
  }

  const db = getDbClient() || supabase;
  const cleanUserId = String(userId || '').trim();
  const isUuid = UUID_V4_RE.test(cleanUserId);
  const cleanEmail = userEmail ? String(userEmail).trim().toLowerCase() : null;
  const cleanUsername = userMetadata?.username ? String(userMetadata.username).trim() : null;

  try {
    const existingClient = await findExistingClientRow({
      userId: isUuid ? cleanUserId : null,
      email: cleanEmail,
      username: cleanUsername,
    });

    if (existingClient) {
      return { client: existingClient, error: null };
    }

    const resolvedName =
      userMetadata?.full_name ||
      userMetadata?.name ||
      cleanUsername ||
      (cleanEmail ? cleanEmail.split('@')[0] : 'Usuário');

    const insertPayload: Record<string, any> = {
      ...(isUuid ? { user_id: cleanUserId } : {}),
      full_name: String(resolvedName).trim(),
      phone: userMetadata?.phone || null,
      email: cleanEmail || null,
      avatar_url: userMetadata?.avatar_url || null,
      ...(userMetadata?.cpf ? { cpf: String(userMetadata.cpf).trim() } : {}),
    };

    let { data: insertedClient, error: insertErr } = await (db.from('clients') as any)
      .insert(insertPayload)
      .select()
      .maybeSingle();

    if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('duplicate'))) {
      const reFetched = await findExistingClientRow({
        userId: isUuid ? cleanUserId : null,
        email: cleanEmail,
        username: cleanUsername,
      });
      if (reFetched) {
        return { client: reFetched, error: null };
      }
    }

    return { client: insertedClient, error: insertErr };
  } catch (err: any) {
    return { client: null, error: err };
  }
}

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
      bio: salonData.bio ?? undefined,
      primary_color: salonData.primaryColor || '#334155',
      secondary_color: '#1E293B',
      default_theme: 'light',
      branding: {
        primaryColor: salonData.primaryColor || '#334155',
        secondaryColor: '#1E293B',
        pwaName: salonData.tradeName,
        defaultTheme: 'light',
        themeMode: 'light',
        faviconUrl: resolvedIcon || '',
        salonIcon: resolvedIcon || '',
        slogan: salonData.slogan || '',
        brandFont: salonData.brandFont || 'Poppins',
        ownerCpf: resolvedOwnerCpf,
        pixKey: resolvedPixKey,
        pixKeys: resolvedPixKeys,
        homeDeliveryEnabled: salonData.homeDeliverySettings?.enabled ?? false,
        homeDeliveryArea: salonData.homeDeliverySettings?.areaDescription || null,
        homeDeliveryTravelFee: salonData.homeDeliverySettings?.travelFee || 0,
        ...(salonData.instagramUrl ? { instagramUrl: salonData.instagramUrl } : {}),
        ...(salonData.bio ? { bio: salonData.bio } : {}),
      },
      is_verified: true,
      is_active: true,
    };

    if (salonData.ownerUserId) {
      payload.owner_id = salonData.ownerUserId;
    }

    const client = getDbClient() || supabase;
    let workingPayload: Record<string, any> = { ...payload };
    let data: any = null;
    let error: any = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await (client.from('salons') as any)
        .upsert(workingPayload, { onConflict: 'slug' })
        .select()
        .single();
      data = res.data;
      error = res.error;
      if (!error) break;

      const errMsg = String(error.message || error.details || '');
      const isMissingCol =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        errMsg.includes('Could not find the') ||
        errMsg.includes('column');
      if (!isMissingCol) break;

      const matchCol =
        errMsg.match(/Could not find the '([^']+)' column/i) ||
        errMsg.match(/column "([^"]+)" of relation/i) ||
        errMsg.match(/column ([a-zA-Z0-9_]+) does not exist/i);
      const offendingCol = matchCol?.[1];
      if (offendingCol && offendingCol in workingPayload) {
        delete workingPayload[offendingCol];
        continue;
      }

      delete workingPayload.favicon_url;
      delete workingPayload.slogan;
      delete workingPayload.brand_font;
      delete workingPayload.owner_cpf;
      delete workingPayload.pix_key;
      delete workingPayload.pix_keys;
      const retry = await (client.from('salons') as any)
        .upsert(workingPayload, { onConflict: 'slug' })
        .select()
        .single();
      data = retry.data;
      error = retry.error;
      break;
    }

    if (error) {
      console.warn('Erro ao sincronizar salão no Supabase:', error.message);
      return { success: false, error: error.message, mode: 'supabase' as const };
    }

    const cleanCpf = resolvedOwnerCpf.replace(/\D/g, '');
    if (cleanCpf.length === 11 || salonData.email) {
      const geoSyncPayload: Record<string, any> = {
        address: salonData.address || undefined,
        neighborhood: salonData.neighborhood || undefined,
        city: salonData.city || undefined,
        state: salonData.state || 'SP',
        cep: salonData.postalCode || undefined,
        latitude: salonData.latitude,
        longitude: salonData.longitude,
        formatted_address: [
          salonData.address,
          salonData.neighborhood,
          salonData.city,
          salonData.state || 'SP',
          salonData.postalCode,
        ]
          .filter(Boolean)
          .join(', '),
      };
      const tables = ['clients', 'professionals', 'profiles'];
      for (const tbl of tables) {
        try {
          if (cleanCpf.length === 11) {
            await (client.from(tbl as any) as any).update(geoSyncPayload).eq('cpf', cleanCpf);
          } else if (salonData.email) {
            await (client.from(tbl as any) as any)
              .update(geoSyncPayload)
              .ilike('email', salonData.email.trim());
          }
        } catch {}
      }
    }

    return { success: true, data, mode: 'supabase' as const };
  } catch (err: any) {
    console.warn('Falha inesperada na sincronização Supabase:', err?.message);
    return { success: false, error: err?.message, mode: 'fallback' as const };
  }
}

export async function fetchSalonProfessionals(salonId: string) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }

    const isSalonUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonId);
    const { data: salonRow } = await supabase
      .from('salons')
      .select('branding')
      .match(isSalonUuid ? { id: salonId } : { slug: salonId })
      .maybeSingle();

    const brandingObj = (salonRow && typeof salonRow === 'object' && 'branding' in salonRow) ? (salonRow as any).branding : null;
    const jsonbTeam = brandingObj?.teamMembers;
    if (Array.isArray(jsonbTeam) && jsonbTeam.length > 0) {
      return jsonbTeam
        .filter((p: any) => p && p.isActive !== false && p.is_active !== false)
        .map((p: any) => ({
          id: p.id,
          salon_id: salonId,
          name: p.name || 'Profissional',
          role: p.role || 'Profissional',
          avatar_url: p.avatarUrl || p.avatar || null,
          specialties: Array.isArray(p.specialties) ? p.specialties : ['Geral'],
          work_schedule: p.workSchedule || p.work_schedule || p.schedule_config || null,
          schedule_config: p.workSchedule || p.schedule_config || null,
          is_active: p.isActive !== false && p.is_active !== false,
        }));
    }

    return data || [];
  } catch {
    return [];
  }
}

export async function fetchSalonServices(salonId: string) {
  if (!supabase) return [];
  const client = getDbClient() || supabase;
  try {

    const { data, error } = await (client.from('services') as any)
      .select('*')
      .eq('salon_id', salonId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data;
    }

    const isSalonUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonId);
    const { data: salonRow } = await (client.from('salons') as any)
      .select('branding')
      .match(isSalonUuid ? { id: salonId } : { slug: salonId })
      .maybeSingle();

    const brandingObj = (salonRow && typeof salonRow === 'object' && 'branding' in salonRow) ? (salonRow as any).branding : null;
    const jsonbServices = brandingObj?.catalogServices || brandingObj?.services;
    if (Array.isArray(jsonbServices) && jsonbServices.length > 0) {
      return jsonbServices.map((s: any) => ({
        id: s.id,
        salon_id: salonId,
        name: s.name || s.title || 'Serviço',
        title: s.title || s.name || 'Serviço',
        category: s.category || 'Geral',
        price: Number(s.price) || 0,
        duration_minutes: parseDurationToMinutes(s.duration_minutes ?? s.durationMinutes ?? s.duration, 40),
        commission_rate: Number(s.commissionRate ?? s.commission_rate ?? 50),
        description: s.description || null,
        image_url: s.image || s.image_url || (s.photos && s.photos.length > 0 ? s.photos[0] : null),
        photos: s.photos || [],
        videos: s.videos || [],
        slides: s.slides || [],
        is_active: s.is_active !== false,
      }));
    }

    return data || [];
  } catch {
    return [];
  }
}

export function mapDbAppointmentToBookingAppointment(dbApt: any, fallbackSalonName = ''): BookingAppointment {
  const rawProto = dbApt.protocol_code || '';
  const protocol = rawProto ? (rawProto.startsWith('#') ? rawProto : `#${rawProto}`) : `#VGA-${dbApt.id ? String(dbApt.id).slice(0, 5) : Math.floor(10000 + Math.random() * 90000)}`;

  let dateFormatted = '';
  if (dbApt.date_str) {
    const parts = String(dbApt.date_str).split('-');
    if (parts.length === 3) {
      dateFormatted = `${parts[2]}/${parts[1]}`;
    } else {
      dateFormatted = String(dbApt.date_str);
    }
  }

  const startTimeStr = dbApt.start_time ? String(dbApt.start_time).slice(0, 5) : '';
  const dateTimeFormatted = dateFormatted && startTimeStr
    ? `${dateFormatted} às ${startTimeStr}`
    : (dateFormatted || startTimeStr || 'Data a confirmar');

  const salonTradeName = dbApt.salons?.trade_name || dbApt.salon_name || fallbackSalonName || 'Meu Estabelecimento';
  const resolvedProName = dbApt.professionals?.name || dbApt.professional_name || dbApt.professional || 'Equipe do Salão';
  const rawClientAvatar =
    dbApt.client_avatar_url ||
    dbApt.clients?.avatar_url ||
    dbApt.client_avatar ||
    dbApt.customer_avatar ||
    dbApt.clientAvatar ||
    dbApt.customerAvatar ||
    '';
  const validClientAvatar = isValidAvatarUrlString(rawClientAvatar) ? rawClientAvatar.trim() : undefined;

  return {
    id: dbApt.id,
    protocolCode: protocol,
    serviceTitle: dbApt.service_title || 'Serviço',
    service: dbApt.service_title || 'Serviço',
    serviceName: dbApt.service_title || 'Serviço',
    professionalName: resolvedProName,
    professional: resolvedProName,
    salonName: salonTradeName,
    dateTime: dateTimeFormatted,
    time: startTimeStr,
    dateIso: dbApt.date_str,
    totalPrice: Number(dbApt.price) || 0,
    status: (dbApt.status || 'CONFIRMADO').toUpperCase(),
    clientName: dbApt.client_name || dbApt.customer_name || 'Cliente',
    customerName: dbApt.client_name || dbApt.customer_name || 'Cliente',
    clientPhone: dbApt.client_phone || dbApt.customer_phone || '',
    customerPhone: dbApt.client_phone || dbApt.customer_phone || '',
    customerEmail: dbApt.client_email || dbApt.customer_email || '',
    clientAvatar: validClientAvatar,
    customerAvatar: validClientAvatar,
    client_user_id: dbApt.client_id || dbApt.client_user_id || undefined,
    createdAt: dbApt.created_at,
    isBlockedSlot: Boolean(dbApt.is_blocked_slot || (dbApt.status || '').toUpperCase() === 'BLOQUEADO'),
    blockReason: dbApt.block_reason || undefined,

    is_dependent: Boolean(dbApt.is_dependent),
    dependent_id: dbApt.dependent_id || undefined,
    dependent_name: dbApt.dependent_name || undefined,
    service_location_type: dbApt.service_location_type || 'in_salon',
    transport_mode: dbApt.transport_mode || 'driving',
    tracking_status: dbApt.tracking_status || 'idle',
    selected_route_summary: dbApt.selected_route_summary || undefined,
    route_polyline: dbApt.route_polyline || undefined,
    current_street_name: dbApt.current_street_name || undefined,
    route_checkpoints: Array.isArray(dbApt.route_checkpoints) ? dbApt.route_checkpoints : undefined,
    active_adversity: dbApt.active_adversity || null,
    delay_minutes: dbApt.delay_minutes != null ? Number(dbApt.delay_minutes) : 0,
    client_lat: dbApt.client_lat != null ? Number(dbApt.client_lat) : undefined,
    client_lng: dbApt.client_lng != null ? Number(dbApt.client_lng) : undefined,
    distance_km: dbApt.distance_km != null ? Number(dbApt.distance_km) : undefined,
    eta_minutes: dbApt.eta_minutes != null ? Number(dbApt.eta_minutes) : undefined,
    prep_buffer_minutes: dbApt.prep_buffer_minutes != null ? Number(dbApt.prep_buffer_minutes) : 15,
    cancellation_reason: dbApt.cancellation_reason || undefined,
    last_location_update: dbApt.last_location_update || undefined,
  };
}

export async function resolveClientAvatarsMap(): Promise<Record<string, string>> {
  let avatarMap: Record<string, string> = {};

  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('vagou_client_avatars_map');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          avatarMap = { ...avatarMap, ...parsed };
        }
      }

      const userAv = localStorage.getItem('vagou_user_avatar');
      const userEmail = (localStorage.getItem('vagou_user_email') || '').trim().toLowerCase();
      const userName = (localStorage.getItem('vagou_user_name') || '').trim().toLowerCase();
      const userPhone = (localStorage.getItem('vagou_user_phone') || '').replace(/\D/g, '');
      if (isValidAvatarUrlString(userAv)) {
        if (userEmail) avatarMap[userEmail] = userAv.trim();
        if (userName) avatarMap[userName] = userAv.trim();
        if (userPhone.length >= 8) {
          avatarMap[userPhone] = userAv.trim();
          avatarMap[userPhone.slice(-9)] = userAv.trim();
          avatarMap[userPhone.slice(-8)] = userAv.trim();
        }
      }
    } catch {}
  }

  if (!supabase || !isSupabaseConfigured) return avatarMap;
  const client = getDbClient() || supabase;

  const registerRecord = (rec: {
    id?: string | null;
    user_id?: string | null;
    name?: string | null;
    full_name?: string | null;
    username?: string | null;
    email?: string | null;
    phone?: string | null;
    phone_whatsapp?: string | null;
    avatar_url?: string | null;
  }) => {
    if (!rec || !isValidAvatarUrlString(rec.avatar_url)) return;
    const url = rec.avatar_url.trim();
    if (rec.id) avatarMap[String(rec.id).trim().toLowerCase()] = url;
    if (rec.user_id) avatarMap[String(rec.user_id).trim().toLowerCase()] = url;
    if (rec.email) avatarMap[String(rec.email).trim().toLowerCase()] = url;
    if (rec.name) {
      const n = String(rec.name).trim().toLowerCase();
      avatarMap[n] = url;
      const strippedAccents = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (strippedAccents) avatarMap[strippedAccents] = url;
      const fName = n.split(' ')[0];
      if (fName && !avatarMap[fName]) avatarMap[fName] = url;
    }
    if (rec.full_name) {
      const fn = String(rec.full_name).trim().toLowerCase();
      avatarMap[fn] = url;
      const strippedAccents = fn.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (strippedAccents) avatarMap[strippedAccents] = url;
      const fName = fn.split(' ')[0];
      if (fName && !avatarMap[fName]) avatarMap[fName] = url;
    }
    if (rec.username) {
      const cleanU = String(rec.username).trim().toLowerCase();
      avatarMap[cleanU] = url;
      const strippedU = cleanU.replace(/^[@#&]+|[@#&]+$/g, '');
      if (strippedU) avatarMap[strippedU] = url;
    }
    const rawPhone = String(rec.phone || rec.phone_whatsapp || '').replace(/\D/g, '');
    if (rawPhone.length >= 8) {
      avatarMap[rawPhone] = url;
      avatarMap[rawPhone.slice(-9)] = url;
      avatarMap[rawPhone.slice(-8)] = url;
    }
  };

  try {
    const [clientsRes, adminsRes, profilesRes, prosRes] = await Promise.all([
      (client.from('clients') as any)
        .select('id, user_id, full_name, email, phone, avatar_url')
        .not('avatar_url', 'is', null)
        .limit(200)
        .then((r: any) => r.data || [])
        .catch(() => []),
      (client.from('system_admins' as any) as any)
        .select('id, full_name, username, email, phone_whatsapp, avatar_url')
        .not('avatar_url', 'is', null)
        .limit(100)
        .then((r: any) => r.data || [])
        .catch(() => []),
      (client.from('profiles') as any)
        .select('id, full_name, username, email, phone, avatar_url')
        .not('avatar_url', 'is', null)
        .limit(200)
        .then((r: any) => r.data || [])
        .catch(() => []),
      (client.from('professionals') as any)
        .select('id, full_name, email, phone, avatar_url')
        .not('avatar_url', 'is', null)
        .limit(100)
        .then((r: any) => r.data || [])
        .catch(() => []),
    ]);

    (prosRes || []).forEach(registerRecord);
    (profilesRes || []).forEach(registerRecord);
    (adminsRes || []).forEach(registerRecord);
    (clientsRes || []).forEach(registerRecord);

    if (typeof window !== 'undefined' && Object.keys(avatarMap).length > 0) {
      try {
        localStorage.setItem('vagou_client_avatars_map', JSON.stringify(avatarMap));
      } catch {}
    }
  } catch (err) {
    console.warn('Aviso ao construir mapa de avatares de clientes:', err);
  }

  return avatarMap;
}

export async function hydrateAppointmentsWithClientAvatars(rawApts: any[]): Promise<any[]> {
  if (!Array.isArray(rawApts) || rawApts.length === 0) return [];
  try {
    const avatarMap = await resolveClientAvatarsMap();
    if (Object.keys(avatarMap).length === 0) return rawApts;

    return rawApts.map((apt) => {
      if (isValidAvatarUrlString(apt.client_avatar_url)) return apt;
      const cId = String(apt.client_id || apt.client_user_id || '').trim().toLowerCase();
      const cEmail = String(apt.client_email || apt.customer_email || '').trim().toLowerCase();
      const cName = String(apt.client_name || apt.customer_name || '').trim().toLowerCase();
      const cPhone = String(apt.client_phone || apt.customer_phone || '').replace(/\D/g, '');

      const cNameClean = cName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cFirstName = cName.split(' ')[0];

      const matchedAvatar =
        (cId && avatarMap[cId]) ||
        (cEmail && avatarMap[cEmail]) ||
        (cPhone.length >= 8 && (avatarMap[cPhone] || avatarMap[cPhone.slice(-9)] || avatarMap[cPhone.slice(-8)])) ||
        (cName && avatarMap[cName]) ||
        (cNameClean && avatarMap[cNameClean]) ||
        (cFirstName && avatarMap[cFirstName]) ||
        '';

      if (matchedAvatar) {
        return { ...apt, client_avatar_url: matchedAvatar };
      }
      return apt;
    });
  } catch {
    return rawApts;
  }
}

export function mapBookingAppointmentToDbPayload(apt: Partial<BookingAppointment>, salonId: string, clientId?: string): any {
  const cleanProtocol = (apt.protocolCode || `#VGA-${Math.floor(10000 + Math.random() * 90000)}`).trim();
  const rawPrice = Number(apt.totalPrice) || 0;

  let dateStr = apt.dateIso || '';
  let startTime = apt.time || '10:00:00';
  if (!dateStr && apt.dateTime) {
    const match = apt.dateTime.match(/(\d{2})\/(\d{2})\s+às\s+(\d{2}):(\d{2})/);
    if (match) {
      const year = new Date().getFullYear();
      dateStr = `${year}-${match[2]}-${match[1]}`;
      startTime = `${match[3]}:${match[4]}:00`;
    }
  }
  if (!dateStr) {
    dateStr = new Date().toISOString().split('T')[0];
  }
  if (startTime.length === 5) {
    startTime = `${startTime}:00`;
  }

  const [sh, sm] = startTime.split(':').map(Number);
  const durMins = typeof apt.durationMinutes === 'number' && apt.durationMinutes > 0 ? apt.durationMinutes : 45;
  const totalM = (sh * 60 + sm) + durMins;
  const eh = Math.floor(totalM / 60) % 24;
  const em = totalM % 60;
  const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`;

  const isUuid = apt.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apt.id);
  const rawAvatar = apt.clientAvatar || apt.customerAvatar || (apt as any).client_avatar_url || '';
  const validAvatar = isValidAvatarUrlString(rawAvatar) ? rawAvatar.trim() : undefined;

  return {
    ...(isUuid ? { id: apt.id } : {}),
    protocol_code: cleanProtocol,
    salon_id: salonId,
    client_id: clientId || null,
    client_name: apt.clientName || apt.customerName || 'Cliente',
    client_phone: apt.clientPhone || apt.customerPhone || '',
    client_email: (apt as any).clientEmail || apt.customerEmail || null,
    ...(validAvatar ? { client_avatar_url: validAvatar } : {}),
    service_title: apt.serviceTitle || apt.service || 'Serviço',
    price: rawPrice,
    date_str: dateStr,
    start_time: startTime,
    end_time: endTime,
    status: (apt.status || 'CONFIRMADO').toUpperCase(),
    is_blocked_slot: Boolean(apt.isBlockedSlot || (apt.status || '').toUpperCase() === 'BLOQUEADO'),
    block_reason: apt.blockReason || ((apt.status || '').toUpperCase() === 'BLOQUEADO' ? 'Pausa de Emergência' : null),
    professional_name: apt.professionalName || apt.professional || null,
    ...((apt as any).professionalId || (apt as any).professional_id ? { professional_id: (apt as any).professionalId || (apt as any).professional_id } : {}),
    notes: (apt as any).notes || (apt.is_dependent && apt.dependent_name ? `Dependente: ${apt.dependent_name}` : null),
    ...(apt.is_dependent !== undefined ? { is_dependent: apt.is_dependent } : {}),
    ...((apt as any).dependent_id !== undefined ? { dependent_id: (apt as any).dependent_id } : {}),
    ...(apt.dependent_name !== undefined ? { dependent_name: apt.dependent_name } : {}),
    ...(apt.service_location_type !== undefined ? { service_location_type: apt.service_location_type } : {}),
    ...(apt.transport_mode !== undefined ? { transport_mode: apt.transport_mode } : {}),
    ...(apt.tracking_status !== undefined ? { tracking_status: apt.tracking_status } : {}),
    ...(apt.selected_route_summary !== undefined ? { selected_route_summary: apt.selected_route_summary } : {}),
    ...(apt.route_polyline !== undefined ? { route_polyline: apt.route_polyline } : {}),
    ...(apt.current_street_name !== undefined ? { current_street_name: apt.current_street_name } : {}),
    ...(apt.route_checkpoints !== undefined ? { route_checkpoints: apt.route_checkpoints } : {}),
    ...(apt.active_adversity !== undefined ? { active_adversity: apt.active_adversity } : {}),
    ...(apt.delay_minutes !== undefined ? { delay_minutes: apt.delay_minutes } : {}),
    ...(apt.client_lat !== undefined ? { client_lat: apt.client_lat } : {}),
    ...(apt.client_lng !== undefined ? { client_lng: apt.client_lng } : {}),
    ...(apt.distance_km !== undefined ? { distance_km: apt.distance_km } : {}),
    ...(apt.eta_minutes !== undefined ? { eta_minutes: apt.eta_minutes } : {}),
    prep_buffer_minutes: apt.prep_buffer_minutes !== undefined ? apt.prep_buffer_minutes : 15,
    ...(apt.cancellation_reason !== undefined ? { cancellation_reason: apt.cancellation_reason } : {}),
    ...(apt.last_location_update !== undefined ? { last_location_update: apt.last_location_update } : {}),
    updated_at: new Date().toISOString(),
  };
}

export async function fetchSalonAppointments(salonId: string): Promise<any[]> {
  if (!supabase || !isSupabaseConfigured || !salonId) return [];
  const client = getDbClient() || supabase;
  try {
    let resolvedSalonId = salonId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonId)) {
      const { data: sRow } = await (client.from('salons') as any).select('id').eq('slug', salonId).maybeSingle();
      if (sRow?.id) resolvedSalonId = sRow.id;
    }

    const { data, error } = await (client.from('appointments') as any)
      .select('*, salons(trade_name, address, slug), professionals(name, avatar_url)')
      .eq('salon_id', resolvedSalonId)
      .order('date_str', { ascending: false });

    if (error) {
      console.warn('Erro ao buscar agendamentos do salão:', error.message);

      const { data: rawList } = await (client.from('appointments') as any)
        .select('*')
        .eq('salon_id', resolvedSalonId)
        .order('date_str', { ascending: false });
      return hydrateAppointmentsWithClientAvatars(rawList || []);
    }
    return hydrateAppointmentsWithClientAvatars(data || []);
  } catch (err) {
    console.warn('Falha em fetchSalonAppointments:', err);
    return [];
  }
}

export async function fetchUserAppointments(userParams: {
  clientId?: string;
  email?: string;
  phone?: string;
  userId?: string;
}): Promise<any[]> {
  if (!supabase || !isSupabaseConfigured) return [];
  const client = getDbClient() || supabase;

  try {
    const cleanEmail = (userParams.email || (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_email') || localStorage.getItem('vagou_active_partner') || '' : '')).trim().toLowerCase();
    const cleanPhone = (userParams.phone || (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_phone') || '' : '')).trim();
    const cleanClientId = userParams.clientId || '';

    let query = (client.from('appointments') as any)
      .select('*, salons(trade_name, address, slug)')
      .order('date_str', { ascending: false });

    const filters: string[] = [];
    if (cleanClientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanClientId)) {
      filters.push(`client_id.eq.${cleanClientId}`);
    }
    if (cleanEmail && cleanEmail.includes('@')) {
      filters.push(`client_email.ilike.${cleanEmail}`);
    }
    if (cleanPhone) {
      const digits = cleanPhone.replace(/\D/g, '');
      if (digits.length >= 8) {
        filters.push(`client_phone.ilike.%${digits.slice(-8)}%`);
      }
    }

    if (filters.length > 0) {
      query = query.or(filters.join(','));
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        query = query.ilike('client_email', session.user.email);
      } else {
        return [];
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Erro ao consultar agendamentos do cliente:', error.message);
      return [];
    }
    return hydrateAppointmentsWithClientAvatars(data || []);
  } catch (err) {
    console.warn('Falha em fetchUserAppointments:', err);
    return [];
  }
}

export async function upsertAppointmentInDb(appointmentData: any): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase não conectado' };
  }
  const client = getDbClient() || supabase;

  try {
    let resolvedSalonId = appointmentData.salon_id;
    if (!resolvedSalonId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedSalonId)) {
      const activeSlug = typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') || '' : '';
      const activeDbId = typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_db_id') || '' : '';
      if (activeDbId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeDbId)) {
        resolvedSalonId = activeDbId;
      } else if (activeSlug) {
        const { data: sRow } = await (client.from('salons') as any).select('id').eq('slug', activeSlug).maybeSingle();
        if (sRow?.id) resolvedSalonId = sRow.id;
      }
    }

    if (!resolvedSalonId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedSalonId)) {
      const { data: firstSalon } = await (client.from('salons') as any).select('id').eq('is_active', true).limit(1).maybeSingle();
      if (firstSalon?.id) resolvedSalonId = firstSalon.id;
    }

    const payload = {
      ...appointmentData,
      salon_id: resolvedSalonId,
      updated_at: new Date().toISOString(),
    };

    let workingPayload: Record<string, any> = { ...payload };

    if (workingPayload.client_id) {
      const rawCid = String(workingPayload.client_id).trim();
      if (!UUID_V4_RE.test(rawCid)) {
        workingPayload.client_id = null;
      } else {
        const verifiedClient = await findExistingClientRow({
          clientId: rawCid,
          email: workingPayload.client_email || null,
        });
        if (verifiedClient?.id) {
          workingPayload.client_id = verifiedClient.id;
        } else {
          workingPayload.client_id = null;
        }
      }
    }

    let activePayload: Record<string, any> = { ...workingPayload };

    let { data, error } = await (client.from('appointments') as any)
      .upsert(activePayload, { onConflict: 'protocol_code' })
      .select()
      .maybeSingle();

    if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('column'))) {
      const stage1Payload: any = { ...activePayload };
      delete stage1Payload.professional_name;
      delete stage1Payload.client_avatar_url;
      delete stage1Payload.duration_minutes;
      activePayload = stage1Payload;
      const retryStage1 = await (client.from('appointments') as any)
        .upsert(activePayload, { onConflict: 'protocol_code' })
        .select()
        .maybeSingle();
      data = retryStage1.data;
      error = retryStage1.error;
    }

    if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('column'))) {
      const safePayload: any = { ...activePayload };
      delete safePayload.professional_name;
      delete safePayload.client_avatar_url;
      delete safePayload.duration_minutes;
      delete safePayload.is_dependent;
      delete safePayload.dependent_id;
      delete safePayload.dependent_name;
      delete safePayload.service_location_type;
      delete safePayload.transport_mode;
      delete safePayload.tracking_status;
      delete safePayload.selected_route_summary;
      delete safePayload.route_polyline;
      delete safePayload.current_street_name;
      delete safePayload.route_checkpoints;
      delete safePayload.active_adversity;
      delete safePayload.delay_minutes;
      delete safePayload.client_lat;
      delete safePayload.client_lng;
      delete safePayload.distance_km;
      delete safePayload.eta_minutes;
      delete safePayload.prep_buffer_minutes;
      delete safePayload.cancellation_reason;
      delete safePayload.last_location_update;
      delete safePayload.is_blocked_slot;
      delete safePayload.block_reason;
      activePayload = safePayload;
      const retry = await (client.from('appointments') as any)
        .upsert(activePayload, { onConflict: 'protocol_code' })
        .select()
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error && (error.code === '23503' || String(error.message || '').includes('appointments_client_id_fkey'))) {
      const fkSafePayload: any = { ...activePayload, client_id: null };
      const fkRetry = await (client.from('appointments') as any)
        .upsert(fkSafePayload, { onConflict: 'protocol_code' })
        .select()
        .maybeSingle();
      data = fkRetry.data;
      error = fkRetry.error;
    }

    if (error) {
      console.warn('Erro ao realizar upsert de appointment no Supabase:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Falha em upsertAppointmentInDb:', err);
    return { success: false, error: err.message };
  }
}

export async function updateAppointmentLiveTrackingInDb(
  appointmentIdOrProtocol: string,
  livePayload: Partial<BookingAppointment>
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured || !appointmentIdOrProtocol) {
    return { success: false, error: 'Supabase não conectado' };
  }
  const client = getDbClient() || supabase;
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointmentIdOrProtocol);
    const cleanCode = appointmentIdOrProtocol.startsWith('#') ? appointmentIdOrProtocol : `#${appointmentIdOrProtocol}`;
    const nowIso = new Date().toISOString();

    const dbFields: Record<string, any> = {
      updated_at: nowIso,
      last_location_update: livePayload.last_location_update || nowIso,
    };
    if (livePayload.status !== undefined) dbFields.status = livePayload.status;
    if (livePayload.service_location_type !== undefined) dbFields.service_location_type = livePayload.service_location_type;
    if (livePayload.transport_mode !== undefined) dbFields.transport_mode = livePayload.transport_mode;
    if (livePayload.tracking_status !== undefined) dbFields.tracking_status = livePayload.tracking_status;
    if (livePayload.selected_route_summary !== undefined) dbFields.selected_route_summary = livePayload.selected_route_summary;
    if (livePayload.route_polyline !== undefined) dbFields.route_polyline = livePayload.route_polyline;
    if (livePayload.current_street_name !== undefined) dbFields.current_street_name = livePayload.current_street_name;
    if (livePayload.route_checkpoints !== undefined) dbFields.route_checkpoints = livePayload.route_checkpoints;
    if (livePayload.active_adversity !== undefined) dbFields.active_adversity = livePayload.active_adversity;
    if (livePayload.delay_minutes !== undefined) dbFields.delay_minutes = livePayload.delay_minutes;
    if (livePayload.client_lat !== undefined) dbFields.client_lat = livePayload.client_lat;
    if (livePayload.client_lng !== undefined) dbFields.client_lng = livePayload.client_lng;
    if (livePayload.distance_km !== undefined) dbFields.distance_km = livePayload.distance_km;
    if (livePayload.eta_minutes !== undefined) dbFields.eta_minutes = livePayload.eta_minutes;
    if (livePayload.prep_buffer_minutes !== undefined) dbFields.prep_buffer_minutes = livePayload.prep_buffer_minutes;
    if (livePayload.cancellation_reason !== undefined) dbFields.cancellation_reason = livePayload.cancellation_reason;

    let query = (client.from('appointments') as any).update(dbFields);
    const { error } = isUuid
      ? await query.eq('id', appointmentIdOrProtocol)
      : await query.eq('protocol_code', cleanCode);

    if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('column'))) {
      if (livePayload.status) {
        const fallbackQuery = (client.from('appointments') as any).update({
          status: livePayload.status,
          updated_at: nowIso,
        });
        if (isUuid) {
          await fallbackQuery.eq('id', appointmentIdOrProtocol);
        } else {
          await fallbackQuery.eq('protocol_code', cleanCode);
        }
      }
      return { success: true };
    }

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function cancelAppointmentInDb(protocolCode: string, cancellationReason?: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) return { success: false, error: 'Supabase não conectado' };
  const client = getDbClient() || supabase;
  try {
    const cleanCode = protocolCode.startsWith('#') ? protocolCode : `#${protocolCode}`;
    const payload: Record<string, any> = {
      status: 'CANCELADO',
      tracking_status: 'cancelled',
      ...(cancellationReason ? { cancellation_reason: cancellationReason } : {}),
      updated_at: new Date().toISOString(),
    };
    let { error } = await (client.from('appointments') as any)
      .update(payload)
      .eq('protocol_code', cleanCode);

    if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.includes('column'))) {
      const retry = await (client.from('appointments') as any)
        .update({ status: 'CANCELADO', updated_at: new Date().toISOString() })
        .eq('protocol_code', cleanCode);
      error = retry.error;
    }

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export async function removeBlockedSlotInDb(protocolCode: string): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured || !protocolCode) {
    return { success: false, error: 'Supabase não conectado' };
  }
  const client = getDbClient() || supabase;
  try {
    const raw = protocolCode.trim();
    const withHash = raw.startsWith('#') ? raw : `#${raw}`;
    const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;

    const { error: delError } = await (client.from('appointments') as any)
      .delete()
      .or(`protocol_code.eq."${withoutHash}",protocol_code.eq."${withHash}"`);

    if (!delError) {
      return { success: true };
    }

    const { error: updError } = await (client.from('appointments') as any)
      .update({
        status: 'CANCELADO',
        tracking_status: 'cancelled',
        cancellation_reason: 'Despausado pelo estabelecimento',
        updated_at: new Date().toISOString()
      })
      .or(`protocol_code.eq."${withoutHash}",protocol_code.eq."${withHash}"`);

    if (updError) {
      return { success: false, error: updError.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

export function subscribeToAppointments(
  filter: { salonId?: string; clientEmail?: string; clientPhone?: string },
  onChange: (payload: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; newRow: any; oldRow: any }) => void
) {
  if (!supabase || !isSupabaseConfigured) return () => {};

  const channelKey = `rt-appointments-${filter.salonId || 'all'}-${Date.now()}`;
  const channel = supabase
    .channel(channelKey)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'appointments',
      },
      (payload) => {
        const newRecord = payload.new as any;
        const oldRecord = payload.old as any;

        if (filter.salonId && newRecord?.salon_id && newRecord.salon_id !== filter.salonId) {
          return;
        }

        onChange({
          eventType: payload.eventType as any,
          newRow: newRecord,
          oldRow: oldRecord,
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToSalonRealtime(
  salonId: string,
  callbacks: {
    onSalonChange?: (row: any) => void;
    onServicesChange?: (payload: { eventType: string; newRow: any; oldRow: any }) => void;
    onProfessionalsChange?: (payload: { eventType: string; newRow: any; oldRow: any }) => void;
    onUiSettingsChange?: (row: any) => void;
    onMediaChange?: (payload: { eventType: string; newRow: any; oldRow: any }) => void;
  }
) {
  if (!supabase || !isSupabaseConfigured || !salonId) return () => {};

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonId);
  const salonFilter = isUuid ? `id=eq.${salonId}` : `slug=eq.${salonId}`;
  const childFilter = isUuid ? `salon_id=eq.${salonId}` : undefined;

  const channel = supabase.channel(`rt-salon-${salonId}-${Date.now()}`);

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'salons', filter: salonFilter },
    (payload) => {
      if (payload.new && callbacks.onSalonChange) {
        callbacks.onSalonChange(payload.new);
      }
    }
  );

  if (childFilter) {
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'services', filter: childFilter },
        (payload) => {
          callbacks.onServicesChange?.({
            eventType: payload.eventType,
            newRow: payload.new,
            oldRow: payload.old,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'professionals', filter: childFilter },
        (payload) => {
          callbacks.onProfessionalsChange?.({
            eventType: payload.eventType,
            newRow: payload.new,
            oldRow: payload.old,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salon_ui_settings', filter: childFilter },
        (payload) => {
          if (payload.new && callbacks.onUiSettingsChange) {
            callbacks.onUiSettingsChange(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media_assets', filter: childFilter },
        (payload) => {
          callbacks.onMediaChange?.({
            eventType: payload.eventType,
            newRow: payload.new,
            oldRow: payload.old,
          });
        }
      );
  }

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchClientFamilyMembers(guardianClientId: string) {
  if (!supabase) return [];
  const client = getDbClient() || supabase;
  try {
    const { data: deps, error } = await (client.from('dependents' as any) as any)
      .select('*')
      .eq('parent_client_id', guardianClientId)
      .eq('is_unlinked', false)
      .order('created_at', { ascending: true });
    if (error || !Array.isArray(deps)) return [];

    return deps.map((d: any) => ({
      id: d.id,
      guardian_client_id: d.parent_client_id,
      parent_client_id: d.parent_client_id,
      name: d.full_name || d.name || 'Dependente',
      full_name: d.full_name || d.name || 'Dependente',
      relationship: d.relationship || 'other',
      birth_date: d.birth_date || null,
      avatar_url: d.avatar_url || null,
      avatar_emoji: d.avatar_emoji || null,
      gender: d.gender || null,
      autonomy_level: d.autonomy_level || 'parent_controlled',
      notes: d.notes || null,
      is_unlinked: Boolean(d.is_unlinked),
      created_at: d.created_at,
    }));
  } catch {
    return [];
  }
}

export function isValidAvatarUrlString(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (
    !trimmed ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === '[object Object]' ||
    trimmed === '{}' ||
    trimmed.includes('unsplash.com') ||
    trimmed.includes('images.unsplash') ||
    /^\s*data:/i.test(trimmed)
  ) {
    return false;
  }
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  );
}

export async function fetchUserProfileFromDb(identifier?: {
  email?: string;
  name?: string;
  cpf?: string;
  clientId?: string;
  userId?: string;
}) {
  if (!supabase || !isSupabaseConfigured) return null;

  const client = getDbClient() || supabase;
  const rawEmail = (
    identifier?.email ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_email') || localStorage.getItem('vagou_active_partner') : '') ||
    ''
  ).trim();
  const rawName = (
    identifier?.name ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_name') : '') ||
    ''
  ).trim();
  const rawCpf = (
    identifier?.cpf ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_cpf') : '') ||
    ''
  ).replace(/\D/g, '');
  const rawClientId = (
    identifier?.clientId ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_client_id') : '') ||
    ''
  ).trim();
  const rawUserId = (
    identifier?.userId ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_auth_user_id') : '') ||
    ''
  ).trim();

  const term = rawEmail || rawName;
  const isGenericName = !rawName || rawName === 'Profissional' || rawName === 'Usuário' || rawName === 'Visitante' || rawName === 'Cliente';
  const isRealEmailTerm = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);

  let resolvedId = rawClientId || rawUserId || '';
  let resolvedName = !isGenericName ? rawName : '';
  let resolvedEmail = isRealEmailTerm ? rawEmail : '';
  let resolvedPhone = '';
  let resolvedAddress = '';
  let resolvedRole: 'client' | 'professional' = 'client';

  let clientAvatar = '';
  let proAvatar = '';
  let profileAvatar = '';
  let authMetaAvatar = '';

  try {

    try {
      const { data: sysAdmins } = await (client.from('system_admins' as any) as any)
        .select('*')
        .limit(50);
      if (Array.isArray(sysAdmins)) {
        const cleanTermLower = (rawEmail || rawName || '').trim().toLowerCase();
        const cleanTermNoAt = cleanTermLower.replace(/^[@#&]+|[@#&]+$/g, '');
        const matchedAdmin = sysAdmins.find((sa: any) => {
          const saId = String(sa.id || '').trim();
          const saEmail = String(sa.email || '').trim().toLowerCase();
          const saUser = String(sa.username || '').trim().toLowerCase();
          const saUserNoAt = saUser.replace(/^[@#&]+|[@#&]+$/g, '');
          const saName = String(sa.full_name || '').trim().toLowerCase();
          const saCpf = String(sa.cpf || '').replace(/\D/g, '');
          if (rawUserId && saId === rawUserId) return true;
          if (rawClientId && saId === rawClientId) return true;
          if (rawCpf && rawCpf.length === 11 && saCpf === rawCpf) return true;
          if (cleanTermLower && (saEmail === cleanTermLower || saUser === cleanTermLower || saName === cleanTermLower || (cleanTermNoAt && saUserNoAt === cleanTermNoAt))) {
            return true;
          }
          return false;
        });
        if (matchedAdmin) {
          resolvedRole = 'professional';
          resolvedId = matchedAdmin.id || resolvedId;
          resolvedName = matchedAdmin.full_name || matchedAdmin.username || resolvedName;
          resolvedEmail = matchedAdmin.email || resolvedEmail;
          resolvedPhone = matchedAdmin.phone_whatsapp || matchedAdmin.phone_secondary || resolvedPhone;
          if (isValidAvatarUrlString(matchedAdmin.avatar_url)) {
            proAvatar = matchedAdmin.avatar_url.trim();
          }
        }
      }
    } catch {}

    try {
      let matchedClients: any[] = [];

      if (rawClientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawClientId)) {
        const { data } = await (client.from('clients') as any).select('*').eq('id', rawClientId).limit(5);
        if (data?.length) matchedClients.push(...data);
      }

      if (rawCpf && rawCpf.length >= 11) {
        const { data } = await (client.from('clients') as any).select('*').eq('cpf', rawCpf).limit(5);
        if (data?.length) matchedClients.push(...data);
      }

      if (isRealEmailTerm) {
        const { data } = await (client.from('clients') as any).select('*').ilike('email', rawEmail).limit(10);
        if (data?.length) matchedClients.push(...data);
      }

      if (!isGenericName) {
        const { data: byName } = await (client.from('clients') as any).select('*').ilike('full_name', rawName).limit(10);
        if (byName?.length) matchedClients.push(...byName);
      }

      if (matchedClients.length > 0) {
        const bestClient =
          matchedClients.find((c) => isValidAvatarUrlString(c?.avatar_url)) ||
          matchedClients[0];

        if (bestClient) {
          resolvedId = bestClient.id || resolvedId;
          resolvedName = bestClient.full_name || bestClient.name || resolvedName;
          resolvedEmail = bestClient.email || resolvedEmail;
          resolvedPhone = bestClient.phone || resolvedPhone;
          const composedClientAddress = bestClient.address
            ? `${bestClient.address}${bestClient.street_number ? `, ${bestClient.street_number}` : ''}${
                bestClient.neighborhood ? ` - ${bestClient.neighborhood}` : ''
              }${bestClient.city ? `, ${bestClient.city}` : ''}${
                bestClient.state ? ` - ${bestClient.state}` : ''
              }${bestClient.cep ? `, CEP ${bestClient.cep}` : ''}`
            : '';
          resolvedAddress =
            bestClient.formatted_address ||
            bestClient.address ||
            composedClientAddress ||
            bestClient.cep ||
            resolvedAddress;
          if (isValidAvatarUrlString(bestClient.avatar_url)) {
            clientAvatar = bestClient.avatar_url.trim();
          }
        }
      }
    } catch {}

    try {
      let matchedPros: any[] = [];
      if (isRealEmailTerm) {
        const { data } = await (client.from('professionals') as any).select('*').ilike('email', rawEmail).limit(5);
        if (data?.length) matchedPros.push(...data);
      }
      if (!isGenericName) {
        const { data } = await (client.from('professionals') as any).select('*').ilike('full_name', rawName).limit(5);
        if (data?.length) matchedPros.push(...data);
      }
      if (matchedPros.length > 0) {
        const bestPro =
          matchedPros.find((p) => isValidAvatarUrlString(p?.avatar_url)) ||
          matchedPros[0];
        if (bestPro) {
          resolvedRole = 'professional';
          resolvedId = resolvedId || bestPro.id;
          resolvedName = resolvedName || bestPro.full_name || bestPro.name;
          resolvedEmail = resolvedEmail || bestPro.email || '';
          resolvedPhone = resolvedPhone || bestPro.phone || '';
          if (isValidAvatarUrlString(bestPro.avatar_url)) {
            proAvatar = bestPro.avatar_url.trim();
          }
        }
      }
    } catch {}

    try {
      const { data: authUserResp } = await supabase.auth.getUser();
      const authUser = authUserResp?.user;
      if (authUser) {
        const metaAv = authUser.user_metadata?.avatar_url || authUser.user_metadata?.avatar || '';
        if (isValidAvatarUrlString(metaAv)) {
          authMetaAvatar = metaAv.trim();
        }
        const metaName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '';
        resolvedId = resolvedId || authUser.id;
        resolvedName = resolvedName || metaName || authUser.email?.split('@')[0] || '';
        resolvedEmail = resolvedEmail || authUser.email || '';
        resolvedPhone = resolvedPhone || authUser.user_metadata?.phone || '';
        resolvedAddress =
          resolvedAddress ||
          authUser.user_metadata?.address ||
          authUser.user_metadata?.cep ||
          '';

        const { data: prof } = await (client.from('profiles') as any)
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        if (prof) {
          resolvedName = resolvedName || prof.full_name || prof.name || '';
          resolvedPhone = resolvedPhone || prof.phone_whatsapp || prof.phone || '';
          resolvedAddress = resolvedAddress || prof.address || prof.default_address || '';
          if (isValidAvatarUrlString(prof.avatar_url)) {
            profileAvatar = prof.avatar_url.trim();
          }
        }
      }
    } catch {}

    if (!clientAvatar && !proAvatar && !profileAvatar && term) {
      try {
        let query = client.from('profiles').select('*');
        if (isRealEmailTerm) {
          query = query.ilike('email', rawEmail);
        } else if (!isGenericName) {
          query = query.ilike('full_name', rawName);
        }
        const { data: profiles } = await (query as any).limit(5);
        if (profiles && profiles.length > 0) {
          const bestProf =
            profiles.find((p: any) => isValidAvatarUrlString(p?.avatar_url)) ||
            profiles[0];
          if (bestProf) {
            resolvedId = resolvedId || bestProf.id;
            resolvedName = resolvedName || bestProf.full_name || bestProf.name || '';
            resolvedEmail = resolvedEmail || bestProf.email || '';
            resolvedPhone = resolvedPhone || bestProf.phone_whatsapp || bestProf.phone || '';
            if (isValidAvatarUrlString(bestProf.avatar_url)) {
              profileAvatar = bestProf.avatar_url.trim();
            }
          }
        }
      } catch {}
    }

    const finalAvatar = clientAvatar || proAvatar || profileAvatar || authMetaAvatar || '';

    if (resolvedId || resolvedName || resolvedEmail || finalAvatar) {
      return {
        type: resolvedRole,
        id: resolvedId,
        name: resolvedName || term || 'Usuário',
        email: resolvedEmail,
        phone: resolvedPhone,
        address: resolvedAddress,
        avatarUrl: finalAvatar,
      };
    }
  } catch (err) {
    console.warn('Erro ao consultar perfil no Supabase:', err);
  }

  return null;
}

export function resolveTriadeAvatar(params: {
  professionalAvatar?: string | null;
  clientAvatar?: string | null;
  authMetadataAvatar?: string | null;
  salonLogo?: string | null;
  isBusinessContext?: boolean;
}): string {

  const candidates = [
    params.clientAvatar,
    params.professionalAvatar,
    params.authMetadataAvatar,
  ];

  for (const candidate of candidates) {
    if (isValidAvatarUrlString(candidate)) {
      return candidate.trim();
    }
  }

  if (params.isBusinessContext && isValidAvatarUrlString(params.salonLogo)) {
    return params.salonLogo.trim();
  }

  return '';
}

export async function getUniversalUserAvatar(userEmail: string, authMetadataAvatar?: string): Promise<string | null> {
  if (isValidAvatarUrlString(authMetadataAvatar)) {
    return authMetadataAvatar.trim();
  }

  if (!supabase || !isSupabaseConfigured || !userEmail) {
    return null;
  }

  try {
    const cleanEmail = userEmail.trim().toLowerCase();
    const client = getDbClient() || supabase;

    const { data: clientRows } = await (client.from('clients') as any)
      .select('avatar_url')
      .ilike('email', `%${cleanEmail}%`)
      .limit(10);

    const validClientRow = clientRows?.find((r: any) => isValidAvatarUrlString(r?.avatar_url));
    if (validClientRow?.avatar_url) {
      return validClientRow.avatar_url.trim();
    }

    const { data: profRows } = await (client.from('professionals') as any)
      .select('avatar_url')
      .ilike('email', `%${cleanEmail}%`)
      .limit(10);

    const validProfRow = profRows?.find((r: any) => isValidAvatarUrlString(r?.avatar_url));
    if (validProfRow?.avatar_url) {
      return validProfRow.avatar_url.trim();
    }
  } catch (err) {
    console.warn('Erro em getUniversalUserAvatar:', err);
  }

  return null;
}

export async function updateUserProfileInDb(profile: {
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  address?: string;
  avatarUrl?: string;
  clientId?: string;
  userId?: string;
  type?: 'client' | 'pro' | 'admin';
}) {
  if (!supabase || !isSupabaseConfigured) {
    return { success: true, localOnly: true, avatarUrl: isValidAvatarUrlString(profile.avatarUrl) ? profile.avatarUrl.trim() : '' };
  }

  try {
    const cleanEmail = (profile.email || '').trim().toLowerCase();
    const cleanName = (profile.name || '').trim();
    const cleanPhone = (profile.phone || '').trim();
    const cleanCpf = (
      profile.cpf ||
      (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_cpf') : '') ||
      ''
    ).replace(/\D/g, '');
    const storedClientId =
      profile.clientId ||
      (typeof window !== 'undefined' ? localStorage.getItem('vagou_client_id') || '' : '');
    const storedUserId =
      profile.userId ||
      (typeof window !== 'undefined' ? localStorage.getItem('vagou_auth_user_id') || '' : '');

    const hasValidAvatar = isValidAvatarUrlString(profile.avatarUrl);
    const cleanAvatar = hasValidAvatar ? profile.avatarUrl!.trim() : '';

    try {
      const isShortUrl = cleanAvatar.startsWith('http://') || cleanAvatar.startsWith('https://');
      await supabase.auth.updateUser({
        data: {
          ...(cleanName ? { full_name: cleanName } : {}),
          ...(cleanPhone ? { phone: cleanPhone } : {}),
          ...(cleanCpf ? { cpf: cleanCpf } : {}),
          ...(isShortUrl ? { avatar_url: cleanAvatar } : {}),
        },
      });
    } catch (authErr) {
      console.warn('Aviso: Não foi possível atualizar auth.users.user_metadata:', authErr);
    }

    const client = getDbClient() || supabase;

    try {
      const adminUpdatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (cleanName) adminUpdatePayload.full_name = cleanName;
      if (cleanPhone) adminUpdatePayload.phone_whatsapp = cleanPhone;
      if (cleanCpf) adminUpdatePayload.cpf = cleanCpf;
      if (hasValidAvatar) adminUpdatePayload.avatar_url = cleanAvatar;

      if (storedUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedUserId)) {
        await (client.from('system_admins' as any) as any).update(adminUpdatePayload).eq('id', storedUserId);
      } else if (cleanEmail) {
        await (client.from('system_admins' as any) as any).update(adminUpdatePayload).ilike('email', cleanEmail);
      }
    } catch {}

    if (cleanEmail || cleanName) {
      const proUpdatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (cleanName) proUpdatePayload.full_name = cleanName;
      if (cleanPhone) proUpdatePayload.phone = cleanPhone;
      if (hasValidAvatar) proUpdatePayload.avatar_url = cleanAvatar;

      if (cleanEmail) {
        await (client.from('professionals') as any)
          .update(proUpdatePayload)
          .ilike('email', cleanEmail);
      } else if (cleanName && cleanName !== 'Usuário' && cleanName !== 'Profissional') {
        await (client.from('professionals') as any)
          .update(proUpdatePayload)
          .ilike('full_name', cleanName);
      }
    }

    try {
      const profileUpdatePayload: Record<string, any> = {};
      if (cleanName) profileUpdatePayload.full_name = cleanName;
      if (cleanPhone) profileUpdatePayload.phone = cleanPhone;
      if (hasValidAvatar) profileUpdatePayload.avatar_url = cleanAvatar;

      if (Object.keys(profileUpdatePayload).length > 0) {
        if (storedUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedUserId)) {
          await (client.from('profiles') as any).update(profileUpdatePayload).eq('id', storedUserId);
        }
        if (cleanEmail) {
          await (client.from('profiles') as any).update(profileUpdatePayload).ilike('email', cleanEmail);
        }
      }
    } catch {}

    const matchedClientIds = new Set<string>();

    if (storedClientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedClientId)) {
      const { data } = await (client.from('clients') as any).select('id').eq('id', storedClientId).limit(5);
      data?.forEach((r: any) => r?.id && matchedClientIds.add(String(r.id)));
    }

    if (cleanCpf && cleanCpf.length >= 11) {
      const { data } = await (client.from('clients') as any).select('id').eq('cpf', cleanCpf).limit(10);
      data?.forEach((r: any) => r?.id && matchedClientIds.add(String(r.id)));
    }

    if (cleanEmail) {
      const { data } = await (client.from('clients') as any).select('id').ilike('email', cleanEmail).limit(10);
      data?.forEach((r: any) => r?.id && matchedClientIds.add(String(r.id)));
    }

    if (matchedClientIds.size === 0 && cleanName && cleanName !== 'Usuário' && cleanName !== 'Cliente') {
      const { data } = await (client.from('clients') as any).select('id').ilike('full_name', cleanName).limit(10);
      data?.forEach((r: any) => r?.id && matchedClientIds.add(String(r.id)));
    }

    const clientUpdatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (cleanName) clientUpdatePayload.full_name = cleanName;
    if (cleanEmail) clientUpdatePayload.email = cleanEmail;
    if (cleanPhone) clientUpdatePayload.phone = cleanPhone;
    if (cleanCpf) clientUpdatePayload.cpf = cleanCpf;
    if (profile.address !== undefined) clientUpdatePayload.address = profile.address || null;
    if (hasValidAvatar) clientUpdatePayload.avatar_url = cleanAvatar;

    if (matchedClientIds.size > 0) {
      const idsArray = Array.from(matchedClientIds);
      const { error: updateErr } = await (client.from('clients') as any)
        .update(clientUpdatePayload)
        .in('id', idsArray);

      if (updateErr) {
        console.warn('Aviso ao atualizar clients por IDs:', updateErr);
      }
      if (typeof window !== 'undefined' && idsArray[0]) {
        try {
          localStorage.setItem('vagou_client_id', idsArray[0]);
        } catch {}
      }
    } else if (cleanEmail || cleanName || cleanCpf) {
      const { data: insertedClient, error: insertErr } = await (client.from('clients') as any)
        .insert({
          ...(storedUserId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedUserId) ? { user_id: storedUserId } : {}),
          full_name: cleanName || 'Cliente',
          email: cleanEmail || null,
          phone: cleanPhone || null,
          ...(cleanCpf ? { cpf: cleanCpf } : {}),
          avatar_url: hasValidAvatar ? cleanAvatar : null,
          address: profile.address || null,
        })
        .select('id')
        .maybeSingle();

      if (insertErr) {
        console.warn('Aviso ao inserir novo cliente em clients:', insertErr);
      } else if (insertedClient?.id && typeof window !== 'undefined') {
        try {
          localStorage.setItem('vagou_client_id', String(insertedClient.id));
        } catch {}
      }
    }

    return { success: true, avatarUrl: cleanAvatar };
  } catch (err: any) {
    console.error('Erro ao salvar perfil unificado no Supabase:', err);
    return { success: false, error: err.message };
  }
}

export const updateUserProfile = updateUserProfileInDb;

export async function ensureSalonRow(params: {
  id?: string;
  slug?: string;
  tradeName?: string;
  name?: string;
  ownerId?: string;
  email?: string;
  phoneWhatsapp?: string;
  primaryColor?: string;
}): Promise<any> {
  if (!supabase || !isSupabaseConfigured) return null;
  const client = getDbClient() || supabase;

  try {

    if (params.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
      const { data: byId } = await (client.from('salons') as any).select('*').eq('id', params.id).maybeSingle();
      if (byId) return byId;
    }

    const targetSlug = (params.slug || (params.tradeName || params.name || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || '').trim();
    if (targetSlug && targetSlug !== 'meu-estabelecimento' && targetSlug !== 'meu-negocio' && targetSlug !== 'meunegocio') {
      const { data: bySlug } = await (client.from('salons') as any).select('*').eq('slug', targetSlug).maybeSingle();
      if (bySlug) return bySlug;
    }

    if (params.ownerId) {
      const { data: byOwner } = await (client.from('salons') as any).select('*').eq('owner_id', params.ownerId).maybeSingle();
      if (byOwner) return byOwner;
    }

    if (params.email) {
      const { data: byEmail } = await (client.from('salons') as any).select('*').ilike('email', params.email.trim()).maybeSingle();
      if (byEmail) return byEmail;
    }

    const searchName = params.tradeName || params.name;
    if (searchName && !isGenericTemplateName(searchName)) {
      const { data: byName } = await (client.from('salons') as any)
        .select('*')
        .ilike('trade_name', `%${searchName.trim()}%`)
        .maybeSingle();
      if (byName) return byName;
    }

    if (typeof window !== 'undefined') {
      const cachedId = localStorage.getItem('vagou_salon_db_id');
      if (cachedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cachedId)) {
        const { data: byCachedId } = await (client.from('salons') as any).select('*').eq('id', cachedId).maybeSingle();
        if (byCachedId) return byCachedId;
      }
    }

    const newId = (params.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id))
      ? params.id
      : generateUuidV4();
    const finalTradeName = params.tradeName || params.name || TEMPLATE_APP_NAME;
    const finalSlug = targetSlug || `salao-${newId.slice(0, 8)}`;

    let resolvedOwnerId = params.ownerId || null;
    if (!resolvedOwnerId && typeof window !== 'undefined') {
      const cachedUid = (localStorage.getItem('vagou_auth_user_id') || '').trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cachedUid)) {
        resolvedOwnerId = cachedUid;
      }
    }

    const newSalonPayload = {
      id: newId,
      slug: finalSlug,
      trade_name: finalTradeName,
      legal_name: finalTradeName,
      email: params.email || null,
      whatsapp: params.phoneWhatsapp || null,
      phone: params.phoneWhatsapp || null,
      owner_id: resolvedOwnerId,
      is_active: true,
      status: 'active',
      created_via: 'mnvapp',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insErr } = await (client.from('salons') as any)
      .upsert(newSalonPayload, { onConflict: 'slug' })
      .select()
      .maybeSingle();

    if (insErr) {
      const { data: fallback } = await (client.from('salons') as any).select('*').eq('slug', finalSlug).maybeSingle();
      return fallback || null;
    }

    if (inserted?.id && params.primaryColor) {
      try {
        await (client.from('salon_ui_settings') as any).upsert(
          {
            salon_id: inserted.id,
            primary_color: params.primaryColor,
            secondary_color: '#1E293B',
            default_theme: 'light',
          },
          { onConflict: 'salon_id' }
        );
      } catch {}
    }

    return inserted;
  } catch (err) {
    console.warn('Falha em ensureSalonRow:', err);
    return null;
  }
}

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

export async function updateSalonSettingsInDb(salonIdOrSlug: string, settings: any) {
  if (!supabase || !isSupabaseConfigured || !salonIdOrSlug) {
    return { success: false, error: 'Supabase não configurado ou identificador vazio' };
  }
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonIdOrSlug);

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

    if (settings.cnpj !== undefined || settings.documentNumber !== undefined || settings.razaoSocial !== undefined || settings.legalName !== undefined) {
      const rawDoc = (settings.cnpj ?? settings.documentNumber ?? '').replace(/\D/g, '');
      const isCnpj14 = rawDoc.length === 14;
      payload.document_number = isCnpj14 ? (settings.cnpj ?? settings.documentNumber ?? '').trim() : '';
      payload.legal_name = isCnpj14 ? (settings.razaoSocial ?? settings.legalName ?? '').trim() : '';
      payload.document_type = isCnpj14 ? 'CNPJ' : '';
    }

    const rawOwnerCpf = settings.ownerCpf ?? settings.legalManagerCpf;
    if (rawOwnerCpf !== undefined) {
      const cleanOwnerCpf = String(rawOwnerCpf).trim();
      payload.owner_cpf = cleanOwnerCpf || null;

      try {
        const ownerUserId = existingRow?.owner_id;
        const ownerEmail = settings.legalManagerEmail || settings.email;
        if (cleanOwnerCpf) {
          if (ownerUserId) {
            await (supabase.from('clients') as any)
              .update({ cpf: cleanOwnerCpf, updated_at: new Date().toISOString() })
              .eq('user_id', ownerUserId);
          } else if (ownerEmail) {
            await (supabase.from('clients') as any)
              .update({ cpf: cleanOwnerCpf, updated_at: new Date().toISOString() })
              .ilike('email', ownerEmail.trim().toLowerCase());
          }
        }
      } catch {}
    }

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
    } else if (settings.operatingSchedule !== undefined) {
      payload.operating_hours = settings.operatingSchedule;
    }
    if (settings.openingHours !== undefined) {
      payload.opening_hours_text = settings.openingHours;
    }
    if (settings.spaceDescription !== undefined) {
      payload.space_description = settings.spaceDescription;
    }
    if (settings.amenities !== undefined) {
      payload.amenities = settings.amenities;
    }
    const cleanLogoLight = sanitizeSalonMediaUrlForDb(settings.salonLogoLight);
    const cleanLogoDark = sanitizeSalonMediaUrlForDb(settings.salonLogoDark);
    const cleanLogoPrimary = sanitizeSalonMediaUrlForDb(
      settings.salonLogo || settings.logoUrl || settings.salonLogoDark || settings.salonLogoLight
    );
    if (settings.salonLogoLight !== undefined) payload.logo_light_url = cleanLogoLight;
    if (settings.salonLogoDark !== undefined) payload.logo_dark_url = cleanLogoDark;
    if (settings.salonLogo !== undefined || settings.logoUrl !== undefined) {
      payload.logo_url = cleanLogoPrimary;
    }
    if (settings.slogan !== undefined) payload.slogan = settings.slogan || '';
    if (settings.isOpenNow !== undefined) payload.is_open_now = settings.isOpenNow;
    if (settings.websiteUrl !== undefined) payload.website_url = settings.websiteUrl || '';
    if (settings.instagramUrl !== undefined) payload.instagram_url = settings.instagramUrl || '';
    if (settings.facebookUrl !== undefined) payload.facebook_url = settings.facebookUrl || '';
    if (settings.mapsUrl !== undefined) payload.maps_url = settings.mapsUrl || '';
    if (settings.holidays !== undefined) payload.holidays = settings.holidays;
    if (settings.cancellationPolicy !== undefined) payload.cancellation_policy = settings.cancellationPolicy;
    if (settings.spacePhotos !== undefined) payload.space_photos = settings.spacePhotos;

    if (settings.accentColor || settings.primaryColor) {
      payload.primary_color = settings.accentColor || settings.primaryColor;
    }
    if (settings.secondaryColor !== undefined) {
      payload.secondary_color = settings.secondaryColor;
    }

    const effectiveHex = (
      settings.accentColor ||
      settings.primaryColor ||
      existingBranding.primaryColor ||
      existingRow?.primary_color ||
      DEFAULT_NEUTRAL_HEX
    ).toLowerCase();
    const nextIsCustomized =
      settings.themeExplicitlyCustomized !== undefined
        ? Boolean(settings.themeExplicitlyCustomized)
        : settings.defaultTheme === 'dark' || Boolean(existingBranding.themeExplicitlyCustomized);
    const resolvedThemePreset =
      settings.themePresetId || resolveThemePresetId(effectiveHex, nextIsCustomized);

    const firstSpacePhoto = Array.isArray(settings.spacePhotos) && settings.spacePhotos.length > 0 ? settings.spacePhotos[0]?.url : undefined;
    const secondSpacePhoto = Array.isArray(settings.spacePhotos) && settings.spacePhotos.length > 1 ? settings.spacePhotos[1]?.url : undefined;
    const resolvedFacadePhotoUrl =
      settings.facadePhotoUrl !== undefined || firstSpacePhoto !== undefined
        ? (settings.facadePhotoUrl ?? firstSpacePhoto ?? null)
        : existingBranding.facadePhotoUrl;
    const resolvedInteriorPhotoUrl =
      settings.interiorPhotoUrl !== undefined || secondSpacePhoto !== undefined
        ? (settings.interiorPhotoUrl ?? secondSpacePhoto ?? null)
        : existingBranding.interiorPhotoUrl;

    if (settings.bio !== undefined) payload.bio = settings.bio;
    if (settings.defaultTheme !== undefined) payload.default_theme = settings.defaultTheme;

    const rawResolvedIcon =
      settings.salonIcon !== undefined
        ? (settings.salonIcon || '')
        : (settings.faviconUrl !== undefined
            ? settings.faviconUrl
            : (existingBranding.salonIcon || existingBranding.faviconUrl || ''));
    const resolvedIcon = sanitizeSalonMediaUrlForDb(rawResolvedIcon) || '';
    if (settings.salonIcon !== undefined || settings.faviconUrl !== undefined) {
      payload.favicon_url = resolvedIcon || null;
    }

    const resolvedDefaultTheme =
      settings.defaultTheme ||
      (nextIsCustomized ? existingBranding.defaultTheme : 'light') ||
      'light';

    payload.branding = {
      ...existingBranding,
      themePresetId: resolvedThemePreset,
      primaryColor: settings.accentColor || settings.primaryColor || existingBranding.primaryColor || existingRow?.primary_color || DEFAULT_NEUTRAL_HEX,
      ...(settings.secondaryColor !== undefined ? { secondaryColor: settings.secondaryColor } : {}),
      ...(resolvedFacadePhotoUrl !== undefined ? { facadePhotoUrl: resolvedFacadePhotoUrl } : {}),
      ...(resolvedInteriorPhotoUrl !== undefined ? { interiorPhotoUrl: resolvedInteriorPhotoUrl } : {}),
      pwaName: settings.pwaName || settings.salonName || existingBranding.pwaName || existingRow?.trade_name,
      defaultTheme: resolvedDefaultTheme,
      themeMode: resolvedDefaultTheme,
      themeExplicitlyCustomized: nextIsCustomized,
      showSlogan: settings.showSlogan !== undefined ? settings.showSlogan : (existingBranding.showSlogan !== false),
      logoTextFallback: settings.logoTextFallback !== undefined ? settings.logoTextFallback : (existingBranding.logoTextFallback || ''),
      logoTextColor: settings.logoTextColor !== undefined ? settings.logoTextColor : (existingBranding.logoTextColor || settings.accentColor || DEFAULT_NEUTRAL_HEX),
      showHomeTab: settings.showHomeTab !== undefined ? settings.showHomeTab : (existingBranding.showHomeTab !== false),
      showHeroSlides: settings.showHeroSlides !== undefined ? settings.showHeroSlides : (existingBranding.showHeroSlides !== false),
      faviconUrl: resolvedIcon,
      salonIcon: resolvedIcon,
      ...(settings.salonLogoLight !== undefined ? { salonLogoLight: cleanLogoLight || '' } : {}),
      ...(settings.salonLogoDark !== undefined ? { salonLogoDark: cleanLogoDark || '' } : {}),
      ...(settings.salonLogo !== undefined ? { salonLogo: cleanLogoPrimary || '' } : {}),
      slogan: settings.slogan !== undefined ? (settings.slogan || '') : (existingBranding.slogan || ''),
      brandFont: settings.brandFont || existingBranding.brandFont || 'Plus Jakarta Sans',
      welcomeStyle: settings.welcomeStyle || existingBranding.welcomeStyle || 'atmospheric',

      sectionHeaderBgColor: settings.sectionHeaderBgColor !== undefined ? settings.sectionHeaderBgColor : existingBranding.sectionHeaderBgColor,
      sectionHeaderTextColor: settings.sectionHeaderTextColor !== undefined ? settings.sectionHeaderTextColor : existingBranding.sectionHeaderTextColor,
      sectionHeaderIconColor: settings.sectionHeaderIconColor !== undefined ? settings.sectionHeaderIconColor : existingBranding.sectionHeaderIconColor,
      sectionHeaderBgStyle: settings.sectionHeaderBgStyle || existingBranding.sectionHeaderBgStyle || 'solid',
      sectionHeaderBorder: settings.sectionHeaderBorder || existingBranding.sectionHeaderBorder || 'bordered',
      sectionHeaderBtnBgColor: settings.sectionHeaderBtnBgColor !== undefined ? settings.sectionHeaderBtnBgColor : existingBranding.sectionHeaderBtnBgColor,
      sectionHeaderBtnActiveBgColor: settings.sectionHeaderBtnActiveBgColor !== undefined ? settings.sectionHeaderBtnActiveBgColor : existingBranding.sectionHeaderBtnActiveBgColor,
      sectionHeaderBtnBorder: settings.sectionHeaderBtnBorder !== undefined ? settings.sectionHeaderBtnBorder : existingBranding.sectionHeaderBtnBorder,
      sectionHeaderBtnShadow: settings.sectionHeaderBtnShadow !== undefined ? settings.sectionHeaderBtnShadow : existingBranding.sectionHeaderBtnShadow,
      sectionHeaderBtnBlur: settings.sectionHeaderBtnBlur !== undefined ? settings.sectionHeaderBtnBlur : existingBranding.sectionHeaderBtnBlur,
      sectionHeaderBtnFont: settings.sectionHeaderBtnFont !== undefined ? settings.sectionHeaderBtnFont : existingBranding.sectionHeaderBtnFont,

      navStyle: settings.navStyle || existingBranding.navStyle || 'minimal',
      navShape: settings.navShape || existingBranding.navShape || 'square',
      navBorder: settings.navBorder || existingBranding.navBorder || 'bordered',
      navIconBorder: settings.navIconBorder || existingBranding.navIconBorder || 'none',
      navBgStyle: settings.navBgStyle || existingBranding.navBgStyle || 'solid',
      navBgColor: settings.navBgColor !== undefined ? settings.navBgColor : existingBranding.navBgColor,
      navBtnBgColor: settings.navBtnBgColor !== undefined ? settings.navBtnBgColor : existingBranding.navBtnBgColor,
      navBtnActiveBgColor: settings.navBtnActiveBgColor !== undefined ? settings.navBtnActiveBgColor : existingBranding.navBtnActiveBgColor,
      navActiveColor: settings.navActiveColor !== undefined ? settings.navActiveColor : existingBranding.navActiveColor,
      navTextColor: settings.navTextColor !== undefined ? settings.navTextColor : existingBranding.navTextColor,
      navBtnShadow: settings.navBtnShadow !== undefined ? settings.navBtnShadow : existingBranding.navBtnShadow,
      navBtnBlur: settings.navBtnBlur !== undefined ? settings.navBtnBlur : existingBranding.navBtnBlur,
      navBtnFont: settings.navBtnFont !== undefined ? settings.navBtnFont : existingBranding.navBtnFont,

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
      ...(settings.operatingSchedule !== undefined ? { operatingSchedule: settings.operatingSchedule } : {}),
      ...(settings.operatingHoursJson !== undefined ? { operatingHoursJson: settings.operatingHoursJson } : {}),
      ...(settings.holidays !== undefined ? { holidays: settings.holidays } : {}),
      ...(settings.cancellationPolicy !== undefined ? { cancellationPolicy: settings.cancellationPolicy } : {}),
      ...(settings.spacePhotos !== undefined ? { spacePhotos: settings.spacePhotos } : {}),
      ...(settings.spaceDescription !== undefined ? { spaceDescription: settings.spaceDescription } : {}),
      ...(settings.amenities !== undefined ? { amenities: settings.amenities } : {}),
      ...(settings.serviceCategories !== undefined ? { serviceCategories: settings.serviceCategories } : {}),
      ...(settings.pinCode !== undefined ? { pinCode: settings.pinCode } : {}),
      ...(settings.isOpenNow !== undefined ? { isOpenNow: settings.isOpenNow } : {}),
      ...(settings.websiteUrl !== undefined ? { websiteUrl: settings.websiteUrl || '' } : {}),
      ...(settings.instagramUrl !== undefined ? { instagramUrl: settings.instagramUrl || '' } : {}),
      ...(settings.facebookUrl !== undefined ? { facebookUrl: settings.facebookUrl || '' } : {}),
      ...(settings.mapsUrl !== undefined ? { mapsUrl: settings.mapsUrl || '' } : {}),
      ...(settings.bio !== undefined ? { bio: settings.bio || '' } : {}),
    };

    payload.theme_preset_id = resolvedThemePreset;
    if (settings.brandFont !== undefined) payload.brand_font = settings.brandFont || 'Plus Jakarta Sans';
    if (settings.welcomeStyle !== undefined) payload.welcome_style = settings.welcomeStyle || 'atmospheric';
    if (settings.showSlogan !== undefined) payload.show_slogan = settings.showSlogan;
    if (settings.showHomeTab !== undefined) payload.show_home_tab = settings.showHomeTab;
    if (settings.showHeroSlides !== undefined) payload.show_hero_slides = settings.showHeroSlides;
    if (settings.logoTextFallback !== undefined) payload.logo_text_fallback = settings.logoTextFallback || null;
    if (settings.logoTextColor !== undefined) payload.logo_text_color = settings.logoTextColor || null;
    if (settings.sectionHeaderBgColor !== undefined) payload.section_header_bg_color = settings.sectionHeaderBgColor || null;
    if (settings.sectionHeaderTextColor !== undefined) payload.section_header_text_color = settings.sectionHeaderTextColor || null;
    if (settings.sectionHeaderIconColor !== undefined) payload.section_header_icon_color = settings.sectionHeaderIconColor || null;
    if (settings.sectionHeaderBgStyle !== undefined) payload.section_header_bg_style = settings.sectionHeaderBgStyle || 'solid';
    if (settings.sectionHeaderBorder !== undefined) payload.section_header_border = settings.sectionHeaderBorder || 'bordered';
    if (settings.sectionHeaderBtnBgColor !== undefined) payload.section_header_btn_bg_color = settings.sectionHeaderBtnBgColor || null;
    if (settings.sectionHeaderBtnActiveBgColor !== undefined) payload.section_header_btn_active_bg_color = settings.sectionHeaderBtnActiveBgColor || null;
    if (settings.sectionHeaderBtnBorder !== undefined) payload.section_header_btn_border = settings.sectionHeaderBtnBorder || null;
    if (settings.sectionHeaderBtnShadow !== undefined) payload.section_header_btn_shadow = settings.sectionHeaderBtnShadow || null;
    if (settings.sectionHeaderBtnBlur !== undefined) payload.section_header_btn_blur = settings.sectionHeaderBtnBlur || null;
    if (settings.sectionHeaderBtnFont !== undefined) payload.section_header_btn_font = settings.sectionHeaderBtnFont || null;
    if (settings.navStyle !== undefined) payload.nav_style = settings.navStyle || 'minimal';
    if (settings.navShape !== undefined) payload.nav_shape = settings.navShape || 'square';
    if (settings.navBorder !== undefined) payload.nav_border = settings.navBorder || 'bordered';
    if (settings.navIconBorder !== undefined) payload.nav_icon_border = settings.navIconBorder || 'none';
    if (settings.navBgStyle !== undefined) payload.nav_bg_style = settings.navBgStyle || 'solid';
    if (settings.navBgColor !== undefined) payload.nav_bg_color = settings.navBgColor || null;
    if (settings.navBtnBgColor !== undefined) payload.nav_btn_bg_color = settings.navBtnBgColor || null;
    if (settings.navBtnActiveBgColor !== undefined) payload.nav_btn_active_bg_color = settings.navBtnActiveBgColor || null;
    if (settings.navActiveColor !== undefined) payload.nav_active_color = settings.navActiveColor || null;
    if (settings.navTextColor !== undefined) payload.nav_text_color = settings.navTextColor || null;
    if (settings.navBtnShadow !== undefined) payload.nav_btn_shadow = settings.navBtnShadow || null;
    if (settings.navBtnBlur !== undefined) payload.nav_btn_blur = settings.navBtnBlur || null;
    if (settings.navBtnFont !== undefined) payload.nav_btn_font = settings.navBtnFont || null;

    const workingSalonsPayload: Record<string, any> = { ...payload };
    let data: any = null;
    let error: any = null;

    for (let attempt = 0; attempt < 25; attempt++) {
      const res = await (supabaseAdmin.from('salons') as any)
        .update(workingSalonsPayload)
        .match(isUuid ? { id: salonIdOrSlug } : { slug: salonIdOrSlug })
        .select()
        .maybeSingle();
      data = res.data;
      error = res.error;
      if (!error) break;

      const errMsg = String(error.message || error.details || '');
      const colMatch =
        errMsg.match(/Could not find the '([^']+)' column/i) ||
        errMsg.match(/column "([^"]+)" of relation/i) ||
        errMsg.match(/column (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+) does not exist/i);
      const isColError = error.code === 'PGRST204' || error.code === '42703' || Boolean(colMatch);
      if (isColError && colMatch?.[1] && colMatch[1] in workingSalonsPayload) {
        delete workingSalonsPayload[colMatch[1]];
        continue;
      }
      break;
    }

    const resolvedSalonUuid = data?.id || existingRow?.id || (isUuid ? salonIdOrSlug : null);

    if (resolvedSalonUuid) {
      try {
        const mergedUi = payload.branding as Record<string, any>;
        await (supabaseAdmin.from('salon_ui_settings' as any) as any).upsert({
          salon_id: resolvedSalonUuid,
          default_theme: mergedUi.defaultTheme || 'light',
          primary_color: payload.primary_color || mergedUi.primaryColor || DEFAULT_NEUTRAL_HEX,
          secondary_color: payload.secondary_color || mergedUi.secondaryColor || '#1E293B',
          brand_font: mergedUi.brandFont || 'Plus Jakarta Sans',
          pwa_name: mergedUi.pwaName || null,
          slogan: mergedUi.slogan || null,
          show_slogan: mergedUi.showSlogan !== false,
          logo_text_fallback: mergedUi.logoTextFallback || null,
          logo_text_color: mergedUi.logoTextColor || null,
          show_hero_slides: mergedUi.showHeroSlides !== false,
          welcome_style: mergedUi.welcomeStyle || 'atmospheric',
          section_header_bg_color: mergedUi.sectionHeaderBgColor || null,
          section_header_text_color: mergedUi.sectionHeaderTextColor || null,
          section_header_icon_color: mergedUi.sectionHeaderIconColor || null,
          section_header_bg_style: mergedUi.sectionHeaderBgStyle || 'solid',
          section_header_border: mergedUi.sectionHeaderBorder || 'bordered',
          section_header_btn_bg_color: mergedUi.sectionHeaderBtnBgColor || null,
          section_header_btn_active_bg_color: mergedUi.sectionHeaderBtnActiveBgColor || null,
          section_header_btn_border: mergedUi.sectionHeaderBtnBorder || null,
          section_header_btn_shadow: mergedUi.sectionHeaderBtnShadow || null,
          section_header_btn_blur: mergedUi.sectionHeaderBtnBlur || null,
          section_header_btn_font: mergedUi.sectionHeaderBtnFont || null,
          nav_style: mergedUi.navStyle || 'minimal',
          nav_shape: mergedUi.navShape || 'square',
          nav_border: mergedUi.navBorder || 'bordered',
          nav_icon_border: mergedUi.navIconBorder || 'none',
          nav_bg_style: mergedUi.navBgStyle || 'solid',
          nav_bg_color: mergedUi.navBgColor || null,
          nav_btn_bg_color: mergedUi.navBtnBgColor || null,
          nav_btn_active_bg_color: mergedUi.navBtnActiveBgColor || null,
          nav_active_color: mergedUi.navActiveColor || null,
          nav_text_color: mergedUi.navTextColor || null,
          nav_btn_shadow: mergedUi.navBtnShadow || null,
          nav_btn_blur: mergedUi.navBtnBlur || null,
          nav_btn_font: mergedUi.navBtnFont || null,
          branding_snapshot: payload.branding,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'salon_id' });
      } catch (uiSyncErr) {
        console.warn('Aviso: Sincronização salon_ui_settings (não bloqueante):', uiSyncErr);
      }
    }

    if (resolvedSalonUuid && supabaseAdmin) {
      try {
        if (payload.logo_url && !/^\s*data:/i.test(String(payload.logo_url))) {
          await (supabaseAdmin.from('media_assets' as any) as any).upsert({
            salon_id: resolvedSalonUuid,
            owner_type: 'salon_logo',
            owner_id: resolvedSalonUuid,
            bucket: 'branding',
            storage_path: `salon_logo/${resolvedSalonUuid}/logo`,
            public_url: payload.logo_url,
            mime_type: 'image/webp',
            title: 'Logotipo Oficial',
            is_cover: false,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'bucket,storage_path' });
        }
        if (Array.isArray(settings.spacePhotos)) {
          for (const sp of settings.spacePhotos) {
            if (sp?.url && !/^\s*data:/i.test(String(sp.url))) {
              const spUuid = sp.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(sp.id)) ? sp.id : generateUuidV4();
              await (supabaseAdmin.from('media_assets' as any) as any).upsert({
                id: spUuid,
                salon_id: resolvedSalonUuid,
                owner_type: 'salon_gallery',
                owner_id: resolvedSalonUuid,
                bucket: 'salon-media',
                storage_path: `salon_gallery/${resolvedSalonUuid}/${spUuid}`,
                public_url: sp.url,
                mime_type: 'image/webp',
                title: sp.caption || 'Foto do Espaço',
                is_cover: false,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id' });
            }
          }
        }
      } catch {}
    }

    if (!data || error) {
      if (resolvedSalonUuid && typeof fetch !== 'undefined') {
        try {
          const proxyRes = await fetch('/api/salon/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'settings',
              salonId: resolvedSalonUuid,
              payload: settings,
            }),
          });
          if (proxyRes.ok) {
            const proxyJson = await proxyRes.json();
            if (proxyJson?.success) {
              return { success: true, data: data || { id: resolvedSalonUuid } };
            }
          }
        } catch {}
      }

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: false,
        error: 'O banco recusou a gravação por permissão (RLS). Verifique suas credenciais de proprietário.',
      };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Falha ao atualizar salão no Supabase:', err);
    return { success: false, error: err.message || 'Erro inesperado ao salvar no Supabase' };
  }
}

export async function uploadSalonMediaToStorage(
  file: File,
  bucket: 'avatars' | 'branding' | 'services' | 'salon-media' = 'salon-media',
  pathPrefix = 'salon_gallery'
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file, file.name || 'media.webp');
  formData.append('bucket', bucket);
  formData.append('ownerType', pathPrefix);

  const headers: Record<string, string> = {};
  try {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
    }
  } catch {}

  try {
    const res = await fetch('/api/media/upload', {
      method: 'POST',
      headers,
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.publicUrl && !/^\s*data:/i.test(String(data.publicUrl))) {
        return String(data.publicUrl);
      }
    }
  } catch {}

  if (isSupabaseConfigured && supabase) {
    const ext = (file.name?.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
    const fileName = `${pathPrefix}/${generateUuidV4()}.${ext}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, { cacheControl: '31536000', contentType: file.type || 'image/webp', upsert: false });

    if (!error && data?.path) {
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  }

  throw new Error('Falha ao enviar mídia binária para o Supabase Storage. Conversão para texto Base64 não é permitida.');
}

export async function syncAllServicesToDb(
  salonId: string,
  services: any[],
  categories?: string[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  if (!supabase || !isSupabaseConfigured || !salonId) return { success: false, error: 'Identificador do salão não fornecido' };
  const client = getDbClient() || supabase;
  try {

    let resolvedSalonUuid = salonId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonId)) {
      const { data: sRow } = await (client.from('salons') as any).select('id').eq('slug', salonId).maybeSingle();
      if (sRow?.id) {
        resolvedSalonUuid = sRow.id;
      } else {
        const cachedDbId = typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_db_id') : null;
        if (cachedDbId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cachedDbId)) {
          resolvedSalonUuid = cachedDbId;
        } else {
          const ensured = await ensureSalonRow({ slug: salonId });
          if (ensured?.id) resolvedSalonUuid = ensured.id;
        }
      }
    }

    if (!resolvedSalonUuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedSalonUuid)) {
      return { success: false, error: 'Salão não possui UUID válido' };
    }

    const { data: existingRows } = await (client.from('services') as any)
      .select('id')
      .eq('salon_id', resolvedSalonUuid);

    const activeServiceIds: string[] = [];
    let lastServiceError: string | null = null;

    for (const s of services) {
      const durationMinutes = parseDurationToMinutes(s.duration_minutes ?? s.durationMinutes ?? s.duration, 40);

      const isUuid = s.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s.id));
      const serviceUuid = isUuid ? String(s.id) : generateUuidV4();
      s.id = serviceUuid;
      s.duration = formatDurationFromMinutes(durationMinutes);
      activeServiceIds.push(serviceUuid);

      const serviceName = s.title || s.name || 'Serviço';
      const firstPhoto = s.image || s.image_url || (s.photos && s.photos.length > 0 ? s.photos[0] : null);

      const safeUrl = (u?: string | null) => (u && !/^\s*data:/i.test(String(u)) ? String(u) : null);
      const safePhotos = Array.isArray(s.photos)
        ? s.photos.map((p: any) => safeUrl(p)).filter(Boolean)
        : safeUrl(firstPhoto)
        ? [safeUrl(firstPhoto)]
        : [];

      const fullPayload: any = {
        id: serviceUuid,
        salon_id: resolvedSalonUuid,
        name: serviceName,
        title: serviceName,
        category: s.category || 'Geral',
        price: Number(s.price) || 0,
        duration_minutes: durationMinutes,
        commission_rate: Number(s.commissionRate ?? s.commission_rate ?? 50),
        description: s.description || null,
        image_url: safeUrl(firstPhoto) || (safePhotos[0] ?? null),
        photos: safePhotos,
        videos: Array.isArray(s.videos) ? s.videos : (safeUrl(s.videoUrl) ? [{ id: `vid_${serviceUuid}`, url: safeUrl(s.videoUrl), title: serviceName, duration_seconds: 5 }] : []),
        slides: Array.isArray(s.slides) ? s.slides.map((p: any) => safeUrl(p)).filter(Boolean) : safePhotos,
        media_type: s.mediaType || 'image',
        video_url: safeUrl(s.videoUrl),
        video_duration_seconds: s.videoDurationSeconds || 0,
        display_mode: s.displayMode || 'static',
        aspect_ratio: s.aspectRatio || '1:1',
        is_active: s.isActive !== false && s.is_active !== false,
        updated_at: new Date().toISOString(),
      };

      const { error: srvErr } = await (client.from('services') as any).upsert(fullPayload, { onConflict: 'id' });
      if (srvErr) {
        lastServiceError = srvErr.message || 'Erro ao gravar serviço no banco.';
      }
    }

    const activeSet = new Set(activeServiceIds);
    const removedIds = (existingRows || [])
      .map((r: any) => r.id)
      .filter((id: string) => id && !activeSet.has(id));

    if (removedIds.length > 0) {
      const { error: delError } = await (client.from('services') as any)
        .delete()
        .eq('salon_id', resolvedSalonUuid)
        .in('id', removedIds);

      if (delError) {
        const { error: softDelErr } = await (client.from('services') as any)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('salon_id', resolvedSalonUuid)
          .in('id', removedIds);
        if (softDelErr && !lastServiceError) {
          lastServiceError = softDelErr.message;
        }
      }
    }

    let brandingWriteError: string | null = null;
    try {
      const { data: currentSalon } = await (client.from('salons') as any)
        .select('branding')
        .eq('id', resolvedSalonUuid)
        .maybeSingle();

      const existingBranding = (currentSalon?.branding && typeof currentSalon.branding === 'object') ? currentSalon.branding : {};
      const { data: updatedSalon, error: brErr } = await (client.from('salons') as any)
        .update({
          branding: {
            ...existingBranding,
            catalogServices: services,
            ...(Array.isArray(categories) ? { serviceCategories: categories } : {}),
            updatedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', resolvedSalonUuid)
        .select('id')
        .maybeSingle();

      if (brErr || !updatedSalon) {
        brandingWriteError = brErr?.message || 'Sem permissão para atualizar catálogo do estabelecimento (RLS).';
      }
    } catch (e: any) {
      brandingWriteError = e?.message || 'Falha ao espelhar catálogo em branding.';
    }

    if (lastServiceError || brandingWriteError) {
      if (typeof fetch !== 'undefined') {
        try {
          const proxyRes = await fetch('/api/salon/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'services',
              salonId: resolvedSalonUuid,
              payload: { services, categories },
            }),
          });
          if (proxyRes.ok) {
            const proxyJson = await proxyRes.json();
            if (proxyJson?.success) {
              return { success: true, count: services.length };
            }
          }
        } catch {}
      }
      return { success: false, error: lastServiceError || brandingWriteError || 'Erro ao gravar catálogo no banco.' };
    }

    return { success: true, count: services.length };
  } catch (err: any) {
    console.error('Falha ao sincronizar catálogo de serviços no Supabase:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao salvar serviços.' };
  }
}

export async function syncAllProfessionalsToDb(
  salonId: string,
  professionals: any[],
  professionalSchedules?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured || !salonId) return { success: false, error: 'Identificador do salão não fornecido' };
  const client = getDbClient() || supabase;
  try {
    let resolvedSalonUuid = salonId;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonId)) {
      const { data: sRow } = await (client.from('salons') as any).select('id').eq('slug', salonId).maybeSingle();
      if (sRow?.id) {
        resolvedSalonUuid = sRow.id;
      } else {
        const cachedDbId = typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_db_id') : null;
        if (cachedDbId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cachedDbId)) {
          resolvedSalonUuid = cachedDbId;
        }
      }
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedSalonUuid)) {
      return { success: false, error: 'Salão não possui UUID válido' };
    }

    const { data: existingPros } = await (client.from('professionals') as any)
      .select('id')
      .eq('salon_id', resolvedSalonUuid);

    const activeProIds: string[] = [];
    let lastProError: string | null = null;

    for (const p of professionals) {
      const isUuid = p.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(p.id));
      const proUuid = isUuid ? String(p.id) : generateUuidV4();
      p.id = proUuid;
      activeProIds.push(proUuid);

      const accessLevel =
        p.accessType ||
        p.accessLevel ||
        (p.systemRole === 'admin' || p.role === 'admin'
          ? 'admin'
          : p.role?.toLowerCase().includes('recep')
          ? 'receptionist'
          : 'professional');

      const workingPayload: Record<string, any> = {
        id: proUuid,
        salon_id: resolvedSalonUuid,
        name: p.name || 'Profissional',
        full_name: p.name || 'Profissional',
        role: p.role || 'Profissional',
        access_level: accessLevel,
        avatar_url: p.avatarUrl || p.avatar || null,
        phone: p.phone || null,
        phone_whatsapp: p.phone || null,
        email: p.email || null,
        commission_rate: Number(p.commissionRate ?? p.commission_rate ?? (accessLevel === 'admin' ? 100 : 50)),
        product_commission_rate: Number(p.productCommissionRate ?? p.product_commission_rate ?? 10),
        specialties: Array.isArray(p.specialties) ? p.specialties : ['Geral'],
        schedule_config: p.workSchedule || p.schedule_config || null,
        use_custom_schedule: Boolean(p.workSchedule || p.schedule_config),
        is_active: p.isActive !== false,
        updated_at: new Date().toISOString(),
      };

      let upsertErr: any = null;
      for (let attempt = 0; attempt < 15; attempt++) {
        const res = await (client.from('professionals') as any).upsert(workingPayload, { onConflict: 'id' });
        upsertErr = res.error;
        if (!upsertErr) break;
        const msg = String(upsertErr.message || '');
        const colMatch =
          msg.match(/Could not find the '([^']+)' column/i) ||
          msg.match(/column "([^"]+)" of relation/i) ||
          msg.match(/column (?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+) does not exist/i);
        if ((upsertErr.code === 'PGRST204' || upsertErr.code === '42703' || colMatch) && colMatch?.[1] && colMatch[1] in workingPayload) {
          delete workingPayload[colMatch[1]];
          continue;
        }
        break;
      }

      if (upsertErr) {
        lastProError = upsertErr.message || 'Erro ao salvar profissional no banco.';
      }
    }

    const activeProSet = new Set(activeProIds);
    const removedProIds = (existingPros || [])
      .map((r: any) => r.id)
      .filter((id: string) => id && !activeProSet.has(id));

    if (removedProIds.length > 0) {
      const { error: delErr } = await (client.from('professionals') as any)
        .delete()
        .eq('salon_id', resolvedSalonUuid)
        .in('id', removedProIds);
      if (delErr) {
        const { error: softDelErr } = await (client.from('professionals') as any)
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('salon_id', resolvedSalonUuid)
          .in('id', removedProIds);
        if (softDelErr && !lastProError) {
          lastProError = softDelErr.message;
        }
      }
    }

    let brandingWriteError: string | null = null;
    try {
      const { data: currentSalon } = await (client.from('salons') as any)
        .select('branding')
        .eq('id', resolvedSalonUuid)
        .maybeSingle();

      const existingBranding = (currentSalon?.branding && typeof currentSalon.branding === 'object') ? currentSalon.branding : {};
      const nextBranding: Record<string, any> = {
        ...existingBranding,
        teamMembers: professionals,
        updatedAt: new Date().toISOString(),
      };
      if (professionalSchedules) {
        nextBranding.operatingSchedule = {
          ...(existingBranding.operatingSchedule || {}),
          professionalSchedules,
        };
      }

      const { data: updatedSalon, error: brErr } = await (client.from('salons') as any)
        .update({
          branding: nextBranding,
          updated_at: new Date().toISOString(),
        })
        .eq('id', resolvedSalonUuid)
        .select('id')
        .maybeSingle();

      if (brErr || !updatedSalon) {
        brandingWriteError = brErr?.message || 'Sem permissão para atualizar equipe do estabelecimento (RLS).';
      }
    } catch (e: any) {
      brandingWriteError = e?.message || 'Falha ao espelhar equipe em branding.';
    }

    if (lastProError || brandingWriteError) {
      if (typeof fetch !== 'undefined') {
        try {
          const proxyRes = await fetch('/api/salon/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'professionals',
              salonId: resolvedSalonUuid,
              payload: { professionals, professionalSchedules },
            }),
          });
          if (proxyRes.ok) {
            const proxyJson = await proxyRes.json();
            if (proxyJson?.success) {
              return { success: true };
            }
          }
        } catch {}
      }
      return { success: false, error: lastProError || brandingWriteError || 'Erro ao gravar equipe no banco.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Falha ao sincronizar profissionais no Supabase:', err);
    return { success: false, error: err?.message || 'Erro inesperado ao salvar equipe.' };
  }
}

export function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/webp';
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return { blob: new Blob([array], { type: mimeType }), mimeType };
  } catch {
    return null;
  }
}

export async function uploadAvatarToSupabaseStorage(
  fileOrBlob: File | Blob | string,
  userIdOrEmail: string
): Promise<string | null> {
  try {
    if (typeof fileOrBlob === 'string') {
      if (isValidAvatarUrlString(fileOrBlob)) {
        return fileOrBlob.trim();
      }
      const converted = dataUrlToBlob(fileOrBlob);
      if (!converted) return null;
      const ext = converted.mimeType.includes('png') ? 'png' : 'webp';
      fileOrBlob = new File([converted.blob], `avatar.${ext}`, { type: converted.mimeType });
    }

    const binaryFile =
      fileOrBlob instanceof File
        ? fileOrBlob
        : new File([fileOrBlob], 'avatar.webp', { type: fileOrBlob.type || 'image/webp' });

    const formData = new FormData();
    formData.append('file', binaryFile, binaryFile.name);
    formData.append('bucket', 'avatars');
    formData.append('ownerType', 'user_avatar');
    formData.append('ownerId', userIdOrEmail);

    const headers: Record<string, string> = {};
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
    }

    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers,
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (isValidAvatarUrlString(data?.publicUrl)) {
          return data.publicUrl.trim();
        }
      }
    } catch {}

    if (!supabase || !isSupabaseConfigured) return null;

    const cleanId = (userIdOrEmail || 'user').replace(/[^a-zA-Z0-9-_]/g, '_');
    const ext = (binaryFile.name.split('.').pop() || 'webp').replace(/[^a-z0-9]/gi, '') || 'webp';
    const fileName = `user_avatar/${cleanId}-${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, binaryFile, { contentType: binaryFile.type || 'image/webp', cacheControl: '31536000', upsert: false });

    if (!error && data?.path) {
      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(data.path);
      if (isValidAvatarUrlString(publicData?.publicUrl)) {
        return publicData.publicUrl.trim();
      }
    }

    return null;
  } catch (err) {
    console.warn('Erro no upload binário de avatar:', err);
    return null;
  }
}

export async function saveUserAvatarToSupabase(params: {
  fileOrBase64: File | Blob | string;
  email?: string;
  cpf?: string;
  name?: string;
  phone?: string;
  clientId?: string;
  userId?: string;
  type?: 'client' | 'pro' | 'admin';
}): Promise<{ success: boolean; avatarUrl: string; source: 'server' | 'client_direct' | 'local_fallback' }> {
  const cleanEmail = (params.email || (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_email') || '' : '')).trim().toLowerCase();
  const cleanName = (params.name || (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_name') || '' : '')).trim();
  const cleanPhone = (params.phone || (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_phone') || '' : '')).trim();
  const cleanCpf = (params.cpf || (typeof window !== 'undefined' ? localStorage.getItem('vagou_user_cpf') || '' : '')).replace(/\D/g, '');
  const storedClientId = (params.clientId || (typeof window !== 'undefined' ? localStorage.getItem('vagou_client_id') || '' : '')).trim();
  const storedUserId = (params.userId || (typeof window !== 'undefined' ? localStorage.getItem('vagou_auth_user_id') || '' : '')).trim();

  const identifier = storedUserId || storedClientId || cleanCpf || cleanEmail || cleanName || 'user';
  const uploadedPublicUrl = await uploadAvatarToSupabaseStorage(params.fileOrBase64, identifier);

  if (!isValidAvatarUrlString(uploadedPublicUrl)) {
    return { success: false, avatarUrl: '', source: 'local_fallback' };
  }

  try {
    const res = await fetch('/api/user/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        avatarData: uploadedPublicUrl,
        email: cleanEmail,
        cpf: cleanCpf,
        name: cleanName,
        phone: cleanPhone,
        clientId: storedClientId,
        userId: storedUserId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (isValidAvatarUrlString(data?.avatarUrl)) {
        return { success: true, avatarUrl: data.avatarUrl, source: 'server' };
      }
    }
  } catch {}

  try {
    await updateUserProfileInDb({
      name: cleanName || 'Usuário',
      email: cleanEmail,
      phone: cleanPhone,
      cpf: cleanCpf,
      avatarUrl: uploadedPublicUrl,
      clientId: storedClientId,
      userId: storedUserId,
      type: params.type || 'client',
    });
    return { success: true, avatarUrl: uploadedPublicUrl, source: 'client_direct' };
  } catch (clientErr) {
    console.error('Erro na gravação client-side do avatar:', clientErr);
  }

  return { success: true, avatarUrl: uploadedPublicUrl, source: 'client_direct' };
}
