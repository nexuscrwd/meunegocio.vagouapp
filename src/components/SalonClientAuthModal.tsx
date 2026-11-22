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
import { CURATED_EDITORIAL_FALLBACK_SLIDES } from '../assets/editorialAuthSlides';
import { TEMPLATE_APP_NAME } from '../utils/templateBranding';

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
  logoTextFallback?: string;
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
  logoTextFallback,
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

  const [fetchedSalonMeta, setFetchedSalonMeta] = useState<{
    tradeName?: string;
    logoUrl?: string;
    logoTextFallback?: string;
    slogan?: string;
  }>({});
  const [salonSlides, setSalonSlides] = useState<string[]>([]);
  const [failedSlides, setFailedSlides] = useState<Record<string, boolean>>({});
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

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
        const resolvedLogoTextFallback = String(
          salonRow.logo_text_fallback || salonRow.branding?.logoTextFallback || ''
        ).trim();
        const resolvedSlogan = String(
          salonRow.slogan || salonRow.branding?.slogan || ''
        ).trim();

        setFetchedSalonMeta({
          tradeName: resolvedTradeName || undefined,
          logoUrl: isValidPhotoUrl(resolvedLogoUrl) ? resolvedLogoUrl : undefined,
          logoTextFallback: resolvedLogoTextFallback || undefined,
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
          const { data: mediaRows } = await (supabase.from('media_assets' as any) as any)
            .select('public_url, mime_type')
            .eq('salon_id', salonRow.id)
            .like('mime_type', 'image/%')
            .limit(5);

          if (Array.isArray(mediaRows)) {
            for (const m of mediaRows) {
              addCandidatePhoto(m?.public_url);
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
    const list: string[] = salonSlides.filter((url) => !failedSlides[url]);
    for (const fallback of CURATED_EDITORIAL_FALLBACK_SLIDES) {
      if (!failedSlides[fallback] && !list.includes(fallback) && list.length < 5) {
        list.push(fallback);
      }
    }
    return list.length > 0 ? list : [...CURATED_EDITORIAL_FALLBACK_SLIDES];
  }, [salonSlides, failedSlides]);

  useEffect(() => {
    if (activeSlideIndex >= effectiveSlides.length) {
      setActiveSlideIndex(0);
    }
  }, [activeSlideIndex, effectiveSlides.length]);

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
    (typeof window !== 'undefined' && currentSlug
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
    (typeof window !== 'undefined' && currentSlug ? localStorage.getItem('vagou_salon_name') || '' : '') ||
    currentSlug ||
    TEMPLATE_APP_NAME;

  const resolvedLogoTextFallback = (
    fetchedSalonMeta.logoTextFallback ||
    logoTextFallback ||
    ''
  ).trim();

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
      String(existingAccountRow?.access_level || '') === '100' ||
      String(existingAccountRow?.access_level || '').toLowerCase().includes('superadmin') ||
      String(existingAccountRow?.role || '').toLowerCase() === 'super_admin' ||
      String(existingAccountRow?.role || '').toLowerCase() === 'superadmin'
    );

    let clientRow: any =
      existingAccountRow?.sourceTable === 'clients' || (!existingAccountRow?.sourceTable && existingAccountRow?.id)
        ? existingAccountRow
        : null;

    if (!clientRow && supabase) {
      try {
        const candidateEmail = existingAccountRow?.email || (isValidEmailAddress(emailOrUsername) ? emailOrUsername : '');
        if (candidateEmail) {
          const { data: cByEmail } = await (supabase.from('clients') as any)
            .select('*')
            .ilike('email', candidateEmail)
            .limit(1)
            .maybeSingle();
          if (cByEmail) clientRow = cByEmail;
        }
        if (!clientRow && userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
          const { data: cByUid } = await (supabase.from('clients') as any)
            .select('*')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();
          if (cByUid) clientRow = cByUid;
        }
      } catch {}
    }

    if (!clientRow && !isSuperadmin) {
      const ensured = await ensureClientRow(
        userId,
        isValidEmailAddress(emailOrUsername) ? emailOrUsername : (existingAccountRow?.email || null),
        {
          full_name:
            fallbackName ||
            existingAccountRow?.full_name ||
            existingAccountRow?.name ||
            userMeta?.full_name ||
            userMeta?.name,
          phone: fallbackPhone || existingAccountRow?.phone || userMeta?.phone,
          cpf: fallbackCpf || existingAccountRow?.cpf || userMeta?.cpf,
          username:
            existingAccountRow?.username ||
            userMeta?.username ||
            (!isValidEmailAddress(emailOrUsername) ? emailOrUsername : undefined),
        }
      );
      clientRow = ensured.client;
    }

    const effectiveUserId = String(
      userId || existingAccountRow?.user_id || existingAccountRow?.id || clientRow?.user_id || clientRow?.id || ''
    ).trim();
    const effectiveClientId = String(existingAccountRow?.client_id || clientRow?.id || '').trim();
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
      ''
    ).trim();
    const effectiveUsername = (
      existingAccountRow?.username ||
      userMeta?.username ||
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
      existingAccountRow?.full_name ||
      existingAccountRow?.name ||
      clientRow?.full_name ||
      clientRow?.name ||
      existingAccountRow?.username ||
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

    try {
      if (mappedRole === 'pro') {
        sessionStorage.removeItem('vagou_explicit_public_preview');
      } else {
        sessionStorage.setItem('vagou_explicit_public_preview', '1');
      }
      if (effectiveUserId) localStorage.setItem('vagou_auth_user_id', effectiveUserId);
      if (effectiveClientId) {
        localStorage.setItem('vagou_client_id', effectiveClientId);
      } else {
        localStorage.removeItem('vagou_client_id');
      }
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
          clientId: effectiveClientId || undefined,
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
    <div
      className="vagou-cinematic-auth vagou-dark-media dark fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 overflow-y-auto animate-in fade-in duration-300 font-['Poppins']"
      style={{ backgroundColor: '#020617' }}
    >

      <div
        className="vagou-dark-media fixed inset-0 pointer-events-none overflow-hidden bg-slate-950"
        style={{ backgroundColor: '#020617' }}
      >
        {effectiveSlides.map((slideUrl, index) => (
          <img
            key={`${slideUrl.slice(0, 48)}-${index}`}
            src={slideUrl}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            onError={() => {
              setFailedSlides((prev) =>
                prev[slideUrl] ? prev : { ...prev, [slideUrl]: true }
              );
            }}
            className={`absolute inset-0 w-full h-full object-cover grayscale contrast-110 transition-opacity duration-1000 select-none ${
              index === activeSlideIndex ? 'opacity-45' : 'opacity-0'
            }`}
          />
        ))}

        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/65 via-slate-950/55 to-slate-950/85" />
      </div>

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
          logoTextFallback={resolvedLogoTextFallback || undefined}
          salonAccentColor={resolvedPrimaryColor}
          onClose={handleCloseModal}
          onSuccess={handleAuthSuccess}
        />
      </div>
    </div>
  );
};
