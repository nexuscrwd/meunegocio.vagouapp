import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { SalonProfileView } from './components/SalonProfileView';
import { UserAppointmentsView } from './components/UserAppointmentsView';
import { UserDashboard } from './components/UserDashboard';
import { PartnerAuthView, PartnerAuthSuccessData } from './components/PartnerAuthView';
import { SalonNotFoundScreen } from './components/public/SalonNotFoundScreen';
import { useSalonRole } from './hooks/useSalonRole';
import { ServiceOffer, BookingAppointment } from './types';
import { initializeStoredPwaAssets } from './utils/pwaAssets';
import {
  supabase,
  isSupabaseConfigured,
  fetchUserProfileFromDb,
  isValidAvatarUrlString,
  ensureClientRow,
  fetchUserAppointments,
  mapDbAppointmentToBookingAppointment,
  subscribeToAppointments,
  cancelAppointmentInDb,
} from './lib/supabase';
import { subscribeToVagouRealtimeHub } from './services/realtimeHub';
import { ensureServiceWorkerReady, triggerPushOutboxDispatch } from './services/webPushService';
import {
  ThemeContext,
  ThemeProvider,
  useTheme,
  applyAccentColorToDom,
  CUSTOMIZED_THEME_STORAGE_KEY,
  EXPLICIT_THEME_STORAGE_KEY,
  type ThemeContextType
} from './context/ThemeContext';
import { DEFAULT_NEUTRAL_HEX, isCustomBrandHex } from './utils/themePalette';

export { ThemeContext, ThemeProvider, useTheme, applyAccentColorToDom, type ThemeContextType };

const RESERVED_SUBDOMAINS = [
  'adm', 'admin', 'admvapp', 'portal', 'pvapp', 'meunegocio', 'mnvapp',
  'www', 'api', 'suporte', 'ajuda', 'vagou', 'vagouapp', 'localhost',
  'app', 'dashboard', 'status', 'auth', 'login', 'signup', 'checkout', 'pay', 'billing'
];

function detectActiveSubdomain(): string {
  if (typeof window === 'undefined') return '';
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const paramSlug = (urlParams.get('salon') || urlParams.get('slug') || '').trim().toLowerCase();
    if (paramSlug && !RESERVED_SUBDOMAINS.includes(paramSlug)) {
      return paramSlug;
    }
  } catch {}

  const hostname = window.location.hostname;
  const isDevOrPreview =
    hostname.includes('localhost') ||
    hostname.includes('127.0.0.1') ||
    hostname.includes('run.app') ||
    hostname.includes('webcontainer') ||
    hostname.includes('stackblitz');

  const parts = hostname.split('.');
  if (parts.length >= 3 && !isDevOrPreview) {
    const sub = parts[0].toLowerCase().trim();
    if (!RESERVED_SUBDOMAINS.includes(sub) && !sub.startsWith('ais-')) {
      return sub;
    }
  }
  return '';
}

const EMPTY_OFFERS: ServiceOffer[] = [];

function sanitizeMockStorageData(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys = ['vagou_user_appointments', 'vagou_appointments'];
    keys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (item: any) =>
            item &&
            !String(item.id || '').startsWith('mock-') &&
            !['#VGA-2001', '#VGA-2002', '#VGA-2003'].includes(String(item.protocolCode || ''))
        );
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(cleaned));
        }
      }
    });
  } catch {}
}

function hasActiveAppSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('vagou_is_superadmin') === 'true') {
      return true;
    }
    const rawSession = localStorage.getItem('vagou_client_session');
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        if (parsed && (parsed.id || parsed.clientId || parsed.email || parsed.username)) {
          return true;
        }
      } catch {}
    }
    const authUserId = (localStorage.getItem('vagou_auth_user_id') || '').trim();
    if (authUserId && !authUserId.startsWith('guest-')) {
      return true;
    }
    const userEmail = (localStorage.getItem('vagou_user_email') || '').trim();
    const activePartner = (localStorage.getItem('vagou_active_partner') || '').trim();
    if (userEmail || activePartner) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const App: React.FC = () => {
  const { isDark, setAccentColor, setTheme, resetToDefaultPalette } = useTheme();

  const [isNotFound, setIsNotFound] = useState(false);
  const [currentSubdomain, setCurrentSubdomain] = useState<string>(() => detectActiveSubdomain());
  const [isValidatingSubdomain, setIsValidatingSubdomain] = useState<boolean>(true);
  const [initialSalonData, setInitialSalonData] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    sanitizeMockStorageData();
    return hasActiveAppSession();
  });

  const [viewMode, setViewMode] = useState<'auth' | 'salon' | 'agenda' | 'dashboard'>(() =>
    hasActiveAppSession() ? 'salon' : 'auth'
  );
  const [salonName, setSalonName] = useState(() => {
    const activeSub = detectActiveSubdomain();
    if (activeSub) {
      const cachedSlug = localStorage.getItem('vagou_salon_slug');
      if (cachedSlug === activeSub) {
        return localStorage.getItem('vagou_salon_name') || '';
      }
      return '';
    }
    try {
      const saved = localStorage.getItem('vagou_partner_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.salonName) return parsed.salonName;
      }
    } catch {}
    return '';
  });

  const devSlug = import.meta.env.DEV ? (import.meta.env.VITE_DEV_SALON_SLUG as string | undefined) : undefined;
  const activeSalonIdentifier =
    devSlug ||
    currentSubdomain ||
    initialSalonData?.slug ||
    initialSalonData?.id ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') || '' : '');
  const { role: currentRole } = useSalonRole(activeSalonIdentifier);

  const effectiveRole = isValidatingSubdomain ? 'loading' : currentRole;
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('vagou_user_name') || '';
  });
  const [userAvatarUrl, setUserAvatarUrl] = useState(() => {
    try {
      const saved = localStorage.getItem('vagou_user_avatar');
      if (saved && (saved.includes('unsplash.com') || saved.includes('images.unsplash'))) {
        localStorage.removeItem('vagou_user_avatar');
        return '';
      }
      if (isValidAvatarUrlString(saved)) return saved.trim();
    } catch {}
    return '';
  });
  const [appointments, setAppointments] = useState<BookingAppointment[]>([]);
  const [offers] = useState<ServiceOffer[]>(EMPTY_OFFERS);

  interface AppToast {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'error';
  }
  const [activeToast, setActiveToast] = useState<AppToast | null>(null);

  const loadAppointments = () => {
    try {
      sanitizeMockStorageData();
      const saved = localStorage.getItem('vagou_user_appointments');
      if (saved) {
        const parsed = JSON.parse(saved);
        setAppointments((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(parsed)) return prev;
          return parsed;
        });
      } else {
        setAppointments((prev) => (prev.length === 0 ? prev : []));
      }

      const savedName = localStorage.getItem('vagou_user_name') || '';
      setUserName((prev) => (prev === savedName ? prev : savedName));

      const savedAvatar = localStorage.getItem('vagou_user_avatar');
      if (savedAvatar && (savedAvatar.includes('unsplash.com') || savedAvatar.includes('images.unsplash'))) {
        localStorage.removeItem('vagou_user_avatar');
        setUserAvatarUrl((prev) => (prev === '' ? prev : ''));
      } else if (isValidAvatarUrlString(savedAvatar)) {
        const trimmedAvatar = savedAvatar.trim();
        setUserAvatarUrl((prev) => (prev === trimmedAvatar ? prev : trimmedAvatar));
      } else {
        setUserAvatarUrl((prev) => (prev === '' ? prev : ''));
      }
    } catch {}

    if (isSupabaseConfigured) {
      const userEmail = localStorage.getItem('vagou_user_email') || localStorage.getItem('vagou_active_partner') || '';
      const userPhone = localStorage.getItem('vagou_user_phone') || '';
      const clientId = localStorage.getItem('vagou_client_id') || '';

      if (userEmail || userPhone || clientId) {
        fetchUserAppointments({ email: userEmail, phone: userPhone, clientId })
          .then((dbRows) => {
            if (Array.isArray(dbRows) && dbRows.length > 0) {
              const mappedDb = dbRows.map((r) => mapDbAppointmentToBookingAppointment(r));
              setAppointments((currentLocal: BookingAppointment[]) => {
                const localMap = new Map<string, BookingAppointment>(
                  currentLocal.map((l) => [String(l.protocolCode || '').replace(/^#/, ''), l])
                );
                const merged = mappedDb.map((dbApt) => {
                  const cleanKey = String(dbApt.protocolCode || '').replace(/^#/, '');
                  const loc = localMap.get(cleanKey);
                  return loc ? { ...loc, ...dbApt } : dbApt;
                });
                const dbSet = new Set(
                  mappedDb.map((a) => String(a.protocolCode || '').replace(/^#/, ''))
                );
                currentLocal.forEach((loc) => {
                  const cleanKey = String(loc.protocolCode || '').replace(/^#/, '');
                  if (!dbSet.has(cleanKey)) {
                    merged.push(loc);
                  }
                });
                if (JSON.stringify(currentLocal) === JSON.stringify(merged)) {
                  return currentLocal;
                }
                try {
                  localStorage.setItem('vagou_user_appointments', JSON.stringify(merged));
                } catch {}
                return merged;
              });
            }
          })
          .catch((err) => console.warn('Aviso: Sincronização de agendamentos no banco:', err));
      }
    }
  };

  const triggerLocalNotification = (apt: BookingAppointment, oldStatus: string, newStatus: string) => {
    const service = apt.serviceTitle || apt.service || 'Serviço';
    const time = apt.dateTime || '';

    let title = 'Status Atualizado! 🔔';
    let message = `Seu agendamento para "${service}" foi atualizado de "${oldStatus.toLowerCase()}" para "${newStatus.toLowerCase()}".`;

    if (newStatus === 'CONFIRMADO') {
      title = 'Agendamento Confirmado! 🎉';
      message = `Seu horário para "${service}" (${time}) foi confirmado com sucesso pelo estabelecimento!`;
    } else if (newStatus === 'CANCELADO') {
      title = 'Agendamento Cancelado ⚠️';
      message = `Infelizmente seu agendamento para "${service}" (${time}) foi cancelado.`;
    } else if (newStatus === 'CONCLUÍDO' || newStatus === 'CONCLUIDO') {
      title = 'Atendimento Concluído! ✨';
      message = `Obrigado! Seu atendimento de "${service}" foi concluído.`;
    }

    setActiveToast({
      id: Date.now().toString(),
      title,
      message,
      type: newStatus === 'CONFIRMADO' ? 'success' : newStatus === 'CANCELADO' ? 'error' : 'info'
    });

    setTimeout(() => {
      setActiveToast((current) => {
        if (current && Date.now() - parseInt(current.id) >= 4900) {
          return null;
        }
        return current;
      });
    }, 5000);

    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body: message,
          });
        } catch (e) {
          console.error('Falha ao instanciar notificação nativa:', e);
        }
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            try {
              new Notification(title, {
                body: message,
              });
            } catch (e) {
              console.error('Falha ao instanciar notificação nativa:', e);
            }
          }
        });
      }
    }

    try {
      window.navigator.vibrate?.([100, 50, 100]);
    } catch {}
  };

  useEffect(() => {
    if (!appointments || appointments.length === 0) return;

    try {

      const notifiedStr = localStorage.getItem('vagou_notified_status_map') || '{}';
      const notifiedMap = JSON.parse(notifiedStr) as Record<string, string>;
      let hasChanges = false;

      appointments.forEach((apt) => {
        if (!apt.protocolCode) return;

        const currentStatus = apt.status || 'PENDENTE';
        const previousStatus = notifiedMap[apt.protocolCode];

        if (previousStatus && previousStatus !== currentStatus) {
          triggerLocalNotification(apt, previousStatus, currentStatus);
          notifiedMap[apt.protocolCode] = currentStatus;
          hasChanges = true;
        } else if (!previousStatus) {

          notifiedMap[apt.protocolCode] = currentStatus;
          hasChanges = true;
        }
      });

      if (hasChanges) {
        localStorage.setItem('vagou_notified_status_map', JSON.stringify(notifiedMap));
      }
    } catch (e) {
      console.error('Erro no detector de status:', e);
    }
  }, [appointments]);

  useEffect(() => {
    loadAppointments();
    initializeStoredPwaAssets();
    ensureServiceWorkerReady().catch(() => {});

    const activeSalonId = localStorage.getItem('vagou_salon_db_id') || null;
    const activeClientId = localStorage.getItem('vagou_client_id') || null;
    const unsubscribeV6Hub = isSupabaseConfigured
      ? subscribeToVagouRealtimeHub({
          salonId: activeSalonId,
          clientId: activeClientId,
          onEvent: (evt) => {
            if (evt.table === 'notification_outbox' && evt.eventType === 'INSERT') {
              triggerPushOutboxDispatch().catch(() => {});
            } else if (evt.table === 'appointments') {
              loadAppointments();
              triggerPushOutboxDispatch().catch(() => {});
            } else if (evt.table === 'media_assets' || evt.table === 'clients') {
              window.dispatchEvent(new CustomEvent('vagou:v6-realtime-event', { detail: evt }));
            }
          },
        })
      : () => {};

    const syncUserFromSupabase = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        const savedEmail = localStorage.getItem('vagou_user_email') || localStorage.getItem('vagou_active_partner') || '';
        const savedName = localStorage.getItem('vagou_user_name') || '';
        const savedCpf = localStorage.getItem('vagou_user_cpf') || '';
        const hasSession = Boolean(
          savedEmail ||
          savedCpf ||
          localStorage.getItem('vagou_client_session') ||
          localStorage.getItem('vagou_auth_user_id')
        );

        if (!hasSession) return;

        const profile = await fetchUserProfileFromDb({ email: savedEmail, name: savedName, cpf: savedCpf });

        const stillHasSession = Boolean(
          localStorage.getItem('vagou_user_email') ||
          localStorage.getItem('vagou_client_session') ||
          localStorage.getItem('vagou_auth_user_id')
        );
        if (!stillHasSession) return;

        if (profile) {
          if (profile.name && profile.name.trim() !== '' && profile.name !== 'Profissional' && profile.name !== 'Usuário') {
            setUserName(profile.name);
            localStorage.setItem('vagou_user_name', profile.name);
          }
          if (profile.email) {
            localStorage.setItem('vagou_user_email', profile.email);
          }
          const localAvatar = localStorage.getItem('vagou_user_avatar');
          const resolvedAvatar = isValidAvatarUrlString(profile.avatarUrl)
            ? profile.avatarUrl.trim()
            : isValidAvatarUrlString(localAvatar)
              ? localAvatar.trim()
              : '';
          if (resolvedAvatar) {
            setUserAvatarUrl(resolvedAvatar);
            localStorage.setItem('vagou_user_avatar', resolvedAvatar);
          }
        }
      } catch {}
    };

    const handleProfileUpdatedEvent = (e: Event) => {
      const customEvt = e as CustomEvent<{ name?: string; avatarUrl?: string }>;
      if (customEvt?.detail) {
        if (customEvt.detail.name !== undefined) {
          setUserName(customEvt.detail.name);
        }
        if (customEvt.detail.avatarUrl === '') {
          setUserAvatarUrl('');
          return;
        }
        if (isValidAvatarUrlString(customEvt.detail.avatarUrl)) {
          setUserAvatarUrl(customEvt.detail.avatarUrl.trim());
          return;
        }
      }
      const savedAvatar = localStorage.getItem('vagou_user_avatar');
      if (isValidAvatarUrlString(savedAvatar)) {
        setUserAvatarUrl(savedAvatar.trim());
      } else {
        setUserAvatarUrl('');
      }
      const savedName = localStorage.getItem('vagou_user_name') || '';
      setUserName(savedName);
    };

    syncUserFromSupabase();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    window.addEventListener('focus', loadAppointments);
    window.addEventListener('vagou:profile-updated', handleProfileUpdatedEvent);
    window.addEventListener('storage', handleProfileUpdatedEvent);

    let unsubscribeRealtime = () => {};
    if (isSupabaseConfigured) {
      const userEmail = localStorage.getItem('vagou_user_email') || '';
      unsubscribeRealtime = subscribeToAppointments({ clientEmail: userEmail }, ({ eventType, newRow }) => {
        if (newRow && (eventType === 'INSERT' || eventType === 'UPDATE')) {
          const mapped = mapDbAppointmentToBookingAppointment(newRow);
          setAppointments((prev) => {
            const index = prev.findIndex((a) => a.protocolCode === mapped.protocolCode || (a.id && a.id === mapped.id));
            let nextList: BookingAppointment[];
            if (index >= 0) {
              const old = prev[index];
              nextList = [...prev];
              nextList[index] = mapped;
              if (old.status !== mapped.status) {
                triggerLocalNotification(mapped, old.status, mapped.status);
              }
            } else {
              nextList = [mapped, ...prev];
              triggerLocalNotification(mapped, 'PENDENTE', mapped.status);
            }
            try {
              localStorage.setItem('vagou_user_appointments', JSON.stringify(nextList));
            } catch {}
            return nextList;
          });
        }
      });
    }

    const interval = setInterval(loadAppointments, 3000);

    return () => {
      window.removeEventListener('focus', loadAppointments);
      window.removeEventListener('vagou:profile-updated', handleProfileUpdatedEvent);
      window.removeEventListener('storage', handleProfileUpdatedEvent);
      unsubscribeRealtime();
      unsubscribeV6Hub();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const uMeta = session.user.user_metadata;
          const uEmail = session.user.email;
          const nameToSet = uMeta?.full_name || uMeta?.name || uEmail?.split('@')[0] || 'Usuário';
          setUserName(nameToSet);
          localStorage.setItem('vagou_user_name', nameToSet);
          if (session.user.id) localStorage.setItem('vagou_auth_user_id', session.user.id);
          if (uEmail) {
            localStorage.setItem('vagou_user_email', uEmail);
            localStorage.setItem('vagou_active_partner', uEmail);
          }
          if (uMeta?.cpf) {
            localStorage.setItem('vagou_user_cpf', String(uMeta.cpf).replace(/\D/g, ''));
          }
          const savedAvatar = localStorage.getItem('vagou_user_avatar');
          if (isValidAvatarUrlString(savedAvatar)) {
            setUserAvatarUrl(savedAvatar.trim());
          }
          setIsAuthenticated(true);
        } else {

          const hasLocalAuth = hasActiveAppSession();
          const ssoName = localStorage.getItem('vagou_user_name');
          const ssoAvatar = localStorage.getItem('vagou_user_avatar');
          if (hasLocalAuth) {
            setIsAuthenticated(true);
            if (ssoName) setUserName(ssoName);
            if (isValidAvatarUrlString(ssoAvatar)) setUserAvatarUrl(ssoAvatar.trim());
          } else {
            setIsAuthenticated(false);
            setUserName('');
            setUserAvatarUrl('');
            setViewMode('auth');
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar sessão inicial:', err);
      }
    };

    checkInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const uid = session.user.id;
        const uEmail = session.user.email;
        const uMeta = session.user.user_metadata;
        const nameToSet = uMeta?.full_name || uMeta?.name || uEmail?.split('@')[0] || 'Usuário';

        setUserName(nameToSet);
        setIsAuthenticated(true);
        localStorage.setItem('vagou_auth_user_id', uid);
        localStorage.setItem('vagou_user_name', nameToSet);
        if (uEmail) {
          localStorage.setItem('vagou_user_email', uEmail);
          localStorage.setItem('vagou_active_partner', uEmail);
        }
        if (uMeta?.cpf) {
          localStorage.setItem('vagou_user_cpf', String(uMeta.cpf).replace(/\D/g, ''));
        }

        setTimeout(() => {
          ensureClientRow(uid, uEmail, uMeta).catch((e) => console.warn('Erro em ensureClientRow:', e));
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        setUserName('');
        setUserAvatarUrl('');
        setIsAuthenticated(false);
        setViewMode('auth');
        try {
          localStorage.removeItem('vagou_auth_user_id');
          localStorage.removeItem('vagou_client_id');
          localStorage.removeItem('vagou_client_session');
          localStorage.removeItem('vagou_user_name');
          localStorage.removeItem('vagou_user_email');
          localStorage.removeItem('vagou_user_cpf');
          localStorage.removeItem('vagou_user_phone');
          localStorage.removeItem('vagou_user_avatar');
          localStorage.removeItem('vagou_active_partner');
          localStorage.removeItem('vagou_user_appointments');
        } catch {}
      }
    });

    const handleCustomAuthUpdated = (e?: Event) => {
      try {
        const customEvt = e as CustomEvent<{ loggedOut?: boolean }>;
        if (customEvt?.detail?.loggedOut) {
          setIsAuthenticated(false);
          setUserName('');
          setUserAvatarUrl('');
          setViewMode('auth');
          return;
        }
        const active = hasActiveAppSession();
        setIsAuthenticated(active);
        if (!active) {
          setUserName('');
          setUserAvatarUrl('');
          setViewMode('auth');
          return;
        }
        const savedName = localStorage.getItem('vagou_user_name') || '';
        const savedAvatar = localStorage.getItem('vagou_user_avatar') || '';
        setUserName(savedName);
        setUserAvatarUrl(isValidAvatarUrlString(savedAvatar) ? savedAvatar.trim() : '');
      } catch {
        setIsAuthenticated(false);
        setUserName('');
        setUserAvatarUrl('');
        setViewMode('auth');
      }
    };
    window.addEventListener('vagou:auth-updated', handleCustomAuthUpdated);
    window.addEventListener('storage', handleCustomAuthUpdated);

    return () => {
      authListener?.subscription.unsubscribe();
      window.removeEventListener('vagou:auth-updated', handleCustomAuthUpdated);
      window.removeEventListener('storage', handleCustomAuthUpdated);
    };
  }, []);

  useEffect(() => {
    const handleLiveAptUpdate = (e: Event) => {
      const customEvt = e as CustomEvent<{ appointment?: BookingAppointment }>;
      const updated = customEvt.detail?.appointment;
      if (!updated) return;
      setAppointments((prev) =>
        prev.map((a) =>
          a.protocolCode === updated.protocolCode || (a.id && a.id === updated.id)
            ? { ...a, ...updated }
            : a
        )
      );
    };
    window.addEventListener('vagou:appointments-updated', handleLiveAptUpdate);
    return () => window.removeEventListener('vagou:appointments-updated', handleLiveAptUpdate);
  }, []);

  const handleNavigateToAgenda = () => {
    loadAppointments();
    setViewMode('agenda');
  };

  const handleCancelAppointment = async (protocolCode: string, reason?: string) => {
    try {
      if (isSupabaseConfigured) {
        const res = await cancelAppointmentInDb(protocolCode, reason);
        if (!res.success && res.error) {
          console.warn('Aviso: Cancelamento no banco de dados:', res.error);
        }
      }

      const saved = localStorage.getItem('vagou_user_appointments');
      if (saved) {
        const list: BookingAppointment[] = JSON.parse(saved);
        const updated = list.map((apt) => {
          if (apt.protocolCode === protocolCode) {
            return {
              ...apt,
              status: 'CANCELADO',
              tracking_status: 'cancelled' as const,
              ...(reason ? { cancellation_reason: reason } : {}),
            };
          }
          return apt;
        });
        localStorage.setItem('vagou_user_appointments', JSON.stringify(updated));
        setAppointments(updated);
      }

      setActiveToast({
        id: String(Date.now()),
        title: 'Agendamento Cancelado',
        message: reason
          ? `O agendamento ${protocolCode} foi cancelado (Motivo: ${reason}).`
          : `O agendamento ${protocolCode} foi cancelado com sucesso.`,
        type: 'info',
      });
    } catch (e) {
      console.error('Erro ao cancelar agendamento:', e);
      setActiveToast({
        id: String(Date.now()),
        title: 'Falha no Cancelamento',
        message: 'Não foi possível cancelar o agendamento no momento.',
        type: 'error',
      });
    }
  };

  useEffect(() => {
    const syncSalonThemeState = (salonRow: any) => {
      const dbColor = salonRow?.primary_color || salonRow?.branding?.primaryColor;
      const hasCustomColor = Boolean(dbColor && isCustomBrandHex(dbColor));
      const isCustomized =
        salonRow?.branding?.themeExplicitlyCustomized === false
          ? false
          : Boolean(
              salonRow?.branding?.themeExplicitlyCustomized ||
              salonRow?.default_theme === 'dark' ||
              hasCustomColor
            );
      const resolvedColor = isCustomized
        ? (dbColor || DEFAULT_NEUTRAL_HEX)
        : DEFAULT_NEUTRAL_HEX;

      if (isCustomized) {
        localStorage.setItem(CUSTOMIZED_THEME_STORAGE_KEY, '1');
        localStorage.setItem('vagou_accent_color', resolvedColor);
        if (!localStorage.getItem(EXPLICIT_THEME_STORAGE_KEY)) {
          setTheme(salonRow?.default_theme === 'dark' ? 'dark' : 'light', { isExplicitUserChoice: false });
        }
        setAccentColor(resolvedColor, { isExplicitUserChoice: true });
      } else {
        resetToDefaultPalette();
      }
    };

    async function validateSubdomainAndSession() {
      try {
        const sub = detectActiveSubdomain();

        if (sub) {
          setCurrentSubdomain(sub);
          if (isSupabaseConfigured && supabase) {
            const { data: salon, error: salonErr } = await (supabase.from('salons') as any)
              .select('*')
              .eq('slug', sub)
              .eq('is_active', true)
              .maybeSingle();

            if (salonErr || !salon) {
              if (salonErr) console.warn('Erro ao validar subdomínio:', salonErr.message);
              setIsNotFound(true);
              setIsValidatingSubdomain(false);
              return;
            }

            setInitialSalonData(salon);
            const displayName = salon.trade_name || sub;
            setSalonName(displayName);
            localStorage.setItem('vagou_salon_db_id', salon.id);
            localStorage.setItem('vagou_salon_name', displayName);
            localStorage.setItem('vagou_salon_slug', salon.slug || sub);

            syncSalonThemeState(salon);
          }
        } else {
          const isLogged = hasActiveAppSession();
          if (!isLogged) {
            try {
              localStorage.removeItem('vagou_salon_db_id');
              localStorage.removeItem('vagou_salon_name');
              localStorage.removeItem('vagou_salon_slug');
              localStorage.removeItem('vagou_salon_logo');
              localStorage.removeItem('vagou_salon_logo_dark');
              localStorage.removeItem('vagou_salon_logo_light');
              localStorage.removeItem('vagou_salon_icon');
              localStorage.removeItem('vagou_salon_admin_settings');
            } catch {}
            setInitialSalonData(null);
            setSalonName('');
            resetToDefaultPalette();
          } else if (isSupabaseConfigured && supabase) {
            const authUserId = (localStorage.getItem('vagou_auth_user_id') || '').trim();
            const userEmail = (localStorage.getItem('vagou_user_email') || '').trim().toLowerCase();
            let ownedSalon: any = null;

            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId)) {
              const { data: byOwner } = await (supabase.from('salons') as any)
                .select('*')
                .eq('owner_id', authUserId)
                .eq('is_active', true)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
              if (byOwner) ownedSalon = byOwner;
            }

            if (!ownedSalon && userEmail) {
              const { data: byEmail } = await (supabase.from('salons') as any)
                .select('*')
                .ilike('email', userEmail)
                .eq('is_active', true)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
              if (byEmail) ownedSalon = byEmail;
            }

            if (ownedSalon) {
              setInitialSalonData(ownedSalon);
              const displayName = ownedSalon.trade_name || '';
              setSalonName(displayName);
              localStorage.setItem('vagou_salon_db_id', ownedSalon.id);
              localStorage.setItem('vagou_salon_name', displayName);
              localStorage.setItem('vagou_salon_slug', ownedSalon.slug);
              syncSalonThemeState(ownedSalon);
            } else {
              try {
                localStorage.removeItem('vagou_salon_db_id');
                localStorage.removeItem('vagou_salon_name');
                localStorage.removeItem('vagou_salon_slug');
                localStorage.removeItem('vagou_salon_logo');
                localStorage.removeItem('vagou_salon_logo_dark');
                localStorage.removeItem('vagou_salon_logo_light');
                localStorage.removeItem('vagou_salon_icon');
                localStorage.removeItem('vagou_salon_admin_settings');
              } catch {}
              setInitialSalonData(null);
              setSalonName('');
              resetToDefaultPalette();
            }
          }
        }
      } catch (err) {
        console.error('Erro ao validar subdomínio:', err);
      } finally {
        setIsValidatingSubdomain(false);
      }
    }

    validateSubdomainAndSession();
  }, []);

  const [isFavorite, setIsFavorite] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vagou_is_favorite') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleFavorite = () => {
    setIsFavorite((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vagou_is_favorite', String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleSalonRedirectMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      const isSalonCreationRedirect =
        data.type === 'VAGOU_REDIRECT' ||
        data.action === 'SALON_MASTER_SUCCESS' ||
        (data.type === 'VAGOU_REGISTRATION_SUCCESS' &&
          (data.slug || data.redirectUrl || data.salonUrl || data.accountType === 'owner'));

      if (!isSalonCreationRedirect) return;

      const rawSlug = String(data.slug || data.salon?.slug || data.payload?.slug || '').trim();
      const rawName = String(
        data.salon?.trade_name || data.salon?.name || data.payload?.tradeName || data.payload?.salonName || ''
      ).trim();
      const rawSalonId = String(data.salon?.id || data.payload?.id || '').trim();

      try {
        if (rawSlug) localStorage.setItem('vagou_salon_slug', rawSlug);
        if (rawName) {
          localStorage.setItem('vagou_salon_name', rawName);
          setSalonName(rawName);
        }
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

    window.addEventListener('message', handleSalonRedirectMessage);
    return () => window.removeEventListener('message', handleSalonRedirectMessage);
  }, []);

  if (isValidatingSubdomain) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center font-sans">
        <Loader2 className="w-7 h-7 animate-spin brand-icon" />
      </div>
    );
  }

  if (isNotFound) {
    return <SalonNotFoundScreen subdomain={currentSubdomain} />;
  }

  const isAuthScreenActive = !isAuthenticated || viewMode === 'auth';

  return (
    <div className={`min-h-screen h-dvh w-full flex justify-center overflow-hidden font-sans ${
      isAuthScreenActive || isDark ? 'bg-slate-950 text-slate-100' : 'bg-[var(--neutral-outer-bg)] text-[#0F172A]'
    }`}>

      <section
        aria-label="Aplicativo Vagou"
        className={`w-full max-w-[430px] min-h-screen h-dvh flex flex-col relative overflow-hidden shadow-lg sm:border-x ${
          isAuthScreenActive
            ? 'bg-slate-950 sm:border-white/10'
            : isDark
              ? 'bg-[#151A1E] sm:border-slate-800/80'
              : 'bg-[var(--brand-canvas-bg)] sm:border-[var(--neutral-shell-border)]'
        }`}
      >

        {activeToast && (
          <aside
            role="status"
            aria-live="polite"
            className={`absolute top-4 left-4 right-4 z-[9999] pointer-events-auto p-3.5 rounded-[4px] border shadow-2xl flex items-start gap-3 backdrop-blur-md animate-in slide-in-from-top-4 duration-300 ${
              activeToast.type === 'success'
                ? isDark ? 'bg-slate-900/95 brand-border-active text-white' : 'bg-white/95 brand-border-active text-slate-900'
                : activeToast.type === 'error'
                  ? isDark ? 'bg-rose-950/95 border-rose-500/40 text-white shadow-rose-900/10' : 'bg-rose-50/95 border-rose-200 text-rose-900'
                  : isDark ? 'bg-slate-900/95 border-slate-700/50 text-white' : 'bg-slate-100/95 border-slate-200 text-slate-900'
            }`}
          >
            <article className="flex-1 min-w-0">
              <header className="text-xs font-black tracking-tight font-['Poppins'] flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${
                  activeToast.type === 'success' ? 'bg-[var(--brand-primary)]' : activeToast.type === 'error' ? 'bg-rose-400' : 'bg-amber-400'
                }`} />
                {activeToast.title}
              </header>
              <p className="text-[11px] leading-snug mt-1 opacity-90 font-medium">
                {activeToast.message}
              </p>
            </article>
            <button
              type="button"
              onClick={() => setActiveToast(null)}
              className={`text-[10px] uppercase font-bold shrink-0 cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Fechar
            </button>
          </aside>
        )}

        <main className="flex-1 w-full min-h-0 overflow-hidden relative flex flex-col">
          {!isAuthenticated || viewMode === 'auth' ? (
            <PartnerAuthView
              salonName={initialSalonData?.trade_name || salonName}
              salonSlug={initialSalonData?.slug || currentSubdomain || ''}
              salonLogo={
                initialSalonData?.logo_dark_url ||
                initialSalonData?.logo_url ||
                initialSalonData?.logo_light_url ||
                ''
              }
              logoTextFallback={
                initialSalonData?.logo_text_fallback ||
                initialSalonData?.branding?.logoTextFallback ||
                ''
              }
              primaryColor={initialSalonData?.primary_color || initialSalonData?.branding?.primaryColor || DEFAULT_NEUTRAL_HEX}
              onSuccess={(partnerData?: PartnerAuthSuccessData) => {
                if (partnerData?.salonName) {
                  setSalonName(partnerData.salonName);
                  try {
                    localStorage.setItem('vagou_salon_name', partnerData.salonName);
                  } catch {}
                }
                if (partnerData?.slug) {
                  try {
                    localStorage.setItem('vagou_salon_slug', partnerData.slug);
                  } catch {}
                }
                const targetUrl =
                  partnerData?.redirectUrl ||
                  partnerData?.salonUrl ||
                  (partnerData?.slug ? `https://${partnerData.slug}.vagouapp.com` : '');
                if (targetUrl) {
                  window.location.assign(targetUrl);
                  return;
                }
                const currentName = localStorage.getItem('vagou_user_name');
                if (currentName) {
                  setUserName(currentName);
                }
                setIsAuthenticated(true);
                setViewMode('salon');
              }}
              onBack={isAuthenticated ? () => setViewMode('salon') : undefined}
            />
          ) : viewMode === 'salon' ? (
            <SalonProfileView
              key={currentSubdomain || 'salon-profile'}
              salonName={salonName}
              activeSubdomain={currentSubdomain}
              initialSalonData={initialSalonData}
              userRole={effectiveRole}
              offers={offers}
              onDirectBook={(_offer) => {

              }}
              isFavorite={isFavorite}
              onToggleFavorite={handleToggleFavorite}
              userName={userName}
              userAvatarUrl={userAvatarUrl}
              onNavigateToUserAppointments={handleNavigateToAgenda}
              onNavigateToUserDashboard={() => setViewMode('dashboard')}
              onBackToAuth={() => setViewMode('auth')}
            />
          ) : viewMode === 'agenda' ? (
            <UserAppointmentsView
              appointments={appointments}
              onBack={() => setViewMode('salon')}
              onCancelAppointment={handleCancelAppointment}
              onUpdateAppointments={(updatedList) => {
                setAppointments(updatedList);
                try {
                  localStorage.setItem('vagou_user_appointments', JSON.stringify(updatedList));
                } catch {}
              }}
              onRescheduleAppointment={() => {
                setViewMode('salon');
                setActiveToast({
                  id: String(Date.now()),
                  title: 'Remanejamento de Horário',
                  message: 'Escolha o novo horário desejado na grade de vagas do estabelecimento.',
                  type: 'info',
                });
              }}
            />
          ) : (
            <UserDashboard
              onBack={() => setViewMode('salon')}
              onUpdateProfile={(newName, newAvatar) => {
                if (newName) setUserName(newName);
                if (isValidAvatarUrlString(newAvatar)) {
                  setUserAvatarUrl(newAvatar.trim());
                  try {
                    localStorage.setItem('vagou_user_avatar', newAvatar.trim());
                  } catch {}
                } else if (newAvatar === '') {
                  setUserAvatarUrl('');
                }
              }}
            />
          )}
        </main>
      </section>
    </div>
  );
};

export default App;
