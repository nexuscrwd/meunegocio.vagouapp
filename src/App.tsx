import React, { useState, useEffect } from 'react';
import { SalonProfileView } from './components/SalonProfileView';
import { UserAppointmentsView } from './components/UserAppointmentsView';
import { UserDashboard } from './components/UserDashboard';
import { PartnerAuthView, PartnerAuthSuccessData } from './components/PartnerAuthView';
import { SalonNotFoundScreen } from './components/public/SalonNotFoundScreen';
import { useSalonRole } from './hooks/useSalonRole';
import { ServiceOffer, BookingAppointment } from './types';
import { initializeStoredPwaAssets } from './utils/pwaAssets';
import { DEFAULT_FACE_CLIPART_AVATAR } from './utils/defaultSalonAssets';
import { supabase, isSupabaseConfigured, fetchUserProfileFromDb, checkUserSalonMembership, ensureClientRow } from './lib/supabase';
import { 
  ThemeContext, 
  ThemeProvider, 
  useTheme, 
  applyAccentColorToDom, 
  type ThemeContextType 
} from './context/ThemeContext';

export { ThemeContext, ThemeProvider, useTheme, applyAccentColorToDom, type ThemeContextType };

// Subdomínios do sistema que NÃO são salões de beleza
const RESERVED_SUBDOMAINS = [
  'adm', 'admin', 'admvapp', 'portal', 'pvapp', 'meunegocio', 'mnvapp',
  'www', 'api', 'suporte', 'ajuda', 'vagou', 'vagouapp', 'localhost',
  'app', 'dashboard', 'status', 'auth', 'login', 'signup', 'checkout', 'pay', 'billing'
];

// Lista de ofertas padrão (vazio, carregado do banco)
const EMPTY_OFFERS: ServiceOffer[] = [];

