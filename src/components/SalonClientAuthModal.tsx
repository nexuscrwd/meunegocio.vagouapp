import React, { useState, useEffect } from 'react';
import {
  supabase,
  isSupabaseConfigured,
  checkUserSalonMembership,
  ensureClientRow,
} from '../lib/supabase';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { TriadeUserAuthCard, UserAuthMode } from './auth/TriadeUserAuthCard';
import { TriadeUserLoginPayload } from './auth/TriadeUserLoginForm';
import { TriadeUserData } from './auth/TriadeUserRegisterForm';

const CURATED_EDITORIAL_FALLBACK_SLIDES = [
  '/assets/images/editorial_modern_salon_backdrop_1794765449149.jpg',
  '/assets/images/editorial_contemporary_barbershop_backdrop_1794765450557.jpg',
  '/assets/images/editorial_aesthetics_clinic_backdrop_1794765451443.jpg',
] as const;

export interface SalonClientAuthUser {
  id?: string;
  name: string;
  phone: string;
  email: string;
}

interface SalonClientAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  salonName: string;
  salonSlug?: string;
  salonSlogan?: string;
  salonLogo?: string;
  salonLogoLight?: string;
  salonLogoDark?: string;
  primaryColor?: string;
  secondaryColor?: string;
  themeMode?: 'light' | 'dark';
  initialMode?: 'login' | 'register';
  requireAuth?: boolean;
  onAuthenticated: (user: SalonClientAuthUser, role?: 'pro' | 'cliente') => void;
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhotoUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.includes('unsplash.com') || trimmed.includes('picsum.photos')) return false;
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/')
  );
}

