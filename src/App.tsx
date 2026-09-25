import React, { useState, useEffect } from 'react';
import { SalonProfileView } from './components/SalonProfileView';
import { UserAppointmentsView } from './components/UserAppointmentsView';
import { UserDashboard } from './components/UserDashboard';
import { PartnerAuthView, PartnerAuthSuccessData } from './components/PartnerAuthView';
import { ServiceOffer, BookingAppointment } from './types';
import { initializeStoredPwaAssets } from './utils/pwaAssets';
import { 
  ThemeContext, 
  ThemeProvider, 
  useTheme, 
  applyAccentColorToDom, 
  type ThemeContextType 
} from './context/ThemeContext';

export { ThemeContext, ThemeProvider, useTheme, applyAccentColorToDom, type ThemeContextType };

// Lista de ofertas padrão (vazio, carregado do banco)
const EMPTY_OFFERS: ServiceOffer[] = [];

export const App: React.FC = () => {
  const { isDark, accentColor } = useTheme();
  // Início padrão na tela de Login / Cadastre-se com botão Acessar como Admin
  const [viewMode, setViewMode] = useState<'auth' | 'salon' | 'agenda' | 'dashboard'>(() => {
    try {
      const isLoggedIn = localStorage.getItem('vagou_salon_logged_in') === 'true';
      return isLoggedIn ? 'salon' : 'auth';
    } catch {
      return 'auth';
    }
  });
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
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('vagou_user_name') || 'Profissional';
  });
  const [userAvatarUrl, setUserAvatarUrl] = useState(() => {
    return localStorage.getItem('vagou_user_avatar') || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
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
      if (savedAvatar) {
        setUserAvatarUrl(savedAvatar);
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

  const handleNavigateToAgenda = () => {
    loadAppointments();
    setViewMode('agenda');
  };

  const handleCancelAppointment = (protocolCode: string) => {
    try {
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
    }
  };

  useEffect(() => {
    applyAccentColorToDom(accentColor);
  }, [accentColor]);


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

  return (
    <div className={`w-full h-dvh flex items-center justify-center overflow-hidden font-['Poppins'] ${
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
        <main className="flex-1 w-full min-h-0 overflow-hidden relative">
          {viewMode === 'auth' ? (
            <PartnerAuthView
              onSuccess={(partnerData?: PartnerAuthSuccessData, userRole?: 'pro' | 'cliente') => {
                if (partnerData?.salonName) {
                  setSalonName(partnerData.salonName);
                }
                if (userRole === 'pro') {
                  localStorage.setItem('vagou_salon_logged_in', 'true');
                  localStorage.setItem('vagou_current_persona', 'pro');
                  localStorage.setItem('vagou_user_role', 'pro');
                } else if (userRole === 'cliente') {
                  localStorage.setItem('vagou_salon_logged_in', 'false');
                  localStorage.setItem('vagou_current_persona', 'cliente');
                  localStorage.setItem('vagou_user_role', 'cliente');
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
              key={`salon-${localStorage.getItem('vagou_user_role') || 'default'}-${localStorage.getItem('vagou_current_persona') || 'default'}`}
              salonName={salonName}
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