export const App: React.FC = () => {
  const { isDark, accentColor } = useTheme();

  // Validação do Subdomínio Wildcard (*.vagouapp.com)
  const [isNotFound, setIsNotFound] = useState(false);
  const [currentSubdomain, setCurrentSubdomain] = useState('');
  const [isValidatingSubdomain, setIsValidatingSubdomain] = useState(true);

  // Início padrão na vitrine do estabelecimento ('salon')
  const [viewMode, setViewMode] = useState<'auth' | 'salon' | 'agenda' | 'dashboard'>('salon');
  const [salonName, setSalonName] = useState(() => {
    try {
      const saved = localStorage.getItem('vagou_partner_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.salonName) return parsed.salonName;
      }
    } catch {}
    return '';
  });

  // Slug de desenvolvimento em DEV (configurado nos Secrets do AI Studio: VITE_DEV_SALON_SLUG)
  const devSlug = import.meta.env.DEV ? (import.meta.env.VITE_DEV_SALON_SLUG as string | undefined) : undefined;
  const activeSalonIdentifier = devSlug || currentSubdomain;
  const { role: currentRole } = useSalonRole(activeSalonIdentifier);

  // Trava anti-expulsão: enquanto valida o subdomínio, passa 'loading' para o SalonProfileView
  const effectiveRole = isValidatingSubdomain ? 'loading' : currentRole;
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('vagou_user_name') || 'Profissional';
  });
  const [userAvatarUrl, setUserAvatarUrl] = useState(() => {
    try {
      const saved = localStorage.getItem('vagou_user_avatar');
      if (saved && (saved.includes('unsplash.com') || saved.includes('images.unsplash'))) {
        localStorage.removeItem('vagou_user_avatar');
        return '';
      }
      if (saved && saved.trim() !== '') return saved;
    } catch {}
    return '';
  });
  const [appointments, setAppointments] = useState<BookingAppointment[]>([]);
  const [offers, setOffers] = useState<ServiceOffer[]>(EMPTY_OFFERS);

  interface AppToast {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'error';
  }
  const [activeToast, setActiveToast] = useState<AppToast | null>(null);

  const loadAppointments = () => {
    try {
      const saved = localStorage.getItem('vagou_user_appointments');
      if (saved) {
        setAppointments(JSON.parse(saved));
      } else {
        setAppointments([]);
      }

      const savedName = localStorage.getItem('vagou_user_name');
      if (savedName) {
        setUserName(savedName);
      }
      const savedAvatar = localStorage.getItem('vagou_user_avatar');
      if (savedAvatar && (savedAvatar.includes('unsplash.com') || savedAvatar.includes('images.unsplash'))) {
        localStorage.removeItem('vagou_user_avatar');
        setUserAvatarUrl('');
      } else if (savedAvatar) {
        setUserAvatarUrl(savedAvatar);
      } else {
        setUserAvatarUrl('');
      }
    } catch {
      setAppointments([]);
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

    // 1. Mostrar o Toast interno no app
    setActiveToast({
      id: Date.now().toString(),
      title,
      message,
      type: newStatus === 'CONFIRMADO' ? 'success' : newStatus === 'CANCELADO' ? 'error' : 'info'
    });

    // Auto fechar o Toast após 5 segundos
    setTimeout(() => {
      setActiveToast((current) => {
        if (current && Date.now() - parseInt(current.id) >= 4900) {
          return null;
        }
        return current;
      });
    }, 5000);

    // 2. Chamar a API de Notificação Nativa do navegador (se disponível e autorizada)
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

    // 3. Feedback tátil/vibratório suave
    try {
      window.navigator.vibrate?.([100, 50, 100]);
    } catch {}
  };

  // Detector de mudança de status para notificações locais
  useEffect(() => {
    if (!appointments || appointments.length === 0) return;

    try {
      // Obter o mapa de status já salvos anteriormente para comparar
      const notifiedStr = localStorage.getItem('vagou_notified_status_map') || '{}';
      const notifiedMap = JSON.parse(notifiedStr) as Record<string, string>;
      let hasChanges = false;

      appointments.forEach((apt) => {
        if (!apt.protocolCode) return;
        
        const currentStatus = apt.status || 'PENDENTE';
        const previousStatus = notifiedMap[apt.protocolCode];

        // Se o agendamento já estava registrado e o status mudou!
        if (previousStatus && previousStatus !== currentStatus) {
          triggerLocalNotification(apt, previousStatus, currentStatus);
          notifiedMap[apt.protocolCode] = currentStatus;
          hasChanges = true;
        } else if (!previousStatus) {
          // Primeira vez que vemos esse agendamento, guardamos o status silenciosamente
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
    
    // Sincronizar perfil do usuário com o Supabase em segundo plano (Tríade Sync)
    const syncUserFromSupabase = async () => {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        const savedEmail = localStorage.getItem('vagou_user_email') || localStorage.getItem('vagou_active_partner') || '';
        const savedName = localStorage.getItem('vagou_user_name') || '';

        if (!savedEmail && !savedName) return;

        // 1. fetchUserProfileFromDb (Auth, Profiles, Professionals, Clients)
        const profile = await fetchUserProfileFromDb({ email: savedEmail, name: savedName });
        if (profile) {
          if (profile.name && profile.name.trim() !== '' && profile.name !== 'Profissional' && profile.name !== 'Usuário') {
            setUserName(profile.name);
            localStorage.setItem('vagou_user_name', profile.name);
          }
          if (profile.email) {
            localStorage.setItem('vagou_user_email', profile.email);
          }
          if (profile.avatarUrl && !profile.avatarUrl.includes('unsplash.com') && !profile.avatarUrl.startsWith('data:image/svg+xml')) {
            setUserAvatarUrl(profile.avatarUrl);
            localStorage.setItem('vagou_user_avatar', profile.avatarUrl);
          } else {
            setUserAvatarUrl('');
            localStorage.removeItem('vagou_user_avatar');
          }
        } else {
          setUserAvatarUrl('');
          localStorage.removeItem('vagou_user_avatar');
        }
      } catch {}
    };

    syncUserFromSupabase();

    // Solicitar permissão para notificações nativas no carregamento inicial
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Recarregar agendamentos quando a aba ou janela ganha foco para manter dados sincronizados
    window.addEventListener('focus', loadAppointments);

    // Poll localstorage periodicamente a cada 2 segundos para sincronizar as mudanças de status em tempo real
    const interval = setInterval(loadAppointments, 2000);

    return () => {
      window.removeEventListener('focus', loadAppointments);
      clearInterval(interval);
    };
  }, []);

  // Ponto ÚNICO soberano de garantia da linha do cliente em public.clients no login
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const uid = session.user.id;
        const uEmail = session.user.email;
        const uMeta = session.user.user_metadata;
        setTimeout(() => {
          ensureClientRow(uid, uEmail, uMeta).catch((e) => console.warn('Erro em ensureClientRow:', e));
        }, 0);
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleNavigateToAgenda = () => {
    loadAppointments();
    setViewMode('agenda');
  };

  const handleCancelAppointment = async (protocolCode: string) => {
    try {
      if (isSupabaseConfigured && supabase) {
        // RLS restringe update do cliente estritamente para status: CANCELADO
        const { data, error } = await (supabase.from('appointments') as any)
          .update({ status: 'CANCELADO', updated_at: new Date().toISOString() })
          .eq('protocol_code', protocolCode)
          .select('id');

        if (error || !data || data.length !== 1) {
          alert('Não foi possível cancelar este agendamento. Verifique suas permissões ou contate o salão.');
          return;
        }
      }

      const saved = localStorage.getItem('vagou_user_appointments');
      if (saved) {
        const list: BookingAppointment[] = JSON.parse(saved);
        const updated = list.map(apt => {
          if (apt.protocolCode === protocolCode) {
            return { ...apt, status: 'CANCELADO' };
          }
          return apt;
        });
        localStorage.setItem('vagou_user_appointments', JSON.stringify(updated));
        setAppointments(updated);
      }
    } catch (e) {
      console.error('Erro ao cancelar agendamento:', e);
      alert('Falha ao processar o cancelamento.');
    }
  };

  useEffect(() => {
    applyAccentColorToDom(accentColor);
  }, [accentColor]);


  // Validação Inicial de Subdomínio Wildcard (*.vagouapp.com) e Validação Soberana de Papel (RBAC)
  useEffect(() => {
    async function validateSubdomainAndSession() {
      try {
        const hostname = window.location.hostname; // ex: "andersonstudio.vagouapp.com"
        const isDevOrPreview = 
          hostname.includes('localhost') || 
          hostname.includes('127.0.0.1') || 
          hostname.includes('run.app') || 
          hostname.includes('webcontainer') || 
          hostname.includes('stackblitz');

        const parts = hostname.split('.');
        let detectedSubdomain = '';

        if (parts.length >= 3 && !isDevOrPreview) {
          const sub = parts[0].toLowerCase().trim();

          if (!RESERVED_SUBDOMAINS.includes(sub) && !sub.startsWith('ais-')) {
            detectedSubdomain = sub;
            if (isSupabaseConfigured && supabase) {
              const { data: salon, error: salonErr } = await (supabase.from('salons') as any)
                .select('id, trade_name, slug, is_active')
                .eq('slug', sub)
                .eq('is_active', true)
                .maybeSingle();

              if (salonErr || !salon) {
                if (salonErr) console.warn('Erro ao validar subdomínio:', salonErr.message);
                setCurrentSubdomain(sub);
                setIsNotFound(true);
                setIsValidatingSubdomain(false);
                return;
              }

              // ✅ ENCONTRADO: Define o nome do salão ativo a partir da coluna real trade_name
              setCurrentSubdomain(sub);
              const displayName = salon.trade_name || sub;
              setSalonName(displayName);
              localStorage.setItem('vagou_salon_name', displayName);
              localStorage.setItem('vagou_salon_slug', salon.slug || sub);
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

  // 🛑 Se o subdomínio não foi encontrado no Supabase (status !== 'active')
  if (isNotFound) {
    return <SalonNotFoundScreen subdomain={currentSubdomain} />;
  }

  return (
    <div className={`w-full h-full h-dvh flex items-center justify-center overflow-hidden font-['Poppins'] ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-200/80 text-slate-900'
    }`}>
      {/* Contêiner Mobile do Aplicativo (Enquadramento PWA Nativo Mobile-First no Desktop) */}
      <section 
        aria-label="Aplicativo Vagou"
        className={`w-full max-w-md h-full flex flex-col relative overflow-hidden sm:shadow-2xl sm:border-x ${
          isDark ? 'bg-[#151A1E] sm:border-slate-800/80' : 'bg-slate-50 sm:border-slate-200'
        }`}
      >
        {/* Toast Notificação de Status */}
        {activeToast && (
          <aside 
            role="status" 
            aria-live="polite"
            className={`absolute top-4 left-4 right-4 z-[9999] pointer-events-auto p-3.5 rounded-[4px] border shadow-2xl flex items-start gap-3 backdrop-blur-md animate-in slide-in-from-top-4 duration-300 ${
              activeToast.type === 'success'
                ? isDark ? 'bg-emerald-950/95 border-emerald-500/40 text-white shadow-emerald-900/10' : 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                : activeToast.type === 'error'
                  ? isDark ? 'bg-rose-950/95 border-rose-500/40 text-white shadow-rose-900/10' : 'bg-rose-50/95 border-rose-200 text-rose-900'
                  : isDark ? 'bg-slate-900/95 border-slate-700/50 text-white' : 'bg-slate-100/95 border-slate-200 text-slate-900'
            }`}
          >
            <article className="flex-1 min-w-0">
              <header className="text-xs font-black tracking-tight font-['Poppins'] flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${
                  activeToast.type === 'success' ? 'bg-emerald-400' : activeToast.type === 'error' ? 'bg-rose-400' : 'bg-amber-400'
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

        {/* Contêiner Principal da Página do Estabelecimento */}
        <main className="flex-1 w-full min-h-0 overflow-hidden relative flex flex-col">
          {viewMode === 'auth' ? (
            <PartnerAuthView
              onSuccess={(partnerData?: PartnerAuthSuccessData) => {
                if (partnerData?.salonName) {
                  setSalonName(partnerData.salonName);
                }
                const currentName = localStorage.getItem('vagou_user_name');
                if (currentName) {
                  setUserName(currentName);
                }
                setViewMode('salon');
              }}
            />
          ) : viewMode === 'salon' ? (
            <SalonProfileView
              key={salonName || 'salon-profile'}
              salonName={salonName}
              userRole={effectiveRole}
              offers={offers}
              onDirectBook={(_offer) => {
                // Booking callback
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
            />
          ) : (
            <UserDashboard
              onBack={() => setViewMode('salon')}
              onUpdateProfile={(newName, newAvatar) => {
                setUserName(newName);
                setUserAvatarUrl(newAvatar);
              }}
            />
          )}
        </main>
      </section>
    </div>
  );
};

export default App;