export const SalonClientAuthModal: React.FC<SalonClientAuthModalProps> = ({
  isOpen,
  onClose,
  salonName,
  salonSlug,
  salonSlogan,
  salonLogo,
  salonLogoLight,
  salonLogoDark,
  primaryColor,
  initialMode = 'login',
  requireAuth = false,
  onAuthenticated,
}) => {
  const pendingAuthCallbackRef = React.useRef<{
    user: SalonClientAuthUser;
    role: 'pro' | 'cliente';
  } | null>(null);

  const currentSlug = (
    salonSlug ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') || '' : '')
  ).trim();

  // Estado dinâmico para metadados e fotos reais do salão (Nível 1) vs Fallback Editorial (Nível 2)
  const [fetchedSalonMeta, setFetchedSalonMeta] = useState<{
    tradeName?: string;
    logoUrl?: string;
    slogan?: string;
  }>({});
  const [salonSlides, setSalonSlides] = useState<string[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Busca Nível 1: public.salons + public.salon_media_items (até 5 fotos type = 'image')
  useEffect(() => {
    if (!isOpen || !isSupabaseConfigured || !supabase) return;
    let isMounted = true;

    async function loadSalonBrandingAndPhotos() {
      try {
        let salonRow: any = null;
        const cachedDbId =
          typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_db_id') || '' : '';

        if (currentSlug) {
          const { data } = await (supabase.from('salons') as any)
            .select('*')
            .eq('slug', currentSlug)
            .maybeSingle();
          if (data) salonRow = data;
        }

        if (!salonRow && cachedDbId) {
          const { data } = await (supabase.from('salons') as any)
            .select('*')
            .eq('id', cachedDbId)
            .maybeSingle();
          if (data) salonRow = data;
        }

        if (!isMounted || !salonRow) return;

        const resolvedTradeName = String(
          salonRow.trade_name || salonRow.name || ''
        ).trim();
        const resolvedLogoUrl = String(
          salonRow.logo_dark_url ||
            salonRow.logo_url ||
            salonRow.logo_light_url ||
            salonRow.branding?.salonIcon ||
            salonRow.branding?.faviconUrl ||
            ''
        ).trim();
        const resolvedSlogan = String(
          salonRow.slogan || salonRow.branding?.slogan || ''
        ).trim();

        setFetchedSalonMeta({
          tradeName: resolvedTradeName || undefined,
          logoUrl: isValidPhotoUrl(resolvedLogoUrl) ? resolvedLogoUrl : undefined,
          slogan: resolvedSlogan || undefined,
        });

        const isLogoUrl = (url: string) => {
          const lower = url.toLowerCase();
          return (
            lower.includes('logo') ||
            lower.includes('favicon') ||
            lower.includes('icon')
          );
        };

        const collectedPhotos: string[] = [];
        const addCandidatePhoto = (candidate: unknown) => {
          if (
            isValidPhotoUrl(candidate) &&
            !isLogoUrl(String(candidate)) &&
            !collectedPhotos.includes(String(candidate).trim()) &&
            collectedPhotos.length < 5
          ) {
            collectedPhotos.push(String(candidate).trim());
          }
        };

        addCandidatePhoto(salonRow.cover_image_url);
        addCandidatePhoto(salonRow.branding?.coverImageUrl);
        addCandidatePhoto(salonRow.branding?.facadePhotoUrl);
        addCandidatePhoto(salonRow.branding?.interiorPhotoUrl);

        if (Array.isArray(salonRow.branding?.spacePhotos)) {
          for (const sp of salonRow.branding.spacePhotos) {
            addCandidatePhoto(sp?.url || sp);
          }
        }

        if (salonRow.id && collectedPhotos.length < 5) {
          const { data: mediaRows } = await (supabase.from('salon_media_items' as any) as any)
            .select('url, media_url, file_url, type')
            .eq('salon_id', salonRow.id)
            .eq('type', 'image')
            .limit(5);

          if (Array.isArray(mediaRows)) {
            for (const m of mediaRows) {
              addCandidatePhoto(m?.url || m?.media_url || m?.file_url);
            }
          }
        }

        if (isMounted && collectedPhotos.length > 0) {
          setSalonSlides(collectedPhotos.slice(0, 5));
          setActiveSlideIndex(0);
        }
      } catch {}
    }

    loadSalonBrandingAndPhotos();
    return () => {
      isMounted = false;
    };
  }, [isOpen, currentSlug]);

  const effectiveSlides = React.useMemo(() => {
    const list: string[] = [...salonSlides];
    for (const fallback of CURATED_EDITORIAL_FALLBACK_SLIDES) {
      if (!list.includes(fallback) && list.length < 5) {
        list.push(fallback);
      }
    }
    return list.length > 0 ? list : (CURATED_EDITORIAL_FALLBACK_SLIDES as unknown as string[]);
  }, [salonSlides]);

  // Troca suave de slide a cada 5500ms (transition-opacity duration-1000)
  useEffect(() => {
    if (!isOpen || effectiveSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % effectiveSlides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [isOpen, effectiveSlides.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePostMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      const isRedirectEvent =
        data.type === 'VAGOU_REDIRECT' ||
        data.action === 'SALON_MASTER_SUCCESS' ||
        (data.type === 'VAGOU_REGISTRATION_SUCCESS' &&
          (data.slug || data.redirectUrl || data.salonUrl || data.accountType === 'owner'));

      if (!isRedirectEvent) return;

      const rawSlug = String(data.slug || data.salon?.slug || data.payload?.slug || '').trim();
      const rawName = String(
        data.salon?.trade_name || data.salon?.name || data.payload?.tradeName || data.payload?.salonName || ''
      ).trim();
      const rawSalonId = String(data.salon?.id || data.payload?.id || '').trim();

      try {
        if (rawSlug) localStorage.setItem('vagou_salon_slug', rawSlug);
        if (rawName) localStorage.setItem('vagou_salon_name', rawName);
        if (rawSalonId) localStorage.setItem('vagou_salon_db_id', rawSalonId);
      } catch {}

      const targetUrl =
        data.redirectUrl ||
        data.salonUrl ||
        data.url ||
        (rawSlug ? `https://${rawSlug}.vagouapp.com` : '');

      if (targetUrl) {
        window.location.assign(targetUrl);
        return;
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);
  }, [isOpen]);

  const handleCloseModal = () => {
    hapticLight();
    try {
      sessionStorage.removeItem('vagou_client_auth_modal_open');
      sessionStorage.removeItem('vagou_client_auth_modal_mode');
      sessionStorage.removeItem('vagou_register_wizard_draft');
    } catch {}
    if (pendingAuthCallbackRef.current) {
      const pending = pendingAuthCallbackRef.current;
      pendingAuthCallbackRef.current = null;
      onAuthenticated(pending.user, pending.role);
      onClose();
      return;
    }
    if (!requireAuth) {
      onClose();
    }
  };

  const resolvedPrimaryColor =
    primaryColor ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_accent_color') : null) ||
    '#20C933';

  const rawLogo = (
    fetchedSalonMeta.logoUrl ||
    salonLogoDark ||
    salonLogo ||
    salonLogoLight ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('vagou_salon_logo_dark') ||
        localStorage.getItem('vagou_salon_logo_light') ||
        localStorage.getItem('vagou_salon_icon') ||
        ''
      : '') ||
    ''
  ).trim();

  const resolvedSalonName =
    fetchedSalonMeta.tradeName ||
    salonName ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_name') || '' : '') ||
    currentSlug ||
    'Meu Estabelecimento';

  const resolvedSalonSlogan =
    fetchedSalonMeta.slogan ||
    salonSlogan ||
    (currentSlug ? `${currentSlug}.vagouapp.com` : undefined);

  if (!isOpen) return null;

  const finalizeAuthentication = async (
    userId: string,
    emailOrUsername: string,
    fallbackName?: string,
    fallbackPhone?: string,
    fallbackCpf?: string,
    userMeta?: Record<string, any>,
    existingAccountRow?: any,
    keepModalOpen = false
  ) => {
    const isSuperadmin = Boolean(
      existingAccountRow?.isSuperadmin ||
      existingAccountRow?.sourceTable === 'system_admins' ||
      userMeta?.isSuperadmin ||
      String(existingAccountRow?.access_level || '').toLowerCase().includes('superadmin') ||
      String(existingAccountRow?.role || '').toLowerCase() === 'superadmin'
    );

    let clientRow: any =
      existingAccountRow?.sourceTable === 'clients' || (!existingAccountRow?.sourceTable && existingAccountRow?.id)
        ? existingAccountRow
        : null;

    if (!clientRow && supabase) {
      try {
        const candidateEmail = existingAccountRow?.email || (isValidEmailAddress(emailOrUsername) ? emailOrUsername : '');
        const candidateUsername = existingAccountRow?.username || (!isValidEmailAddress(emailOrUsername) ? emailOrUsername : '');
        if (candidateEmail) {
          const { data: cByEmail } = await (supabase.from('clients') as any)
            .select('*')
            .ilike('email', candidateEmail)
            .limit(1)
            .maybeSingle();
          if (cByEmail) clientRow = cByEmail;
        }
        if (!clientRow && candidateUsername) {
          const { data: cByUser } = await (supabase.from('clients') as any)
            .select('*')
            .ilike('username', candidateUsername)
            .limit(1)
            .maybeSingle();
          if (cByUser) clientRow = cByUser;
        }
      } catch {}
    }

    if (!clientRow) {
      const ensured = await ensureClientRow(
        userId,
        isValidEmailAddress(emailOrUsername) ? emailOrUsername : (existingAccountRow?.email || null),
        {
          full_name: fallbackName || existingAccountRow?.name || userMeta?.full_name || userMeta?.name,
          phone: fallbackPhone || existingAccountRow?.phone || userMeta?.phone,
          cpf: fallbackCpf || existingAccountRow?.cpf || userMeta?.cpf,
          username:
            existingAccountRow?.username ||
            userMeta?.username ||
            (!isValidEmailAddress(emailOrUsername) ? emailOrUsername : undefined),
          password_hash: existingAccountRow?.password_hash || userMeta?.password_hash,
        }
      );
      clientRow = ensured.client;
    }

    const effectiveUserId = String(
      userId || existingAccountRow?.id || clientRow?.user_id || clientRow?.id || ''
    ).trim();
    const effectiveClientId = String(clientRow?.id || effectiveUserId).trim();
    const cleanCpf = (
      fallbackCpf ||
      existingAccountRow?.cpf ||
      clientRow?.cpf ||
      userMeta?.cpf ||
      ''
    ).replace(/\D/g, '');
    const effectiveIdentity = (
      existingAccountRow?.email ||
      clientRow?.email ||
      emailOrUsername ||
      existingAccountRow?.username ||
      clientRow?.username ||
      ''
    ).trim();
    const effectiveUsername = (
      existingAccountRow?.username ||
      clientRow?.username ||
      effectiveIdentity
    ).trim();

    try {
      if (isSuperadmin) {
        localStorage.setItem('vagou_is_superadmin', 'true');
      } else {
        localStorage.removeItem('vagou_is_superadmin');
      }
    } catch {}

    const membership = await checkUserSalonMembership(
      effectiveUserId,
      currentSlug,
      effectiveIdentity,
      cleanCpf
    );

    const resolvedName =
      fallbackName ||
      existingAccountRow?.name ||
      clientRow?.name ||
      existingAccountRow?.username ||
      clientRow?.username ||
      userMeta?.full_name ||
      userMeta?.name ||
      (effectiveIdentity ? effectiveIdentity.split('@')[0] : 'Usuário');

    const resolvedPhone =
      fallbackPhone || existingAccountRow?.phone || clientRow?.phone || userMeta?.phone || '';

    const resolvedAvatar =
      existingAccountRow?.avatar_url || clientRow?.avatar_url || userMeta?.avatar_url || '';

    const finalIsSuperadmin =
      isSuperadmin || (membership.role === 'owner' && existingAccountRow?.sourceTable === 'system_admins');

    const mappedRole: 'pro' | 'cliente' =
      finalIsSuperadmin || membership.isMember ? 'pro' : 'cliente';

    // Roteamento Inteligente Pós-Login (BOL-167):
    // Proprietário (salons.email / owner_id) ou Profissional (professionals) -> abre direto o Painel Meu Negócio
    // Cliente -> abre direto a Vitrine de Agendamento do salão
    try {
      if (mappedRole === 'pro') {
        sessionStorage.removeItem('vagou_explicit_public_preview');
      } else {
        sessionStorage.setItem('vagou_explicit_public_preview', '1');
      }
      if (effectiveUserId) localStorage.setItem('vagou_auth_user_id', effectiveUserId);
      if (effectiveClientId) localStorage.setItem('vagou_client_id', effectiveClientId);
      if (resolvedName) localStorage.setItem('vagou_user_name', resolvedName);
      if (effectiveIdentity) {
        localStorage.setItem('vagou_user_email', effectiveIdentity);
        localStorage.setItem('vagou_active_partner', effectiveIdentity);
      }
      if (cleanCpf) localStorage.setItem('vagou_user_cpf', cleanCpf);
      if (resolvedPhone) localStorage.setItem('vagou_user_phone', resolvedPhone);
      if (resolvedAvatar && !resolvedAvatar.includes('unsplash.com')) {
        localStorage.setItem('vagou_user_avatar', resolvedAvatar);
      }
      localStorage.setItem(
        'vagou_user_role',
        finalIsSuperadmin ? 'superadmin' : membership.role
      );
      localStorage.setItem(
        'vagou_client_session',
        JSON.stringify({
          id: effectiveUserId || effectiveClientId,
          clientId: effectiveClientId || effectiveUserId,
          name: resolvedName,
          email: effectiveIdentity,
          username: effectiveUsername,
          phone: resolvedPhone,
          cpf: cleanCpf,
          role: finalIsSuperadmin ? 'superadmin' : membership.role,
          accessLevel: finalIsSuperadmin
            ? 'Superadmin Master'
            : existingAccountRow?.access_level || clientRow?.access_level || membership.role,
          isSuperadmin: finalIsSuperadmin,
        })
      );
    } catch {}

    window.dispatchEvent(
      new CustomEvent('vagou:auth-updated', {
        detail: {
          userId: effectiveUserId,
          email: effectiveIdentity,
          cpf: cleanCpf,
          name: resolvedName,
          accountType: finalIsSuperadmin ? 'owner' : membership.role,
          mappedRole,
          isSuperadmin: finalIsSuperadmin,
        },
      })
    );

    hapticSuccess();
    const authUserObj: SalonClientAuthUser = {
      id: effectiveClientId || effectiveUserId,
      name: resolvedName,
      phone: resolvedPhone,
      email: effectiveIdentity,
    };

    if (keepModalOpen) {
      pendingAuthCallbackRef.current = { user: authUserObj, role: mappedRole };
    } else {
      pendingAuthCallbackRef.current = null;
      try {
        sessionStorage.removeItem('vagou_client_auth_modal_open');
        sessionStorage.removeItem('vagou_client_auth_modal_mode');
        sessionStorage.removeItem('vagou_register_wizard_draft');
      } catch {}
      onAuthenticated(authUserObj, mappedRole);
      onClose();
    }
  };

  const handleAuthSuccess = async (result: {
    mode: UserAuthMode;
    data: TriadeUserLoginPayload | TriadeUserData;
    keepModalOpen?: boolean;
  }) => {
    const payload = result.data as any;
    const userId = String(payload.id || '').trim();
    const identity = String(
      payload.email || payload.username || payload.identifier || ''
    ).trim();

    await finalizeAuthentication(
      userId,
      identity,
      payload.name,
      payload.phone,
      payload.cpf,
      {
        full_name: payload.name,
        name: payload.name,
        phone: payload.phone,
        cpf: payload.cpf,
        username: payload.username,
        avatar_url: payload.avatarUrl,
        password_hash: payload.passwordHash,
        isSuperadmin: payload.accountType === 'owner',
      },
      payload.matchedAccount,
      Boolean(result.keepModalOpen)
    );

    const targetUrl =
      payload.redirectUrl ||
      payload.salonUrl ||
      (payload.accountType === 'owner' && payload.slug ? `https://${payload.slug}.vagouapp.com` : '');

    if (targetUrl) {
      window.location.assign(targetUrl);
      return;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 overflow-y-auto animate-in fade-in duration-300 font-['Poppins']">
      {/* Camada de Fundo: Slideshow Editorial Inteligente em 2 Níveis (Tela Cheia fixed inset-0) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden bg-slate-950">
        {effectiveSlides.map((slideUrl, index) => (
          <img
            key={`${slideUrl}-${index}`}
            src={slideUrl}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className={`absolute inset-0 w-full h-full object-cover grayscale contrast-110 transition-opacity duration-1000 select-none ${
              index === activeSlideIndex ? 'opacity-45' : 'opacity-0'
            }`}
          />
        ))}
        {/* Película cinematográfica oficial */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/65 via-slate-950/55 to-slate-950/85" />
      </div>

      {/* Card Central Flutuante em Vidro Jateado (Glassmorphism Dark — Zero Box dentro de Box) */}
      <div
        className="relative z-10 w-full max-w-md my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <TriadeUserAuthCard
          initialMode={initialMode}
          requireAuth={requireAuth}
          origin="establishment"
          salonName={resolvedSalonName}
          salonSlug={currentSlug}
          salonSlogan={resolvedSalonSlogan}
          salonLogoUrl={rawLogo || undefined}
          salonAccentColor={resolvedPrimaryColor}
          onClose={handleCloseModal}
          onSuccess={handleAuthSuccess}
        />
      </div>
    </div>
  );
};
