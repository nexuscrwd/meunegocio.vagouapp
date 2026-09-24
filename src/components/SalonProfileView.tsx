import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Heart, Zap, 
  Calendar,
  ChevronLeft, ChevronRight, ArrowRight,
  Check, MessageCircle, MessageSquare,
  Scissors, Hand, Smile, Eye, Sparkles, LayoutDashboard,
  Store, Car, MapPin, Clock, Users, Wifi, Coffee, Wind,
  LogOut, ShieldCheck, EyeOff, User, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ServiceOffer, BookingAppointment, SalonAdminSettings, UserPersona, ProfessionalTeamMember } from '../types';
import { SalonBookingModal, CatalogServiceItem, SalonProfessionalItem } from './SalonBookingModal';
import { ProfessionalDashboardView } from './professional/ProfessionalDashboardView';
import { ProfessionalServicesManager } from './professional/ProfessionalServicesManager';
import { ProfessionalAgendaView } from './professional/ProfessionalAgendaView';
import { ProfessionalSpaceManager } from './professional/ProfessionalSpaceManager';
import { TeamManager } from './professional/TeamManager';
import { FinancialManagerView } from './professional/FinancialManagerView';
import { CaixaManagerView } from './professional/CaixaManagerView';
import { ProfessionalLoginModal } from './professional/ProfessionalLoginModal';
import { SalonCustomizationHub } from './professional/SalonCustomizationHub';
import { UtilitiesAndToolsView } from './professional/UtilitiesAndToolsView';
import { useTheme } from '../context/ThemeContext';
import { getSalonLogo } from '../utils/salonLogos';
import { DEFAULT_ROTA99_LOGO_DARK, DEFAULT_ROTA99_LOGO_LIGHT, DEFAULT_ROTA99_ICON } from '../utils/defaultSalonAssets';
import { updateDynamicPwaAssets } from '../utils/pwaAssets';
import { BottomNav } from './BottomNav';
import { ProfileDrawer } from './ProfileDrawer';
import { hapticSuccess, hapticLight } from '../utils/haptics';
import { 
  supabase, 
  isSupabaseConfigured, 
  fetchSalonServices, 
  fetchSalonProfessionals,
  fetchSalonAppointments,
  upsertSalonService 
} from '../lib/supabase';

export interface SalonProfileViewProps {
  salonName: string;
  offers: ServiceOffer[];
  onBack?: () => void;
  onDirectBook: (offer: ServiceOffer) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (salonName: string) => void;
  userName?: string;
  userAvatarUrl?: string;
  onNavigateToUserAppointments?: () => void;
  onNavigateToUserDashboard?: () => void;
  onBackToAuth?: () => void;
}

// Catálogo inicial de serviços padrão (vazio por padrão, integrado ao Supabase)
const INITIAL_CATALOG_SERVICES: CatalogServiceItem[] = [];

// Componente de Mídia do Card de Serviço (Vídeo 5s, Slideshow de até 5 fotos ou Foto Estática)
const ServiceCardMedia: React.FC<{ service: CatalogServiceItem }> = ({ service }) => {
  const displayMode = service.displayMode || (service.mediaType === 'video' || service.videoUrl ? 'video' : 'static');
  const photos = service.photos && service.photos.length > 0 
    ? service.photos 
    : (service.image ? [service.image] : []);
  
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    if (displayMode !== 'slideshow' || photos.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % photos.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [displayMode, photos.length]);

  if (displayMode === 'video' && service.videoUrl) {
    return (
      <video
        src={service.videoUrl}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
    );
  }

  if (displayMode === 'slideshow' && photos.length > 1) {
    return (
      <div className="w-full h-full relative overflow-hidden bg-slate-950">
        {photos.map((photo, i) => (
          <img
            key={i}
            src={photo}
            alt={`${service.title} - ${i + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
              i === slideIdx ? 'opacity-100' : 'opacity-0 pointer-events-none'
            } group-hover:scale-110 transition-transform duration-700`}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ))}

        {/* Indicadores de pontinhos discretos do Slide */}
        <div className="absolute bottom-11 right-2 z-10 flex items-center gap-1 pointer-events-none">
          {photos.map((_, i) => (
            <span
              key={i}
              className={`transition-all duration-300 rounded-full ${
                i === slideIdx 
                  ? 'w-2 h-1 bg-emerald-400 shadow-xs' 
                  : 'w-1 h-1 bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (photos.length > 0) {
    return (
      <img
        src={photos[0]}
        alt={service.title}
        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    );
  }

  // Placeholder estilizado (Ombro e Rosto / Ícone de Linha) quando não há foto
  return (
    <div className="w-full h-full bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-3 text-center">
      <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-1">
        <User className="w-5 h-5 stroke-[1.75]" />
      </div>
      <span className="text-[10px] font-bold text-slate-400 truncate w-full px-1">
        {service.title}
      </span>
    </div>
  );
};

// Equipe inicial padrão (vazia por padrão)
const INITIAL_PROFESSIONALS: SalonProfessionalItem[] = [];

// Agendamentos iniciais padrão para a agenda do profissional (vazio por padrão)
const INITIAL_APPOINTMENTS: BookingAppointment[] = [];

// Cabeçalho de Seção Fixo Padrão que gruda perfeitamente abaixo do cabeçalho principal
interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
  isDark?: boolean;
}

const SectionHeader: React.FC<SectionHeaderProps> = React.memo(({ title, action, className = '', isDark = true }) => (
  <div
    className={`w-full px-4 sm:px-5 py-2.5 sm:py-3 border-y flex items-center justify-between transition-colors shadow-xs shrink-0 ${
      isDark
        ? 'bg-gradient-to-r from-emerald-950/95 via-emerald-900/70 to-slate-950/95 border-emerald-500/30'
        : 'bg-gradient-to-r from-emerald-500/20 via-emerald-500/15 to-emerald-50/95 border-emerald-500/30'
    } ${className}`}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="w-1 h-3.5 sm:h-4 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
      <h2
        className={`text-[12px] font-bold uppercase tracking-wider font-['Poppins'] truncate ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {title}
      </h2>
    </div>
    {action && (
      <div className="flex items-center gap-2 shrink-0">
        {action}
      </div>
    )}
  </div>
));

export const SalonProfileView: React.FC<SalonProfileViewProps> = ({
  salonName,
  offers,
  onBack,
  onDirectBook,
  isFavorite = false,
  onToggleFavorite,
  userName = 'Usuário',
  userAvatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  onNavigateToUserAppointments,
  onNavigateToUserDashboard,
  onBackToAuth,
}) => {
  const { isDark, accentColor, setAccentColor: setAccentColorContext } = useTheme();
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState<boolean>(false);
  const [currentUserName, setCurrentUserName] = useState<string>(userName);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  React.useEffect(() => {
    setCurrentUserName(userName);
  }, [userName]);
  const [isLoginPinModalOpen, setIsLoginPinModalOpen] = useState<boolean>(false);
  const [isManagePinModalOpen, setIsManagePinModalOpen] = useState<boolean>(false);

  // Personalidade Ativa: 'cliente' | 'pro' (mapeando legados 'profissional'/'admin' para 'pro')
  const [currentPersona, setCurrentPersona] = useState<UserPersona>(() => {
    try {
      const saved = localStorage.getItem('vagou_current_persona') as UserPersona;
      if (saved === 'cliente') return 'cliente';
      if (saved === 'pro' || saved === 'profissional' || saved === 'admin') {
        return 'pro';
      }
      const logged = localStorage.getItem('vagou_salon_logged_in') === 'true';
      return logged ? 'pro' : 'cliente';
    } catch {
      return 'pro';
    }
  });

  // Estado de Autenticação do Salão / Modo Gestor
  const [isSalonLoggedIn, setIsSalonLoggedIn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('vagou_current_persona');
      if (saved === 'pro' || saved === 'admin' || saved === 'profissional') return true;
      if (saved === 'cliente') return false;
      return localStorage.getItem('vagou_salon_logged_in') === 'true';
    } catch {
      return true;
    }
  });

  // Modo de visualização quando logado: 'ger' (Gerenciamento) ou 'pub' (Público / Visão do Cliente)
  const [viewMode, setViewMode] = useState<'ger' | 'pub'>(() => {
    try {
      const saved = localStorage.getItem('vagou_current_persona');
      return saved === 'cliente' ? 'pub' : 'ger';
    } catch {
      return 'ger';
    }
  });

  // Modo ativo operacional/gerenciamento
  const isGerMode = currentPersona !== 'cliente';

  // Identifica se o usuário conectado possui perfil de profissional/dono
  const isUserProRole = useMemo(() => {
    try {
      const userRole = localStorage.getItem('vagou_user_role');
      if (userRole === 'cliente') return false;
      if (userRole === 'pro' || userRole === 'admin') return true;
      const loggedPartner = localStorage.getItem('vagou_active_partner');
      const isLoggedSalon = localStorage.getItem('vagou_salon_logged_in') === 'true';
      return isLoggedSalon || currentPersona === 'pro' || !!loggedPartner;
    } catch {
      return true;
    }
  }, [currentPersona]);

  // Identificação do Profissional Logado / Ativo no modo Pro
  const [activeProId, setActiveProId] = useState<string>(() => {
    try {
      return localStorage.getItem('vagou_active_pro_id') || 'prof_admin_1';
    } catch {
      return 'prof_admin_1';
    }
  });

  // Lista dinâmica de membros da equipe para identificação de perfil (Admin vs Membro)
  const [teamMembersList, setTeamMembersList] = useState<ProfessionalTeamMember[]>(() => {
    try {
      const saved = localStorage.getItem('vagou_salon_team_members') || localStorage.getItem('vagou_team_members');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const partnerDataStr = localStorage.getItem('vagou_partner_data');
      if (partnerDataStr) {
        const p = JSON.parse(partnerDataStr);
        if (p.legalManagerName) {
          return [
            {
              id: 'prof_admin_1',
              name: p.legalManagerName,
              role: 'admin',
              phone: p.legalManagerPhone || p.phoneWhatsapp || '',
              commissionRate: 100,
              specialties: [p.category || 'Geral'],
              avatarUrl: '',
              isActive: true,
              joinedAt: new Date().toISOString(),
            }
          ];
        }
      }
    } catch {}
    return [
      {
        id: 'prof_admin_1',
        name: 'Administrador',
        role: 'admin',
        phone: '',
        commissionRate: 100,
        specialties: ['Geral'],
        avatarUrl: '',
        isActive: true,
        joinedAt: new Date().toISOString(),
      }
    ];
  });

  // Atualização em tempo real de membros de equipe caso alterados no TeamManager
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('vagou_salon_team_members') || localStorage.getItem('vagou_team_members');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTeamMembersList(parsed);
          }
        }
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const activeProMember = useMemo(() => {
    return teamMembersList.find(m => m.id === activeProId) || teamMembersList.find(m => m.role === 'admin') || teamMembersList[0];
  }, [teamMembersList, activeProId]);

  const isActiveProAdmin = activeProMember?.role === 'admin';

  const handleSelectActiveProId = (id: string) => {
    setActiveProId(id);
    try {
      localStorage.setItem('vagou_active_pro_id', id);
      const member = teamMembersList.find(m => m.id === id);
      if (member) {
        localStorage.setItem('vagou_dashboard_user_role', member.role);
        localStorage.setItem('vagou_dashboard_logged_pro_name', member.name);
      }
    } catch {}
  };

  // Alternador das 2 Personalidades: Cliente | Pro
  const handleSelectPersona = (persona: UserPersona) => {
    hapticLight();
    const effectivePersona = persona === 'cliente' ? 'cliente' : 'pro';
    setCurrentPersona(effectivePersona);
    try {
      localStorage.setItem('vagou_current_persona', effectivePersona);
    } catch {
      // ignore
    }

    if (effectivePersona === 'cliente') {
      setViewMode('pub');
      setIsSalonLoggedIn(false);
      setActiveTab('home');
      try {
        localStorage.setItem('vagou_salon_logged_in', 'false');
      } catch {}
    } else {
      // 'pro'
      setViewMode('ger');
      setIsSalonLoggedIn(true);
      setActiveTab('home');
      try {
        localStorage.setItem('vagou_salon_logged_in', 'true');
      } catch {}
    }
  };

  // Configurações do Salão editáveis pelo gestor
  const [adminSettings, setAdminSettings] = useState<SalonAdminSettings>(() => {
    let partnerInfo: any = null;
    try {
      const partnerDataStr = localStorage.getItem('vagou_partner_data');
      if (partnerDataStr) {
        partnerInfo = JSON.parse(partnerDataStr);
      }
    } catch {}

    const fullAddr = partnerInfo 
      ? `${partnerInfo.logradouro || ''}, ${partnerInfo.numero || ''}${partnerInfo.complemento ? ' - ' + partnerInfo.complemento : ''} - ${partnerInfo.bairro || ''}, ${partnerInfo.cidade || ''}/${partnerInfo.uf || ''}`.replace(/^, /, '').trim()
      : '';

    const effectiveSalonName = salonName || partnerInfo?.salonName || 'Meu Estabelecimento';
    const effectivePhone = partnerInfo?.phoneWhatsapp || '';
    const effectiveColor = partnerInfo?.primaryColor || localStorage.getItem('vagou_accent_color') || '#20C933';

    const defaults: SalonAdminSettings = {
      salonName: effectiveSalonName,
      salonPhone: effectivePhone,
      salonAddress: fullAddr,
      openingHours: 'Seg a Sáb: 09:00 às 20:00',
      isOpenNow: true,
      pinCode: '1234',
      accentColor: effectiveColor,
      salonLogoDark: localStorage.getItem('vagou_salon_logo_dark') || (partnerInfo ? '' : DEFAULT_ROTA99_LOGO_DARK),
      salonLogoLight: localStorage.getItem('vagou_salon_logo_light') || (partnerInfo ? '' : DEFAULT_ROTA99_LOGO_LIGHT),
      salonLogo: localStorage.getItem('vagou_salon_logo_dark') || (partnerInfo ? '' : DEFAULT_ROTA99_LOGO_DARK),
      salonIcon: localStorage.getItem('vagou_salon_icon') || (partnerInfo ? '' : DEFAULT_ROTA99_ICON),
      pwaName: effectiveSalonName,
    };
    try {
      const saved = localStorage.getItem('vagou_salon_admin_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaults,
          ...parsed,
          salonLogoDark: parsed.salonLogoDark || localStorage.getItem('vagou_salon_logo_dark') || defaults.salonLogoDark,
          salonLogoLight: parsed.salonLogoLight || localStorage.getItem('vagou_salon_logo_light') || defaults.salonLogoLight,
          salonLogo: parsed.salonLogo || parsed.salonLogoDark || localStorage.getItem('vagou_salon_logo_dark') || defaults.salonLogo,
          salonIcon: parsed.salonIcon || localStorage.getItem('vagou_salon_icon') || defaults.salonIcon,
          accentColor: parsed.accentColor || localStorage.getItem('vagou_accent_color') || defaults.accentColor,
          isOpenNow: parsed.isOpenNow !== undefined ? parsed.isOpenNow : true,
        };
      }
    } catch {
      // ignore
    }
    return defaults;
  });

  // Compartilhamento via Web Share API com fallback para Área de Transferência
  const handleShare = useCallback(async () => {
    hapticLight();
    const shareTitle = adminSettings.salonName || salonName;
    const shareText = `Confira os serviços e horários disponíveis em ${shareTitle} no Vagou!`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        hapticSuccess();
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          try {
            await navigator.clipboard.writeText(shareUrl);
            setIsCopied(true);
            hapticSuccess();
            setTimeout(() => setIsCopied(false), 2000);
          } catch {}
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setIsCopied(true);
        hapticSuccess();
        setTimeout(() => setIsCopied(false), 2000);
      } catch {}
    }
  }, [adminSettings.salonName, salonName]);

  // Lista dinâmica de serviços
  const [catalogServicesList, setCatalogServicesList] = useState<CatalogServiceItem[]>(() => {
    try {
      const saved = localStorage.getItem('vagou_custom_catalog_services');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_CATALOG_SERVICES;
  });

  // Lista dinâmica de profissionais da equipe
  const [professionalsList, setProfessionalsList] = useState<SalonProfessionalItem[]>(() => {
    try {
      const savedTeam = localStorage.getItem('vagou_team_members');
      if (savedTeam) {
        const parsedTeam = JSON.parse(savedTeam);
        if (Array.isArray(parsedTeam) && parsedTeam.length > 0) {
          return parsedTeam.map(member => ({
            id: member.id,
            name: member.name,
            role: member.role === 'admin' ? 'Dono / Gerente' : member.role === 'receptionist' ? 'Recepcionista' : 'Profissional',
            avatar: member.avatarUrl,
            avatarUrl: member.avatarUrl,
            rating: 5.0
          }));
        }
      }

      const saved = localStorage.getItem('vagou_custom_professionals');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_PROFESSIONALS;
  });

  // Lista dinâmica de agendamentos da agenda do profissional
  const [appointmentsList, setAppointmentsList] = useState<BookingAppointment[]>(() => {
    try {
      const saved = localStorage.getItem('vagou_user_appointments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_APPOINTMENTS;
  });

  // Carregar dados reais do Supabase (Serviços e Equipe)
  useEffect(() => {
    let isMounted = true;
    async function loadDataFromSupabase() {
      if (!isSupabaseConfigured || !supabase) return;
      try {
        // 1. Obter o salão atual no Supabase
        const activeSlug = localStorage.getItem('vagou_salon_slug') || adminSettings.salonSlug || salonName.toLowerCase().replace(/\s+/g, '-');
        const { data: salonRecord } = await (supabase
          .from('salons') as any)
          .select('id, trade_name')
          .or(`slug.eq.${activeSlug},trade_name.ilike.%${salonName}%`)
          .maybeSingle();

        if (!salonRecord || !salonRecord.id) return;

        // 2. Buscar serviços reais do banco
        const servicesFromDb = await fetchSalonServices(salonRecord.id);
        if (isMounted && servicesFromDb && servicesFromDb.length > 0) {
          const mappedServices: CatalogServiceItem[] = servicesFromDb.map((s: any) => ({
            id: s.id,
            title: s.name,
            description: s.description || '',
            price: Number(s.price),
            duration: `${s.duration_minutes} min`,
            category: s.category || 'Geral',
            image: s.image_url || '',
          }));
          setCatalogServicesList(mappedServices);
          localStorage.setItem('vagou_custom_catalog_services', JSON.stringify(mappedServices));
        }

        // 3. Buscar profissionais reais do banco
        const prosFromDb = await fetchSalonProfessionals(salonRecord.id);
        if (isMounted && prosFromDb && prosFromDb.length > 0) {
          const mappedPros: SalonProfessionalItem[] = prosFromDb.map((p: any) => ({
            id: p.id,
            name: p.name,
            role: p.role === 'admin' ? 'Dono / Gerente' : 'Profissional',
            avatar: p.avatar_url || '',
            avatarUrl: p.avatar_url || '',
            rating: 5.0,
          }));
          setProfessionalsList(mappedPros);
          localStorage.setItem('vagou_custom_professionals', JSON.stringify(mappedPros));
        }
      } catch (err) {
        console.warn('Consulta Supabase em segundo plano:', err);
      }
    }
    loadDataFromSupabase();
    return () => { isMounted = false; };
  }, [salonName, adminSettings.salonSlug]);

  // Handlers para persistência e atualização em tempo real
  const handleUpdateServices = (newServices: CatalogServiceItem[]) => {
    setCatalogServicesList(newServices);
    try {
      localStorage.setItem('vagou_custom_catalog_services', JSON.stringify(newServices));
    } catch {
      // ignore
    }
  };

  const handleUpdateProfessionals = (newPros: SalonProfessionalItem[]) => {
    setProfessionalsList(newPros);
    try {
      localStorage.setItem('vagou_custom_professionals', JSON.stringify(newPros));
    } catch {
      // ignore
    }
  };

  const handleUpdateSettings = (newSettings: Partial<SalonAdminSettings>) => {
    if (newSettings.accentColor) {
      setAccentColorContext(newSettings.accentColor);
      try {
        localStorage.setItem('vagou_accent_color', newSettings.accentColor);
      } catch {}
    }
    setAdminSettings((prev) => {
      const merged = { ...prev, ...newSettings };
      try {
        localStorage.setItem('vagou_salon_admin_settings', JSON.stringify(merged));
        if (merged.accentColor) {
          localStorage.setItem('vagou_accent_color', merged.accentColor);
        }
        const effectiveName = merged.pwaName || merged.salonName || salonName;
        updateDynamicPwaAssets(
          effectiveName, 
          merged.salonIcon || merged.salonLogoDark || merged.salonLogo,
          merged.accentColor
        );
      } catch {
        // ignore
      }
      return merged;
    });
  };

  useEffect(() => {
    const effectiveName = adminSettings.pwaName || adminSettings.salonName || salonName;
    updateDynamicPwaAssets(
      effectiveName, 
      adminSettings.salonIcon || adminSettings.salonLogoDark || adminSettings.salonLogo,
      adminSettings.accentColor
    );
  }, [adminSettings.pwaName, adminSettings.salonName, adminSettings.salonIcon, adminSettings.salonLogoDark, adminSettings.salonLogo, adminSettings.accentColor, salonName]);

  const handleUpdateAppointments = (newApts: BookingAppointment[]) => {
    setAppointmentsList(newApts);
    try {
      localStorage.setItem('vagou_user_appointments', JSON.stringify(newApts));
    } catch {
      // ignore
    }
  };

  const handleSalonLogin = (pin: string): boolean => {
    let validPin = adminSettings.pinCode || '1234';
    if (pin.trim() === validPin.trim()) {
      setIsSalonLoggedIn(true);
      setViewMode('ger');
      setCurrentPersona('admin');
      try {
        localStorage.setItem('vagou_salon_logged_in', 'true');
        localStorage.setItem('vagou_current_persona', 'admin');
      } catch {
        // ignore
      }
      return true;
    }
    return false;
  };

  const handleSalonLogout = () => {
    setIsSalonLoggedIn(false);
    setViewMode('pub');
    setCurrentPersona('cliente');
    try {
      localStorage.removeItem('vagou_salon_logged_in');
      localStorage.setItem('vagou_current_persona', 'cliente');
    } catch {
      // ignore
    }
    if (onBackToAuth) {
      onBackToAuth();
    }
  };

  // Solicitação de acesso a Gerenciar Estabelecimento com verificação obrigatória de senha
  const handleRequestManage = useCallback(() => {
    if (!isActiveProAdmin) {
      return;
    }
    setIsManagePinModalOpen(true);
  }, [isActiveProAdmin]);

  const handleConfirmManagePin = (pin: string): boolean => {
    const validPin = (adminSettings.pinCode || '1234').trim();
    if (pin.trim() === validPin) {
      setActiveTab('personalizar');
      setIsManagePinModalOpen(false);
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (userName) {
      setCurrentUserName(userName);
    }
  }, [userName]);

  const [activeTab, setActiveTab] = useState<'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades'>('home');
  const [bookingService, setBookingService] = useState<CatalogServiceItem | null>(null);
  const [skipDateStep, setSkipDateStep] = useState<boolean>(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [selectedPublicProfessional, setSelectedPublicProfessional] = useState<string>('any');

  // Refs para controle do scroll snap da landing page (4 seções)
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const homeSectionRef = useRef<HTMLElement>(null);
  const servicosSectionRef = useRef<HTMLElement>(null);
  const vagasSectionRef = useRef<HTMLElement>(null);
  const espacoSectionRef = useRef<HTMLElement>(null);
  const isProgrammaticScroll = useRef<boolean>(false);

  // Sub-abas e efeito swipe para a Seção Espaço (0: Equipe, 1: Estrutura, 2: Localização)
  const [espacoSlideIndex, setEspacoSlideIndex] = useState<number>(0);
  const [espacoSwipeDirection, setEspacoSwipeDirection] = useState<number>(1);

  // Paginação e efeito swap para o catálogo enquadrado de serviços (4 por visualização)
  const [servicePage, setServicePage] = useState<number>(0);
  const [swapDirection, setSwapDirection] = useState<number>(1);

  // Estado para agendamento confirmado exibido dentro da seção do salão
  const [confirmedBookingData, setConfirmedBookingData] = useState<{
    protocolCode: string;
    serviceTitle: string;
    professionalName: string;
    salonName: string;
    dateTime: string;
    totalPrice: number;
    address: string;
  } | null>(null);

  // Sincronização da tabela de horários com o modal
  const [selectedTimeSlotForBooking, setSelectedTimeSlotForBooking] = useState<string | null>(null);

  const todayIso = useMemo(() => {
    const d = new Date();
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [selectedCalendarDateIso, setSelectedCalendarDateIso] = useState<string>(todayIso);

  // Filtrar ofertas desse salão
  const salonOffers = useMemo(() => offers.filter((o) => o.salonName === salonName), [offers, salonName]);
  const primaryOffer = salonOffers[0] || offers[0];

  // Informações consolidadas do salão conectadas ao estado dinâmico
  const hasCustomLogo = Boolean(adminSettings.salonLogoDark || adminSettings.salonLogoLight || adminSettings.salonLogo);
  const activeLogo = hasCustomLogo
    ? (isDark
        ? (adminSettings.salonLogoDark || adminSettings.salonLogo || '')
        : (adminSettings.salonLogoLight || adminSettings.salonLogo || ''))
    : '';

  const salonInfo = useMemo(() => ({
    name: adminSettings.salonName || salonName,
    avatar: adminSettings.salonIcon || activeLogo || DEFAULT_ROTA99_ICON,
    coverImage: primaryOffer?.galleryImages?.[0] || primaryOffer?.imageUrl || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80',
    rating: primaryOffer?.rating || 4.9,
    reviewsCount: primaryOffer?.reviewsCount || 84,
    distance: primaryOffer?.distance || '850m',
    address: (adminSettings.operatingModel === 'home_delivery' && adminSettings.homeDeliverySettings?.areaDescription)
      ? `Atendimento em Domicílio • ${adminSettings.homeDeliverySettings.areaDescription}`
      : (adminSettings.salonAddress || primaryOffer?.salonAddress || ''),
    city: adminSettings.cidade && adminSettings.uf ? `${adminSettings.cidade}, ${adminSettings.uf}` : '',
    phone: adminSettings.salonPhone || '',
    hours: adminSettings.openingHours || 'Seg a Sáb: 09:00 às 20:00',
    verified: true,
    isHomeCare: adminSettings.operatingModel === 'home_delivery' || !!adminSettings.homeDeliverySettings?.enabled,
    description: primaryOffer?.description || 'Espaço premium especializado em estética masculina e feminina de alta precisão, barboterapia, cortes modernos e bem-estar.',
    amenities: [
      { icon: Wifi, label: 'Wi-Fi de Alta Velocidade' },
      { icon: Wind, label: 'Ambiente Climatizado' },
      { icon: Coffee, label: 'Café Expresso & Bebidas' },
      { icon: Car, label: 'Estacionamento Próprio' },
    ],
    professionals: professionalsList,
  }), [salonName, primaryOffer, adminSettings, professionalsList, activeLogo]);

  const hasMultipleProfessionals = salonInfo.professionals.length > 1;
  const spaceTabLabel = salonInfo.isHomeCare ? 'Atendimento' : 'Espaço';
  const SpaceIcon = salonInfo.isHomeCare ? Car : Store;

  // Ícone dinâmico da aba Serviços baseado na categoria e especialidade do estabelecimento
  const ServicesIcon = useMemo(() => {
    const mainCategory = (primaryOffer?.serviceCategory || '').toLowerCase();
    const nameLower = salonName.toLowerCase();
    const serviceTitles = (salonOffers.length > 0 ? salonOffers : offers)
      .map((o) => `${o.serviceTitle} ${o.serviceCategory || ''}`.toLowerCase())
      .join(' ');

    // 1. Unhas / Manicure / Pedicure / Nails / Esmaltação
    if (
      mainCategory === 'unhas' ||
      nameLower.includes('unha') ||
      nameLower.includes('nail') ||
      nameLower.includes('manicure') ||
      nameLower.includes('pedicure') ||
      nameLower.includes('esmalte') ||
      serviceTitles.includes('unha') ||
      serviceTitles.includes('manicure') ||
      serviceTitles.includes('pedicure') ||
      serviceTitles.includes('esmaltação')
    ) {
      return Hand;
    }

    // 2. Estética Facial / Rosto / Skincare / Limpeza de Pele / Visagismo
    if (
      (mainCategory === 'estetica' || mainCategory === 'beleza') &&
      (nameLower.includes('facial') ||
        nameLower.includes('rosto') ||
        nameLower.includes('pele') ||
        nameLower.includes('estética') ||
        nameLower.includes('estetica') ||
        nameLower.includes('skincare') ||
        nameLower.includes('face') ||
        serviceTitles.includes('facial') ||
        serviceTitles.includes('limpeza de pele') ||
        serviceTitles.includes('peeling') ||
        serviceTitles.includes('visagismo facial'))
    ) {
      return Smile;
    }

    // 3. Sobrancelhas / Olhar / Cílios / Lash
    if (
      nameLower.includes('sobrancelha') ||
      nameLower.includes('lash') ||
      nameLower.includes('cílios') ||
      nameLower.includes('cilios') ||
      nameLower.includes('brow') ||
      serviceTitles.includes('sobrancelha') ||
      serviceTitles.includes('extensão de cílios') ||
      serviceTitles.includes('micropigmentação')
    ) {
      return Eye;
    }

    // 4. Barbearia / Corte de Cabelo / Barba / Hair / Salão Tradicional
    if (
      mainCategory === 'cabelo' ||
      mainCategory === 'barba' ||
      nameLower.includes('barber') ||
      nameLower.includes('barba') ||
      nameLower.includes('corte') ||
      nameLower.includes('cabelo') ||
      nameLower.includes('hair') ||
      nameLower.includes('salão') ||
      nameLower.includes('salao') ||
      serviceTitles.includes('corte') ||
      serviceTitles.includes('degradê') ||
      serviceTitles.includes('barba') ||
      serviceTitles.includes('mechas') ||
      serviceTitles.includes('escova')
    ) {
      return Scissors;
    }

    // 5. Estética / Beleza geral
    if (mainCategory === 'estetica' || mainCategory === 'beleza') {
      return Smile;
    }

    // Fallback universal
    return Sparkles;
  }, [primaryOffer, salonName, salonOffers, offers]);

  // Navegação direta: no modo público rola para a seção; no modo gerenciamento alterna a aba diretamente
  const handleSelectTab = useCallback((tab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades') => {
    if (tab === 'caixa') {
      if (currentPersona === 'cliente') {
        setCurrentPersona('admin');
        setIsSalonLoggedIn(true);
        setViewMode('ger');
      }
      setActiveTab('caixa');
      return;
    }

    if (tab === 'utilidades') {
      if (currentPersona === 'cliente') {
        setCurrentPersona('admin');
        setIsSalonLoggedIn(true);
        setViewMode('ger');
      }
      setActiveTab('utilidades');
      return;
    }

    if (tab === 'personalizar') {
      if (isGerMode && !isActiveProAdmin) {
        setActiveTab('home');
        return;
      }
      handleRequestManage();
      return;
    }

    if (tab === 'financeiro') {
      if (currentPersona === 'cliente') {
        setCurrentPersona('admin');
        setIsSalonLoggedIn(true);
        setViewMode('ger');
      }
      setActiveTab('financeiro');
      return;
    }

    if (tab === 'equipe') {
      if (isGerMode) {
        if (!isActiveProAdmin) {
          setActiveTab('home');
          return;
        }
        handleRequestManage();
        return;
      }
      setActiveTab('equipe');
      setEspacoSlideIndex(0);
      isProgrammaticScroll.current = true;
      if (espacoSectionRef.current && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: espacoSectionRef.current.offsetTop,
          behavior: 'smooth',
        });
      }
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 600);
      return;
    }

    if (tab === 'espaco') {
      if (isGerMode) {
        if (!isActiveProAdmin) {
          setActiveTab('home');
          return;
        }
        handleRequestManage();
        return;
      }
      setActiveTab('espaco');
      setEspacoSlideIndex(1);
      isProgrammaticScroll.current = true;
      if (espacoSectionRef.current && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: espacoSectionRef.current.offsetTop,
          behavior: 'smooth',
        });
      }
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 600);
      return;
    }

    if (tab === 'servicos') {
      if (isGerMode) {
        handleRequestManage();
        return;
      }
      setActiveTab('servicos');
      isProgrammaticScroll.current = true;
      if (servicosSectionRef.current && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: servicosSectionRef.current.offsetTop,
          behavior: 'smooth',
        });
      }
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 600);
      return;
    }

    setActiveTab(tab);
    if (isGerMode) {
      // No modo gerenciamento, a navegação é exclusivamente por botões (troca direta de estado)
      return;
    }
    isProgrammaticScroll.current = true;
    const targetMap: Record<'home' | 'servicos' | 'vagas', HTMLElement | null> = {
      home: homeSectionRef.current,
      servicos: servicosSectionRef.current,
      vagas: vagasSectionRef.current,
    };
    const target = targetMap[tab as 'home' | 'servicos' | 'vagas'];
    if (target && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: target.offsetTop,
        behavior: 'smooth',
      });
    }
    setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 600);
  }, [isGerMode, currentPersona]);

  // Observer para sincronizar a aba ativa do rodapé ao deslizar o dedo pelas seções da landing page (somente no modo público)
  useEffect(() => {
    if (isGerMode) return; // No modo gerenciamento, o efeito landing page e o scroll snap estão desativados
    const container = scrollContainerRef.current;
    if (!container) return;

    const sections = [
      { id: 'home' as const, el: homeSectionRef.current },
      { id: 'servicos' as const, el: servicosSectionRef.current },
      { id: 'vagas' as const, el: vagasSectionRef.current },
      { id: 'espaco' as const, el: espacoSectionRef.current },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        if (isProgrammaticScroll.current) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const tabId = entry.target.getAttribute('data-tab-id');
            if (tabId === 'espaco') {
              setActiveTab(espacoSlideIndex === 0 ? 'equipe' : 'espaco');
            } else if (tabId === 'home' || tabId === 'servicos' || tabId === 'vagas') {
              setActiveTab(tabId);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.5,
      }
    );

    sections.forEach(({ el }) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isGerMode, espacoSlideIndex]);

  // Catálogo completo de serviços conectado ao estado dinâmico gerenciável
  const filteredCatalogServices = useMemo(() => {
    let base = catalogServicesList;
    if (selectedPublicProfessional !== 'any') {
      const activeProf = professionalsList.find(p => p.name === selectedPublicProfessional);
      if (activeProf && activeProf.id) {
        // Filter by professionalId if it exists in the service
        // Since many legacy services might not have professionalId, we only filter those that do have it.
        // Wait, if we want strict multi-tenant:
        base = base.filter(srv => !srv.professionalId || srv.professionalId === activeProf.id);
      }
    }
    return base.length > 0 ? base : catalogServicesList;
  }, [catalogServicesList, selectedPublicProfessional, professionalsList]);

  const catalogServices: CatalogServiceItem[] = filteredCatalogServices;

  const handleOpenBooking = (srv?: CatalogServiceItem, directToTimeGrid = false, timeSlot?: string, dateIso?: string) => {
    setBookingService(srv || catalogServices[0]);
    setSkipDateStep(directToTimeGrid);
    setSelectedTimeSlotForBooking(timeSlot || null);
    if (dateIso) {
      setSelectedCalendarDateIso(dateIso);
    }
    handleSelectTab('vagas');
  };

  // Slides de portfólio para o Slider da Página Inicial (Apresentação publicitária elegante e limpa)
  const portfolioSlides = useMemo(() => [
    {
      id: 'slide-servicos',
      title: 'Nossos Serviços',
      tagline: 'Cortes modernos, barboterapia, visagismo e procedimentos com valores transparentes.',
      image: primaryOffer?.imageUrl || 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'slide-agendamento',
      title: 'Agende de Forma Rápida',
      tagline: 'Escolha seu procedimento e confirme seu atendimento em poucos toques, de forma rápida e segura.',
      image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'slide-horarios',
      title: 'Consulte os Horários',
      tagline: 'Consulte os horários de forma eficiente: vagas abertas para hoje ou agende para até 60 dias.',
      image: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'slide-espaco',
      title: 'Nosso Espaço & Equipe',
      tagline: 'Conheça nossa infraestrutura moderna, ambiente climatizado e equipe de especialistas.',
      image: salonInfo.coverImage,
    },
  ], [primaryOffer?.imageUrl, salonInfo.coverImage]);

  // Autoplay suave para o slider da página inicial
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % portfolioSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [portfolioSlides.length]);

  const handleConfirmSchedule = (bookingData: {
    service: CatalogServiceItem;
    professional: string;
    professionalAvatar?: string;
    dateIso: string;
    dateFormatted: string;
    timeSlot: string;
    salonName: string;
    salonAddress: string;
    price: number;
  }) => {
    hapticSuccess();
    const rawCode = `VGA-${Math.floor(10000 + Math.random() * 90000)}`;
    if (primaryOffer) {
      onDirectBook({
        ...primaryOffer,
        id: `sched-${Date.now()}`,
        salonName: bookingData.salonName,
        serviceTitle: bookingData.service.title,
        price: bookingData.price,
        timeSlot: `${bookingData.dateFormatted} às ${bookingData.timeSlot}`,
        dayLabel: bookingData.dateFormatted,
        serviceCategory: (bookingData.service.category.toLowerCase().includes('barba') ? 'barba' : 'cabelo') as any,
      });
      setConfirmedBookingData({
        protocolCode: `#${rawCode}`,
        serviceTitle: bookingData.service.title,
        professionalName: bookingData.professional,
        salonName: bookingData.salonName,
        dateTime: `${bookingData.dateFormatted} às ${bookingData.timeSlot}`,
        totalPrice: bookingData.price,
        address: bookingData.salonAddress,
      });

      // Salvar nos agendamentos do usuário para visualização em Minha Agenda
      try {
        const savedList = JSON.parse(localStorage.getItem('vagou_user_appointments') || '[]');
        const newRecord = {
          protocolCode: rawCode,
          service: bookingData.service.title,
          professional: bookingData.professional,
          salonName: bookingData.salonName,
          dateTime: `${bookingData.dateFormatted} às ${bookingData.timeSlot}`,
          dayGroup: bookingData.dateFormatted,
          time: bookingData.timeSlot,
          totalPrice: bookingData.price,
          status: 'CONFIRMADO',
          address: bookingData.salonAddress,
        };
        localStorage.setItem('vagou_user_appointments', JSON.stringify([newRecord, ...savedList]));
      } catch {
        // ignore
      }
    }
  };

  // Paginação e controle de swap para a seção de serviços (4 por visualização em grid enquadrado 2x2)
  const SERVICES_PER_PAGE = 4;
  const totalServicePages = Math.ceil(catalogServices.length / SERVICES_PER_PAGE);

  const handlePrevServicePage = () => {
    if (totalServicePages <= 1) return;
    setSwapDirection(-1);
    setServicePage((prev) => (prev - 1 + totalServicePages) % totalServicePages);
  };

  const handleNextServicePage = () => {
    if (totalServicePages <= 1) return;
    setSwapDirection(1);
    setServicePage((prev) => (prev + 1) % totalServicePages);
  };

  useEffect(() => {
    setServicePage(0);
  }, [selectedPublicProfessional]);

  const currentServices = useMemo(() => {
    const start = servicePage * SERVICES_PER_PAGE;
    return catalogServices.slice(start, start + SERVICES_PER_PAGE);
  }, [catalogServices, servicePage]);

  // Controles de swipe/swap para os três blocos da Seção Espaço (0: Equipe, 1: Estrutura, 2: Endereço & Mapa)
  const handleNextEspacoSlide = () => {
    setEspacoSwipeDirection(1);
    setEspacoSlideIndex((prev) => (prev + 1) % 3);
  };

  const handlePrevEspacoSlide = () => {
    setEspacoSwipeDirection(-1);
    setEspacoSlideIndex((prev) => (prev - 1 + 3) % 3);
  };

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} font-['Poppins'] transition-colors duration-200`}>
      {/* 1. CABEÇALHO DO APLICATIVO DO SALÃO (Logo Full Height & Botões Selecionados) */}
      <header 
        id="salon-profile-header"
        className={`sticky top-0 z-40 ${isDark ? 'bg-[#151A1E]/95 border-slate-800/80' : 'bg-white/95 border-slate-200/90 shadow-xs'} backdrop-blur-md border-b px-2 sm:px-4 shadow-md flex items-center justify-between gap-1.5 sm:gap-3 transition-colors h-14 sm:h-16 overflow-hidden shrink-0 w-full max-w-full`}
      >
        {/* Lado Esquerdo: Logotipia / Logo do Salão no Cabeçalho (Retangular ou Tipografia) */}
        <div 
          onClick={() => handleSelectTab('home')}
          className="h-full min-w-0 max-w-[125px] xs:max-w-[145px] sm:max-w-[190px] pl-1 pr-0.5 flex items-center shrink select-none cursor-pointer overflow-hidden"
          title={salonInfo.name}
        >
          {activeLogo ? (
            <img 
              src={activeLogo} 
              alt={salonInfo.name}
              className="max-h-7.5 sm:max-h-9.5 w-auto max-w-full object-contain object-left shrink-0"
            />
          ) : (
            <span className={`font-sans text-[11px] sm:text-[13px] font-extrabold tracking-tight uppercase leading-tight truncate ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {salonInfo.name}
            </span>
          )}
        </div>

        {/* Lado Direito: Modo Profissional (Seletor Ger. / Púb. quando logado) + Compartilhar + Favoritar + Foto do Usuário */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
          {/* Seletor Cliente | Pro (Exibido exclusivamente para Dono ou Profissional) */}
          {isUserProRole && (
            <div 
              id="header-persona-selector"
              className={`flex items-center p-0.5 rounded border shrink-0 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-300 shadow-xs'
              }`}
            >
              <button
                type="button"
                id="persona-btn-cliente"
                onClick={() => handleSelectPersona('cliente')}
                style={currentPersona === 'cliente' ? { backgroundColor: accentColor } : undefined}
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[9.5px] sm:text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  currentPersona === 'cliente'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-950'
                }`}
                title="Visualizar como Cliente"
              >
                Cliente
              </button>
              <button
                type="button"
                id="persona-btn-pro"
                onClick={() => handleSelectPersona('pro')}
                style={currentPersona !== 'cliente' ? { backgroundColor: accentColor } : undefined}
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[9.5px] sm:text-[11px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer flex items-center justify-center ${
                  currentPersona !== 'cliente'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-600 hover:text-slate-950'
                }`}
                title="Visualizar como Profissional (Estabelecimento)"
              >
                Pro
              </button>
            </div>
          )}

          {/* Botão Compartilhar Perfil (Web Share API) */}
          <button
            type="button"
            onClick={handleShare}
            className={`w-8 h-8 sm:w-9.5 sm:h-9.5 rounded flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${
              isDark
                ? 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800'
                : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-xs'
            }`}
            title={isCopied ? "Link copiado!" : "Compartilhar perfil"}
            aria-label="Compartilhar perfil"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            ) : (
              <Share2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`} />
            )}
          </button>

          {/* Favoritar Rápido (Somente visível no modo cliente/público) */}
          {currentPersona === 'cliente' && (
            <button
              type="button"
              onClick={() => onToggleFavorite?.(salonInfo.name)}
              className={`w-8 h-8 sm:w-9.5 sm:h-9.5 rounded flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800'
                  : 'bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-xs'
              }`}
              title="Favoritar este estabelecimento"
              aria-label="Favoritar estabelecimento"
            >
              <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>
          )}

          {/* Foto do Usuário / Abrir Perfil */}
          <button
            onClick={() => {
              hapticLight();
              setIsProfileDrawerOpen(true);
            }}
            className="relative flex items-center justify-center shrink-0 w-8 h-8 sm:w-9.5 sm:h-9.5 rounded overflow-hidden ring-1.5 ring-emerald-500 hover:ring-emerald-400 active:scale-95 transition shadow-xs bg-slate-800 cursor-pointer"
            title={`Perfil de ${currentUserName}`}
            aria-label="Perfil do Usuário"
          >
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt={currentUserName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                {currentUserName ? currentUserName.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
          </button>
        </div>
      </header>

      {/* 2. ÁREA DE CONTEÚDO */}
      {isGerMode ? (
        /* MODO GERENCIAMENTO: TELAS DEDICADAS COM NAVEGAÇÃO EXCLUSIVAMENTE POR BOTÕES (SEM EFEITO LANDING PAGE) */
        <main className="flex-1 min-h-0 w-full relative overflow-hidden flex flex-col">
          {activeTab === 'home' && (
            <div className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-between animate-in fade-in duration-150">
              <ProfessionalDashboardView
                adminSettings={adminSettings}
                onUpdateSettings={handleUpdateSettings}
                services={catalogServicesList}
                appointments={appointmentsList}
                onUpdateAppointments={handleUpdateAppointments}
                professionals={professionalsList}
                onNavigateTab={handleSelectTab}
                onOpenNewService={() => handleSelectTab('personalizar')}
                onOpenNewAppointment={() => handleSelectTab('vagas')}
                onLogout={handleSalonLogout}
                salonName={salonInfo.name}
                currentUserName={currentUserName}
                currentPersona={currentPersona}
                isProAdmin={isActiveProAdmin}
                activeProId={activeProId}
                onSelectActiveProId={handleSelectActiveProId}
                onRequestManage={handleRequestManage}
              />
            </div>
          )}

          {activeTab === 'vagas' && (
            <div className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-start animate-in fade-in duration-150">
              <ProfessionalAgendaView
                appointments={appointmentsList}
                onUpdateAppointments={handleUpdateAppointments}
                services={catalogServicesList}
                professionals={professionalsList}
              />
            </div>
          )}

          {(activeTab === 'personalizar' || activeTab === 'servicos' || activeTab === 'espaco' || activeTab === 'equipe') && (
            <div className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-start animate-in fade-in duration-150">
              <SalonCustomizationHub
                initialSubTab={activeTab === 'servicos' ? 'servicos' : activeTab === 'equipe' ? 'equipe' : 'hub'}
                adminSettings={adminSettings}
                onUpdateSettings={handleUpdateSettings}
                services={catalogServicesList}
                onUpdateServices={handleUpdateServices}
                professionals={professionalsList}
                onUpdateProfessionals={handleUpdateProfessionals}
                appointments={appointmentsList}
                onUpdateAppointments={handleUpdateAppointments}
                onBack={() => handleSelectTab('home')}
              />
            </div>
          )}

          {activeTab === 'caixa' && (
            <div className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-start animate-in fade-in duration-150">
              <CaixaManagerView
                appointments={appointmentsList}
                onUpdateAppointments={handleUpdateAppointments}
                salonName={salonInfo.name}
                currentPersona={currentPersona}
                activeProId={activeProId}
                matchesSelectedPro={(app) => {
                  if (activeProId === 'all') return true;
                  const activeMember = professionalsList.find(p => p.id === activeProId);
                  const selectedName = activeMember ? activeMember.name : activeProId;
                  const appProName = app.professionalName || app.professional || '';
                  return !selectedName || selectedName === 'Todos' || appProName.toLowerCase().includes(selectedName.toLowerCase());
                }}
                onNavigateTab={handleSelectTab}
                onBack={() => handleSelectTab('home')}
              />
            </div>
          )}

          {activeTab === 'financeiro' && (
            <div className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-start animate-in fade-in duration-150">
              <UtilitiesAndToolsView
                appointments={appointmentsList}
                services={catalogServicesList}
                activeProId={activeProId}
                isOwner={isActiveProAdmin}
                salonName={salonInfo.name}
                currentPersona={currentPersona}
                initialSubTab="financeiro"
                onUpdateAppointments={handleUpdateAppointments}
                onBack={() => handleSelectTab('home')}
              />
            </div>
          )}

          {activeTab === 'utilidades' && (
            <div className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-start animate-in fade-in duration-150">
              <UtilitiesAndToolsView
                appointments={appointmentsList}
                services={catalogServicesList}
                activeProId={activeProId}
                isOwner={isActiveProAdmin}
                salonName={salonInfo.name}
                currentPersona={currentPersona}
                initialSubTab="hub"
                onUpdateAppointments={handleUpdateAppointments}
                onBack={() => handleSelectTab('home')}
              />
            </div>
          )}
        </main>
      ) : (
        /* MODO PÚBLICO / CLIENTE: LANDING PAGE INTEGRADA COM SCROLL SNAP NATIVO */
        <div 
          ref={scrollContainerRef}
          className="flex-1 min-h-0 w-full relative overflow-y-auto scroll-smooth no-scrollbar overscroll-y-contain touch-pan-y"
        >
          {/* SEÇÃO 1: INÍCIO */}
          <section
            id="section-home"
            ref={homeSectionRef}
            data-tab-id="home"
            className="w-full h-full min-h-full shrink-0 snap-start snap-always snap-section overflow-hidden flex flex-col justify-between"
          >
            {/* SUBCABEÇALHO DE BOAS-VINDAS DENTRO DA SEÇÃO INÍCIO */}
            <div className={`px-3.5 border-b flex items-center justify-between gap-3 transition-colors h-11 shrink-0 ${
              isDark ? 'bg-slate-900/80 border-slate-800/80' : 'bg-slate-100/90 border-slate-200'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0 py-1">
                {onBack && (
                  <button
                    onClick={onBack}
                    className={`w-7 h-7 rounded flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${
                      isDark
                        ? 'bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white'
                        : 'bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 hover:text-slate-950 shadow-xs'
                    }`}
                    title="Voltar"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-emerald-500" />
                  </button>
                )}

                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />

                <div className="min-w-0">
                  <h2 className={`text-xs sm:text-sm font-bold truncate leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Seja bem-vindo, <span className="text-emerald-500">{currentUserName ? currentUserName.trim().split(' ')[0] : ''}</span>
                  </h2>
                </div>
              </div>
            </div>

            {/* SLIDER / CARROSSEL PUBLICITÁRIO TOTALMENTE RESPONSIVO */}
            <div className={`relative w-full h-full flex-1 min-h-0 overflow-hidden select-none touch-pan-y ${
              isDark ? 'bg-slate-900 border-b border-slate-800' : 'bg-slate-200 border-b border-slate-300'
            }`}>
              <AnimatePresence mode="wait">
                {portfolioSlides.map((slide, idx) => {
                  if (idx !== activeSlideIndex) return null;
                  return (
                    <motion.div
                      key={slide.id}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.2}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -40 || info.velocity.x < -300) {
                          setActiveSlideIndex((prev) => (prev + 1) % portfolioSlides.length);
                        } else if (info.offset.x > 40 || info.velocity.x > 300) {
                          setActiveSlideIndex((prev) => (prev - 1 + portfolioSlides.length) % portfolioSlides.length);
                        }
                      }}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
                    >
                      {/* Imagem de Fundo Fullscreen */}
                      <img
                        src={slide.image}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />

                      {/* Degradês Publicitários de Alta Qualidade para Leitura Impecável */}
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/35" />
                      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/90" />

                      {/* Conteúdo Publicitário Integrado */}
                      <div className="absolute inset-0 p-4 sm:p-6 flex flex-col justify-between z-10 max-w-[90%] sm:max-w-[78%]">
                        {/* Topo do Slide: Título Principal e Tagline */}
                        <div className="pt-2 sm:pt-4 space-y-1.5">
                          <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-md font-['Poppins']">
                            {slide.title}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-200/95 font-normal leading-relaxed line-clamp-3 drop-shadow-xs max-w-md">
                            {slide.tagline}
                          </p>
                        </div>

                        {/* Base do Slide: Indicador de pontos minimalista */}
                        <div className="flex items-center gap-1.5 pb-2 sm:pb-3">
                          {portfolioSlides.map((_, dotIdx) => (
                            <div
                              key={dotIdx}
                              className={`transition-all rounded-full ${
                                dotIdx === activeSlideIndex
                                  ? 'w-5 h-1.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                                  : 'w-1.5 h-1.5 bg-white/40'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>

        {/* SEÇÃO 2: SERVIÇOS */}
        <section
          id="section-servicos"
          ref={servicosSectionRef}
          data-tab-id="servicos"
          className="w-full h-full min-h-full shrink-0 snap-start snap-always snap-section overflow-hidden flex flex-col justify-between"
        >
          <SectionHeader title="Serviços & Procedimentos" isDark={isDark} />

          {/* PASSO 1: Seleção de Profissional (Visível Apenas se Múltiplos Profissionais) */}
          {hasMultipleProfessionals && (
            <div className={`w-full shrink-0 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'} p-3 flex flex-col gap-2`}>
              <h3 className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                1. Com quem deseja agendar?
              </h3>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory">
                {/* Qualquer Profissional Livre */}
                <button
                  type="button"
                  onClick={() => setSelectedPublicProfessional('any')}
                  className={`shrink-0 flex flex-col items-center gap-1.5 snap-center transition cursor-pointer ${selectedPublicProfessional === 'any' ? 'opacity-100 scale-100' : 'opacity-60 scale-95 hover:opacity-100'}`}
                >
                  <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors ${selectedPublicProfessional === 'any' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : isDark ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-300 bg-slate-200 text-slate-500'}`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider max-w-[65px] text-center truncate leading-tight ${selectedPublicProfessional === 'any' ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>
                    Qualquer Livre
                  </span>
                </button>

                {/* Lista de Profissionais */}
                {professionalsList.map(prof => (
                  <button
                    key={prof.id || prof.name}
                    type="button"
                    onClick={() => setSelectedPublicProfessional(prof.name)}
                    className={`shrink-0 flex flex-col items-center gap-1.5 snap-center transition cursor-pointer ${selectedPublicProfessional === prof.name ? 'opacity-100 scale-100' : 'opacity-60 scale-95 hover:opacity-100'}`}
                  >
                    <div className={`w-12 h-12 rounded-full border-2 overflow-hidden transition-colors relative ${selectedPublicProfessional === prof.name ? 'border-emerald-500' : isDark ? 'border-slate-700' : 'border-slate-300'}`}>
                      {prof.avatar || prof.avatarUrl ? (
                        <img src={prof.avatar || prof.avatarUrl} alt={prof.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                          <User className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider max-w-[65px] text-center truncate leading-tight ${selectedPublicProfessional === prof.name ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>
                      {prof.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

              {/* Grid de Serviços Fullwidth sem Espaçamentos (Laterais, Topo e Rodapé zerados) */}
              <div className="relative overflow-hidden select-none w-full flex-1 min-h-0 flex flex-col justify-between">
                <AnimatePresence mode="wait" custom={swapDirection}>
                  <motion.div
                    key={servicePage}
                    custom={swapDirection}
                    initial={{ opacity: 0, x: swapDirection > 0 ? 40 : -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: swapDirection > 0 ? -40 : 40 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    drag={totalServicePages > 1 ? 'x' : false}
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -35 || info.velocity.x < -200) {
                        handleNextServicePage();
                      } else if (info.offset.x > 35 || info.velocity.x > 200) {
                        handlePrevServicePage();
                      }
                    }}
                    className={`grid grid-cols-2 grid-rows-2 gap-0 w-full flex-1 min-h-0 cursor-grab active:cursor-grabbing touch-pan-y ${
                      isDark ? 'bg-slate-950' : 'bg-slate-100'
                    }`}
                  >
                    {currentServices.map((srv) => (
                      <div
                        key={srv.id}
                        onClick={() => handleOpenBooking(srv)}
                        className="group relative overflow-hidden transition-all duration-300 cursor-pointer bg-slate-950 h-full w-full"
                        title={`${srv.title} - R$ ${srv.price}`}
                      >
                        {/* Imagem, Slideshow de até 5 fotos ou Vídeo de 5s com Zoom no Hover */}
                        <div className="relative w-full h-full overflow-hidden bg-slate-950">
                          <ServiceCardMedia service={srv} />

                          {/* Gradiente Cinematográfico Escuro para Máximo Contraste */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-black/25 group-hover:via-slate-950/65 transition-colors duration-300 pointer-events-none" />

                          {/* Topo do Card: Badge de Categoria com Frosted Glass & Ponto Esmeralda */}
                          <div className="absolute top-2 left-2 right-2 z-10 pointer-events-none flex items-center justify-between gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-wider shadow-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                              {srv.category}
                            </span>
                          </div>

                          {/* Base do Card: Título + Preço */}
                          <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 z-10 flex flex-col justify-end pointer-events-none">
                            <h3 className="text-xs sm:text-[13px] font-bold text-white tracking-tight leading-tight line-clamp-1 font-['Poppins'] drop-shadow-sm group-hover:text-emerald-300 transition-colors">
                              {srv.title}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-emerald-400 font-black text-xs sm:text-sm tracking-tight drop-shadow-xs">
                                R$ {srv.price}
                              </span>
                              {srv.duration && (
                                <span className="text-[10px] text-slate-300/80 font-medium">
                                  • {srv.duration}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* Barra de Paginação e Navegação de Alta Precisão */}
                {totalServicePages > 1 && (
                  <div
                    className={`w-full px-4 py-2 flex items-center justify-between border-t transition-colors select-none shrink-0 ${
                      isDark
                        ? 'bg-slate-950 border-slate-800/80 text-white'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    {/* Indicador de Página e Total */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-['Poppins'] ${
                          isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-200'
                            : 'bg-slate-100 border-slate-200 text-slate-800'
                        }`}
                      >
                        <span className="text-emerald-400 font-extrabold">{servicePage + 1}</span>
                        <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>/</span>
                        <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>{totalServicePages}</span>
                      </div>
                      <span
                        className={`text-[11px] font-semibold tracking-wide uppercase ${
                          isDark ? 'text-slate-300' : 'text-slate-700'
                        }`}
                      >
                        Procedimentos
                      </span>
                    </div>

                    {/* Controles de Navegação com Setas e Indicadores em Pílula */}
                    <div className="flex items-center gap-2">
                      {/* Botão Anterior */}
                      <button
                        type="button"
                        onClick={handlePrevServicePage}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isDark
                            ? 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 active:scale-95'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 active:scale-95'
                        }`}
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* Pílulas de Navegação com Brilho Esmeralda */}
                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalServicePages }).map((_, dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            onClick={() => {
                              setSwapDirection(dotIdx > servicePage ? 1 : -1);
                              setServicePage(dotIdx);
                            }}
                            className={`transition-all rounded-full cursor-pointer ${
                              dotIdx === servicePage
                                ? 'w-5 h-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                                : isDark
                                ? 'w-2 h-2 bg-slate-800 hover:bg-slate-700'
                                : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                            }`}
                            aria-label={`Ir para página ${dotIdx + 1}`}
                          />
                        ))}
                      </div>

                      {/* Botão Próximo */}
                      <button
                        type="button"
                        onClick={handleNextServicePage}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isDark
                            ? 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 active:scale-95'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 active:scale-95'
                        }`}
                        aria-label="Próxima página"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
        </section>

        {/* SEÇÃO 3: AGENDAR */}
        <section
          id="section-vagas"
          ref={vagasSectionRef}
          data-tab-id="vagas"
          className="w-full h-full min-h-full shrink-0 snap-start snap-always snap-section overflow-hidden flex flex-col justify-start"
        >
          <SectionHeader
            title="Agendar"
            isDark={isDark}
          />

              <div className="flex-1 min-h-0 flex flex-col justify-start overflow-hidden w-full">
                <SalonBookingModal
                  isOpen={true}
                  inline={true}
                  salonName={salonInfo.name}
                  salonAddress={salonInfo.address}
                  services={catalogServices}
                  professionals={professionalsList}
                  initialService={bookingService}
                  skipDateStep={skipDateStep}
                  initialTimeSlot={selectedTimeSlotForBooking}
                  initialDateIso={selectedCalendarDateIso}
                  preSelectedProfessionalName={selectedPublicProfessional}
                  onConfirmAppointment={handleConfirmSchedule}
                />
              </div>
        </section>

        {/* SEÇÃO 4: ESPAÇO, LOCALIZAÇÃO & EQUIPE */}
        <section
          id="section-espaco"
          ref={espacoSectionRef}
          data-tab-id="espaco"
          className="w-full h-full min-h-full shrink-0 snap-start snap-always snap-section overflow-hidden flex flex-col justify-start"
        >
          <SectionHeader
            title={
              espacoSlideIndex === 0
                ? (hasMultipleProfessionals ? 'Equipe & Especialistas' : 'Perfil do Profissional')
                : espacoSlideIndex === 1
                ? (salonInfo.isHomeCare ? 'Modalidade de Atendimento' : 'Estrutura do Espaço')
                : 'Endereço & Localização'
            }
            isDark={isDark}
          />

              <div className="px-3.5 sm:px-4 py-2.5 space-y-2.5 flex-1 min-h-0 flex flex-col justify-start overflow-y-auto">
                {/* Abas de Navegação Interna da Seção Espaço */}
                <div className="grid grid-cols-3 gap-1.5 w-full">
                  {/* Aba 1: Equipe */}
                  <button
                    type="button"
                    onClick={() => {
                      setEspacoSwipeDirection(0 < espacoSlideIndex ? -1 : 1);
                      setEspacoSlideIndex(0);
                    }}
                    className={`py-2 px-1 rounded text-center transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
                      espacoSlideIndex === 0
                        ? isDark
                          ? 'bg-slate-800 text-white font-bold border border-emerald-500/50 shadow-xs'
                          : 'bg-white text-slate-900 font-bold border border-emerald-500/50 shadow-xs'
                        : isDark
                          ? 'bg-slate-900/80 text-slate-400 hover:text-white font-medium border border-slate-800'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900 font-medium border border-slate-200'
                    }`}
                  >
                    <Users className={`w-3.5 h-3.5 shrink-0 ${
                      espacoSlideIndex === 0 ? 'text-emerald-400' : 'text-slate-400'
                    }`} />
                    <span className="text-[11px] sm:text-xs tracking-tight truncate">
                      Equipe
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold leading-none ${
                      espacoSlideIndex === 0
                        ? 'bg-emerald-500 text-white'
                        : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {salonInfo.professionals.length}
                    </span>
                  </button>

                  {/* Aba 2: Estrutura */}
                  <button
                    type="button"
                    onClick={() => {
                      setEspacoSwipeDirection(1 < espacoSlideIndex ? -1 : 1);
                      setEspacoSlideIndex(1);
                    }}
                    className={`py-2 px-1 rounded text-center transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
                      espacoSlideIndex === 1
                        ? isDark
                          ? 'bg-slate-800 text-white font-bold border border-emerald-500/50 shadow-xs'
                          : 'bg-white text-slate-900 font-bold border border-emerald-500/50 shadow-xs'
                        : isDark
                          ? 'bg-slate-900/80 text-slate-400 hover:text-white font-medium border border-slate-800'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900 font-medium border border-slate-200'
                    }`}
                  >
                    <Store className={`w-3.5 h-3.5 shrink-0 ${
                      espacoSlideIndex === 1 ? 'text-emerald-400' : 'text-slate-400'
                    }`} />
                    <span className="text-[11px] sm:text-xs tracking-tight truncate">
                      Estrutura
                    </span>
                  </button>

                  {/* Aba 3: Localização */}
                  <button
                    type="button"
                    onClick={() => {
                      setEspacoSwipeDirection(2 < espacoSlideIndex ? -1 : 1);
                      setEspacoSlideIndex(2);
                    }}
                    className={`py-2 px-1 rounded text-center transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
                      espacoSlideIndex === 2
                        ? isDark
                          ? 'bg-slate-800 text-white font-bold border border-emerald-500/50 shadow-xs'
                          : 'bg-white text-slate-900 font-bold border border-emerald-500/50 shadow-xs'
                        : isDark
                          ? 'bg-slate-900/80 text-slate-400 hover:text-white font-medium border border-slate-800'
                          : 'bg-slate-100 text-slate-600 hover:text-slate-900 font-medium border border-slate-200'
                    }`}
                  >
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${
                      espacoSlideIndex === 2 ? 'text-emerald-400' : 'text-slate-400'
                    }`} />
                    <span className="text-[11px] sm:text-xs tracking-tight truncate">
                      Localização
                    </span>
                  </button>
                </div>

                {/* Container com Suporte a Gesto Swipe (Arrasto Horizontal para Esquerda e Direita) */}
                <div className="relative overflow-hidden select-none flex-1 min-h-0 flex flex-col justify-between">
                  <AnimatePresence mode="wait" custom={espacoSwipeDirection}>
                    {/* SLIDE 0: EQUIPE & ESPECIALISTAS */}
                    {espacoSlideIndex === 0 && (
                      <motion.div
                        key="slide-equipe"
                        custom={espacoSwipeDirection}
                        initial={{ opacity: 0, x: espacoSwipeDirection > 0 ? 40 : -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: espacoSwipeDirection > 0 ? -40 : 40 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -35 || info.velocity.x < -200) {
                            handleNextEspacoSlide();
                          } else if (info.offset.x > 35 || info.velocity.x > 200) {
                            handlePrevEspacoSlide();
                          }
                        }}
                        className="cursor-grab active:cursor-grabbing touch-pan-y flex-1 min-h-0 flex flex-col"
                      >
                        {/* ABA 1: EQUIPE / NOSSO TIME (LAYOUT PLANO, SEM BOX DENTRO DE BOX) */}
                        <div className={`border rounded p-4 flex-1 min-h-[340px] flex flex-col justify-between transition-colors ${
                          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                        }`}>
                          <div className="flex-1 min-h-0 flex flex-col">
                            {/* Título direto e discreto */}
                            <div className={`flex items-center justify-between pb-3 border-b shrink-0 mb-3 ${
                              isDark ? 'border-slate-800/80' : 'border-slate-200'
                            }`}>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-emerald-400" />
                                <h4 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {hasMultipleProfessionals ? 'Nosso Time' : 'Profissional'}
                                </h4>
                              </div>
                              <span className="text-[11px] font-medium text-slate-400">
                                {salonInfo.professionals.length} {salonInfo.professionals.length === 1 ? 'especialista' : 'especialistas'}
                              </span>
                            </div>

                            {/* Grade Aberta e Plana da Equipe */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-4 py-3 overflow-y-auto pr-1 flex-1 min-h-0 no-scrollbar items-start">
                              {salonInfo.professionals.map((prof, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex flex-col items-center text-center"
                                >
                                  {prof.avatar ? (
                                    <img
                                      src={prof.avatar}
                                      alt={prof.name}
                                      className={`w-20 h-20 sm:w-24 sm:h-24 aspect-square rounded object-cover shadow-xs mb-2 border ${
                                        isDark ? 'border-slate-800' : 'border-slate-200'
                                      }`}
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className={`w-20 h-20 sm:w-24 sm:h-24 aspect-square rounded bg-slate-800 flex items-center justify-center shadow-xs mb-2 border ${
                                      isDark ? 'border-slate-800' : 'border-slate-200'
                                    }`}>
                                      <User className="w-8 h-8 text-slate-500" />
                                    </div>
                                  )}
                                  <h5 className={`text-xs font-bold leading-tight truncate w-full px-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {prof.name}
                                  </h5>
                                  <p className={`text-[11px] leading-snug mt-0.5 truncate w-full px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {prof.role}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* SLIDE 1: ESTRUTURA DO ESPAÇO */}
                    {espacoSlideIndex === 1 && (
                      <motion.div
                        key="slide-espaco-estrutura"
                        custom={espacoSwipeDirection}
                        initial={{ opacity: 0, x: espacoSwipeDirection > 0 ? 40 : -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: espacoSwipeDirection > 0 ? -40 : 40 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -35 || info.velocity.x < -200) {
                            handleNextEspacoSlide();
                          } else if (info.offset.x > 35 || info.velocity.x > 200) {
                            handlePrevEspacoSlide();
                          }
                        }}
                        className="cursor-grab active:cursor-grabbing touch-pan-y flex-1 min-h-0 flex flex-col"
                      >
                        {/* ABA 2: CARD DE ESTRUTURA DO ESPAÇO & COMODIDADES */}
                        <div className={`border rounded p-3.5 space-y-3 shadow-xs flex-1 min-h-[340px] flex flex-col justify-between ${
                          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                        }`}>
                          <div className="space-y-2.5">
                            <h3 className={`text-xs font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              <Store className="w-4 h-4 text-emerald-500" />
                              <span>{salonInfo.isHomeCare ? 'Modalidade de Atendimento' : 'Estrutura do Espaço'}</span>
                            </h3>
                            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              {salonInfo.description}
                            </p>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              {salonInfo.amenities.map((amenity, idx) => (
                                <div key={idx} className={`flex items-center gap-2 p-2.5 rounded border text-xs ${
                                  isDark
                                    ? 'bg-slate-950 border-slate-800 text-slate-300'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }}`}>
                                  <amenity.icon className="w-4 h-4 text-emerald-500 shrink-0" />
                                  <span className="truncate font-medium">{amenity.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={`pt-2.5 border-t text-[11px] flex items-center justify-between ${
                            isDark ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
                          }`}>
                            <span>Ambiente climatizado e confortável</span>
                            <span className="text-emerald-400 font-bold">100% Verificado</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* SLIDE 2: ENDEREÇO & MAPA EMBED */}
                    {espacoSlideIndex === 2 && (
                      <motion.div
                        key="slide-espaco-mapa"
                        custom={espacoSwipeDirection}
                        initial={{ opacity: 0, x: espacoSwipeDirection > 0 ? 40 : -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: espacoSwipeDirection > 0 ? -40 : 40 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -35 || info.velocity.x < -200) {
                            handleNextEspacoSlide();
                          } else if (info.offset.x > 35 || info.velocity.x > 200) {
                            handlePrevEspacoSlide();
                          }
                        }}
                        className="cursor-grab active:cursor-grabbing touch-pan-y flex-1 min-h-0 flex flex-col"
                      >
                        {/* ABA 3: CARD DE ENDEREÇO, COMO CHEGAR & MAPA EMBED */}
                        <div className={`border rounded p-3.5 space-y-3 shadow-xs flex-1 min-h-[340px] flex flex-col justify-between ${
                          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
                        }`}>
                          {/* Endereço e Horário */}
                          <div className="space-y-2">
                            <div className="flex items-start gap-2.5 text-xs">
                              <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <span className={`font-semibold block truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {salonInfo.address}
                                </span>
                                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                  {salonInfo.city}
                                </span>
                              </div>
                            </div>
                            <div className={`flex items-center gap-2 text-xs ${
                              isDark ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>{salonInfo.hours}</span>
                            </div>
                          </div>

                          {/* Abaixo: Mapa Embed */}
                          <div className="space-y-1.5 pt-0.5 flex-1 min-h-0 flex flex-col">
                            <div className={`relative w-full flex-1 min-h-[160px] sm:min-h-[190px] rounded overflow-hidden border shadow-xs ${
                              isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-100'
                            }`}>
                              <iframe
                                title={`Localização no Google Maps - ${salonInfo.name}`}
                                src={`https://maps.google.com/maps?q=${encodeURIComponent(salonInfo.name + ', ' + salonInfo.address + ', ' + salonInfo.city)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                className="w-full h-full border-0"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                allowFullScreen
                              />
                              {/* Botão flutuante compacto para abrir direto no aplicativo do Maps */}
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salonInfo.name + ' ' + salonInfo.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute bottom-2 right-2 px-2.5 py-1.5 bg-slate-950/90 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded text-[10px] font-bold shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 uppercase tracking-wider"
                              >
                                <MapPin className="w-3 h-3 text-emerald-400" />
                                <span>Rota no Maps</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Dica de Swipe e Indicador de Pontos */}
                  <div className="mt-2 flex items-center justify-between px-1">
                    <span className="text-[10px] text-slate-400">
                      Deslize para alternar entre as abas
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((dotIdx) => (
                        <button
                          key={dotIdx}
                          onClick={() => {
                            setEspacoSwipeDirection(dotIdx > espacoSlideIndex ? 1 : -1);
                            setEspacoSlideIndex(dotIdx);
                          }}
                          className={`transition-all rounded-full cursor-pointer ${
                            dotIdx === espacoSlideIndex
                              ? 'w-5 h-1.5 bg-emerald-500'
                              : 'w-1.5 h-1.5 bg-slate-700 hover:bg-slate-500'
                          }`}
                          aria-label={`Aba ${dotIdx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
          </section>
        </div>
      )}

      {/* Barra de Navegação Inferior Nativa do Estabelecimento (4 Abas: Início/Painel, Serviços/Gestão, Agendar/Agenda, Espaço/Gerenciar) */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        spaceTabLabel={spaceTabLabel}
        SpaceIcon={SpaceIcon}
        ServicesIcon={ServicesIcon}
        isProfessionalMode={isGerMode}
        currentPersona={currentPersona}
        isProAdmin={isActiveProAdmin}
      />

      {/* 2. MODAL DE AGENDAMENTO CONFIRMADO (DENTRO DA SEÇÃO DO ESTABELECIMENTO) */}
      {confirmedBookingData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className={`w-full max-w-md border rounded p-5 sm:p-6 shadow-2xl flex flex-col items-center text-center space-y-4 transition-colors ${
              isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            {/* Ícone de Sucesso */}
            <div className="w-16 h-16 rounded bg-[#20C933] text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 animate-in zoom-in-75 duration-300">
              <Check className="w-9 h-9 stroke-[3] text-white" />
            </div>

            <div className="space-y-1">
              <h2 className={`text-xl font-bold font-['Poppins'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Agendamento confirmado!
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Sua vaga está garantida. Apresente o código abaixo ao chegar no estabelecimento.
              </p>
            </div>

            {/* Card com Detalhes do Voucher */}
            <div className={`w-full rounded p-4 border text-left space-y-3 ${
              isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                <span className="text-xs font-bold text-slate-400">Código Protocolo</span>
                <span className="text-xs font-mono font-bold text-[#20C933] bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-500/30">
                  {confirmedBookingData.protocolCode}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Serviço:</span>
                  <span className={`font-bold truncate max-w-[200px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {confirmedBookingData.serviceTitle}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Profissional:</span>
                  <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {confirmedBookingData.professionalName}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Estabelecimento:</span>
                  <span className="font-bold text-emerald-500 truncate max-w-[200px]">
                    {confirmedBookingData.salonName}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Data / Hora:</span>
                  <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {confirmedBookingData.dateTime}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400 font-bold">Total pago no local:</span>
                  <span className="text-sm font-black text-emerald-400">
                    R$ {confirmedBookingData.totalPrice.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações do Agendamento Concluído */}
            <div className="w-full space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmedBookingData(null)}
                className="w-full py-3.5 bg-[#20C933] hover:bg-[#1bb32d] active:scale-[0.99] text-white font-bold text-xs rounded transition shadow-md shadow-emerald-900/30 uppercase tracking-wider font-['Poppins'] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>OK, ENTENDIDO</span>
                <Check className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Chat no App com o Estabelecimento */}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setConfirmedBookingData(null);
                setIsProfileDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#20C933] hover:underline font-bold pt-1 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Enviar mensagem no Chat do App</span>
            </button>
          </div>
        </div>
      )}

      {/* Drawer do Perfil do Usuário com Menus, Dados Privados, Agenda e Configurações */}
      <ProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        userName={currentUserName}
        userAvatarUrl={userAvatarUrl}
        onUpdateUserName={(newName) => setCurrentUserName(newName)}
        onNavigateToSchedule={() => handleSelectTab('vagas')}
        onNavigateTab={handleSelectTab}
        salonName={salonInfo.name}
        salonPhone="5511987654321"
        isSalonLoggedIn={isSalonLoggedIn}
        currentPersona={currentPersona}
        isProAdmin={isActiveProAdmin}
        onRequestManage={handleRequestManage}
        onOpenAdminPanel={() => {
          handleSelectPersona('pro');
          handleSelectTab('home');
        }}
        onLoginSalon={handleSalonLogin}
        onLogoutSalon={handleSalonLogout}
        allAppointments={appointmentsList}
        onUpdateAppointments={setAppointmentsList}
        onNavigateToUserAppointments={onNavigateToUserAppointments}
        onNavigateToUserDashboard={onNavigateToUserDashboard}
      />

      {/* Modal de Autenticação / Login Inicial do Profissional */}
      <ProfessionalLoginModal
        isOpen={isLoginPinModalOpen}
        onClose={() => setIsLoginPinModalOpen(false)}
        onLogin={handleSalonLogin}
        onSuccess={() => {
          setIsSalonLoggedIn(true);
          setViewMode('ger');
          try {
            localStorage.setItem('vagou_salon_logged_in', 'true');
          } catch {
            // ignore
          }
        }}
        savedPin={adminSettings.pinCode || '1234'}
        salonName={salonInfo.name}
      />

      {/* Modal de Confirmação de Senha para Acesso a Gerenciar Estabelecimento */}
      <ProfessionalLoginModal
        isOpen={isManagePinModalOpen}
        onClose={() => setIsManagePinModalOpen(false)}
        title="Confirmar Senha de Acesso"
        description="Digite novamente a mesma senha de acesso usada no login para gerenciar o estabelecimento."
        onLogin={handleConfirmManagePin}
        onSuccess={() => {
          setActiveTab('personalizar');
          setIsManagePinModalOpen(false);
        }}
        savedPin={adminSettings.pinCode || '1234'}
        salonName={salonInfo.name}
      />
    </div>
  );
};
