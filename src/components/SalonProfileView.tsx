import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  ArrowLeft, Zap, 
  Calendar,
  ChevronLeft, ChevronRight, ArrowRight,
  Check, MessageCircle, MessageSquare,
  Scissors, Sparkles, LayoutDashboard, LayoutGrid,
  Store, Car, MapPin, Clock, Users, Wifi, Coffee, Wind,
  LogOut, EyeOff, User, Loader2, Bookmark, X,
  Bike, Bus, Smartphone, Navigation, ExternalLink,
  Phone, Mail, Globe, Instagram, Facebook
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ServiceOffer, BookingAppointment, SalonAdminSettings, UserPersona, ProfessionalTeamMember } from '../types';
import { SalonBookingModal, CatalogServiceItem, SalonProfessionalItem } from './SalonBookingModal';
import {
  getSavedBookingDraft,
  saveBookingDraft,
  BookingDraftItem,
  TransportMode,
  TRANSPORT_MODE_META,
  buildTransportDeepLinks,
  formatMaxDepartureTime,
} from '../utils/bookingSlots';
import { ProfessionalDashboardView } from './professional/ProfessionalDashboardView';
import { ProfessionalServicesManager } from './professional/ProfessionalServicesManager';
import { ProfessionalAgendaView } from './professional/ProfessionalAgendaView';
import { ProfessionalSpaceManager, DEFAULT_SPACE_AMENITIES, resolveSpaceAmenityIcon } from './professional/ProfessionalSpaceManager';
import { TeamManager } from './professional/TeamManager';
import { FinancialManagerView } from './professional/FinancialManagerView';
import { CaixaManagerView } from './professional/CaixaManagerView';
import { SalonCustomizationHub } from './professional/SalonCustomizationHub';
import { UtilitiesAndToolsView } from './professional/UtilitiesAndToolsView';
import { useSalonRole, SalonRole } from '../hooks/useSalonRole';
import { useOwnerAccess } from '../hooks/useOwnerAccess';
import { useTheme, sanitizeAccentColor } from '../context/ThemeContext';
import { getSalonLogo } from '../utils/salonLogos';
import { DEFAULT_ROTA99_LOGO_DARK, DEFAULT_ROTA99_LOGO_LIGHT, DEFAULT_ROTA99_ICON, DEFAULT_FACE_CLIPART_AVATAR } from '../utils/defaultSalonAssets';
import { updateDynamicPwaAssets } from '../utils/pwaAssets';
import { BottomNav } from './BottomNav';
import { MobileHeader, UserRole as HeaderUserRole } from './MobileHeader';
import { PauseSlotsModal } from './professional/PauseSlotsModal';
import { ProfileDrawer } from './ProfileDrawer';
import { SalonClientAuthModal } from './SalonClientAuthModal';
import { SalonSpaceInteractiveMap } from './SalonSpaceInteractiveMap';
import { hapticSuccess, hapticLight, hapticMedium } from '../utils/haptics';
import { getSectionHeaderStyleData } from '../utils/sectionHeaderStyle';
import { syncAllLocalUtilitiesToDatabase } from '../services/mnvSupabaseSync';
import { 
  supabase, 
  isSupabaseConfigured, 
  fetchSalonServices, 
  fetchSalonProfessionals,
  fetchSalonAppointments,
  upsertSalonService,
  fetchCompleteSalonData,
  updateSalonSettingsInDb,
  syncAllServicesToDb,
  syncAllProfessionalsToDb,
  fetchUserProfileFromDb,
  isValidAvatarUrlString,
  checkUserSalonMembership,
  ensureClientRow,
  mapDbAppointmentToBookingAppointment,
  mapBookingAppointmentToDbPayload,
  upsertAppointmentInDb,
  removeBlockedSlotInDb,
  subscribeToAppointments,
  ensureSalonRow
} from '../lib/supabase';

export interface SalonProfileViewProps {
  salonName: string;
  activeSubdomain?: string;
  initialSalonData?: any;
  userRole?: SalonRole;
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

import { getDefaultThematicCoverForCategory } from '../utils/serviceGalleryPresets';

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

  // Capa Temática Curada da Categoria (Alta Qualidade) quando o serviço não tiver foto própria
  const thematicCover = getDefaultThematicCoverForCategory(service.category, service.title);
  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 group/cover">
      <img
        src={thematicCover}
        alt={service.title}
        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/cover:scale-110 opacity-90"
        referrerPolicy="no-referrer"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-xs text-[8.5px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1 border border-emerald-500/30">
        <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
        <span>{service.category || 'Serviço'}</span>
      </div>
    </div>
  );
};

// Equipe inicial padrão (vazia por padrão)
const INITIAL_PROFESSIONALS: SalonProfessionalItem[] = [];

// Agendamentos iniciais padrão para a agenda do profissional (vazio por padrão)
const INITIAL_APPOINTMENTS: BookingAppointment[] = [];

export const SalonProfileView: React.FC<SalonProfileViewProps> = ({
  salonName,
  activeSubdomain = '',
  initialSalonData,
  userRole,
  offers,
  onBack,
  onDirectBook,
  isFavorite = false,
  onToggleFavorite,
  userName = 'Usuário',
  userAvatarUrl = '',
  onNavigateToUserAppointments,
  onNavigateToUserDashboard,
  onBackToAuth,
}) => {
  const { isDark, theme, setTheme, accentColor, setAccentColor: setAccentColorContext } = useTheme();
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState<boolean>(false);
  const [profileDrawerInitialTab, setProfileDrawerInitialTab] = useState<'menu' | 'agenda' | 'dados' | 'dependentes' | 'config' | 'trajeto' | 'chat'>('menu');
  const [isClientAuthModalOpen, setIsClientAuthModalOpenState] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('vagou_client_auth_modal_open') === 'true';
    } catch {
      return false;
    }
  });
  const setIsClientAuthModalOpen = useCallback((open: boolean) => {
    setIsClientAuthModalOpenState(open);
    try {
      if (open) {
        sessionStorage.setItem('vagou_client_auth_modal_open', 'true');
      } else {
        sessionStorage.removeItem('vagou_client_auth_modal_open');
        sessionStorage.removeItem('vagou_client_auth_modal_mode');
        sessionStorage.removeItem('vagou_register_wizard_draft');
      }
    } catch {}
  }, []);
  const [currentUserName, setCurrentUserName] = useState<string>(userName);
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vagou_user_avatar');
      if (isValidAvatarUrlString(saved)) return saved.trim();
    } catch {}
    return isValidAvatarUrlString(userAvatarUrl) ? userAvatarUrl!.trim() : '';
  });

  React.useEffect(() => {
    setCurrentUserName(userName && userName.trim() !== '' ? userName : 'Usuário');
  }, [userName]);

  React.useEffect(() => {
    if (isValidAvatarUrlString(userAvatarUrl)) {
      setCurrentUserAvatarUrl(userAvatarUrl.trim());
    } else {
      try {
        const saved = localStorage.getItem('vagou_user_avatar');
        if (isValidAvatarUrlString(saved)) {
          setCurrentUserAvatarUrl(saved.trim());
        } else {
          setCurrentUserAvatarUrl('');
        }
      } catch {
        setCurrentUserAvatarUrl('');
      }
    }
  }, [userAvatarUrl]);

  // Sincronizar Avatar do Usuário com o Supabase (Tríade Sync) sem jamais re-logar usuário desconectado
  React.useEffect(() => {
    let isMounted = true;

    const handleLocalProfileUpdated = (e: Event) => {
      const customEvt = e as CustomEvent<{ name?: string; avatarUrl?: string }>;
      if (customEvt?.detail) {
        if (customEvt.detail.name !== undefined) {
          setCurrentUserName(customEvt.detail.name || 'Usuário');
        }
        if (customEvt.detail.avatarUrl === '') {
          setCurrentUserAvatarUrl('');
          return;
        }
        if (isValidAvatarUrlString(customEvt.detail.avatarUrl)) {
          setCurrentUserAvatarUrl(customEvt.detail.avatarUrl.trim());
          return;
        }
      }
      try {
        const savedAvatar = localStorage.getItem('vagou_user_avatar');
        if (isValidAvatarUrlString(savedAvatar)) {
          setCurrentUserAvatarUrl(savedAvatar.trim());
        } else {
          setCurrentUserAvatarUrl('');
        }
        const savedName = localStorage.getItem('vagou_user_name');
        setCurrentUserName(savedName || 'Usuário');
      } catch {}
    };

    async function syncAvatar(e?: Event) {
      const customEvt = e as CustomEvent<{ loggedOut?: boolean }> | undefined;
      if (customEvt?.detail?.loggedOut) {
        if (isMounted) {
          setCurrentUserName('Usuário');
          setCurrentUserAvatarUrl('');
        }
        return;
      }

      // Verifica se há sessão ativa real no localStorage antes de sincronizar
      const savedEmail = localStorage.getItem('vagou_user_email') || localStorage.getItem('vagou_active_partner') || '';
      const savedName = localStorage.getItem('vagou_user_name') || '';
      const savedCpf = localStorage.getItem('vagou_user_cpf') || '';
      const hasActiveLocalAuth = Boolean(
        savedEmail ||
        savedCpf ||
        localStorage.getItem('vagou_client_session') ||
        localStorage.getItem('vagou_auth_user_id')
      );

      if (!hasActiveLocalAuth) {
        if (isMounted) {
          setCurrentUserName('Usuário');
          setCurrentUserAvatarUrl('');
        }
        return;
      }

      try {
        const savedLocal = localStorage.getItem('vagou_user_avatar');
        if (isMounted && isValidAvatarUrlString(savedLocal)) {
          setCurrentUserAvatarUrl(savedLocal.trim());
        }
      } catch {}

      if (!isSupabaseConfigured || !supabase) return;

      try {
        // 1. fetchUserProfileFromDb (Clients, Professionals, Auth, Profiles)
        const profile = await fetchUserProfileFromDb({ email: savedEmail, name: savedName, cpf: savedCpf });

        // Confirma que o usuário não deslogou enquanto a query estava em andamento
        const stillLogged = Boolean(
          localStorage.getItem('vagou_user_email') ||
          localStorage.getItem('vagou_client_session') ||
          localStorage.getItem('vagou_auth_user_id')
        );
        if (!isMounted || !stillLogged) return;

        if (profile) {
          if (profile.name && profile.name !== 'Profissional' && profile.name !== 'Usuário') {
            setCurrentUserName(profile.name);
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
            setCurrentUserAvatarUrl(resolvedAvatar);
            localStorage.setItem('vagou_user_avatar', resolvedAvatar);
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar avatar do Supabase:', err);
      }
    }

    syncAvatar();
    window.addEventListener('storage', handleLocalProfileUpdated);
    window.addEventListener('vagou:profile-updated', handleLocalProfileUpdated);
    window.addEventListener('vagou:auth-updated', syncAvatar);
    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleLocalProfileUpdated);
      window.removeEventListener('vagou:profile-updated', handleLocalProfileUpdated);
      window.removeEventListener('vagou:auth-updated', syncAvatar);
    };
  }, []);

  // 1. Papel Soberano recebido via prop do App + Hook useOwnerAccess (Validação cruzada por CPF, E-mail e user_id no Supabase)
  const ownerAccess = useOwnerAccess({
    salonId: initialSalonData?.id || (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_db_id') : ''),
    salonSlug: activeSubdomain || initialSalonData?.slug || (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') : ''),
    initialSalonData,
  });

  const [isPublicPreviewMode, setIsPublicPreviewMode] = useState<boolean>(true);

  const activeRole: SalonRole = useMemo(() => {
    if (ownerAccess.isOwner) return 'owner';
    if (ownerAccess.role !== 'guest' && ownerAccess.role !== 'loading') return ownerAccess.role;
    return userRole || 'guest';
  }, [ownerAccess.isOwner, ownerAccess.role, userRole]);

  const isRoleLoading = activeRole === 'loading' && ownerAccess.isLoading;
  const isOwnerOrManager = ownerAccess.isOwner || activeRole === 'owner' || activeRole === 'manager';
  const isProfessional = activeRole === 'professional';
  const isSalonLoggedIn = isOwnerOrManager || isProfessional;
  const currentPersona: UserPersona = (isSalonLoggedIn && !isPublicPreviewMode) ? 'pro' : 'cliente';
  const isGerMode = isSalonLoggedIn && !isPublicPreviewMode;
  const isUserProRole = isSalonLoggedIn;
  const isActiveProAdmin = isOwnerOrManager;

  // Verificação estrita de sessão ativa do usuário/cliente (sem considerar nomes soltos sem sessão)
  const checkHasActiveSession = useCallback((): boolean => {
    try {
      if ((activeRole !== 'guest' && activeRole !== 'loading') || isSalonLoggedIn) {
        return true;
      }
      if (localStorage.getItem('vagou_is_superadmin') === 'true') {
        return true;
      }
      const rawClientSession = localStorage.getItem('vagou_client_session');
      if (rawClientSession) {
        try {
          const parsed = JSON.parse(rawClientSession);
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
  }, [activeRole, isSalonLoggedIn]);

  // Identificação do estado de login do usuário (Exibe o ícone de avatar se logado; botão "Entrar" se não logado)
  const [isUserLoggedInState, setIsUserLoggedInState] = useState<boolean>(() => checkHasActiveSession());

  useEffect(() => {
    const checkLoginState = () => {
      setIsUserLoggedInState(checkHasActiveSession());
    };

    checkLoginState();
    window.addEventListener('storage', checkLoginState);
    window.addEventListener('vagou:auth-updated', checkLoginState);
    return () => {
      window.removeEventListener('storage', checkLoginState);
      window.removeEventListener('vagou:auth-updated', checkLoginState);
    };
  }, [checkHasActiveSession, userName, isSalonLoggedIn, currentPersona, activeRole]);

  // Modo de visualização quando logado: 'ger' (Gerenciamento) ou 'pub' (Público / Visão do Cliente)
  const viewMode = isGerMode ? 'ger' : 'pub';

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

  // Alternador de Navegação Interna
  const handleSelectPersona = (_persona?: UserPersona) => {
    setActiveTab('home');
  };

  const hasActiveSubdomain = Boolean(activeSubdomain);
  const [isLoadingSalon, setIsLoadingSalon] = useState<boolean>(() => {
    if (initialSalonData) return false;
    if (hasActiveSubdomain && isSupabaseConfigured) return true;
    return false;
  });

  // Configurações do Salão editáveis pelo gestor (Zero FOUC em subdomínios *.vagouapp.com)
  const [adminSettings, setAdminSettings] = useState<SalonAdminSettings>(() => {
    // Leitura prévia resiliente do cache local para mesclagem sem perda de dados
    let localSaved: Partial<SalonAdminSettings> = {};
    try {
      const savedStr = localStorage.getItem('vagou_salon_admin_settings');
      if (savedStr) localSaved = JSON.parse(savedStr);
    } catch {}

    if (initialSalonData) {
      const resolvedIcon =
        initialSalonData.favicon_url ||
        initialSalonData.branding?.salonIcon ||
        initialSalonData.branding?.faviconUrl ||
        initialSalonData.logo_url ||
        localSaved.salonIcon ||
        '';
      const resolvedLogoDark =
        initialSalonData.logo_dark_url ||
        initialSalonData.logo_url ||
        localSaved.salonLogoDark ||
        resolvedIcon;
      const resolvedLogoLight =
        initialSalonData.logo_light_url ||
        initialSalonData.logo_url ||
        localSaved.salonLogoLight ||
        resolvedIcon;
      const resolvedName = initialSalonData.trade_name || salonName || localSaved.salonName || '';
      const resolvedColor = initialSalonData.primary_color || initialSalonData.branding?.primaryColor || localSaved.accentColor || '#20C933';

      const rawInitialDoc = (initialSalonData.document_number || '').replace(/\D/g, '');
      const isInitialCnpj14 = rawInitialDoc.length === 14;
      const resolvedOwnerCpf =
        initialSalonData.owner_cpf ||
        initialSalonData.branding?.ownerCpf ||
        localSaved.ownerCpf ||
        (rawInitialDoc.length === 11 ? initialSalonData.document_number : '') ||
        '';
      const resolvedPixKeys = Array.isArray(initialSalonData.pix_keys)
        ? initialSalonData.pix_keys
        : (Array.isArray(initialSalonData.branding?.pixKeys) ? initialSalonData.branding.pixKeys : (localSaved.pixKeys || []));
      const resolvedPixKey =
        initialSalonData.pix_key ||
        initialSalonData.branding?.pixKey ||
        localSaved.pixKey ||
        resolvedPixKeys.find((k: any) => k?.isPrimary)?.key ||
        resolvedPixKeys[0]?.key ||
        '';

      return {
        salonName: resolvedName,
        salonSlug: initialSalonData.slug || activeSubdomain || localSaved.salonSlug || '',
        category: initialSalonData.category || initialSalonData.branding?.category || localSaved.category || 'barbearia',
        email: initialSalonData.email || initialSalonData.branding?.email || localSaved.email || '',
        phoneLandline: initialSalonData.phone_landline || initialSalonData.branding?.phoneLandline || localSaved.phoneLandline || '',
        razaoSocial: isInitialCnpj14 ? (initialSalonData.legal_name || '') : (localSaved.razaoSocial || ''),
        cnpj: isInitialCnpj14 ? (initialSalonData.document_number || '') : (localSaved.cnpj || ''),
        ownerCpf: resolvedOwnerCpf,
        legalManagerCpf: resolvedOwnerCpf,
        pixKey: resolvedPixKey,
        pixKeys: resolvedPixKeys,
        salonPhone: initialSalonData.phone_whatsapp || localSaved.salonPhone || '',
        salonAddress: initialSalonData.address || localSaved.salonAddress || '',
        numero: initialSalonData.street_number || localSaved.numero || '',
        complemento: initialSalonData.complement || localSaved.complemento || '',
        bairro: initialSalonData.neighborhood || localSaved.bairro || '',
        cidade: initialSalonData.city || localSaved.cidade || '',
        uf: initialSalonData.state || localSaved.uf || '',
        cep: initialSalonData.cep || localSaved.cep || '',
        openingHours: initialSalonData.opening_hours_text || initialSalonData.branding?.openingHours || localSaved.openingHours || 'Seg a Sáb: 09:00 às 20:00',
        operatingSchedule: initialSalonData.operating_hours || initialSalonData.branding?.operatingSchedule || initialSalonData.branding?.operatingHoursJson || localSaved.operatingSchedule,
        operatingHoursJson: initialSalonData.operating_hours || initialSalonData.branding?.operatingHours || localSaved.operatingHoursJson,
        spacePhotos: initialSalonData.space_photos || initialSalonData.branding?.spacePhotos || localSaved.spacePhotos,
        spaceDescription: initialSalonData.space_description || initialSalonData.branding?.spaceDescription || localSaved.spaceDescription,
        amenities: initialSalonData.amenities || initialSalonData.branding?.amenities || localSaved.amenities,
        isOpenNow: true,
        accentColor: resolvedColor,
        salonLogoDark: resolvedLogoDark,
        salonLogoLight: resolvedLogoLight,
        salonLogo: initialSalonData.logo_url || resolvedLogoDark,
        salonIcon: resolvedIcon,
        pwaName: initialSalonData.branding?.pwaName || localSaved.pwaName || resolvedName,
        slogan: initialSalonData.slogan || initialSalonData.branding?.slogan || localSaved.slogan || '',
        brandFont: initialSalonData.brand_font || initialSalonData.branding?.brandFont || localSaved.brandFont || 'Poppins',
        defaultTheme: initialSalonData.default_theme || initialSalonData.branding?.defaultTheme || localSaved.defaultTheme,
        showSlogan: initialSalonData.show_slogan !== undefined ? initialSalonData.show_slogan : (initialSalonData.branding?.showSlogan !== undefined ? initialSalonData.branding?.showSlogan : (localSaved.showSlogan !== false)),
        logoTextFallback: initialSalonData.logo_text_fallback || initialSalonData.branding?.logoTextFallback || localSaved.logoTextFallback || '',
        logoTextColor: initialSalonData.logo_text_color || initialSalonData.branding?.logoTextColor || localSaved.logoTextColor || resolvedColor,
        showHeroSlides: initialSalonData.show_hero_slides !== undefined ? initialSalonData.show_hero_slides : (initialSalonData.branding?.showHeroSlides !== undefined ? initialSalonData.branding?.showHeroSlides : (localSaved.showHeroSlides !== false)),
        
        // Barra de Títulos das Seções (Section Header)
        sectionHeaderBgColor: initialSalonData.section_header_bg_color || initialSalonData.branding?.sectionHeaderBgColor || localSaved.sectionHeaderBgColor || undefined,
        sectionHeaderTextColor: initialSalonData.section_header_text_color || initialSalonData.branding?.sectionHeaderTextColor || localSaved.sectionHeaderTextColor || undefined,
        sectionHeaderIconColor: initialSalonData.section_header_icon_color || initialSalonData.branding?.sectionHeaderIconColor || localSaved.sectionHeaderIconColor || resolvedColor,
        sectionHeaderBgStyle: initialSalonData.section_header_bg_style || initialSalonData.branding?.sectionHeaderBgStyle || localSaved.sectionHeaderBgStyle || 'glass',
        sectionHeaderBorder: initialSalonData.section_header_border || initialSalonData.branding?.sectionHeaderBorder || localSaved.sectionHeaderBorder || 'bordered',
        sectionHeaderBtnBgColor: initialSalonData.section_header_btn_bg_color || initialSalonData.branding?.sectionHeaderBtnBgColor || localSaved.sectionHeaderBtnBgColor || undefined,
        sectionHeaderBtnActiveBgColor: initialSalonData.section_header_btn_active_bg_color || initialSalonData.branding?.sectionHeaderBtnActiveBgColor || localSaved.sectionHeaderBtnActiveBgColor || undefined,
        sectionHeaderBtnBorder: initialSalonData.section_header_btn_border || initialSalonData.branding?.sectionHeaderBtnBorder || localSaved.sectionHeaderBtnBorder || undefined,
        sectionHeaderBtnShadow: initialSalonData.section_header_btn_shadow || initialSalonData.branding?.sectionHeaderBtnShadow || localSaved.sectionHeaderBtnShadow || undefined,
        sectionHeaderBtnBlur: initialSalonData.section_header_btn_blur || initialSalonData.branding?.sectionHeaderBtnBlur || localSaved.sectionHeaderBtnBlur || undefined,
        sectionHeaderBtnFont: initialSalonData.section_header_btn_font || initialSalonData.branding?.sectionHeaderBtnFont || localSaved.sectionHeaderBtnFont || undefined,

        // Barra de Navegação Inferior (BottomNav) — Padrão Default: cor sólida igual ao cabeçalho (#005CA9), salvo personalização
        navStyle: initialSalonData.nav_style || initialSalonData.branding?.navStyle || localSaved.navStyle || 'minimal',
        navShape: initialSalonData.nav_shape || initialSalonData.branding?.navShape || localSaved.navShape || 'square',
        navBorder: initialSalonData.nav_border || initialSalonData.branding?.navBorder || localSaved.navBorder || 'bordered',
        navIconBorder: initialSalonData.nav_icon_border || initialSalonData.branding?.navIconBorder || localSaved.navIconBorder || 'none',
        navBgStyle: initialSalonData.nav_bg_style || initialSalonData.branding?.navBgStyle || (localSaved.navBgColor ? localSaved.navBgStyle : undefined) || 'solid',
        navBgColor: (() => {
          const candidate = initialSalonData.nav_bg_color || initialSalonData.branding?.navBgColor || localSaved.navBgColor || '';
          return !candidate || candidate.trim().toLowerCase() === '#f1f5f9' ? '#005CA9' : candidate;
        })(),
        navBtnBgColor: initialSalonData.nav_btn_bg_color || initialSalonData.branding?.navBtnBgColor || localSaved.navBtnBgColor || undefined,
        navBtnActiveBgColor: initialSalonData.nav_btn_active_bg_color || initialSalonData.branding?.navBtnActiveBgColor || localSaved.navBtnActiveBgColor || undefined,
        navActiveColor: initialSalonData.nav_active_color || initialSalonData.branding?.navActiveColor || localSaved.navActiveColor || resolvedColor,
        navTextColor: initialSalonData.nav_text_color || initialSalonData.branding?.navTextColor || localSaved.navTextColor || undefined,
        navBtnShadow: initialSalonData.nav_btn_shadow || initialSalonData.branding?.navBtnShadow || localSaved.navBtnShadow || undefined,
        navBtnBlur: initialSalonData.nav_btn_blur || initialSalonData.branding?.navBtnBlur || localSaved.navBtnBlur || undefined,
        navBtnFont: initialSalonData.nav_btn_font || initialSalonData.branding?.navBtnFont || localSaved.navBtnFont || undefined,

        welcomeStyle: initialSalonData.welcome_style || initialSalonData.branding?.welcomeStyle || localSaved.welcomeStyle || 'atmospheric',
        bio: initialSalonData.bio || initialSalonData.branding?.bio || localSaved.bio || '',
        websiteUrl: initialSalonData.website_url || initialSalonData.branding?.websiteUrl || localSaved.websiteUrl || '',
        instagramUrl: initialSalonData.instagram_url || initialSalonData.branding?.instagramUrl || localSaved.instagramUrl || '',
        facebookUrl: initialSalonData.facebook_url || initialSalonData.branding?.facebookUrl || localSaved.facebookUrl || '',
        mapsUrl: initialSalonData.maps_url || initialSalonData.branding?.mapsUrl || localSaved.mapsUrl || '',
      };
    }

    let partnerInfo: any = null;
    if (!hasActiveSubdomain) {
      try {
        const partnerDataStr = localStorage.getItem('vagou_partner_data');
        if (partnerDataStr) {
          partnerInfo = JSON.parse(partnerDataStr);
        }
      } catch {}
    }

    const fullAddr = partnerInfo 
      ? `${partnerInfo.logradouro || ''}, ${partnerInfo.numero || ''}${partnerInfo.complemento ? ' - ' + partnerInfo.complemento : ''} - ${partnerInfo.bairro || ''}, ${partnerInfo.cidade || ''}/${partnerInfo.uf || ''}`.replace(/^, /, '').trim()
      : '';

    const effectiveSalonName = hasActiveSubdomain
      ? (salonName || '')
      : (salonName || partnerInfo?.salonName || 'Meu Estabelecimento');
    const effectivePhone = partnerInfo?.phoneWhatsapp || '';
    const effectiveColor = partnerInfo?.primaryColor || localStorage.getItem('vagou_accent_color') || '#20C933';

    const defaults: SalonAdminSettings = {
      salonName: effectiveSalonName,
      salonSlug: activeSubdomain || undefined,
      salonPhone: effectivePhone,
      salonAddress: fullAddr,
      openingHours: 'Seg a Sáb: 09:00 às 20:00',
      isOpenNow: true,
      accentColor: effectiveColor,
      salonLogoDark: hasActiveSubdomain ? '' : (localStorage.getItem('vagou_salon_logo_dark') || (partnerInfo ? '' : DEFAULT_ROTA99_LOGO_DARK)),
      salonLogoLight: hasActiveSubdomain ? '' : (localStorage.getItem('vagou_salon_logo_light') || (partnerInfo ? '' : DEFAULT_ROTA99_LOGO_LIGHT)),
      salonLogo: hasActiveSubdomain ? '' : (localStorage.getItem('vagou_salon_logo_dark') || (partnerInfo ? '' : DEFAULT_ROTA99_LOGO_DARK)),
      salonIcon: hasActiveSubdomain ? '' : (localStorage.getItem('vagou_salon_icon') || (partnerInfo ? '' : DEFAULT_ROTA99_ICON)),
      pwaName: effectiveSalonName,
      slogan: '',
      showSlogan: true,
      logoTextFallback: '',
      logoTextColor: effectiveColor,
      showHeroSlides: true,
      brandFont: 'Poppins',
      defaultTheme: undefined,
      navStyle: 'minimal',
      navShape: 'square',
      navBorder: 'bordered',
      navBgStyle: 'solid',
      navBgColor: '#005CA9',
      navActiveColor: effectiveColor,
      navTextColor: undefined,
      welcomeStyle: 'atmospheric',
      bio: '',
      instagramUrl: '',
    };
    if (!hasActiveSubdomain) {
      try {
        const saved = localStorage.getItem('vagou_salon_admin_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          const resolvedNavBgColor =
            !parsed.navBgColor || String(parsed.navBgColor).trim().toLowerCase() === '#f1f5f9'
              ? defaults.navBgColor
              : parsed.navBgColor;
          const resolvedNavBgStyle =
            parsed.navBgStyle === 'glass' && !parsed.navBgColor
              ? 'solid'
              : (parsed.navBgStyle || defaults.navBgStyle);
          return {
            ...defaults,
            ...parsed,
            salonLogoDark: parsed.salonLogoDark || localStorage.getItem('vagou_salon_logo_dark') || defaults.salonLogoDark,
            salonLogoLight: parsed.salonLogoLight || localStorage.getItem('vagou_salon_logo_light') || defaults.salonLogoLight,
            salonLogo: parsed.salonLogo || parsed.salonLogoDark || localStorage.getItem('vagou_salon_logo_dark') || defaults.salonLogo,
            salonIcon: parsed.salonIcon || localStorage.getItem('vagou_salon_icon') || defaults.salonIcon,
            accentColor: parsed.accentColor || localStorage.getItem('vagou_accent_color') || defaults.accentColor,
            slogan: parsed.slogan || defaults.slogan,
            showSlogan: parsed.showSlogan !== undefined ? parsed.showSlogan : defaults.showSlogan,
            logoTextFallback: parsed.logoTextFallback !== undefined ? parsed.logoTextFallback : defaults.logoTextFallback,
            logoTextColor: parsed.logoTextColor || defaults.logoTextColor,
            showHeroSlides: parsed.showHeroSlides !== undefined ? parsed.showHeroSlides : defaults.showHeroSlides,
            defaultTheme: parsed.defaultTheme || defaults.defaultTheme,
            brandFont: parsed.brandFont || defaults.brandFont,
            navStyle: parsed.navStyle || defaults.navStyle,
            navShape: parsed.navShape || defaults.navShape,
            navBorder: parsed.navBorder || defaults.navBorder,
            navIconBorder: parsed.navIconBorder || defaults.navIconBorder,
            navBgStyle: resolvedNavBgStyle,
            navBgColor: resolvedNavBgColor,
            navActiveColor: parsed.navActiveColor || defaults.navActiveColor,
            navTextColor: parsed.navTextColor !== undefined ? parsed.navTextColor : defaults.navTextColor,
            welcomeStyle: parsed.welcomeStyle || defaults.welcomeStyle,
            bio: parsed.bio || defaults.bio,
            instagramUrl: parsed.instagramUrl || defaults.instagramUrl,
            isOpenNow: parsed.isOpenNow !== undefined ? parsed.isOpenNow : true,
          };
        }
      } catch {
        // ignore
      }
    }
    return defaults;
  });

  // Sincroniza tema padrão / permanente do estabelecimento sem criar loop de dependência com o tema do usuário
  const initialThemeSyncDoneRef = useRef(false);
  useEffect(() => {
    if (adminSettings.defaultTheme) {
      const explicitUserPref = localStorage.getItem('vagou_user_theme_preference');
      // Se não há preferência manual do usuário, aplica o tema padrão do salão na inicialização
      if (!explicitUserPref && !initialThemeSyncDoneRef.current) {
        setTheme(adminSettings.defaultTheme, { isExplicitUserChoice: false });
        initialThemeSyncDoneRef.current = true;
      }
    }
  }, [adminSettings.defaultTheme, setTheme]);

  // Cor de destaque / tema ativa e prioritária do estabelecimento
  const effectiveAccentColor = adminSettings.accentColor || accentColor || '#20C933';

  const effectiveSalonCacheSlug = (
    activeSubdomain ||
    initialSalonData?.slug ||
    adminSettings.salonSlug ||
    (typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_slug') : '') ||
    ''
  ).trim().toLowerCase();

  // Lista dinâmica de serviços isolada por salão (sem vazar serviços demo em salões reais do Supabase)
  const [catalogServicesList, setCatalogServicesList] = useState<CatalogServiceItem[]>(() => {
    const isRealTenant = Boolean(hasActiveSubdomain || initialSalonData?.id);
    try {
      if (effectiveSalonCacheSlug) {
        const scopedSaved = localStorage.getItem(`vagou_services_${effectiveSalonCacheSlug}`);
        if (scopedSaved) {
          const parsed = JSON.parse(scopedSaved);
          if (Array.isArray(parsed)) return parsed;
        }
      }
      if (!isRealTenant) {
        const saved = localStorage.getItem('vagou_custom_catalog_services');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {
      // ignore
    }
    return isRealTenant ? [] : INITIAL_CATALOG_SERVICES;
  });

  // Lista dinâmica de profissionais da equipe isolada por salão
  const [professionalsList, setProfessionalsList] = useState<SalonProfessionalItem[]>(() => {
    const isRealTenant = Boolean(hasActiveSubdomain || initialSalonData?.id);
    try {
      if (effectiveSalonCacheSlug) {
        const scopedPros = localStorage.getItem(`vagou_pros_${effectiveSalonCacheSlug}`);
        if (scopedPros) {
          const parsed = JSON.parse(scopedPros);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
      if (!isRealTenant) {
        const savedTeam = localStorage.getItem('vagou_team_members');
        if (savedTeam) {
          const parsedTeam = JSON.parse(savedTeam);
          if (Array.isArray(parsedTeam) && parsedTeam.length > 0) {
            return parsedTeam.map(member => ({
              id: member.id,
              name: member.name,
              role: member.role === 'admin' ? 'Dono / Gerente' : member.role === 'receptionist' ? 'Recepcionista' : 'Profissional',
              avatar: member.avatarUrl || member.avatar,
              avatarUrl: member.avatarUrl || member.avatar,
              specialties: Array.isArray(member.specialties) ? member.specialties : undefined,
              rating: 5.0
            }));
          }
        }

        const saved = localStorage.getItem('vagou_custom_professionals');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {
      // ignore
    }
    if (isRealTenant) {
      const ownerDisplayName = initialSalonData?.trade_name || salonName || 'Profissional';
      return [
        {
          id: initialSalonData?.id || 'owner-1',
          name: ownerDisplayName,
          role: 'Dono / Gerente',
          avatar: initialSalonData?.favicon_url || initialSalonData?.logo_url || '',
          avatarUrl: initialSalonData?.favicon_url || initialSalonData?.logo_url || '',
          rating: 5.0,
        },
      ];
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

  // Estado do ID do salão no Supabase para sincronização em tempo real
  const [currentSalonDbId, setCurrentSalonDbId] = useState<string>(() => {
    return initialSalonData?.id || localStorage.getItem('vagou_salon_db_id') || '';
  });

  // Carregar dados reais do Supabase (Identidade Visual, Configurações, Serviços e Equipe)
  useEffect(() => {
    let isMounted = true;
    async function loadDataFromSupabase() {
      if (!isSupabaseConfigured || !supabase) {
        if (isMounted) setIsLoadingSalon(false);
        return;
      }
      try {
        const activeSlug = activeSubdomain || localStorage.getItem('vagou_salon_slug') || adminSettings.salonSlug || salonName.toLowerCase().replace(/\s+/g, '-');
        const activeEmail = localStorage.getItem('vagou_user_email') || localStorage.getItem('vagou_active_partner') || '';
        
        // 1. Reaproveitar initialSalonData vindo do App.tsx (evita duas queries seguidas em public.salons) ou buscar do banco
        const salonRecord = (initialSalonData && initialSalonData.id)
          ? initialSalonData
          : await fetchCompleteSalonData({
              slug: activeSlug,
              name: salonName,
              email: activeEmail
            });

        if (!salonRecord || !salonRecord.id) return;
        if (isMounted) {
          setCurrentSalonDbId(salonRecord.id);
          localStorage.setItem('vagou_salon_db_id', salonRecord.id);
          if (salonRecord.slug) localStorage.setItem('vagou_salon_slug', salonRecord.slug);

          // Sincronizar dados visuais e administrativos vindos do Supabase
          const updatedSettings: Partial<SalonAdminSettings> = {};
          if (salonRecord.trade_name) updatedSettings.salonName = salonRecord.trade_name;

          const rawRecordDoc = (salonRecord.document_number || '').replace(/\D/g, '');
          const isRecordCnpj14 = rawRecordDoc.length === 14;
          updatedSettings.cnpj = isRecordCnpj14 ? (salonRecord.document_number || '') : '';
          updatedSettings.razaoSocial = isRecordCnpj14 ? (salonRecord.legal_name || '') : '';

          const resolvedOwnerCpf =
            salonRecord.owner_cpf ||
            salonRecord.branding?.ownerCpf ||
            (rawRecordDoc.length === 11 ? salonRecord.document_number : '');
          if (resolvedOwnerCpf) {
            updatedSettings.ownerCpf = resolvedOwnerCpf;
            updatedSettings.legalManagerCpf = resolvedOwnerCpf;
          }

          const resolvedPixKeys = Array.isArray(salonRecord.pix_keys)
            ? salonRecord.pix_keys
            : (Array.isArray(salonRecord.branding?.pixKeys) ? salonRecord.branding.pixKeys : undefined);
          if (resolvedPixKeys !== undefined) {
            updatedSettings.pixKeys = resolvedPixKeys;
          }
          const resolvedPixKey =
            salonRecord.pix_key ||
            salonRecord.branding?.pixKey ||
            (Array.isArray(resolvedPixKeys) ? (resolvedPixKeys.find((k: any) => k?.isPrimary)?.key || resolvedPixKeys[0]?.key) : '');
          if (resolvedPixKey) {
            updatedSettings.pixKey = resolvedPixKey;
          }

          if (salonRecord.phone_whatsapp) updatedSettings.salonPhone = salonRecord.phone_whatsapp;
          if (salonRecord.category || salonRecord.branding?.category) {
            updatedSettings.category = salonRecord.category || salonRecord.branding?.category;
          }
          if (salonRecord.email || salonRecord.branding?.email) {
            updatedSettings.email = salonRecord.email || salonRecord.branding?.email;
          }
          if (salonRecord.phone_landline || salonRecord.branding?.phoneLandline) {
            updatedSettings.phoneLandline = salonRecord.phone_landline || salonRecord.branding?.phoneLandline;
          }
          if (salonRecord.opening_hours_text || salonRecord.branding?.openingHours) {
            updatedSettings.openingHours = salonRecord.opening_hours_text || salonRecord.branding?.openingHours;
          }
          if (salonRecord.operating_hours || salonRecord.branding?.operatingHours) {
            updatedSettings.operatingHoursJson = salonRecord.operating_hours || salonRecord.branding?.operatingHours;
          }
          if (salonRecord.space_photos || salonRecord.branding?.spacePhotos) {
            updatedSettings.spacePhotos = salonRecord.space_photos || salonRecord.branding?.spacePhotos;
          }
          if (salonRecord.space_description || salonRecord.branding?.spaceDescription) {
            updatedSettings.spaceDescription = salonRecord.space_description || salonRecord.branding?.spaceDescription;
          }
          if (salonRecord.amenities || salonRecord.branding?.amenities) {
            updatedSettings.amenities = salonRecord.amenities || salonRecord.branding?.amenities;
          }
          if (salonRecord.address || salonRecord.branding?.salonAddress) {
            updatedSettings.salonAddress = salonRecord.address || salonRecord.branding?.salonAddress;
          }
          if (salonRecord.street_number || salonRecord.branding?.numero || salonRecord.branding?.streetNumber) {
            updatedSettings.numero = salonRecord.street_number || salonRecord.branding?.numero || salonRecord.branding?.streetNumber;
          }
          if (salonRecord.complement || salonRecord.branding?.complemento || salonRecord.branding?.complement) {
            updatedSettings.complemento = salonRecord.complement || salonRecord.branding?.complemento || salonRecord.branding?.complement;
          }
          if (salonRecord.neighborhood || salonRecord.branding?.bairro || salonRecord.branding?.neighborhood) {
            updatedSettings.bairro = salonRecord.neighborhood || salonRecord.branding?.bairro || salonRecord.branding?.neighborhood;
          }
          if (salonRecord.city || salonRecord.branding?.cidade || salonRecord.branding?.city) {
            updatedSettings.cidade = salonRecord.city || salonRecord.branding?.cidade || salonRecord.branding?.city;
          }
          if (salonRecord.state || salonRecord.branding?.uf || salonRecord.branding?.state) {
            updatedSettings.uf = salonRecord.state || salonRecord.branding?.uf || salonRecord.branding?.state;
          }
          if (salonRecord.cep || salonRecord.branding?.cep) {
            updatedSettings.cep = salonRecord.cep || salonRecord.branding?.cep;
          }
          const resolvedLogoLight = salonRecord.logo_light_url || salonRecord.branding?.logoLightUrl || '';
          const resolvedLogoDark = salonRecord.logo_dark_url || salonRecord.branding?.logoDarkUrl || '';
          const resolvedMainLogo = salonRecord.logo_url || salonRecord.branding?.logoUrl || resolvedLogoDark || resolvedLogoLight || '';

          updatedSettings.salonLogoLight = resolvedLogoLight;
          updatedSettings.salonLogoDark = resolvedLogoDark;
          updatedSettings.salonLogo = resolvedMainLogo;

          if (resolvedLogoLight) {
            localStorage.setItem('vagou_salon_logo_light', resolvedLogoLight);
          } else {
            localStorage.removeItem('vagou_salon_logo_light');
          }
          if (resolvedLogoDark) {
            localStorage.setItem('vagou_salon_logo_dark', resolvedLogoDark);
          } else {
            localStorage.removeItem('vagou_salon_logo_dark');
          }

          // Hidratação canônica Boletim bol-017 (favicon_url / salonIcon, slogan, brand_font, bio, instagramUrl)
          const resolvedSalonIcon =
            salonRecord.favicon_url ||
            salonRecord.branding?.salonIcon ||
            salonRecord.branding?.faviconUrl ||
            salonRecord.logo_url ||
            '';
          if (resolvedSalonIcon) {
            updatedSettings.salonIcon = resolvedSalonIcon;
            localStorage.setItem('vagou_salon_icon', resolvedSalonIcon);
          }

          const resolvedSlogan = salonRecord.slogan || salonRecord.branding?.slogan || '';
          updatedSettings.slogan = resolvedSlogan;

          const resolvedBrandFont = salonRecord.brand_font || salonRecord.branding?.brandFont || 'Poppins';
          updatedSettings.brandFont = resolvedBrandFont;

          if (salonRecord.default_theme || salonRecord.branding?.defaultTheme) {
            const remoteTheme = (salonRecord.default_theme || salonRecord.branding?.defaultTheme) as 'dark' | 'light';
            updatedSettings.defaultTheme = remoteTheme;
            const explicitUserChoice = localStorage.getItem('vagou_user_theme_preference');
            if (!explicitUserChoice) {
              setTheme(remoteTheme, { isExplicitUserChoice: false });
              initialThemeSyncDoneRef.current = true;
            }
          }
          if (salonRecord.show_slogan !== undefined || salonRecord.branding?.showSlogan !== undefined) {
            updatedSettings.showSlogan = salonRecord.show_slogan !== undefined ? salonRecord.show_slogan : salonRecord.branding?.showSlogan;
          }
          if (salonRecord.logo_text_fallback || salonRecord.branding?.logoTextFallback) {
            updatedSettings.logoTextFallback = salonRecord.logo_text_fallback || salonRecord.branding?.logoTextFallback;
          }
          if (salonRecord.logo_text_color || salonRecord.branding?.logoTextColor) {
            updatedSettings.logoTextColor = salonRecord.logo_text_color || salonRecord.branding?.logoTextColor;
          }
          if (salonRecord.show_hero_slides !== undefined || salonRecord.branding?.showHeroSlides !== undefined) {
            updatedSettings.showHeroSlides = salonRecord.show_hero_slides !== undefined ? salonRecord.show_hero_slides : salonRecord.branding?.showHeroSlides;
          }

          // Barra de Títulos das Seções (Section Header)
          if (salonRecord.section_header_bg_color || salonRecord.branding?.sectionHeaderBgColor) {
            updatedSettings.sectionHeaderBgColor = salonRecord.section_header_bg_color || salonRecord.branding?.sectionHeaderBgColor;
          }
          if (salonRecord.section_header_text_color || salonRecord.branding?.sectionHeaderTextColor) {
            updatedSettings.sectionHeaderTextColor = salonRecord.section_header_text_color || salonRecord.branding?.sectionHeaderTextColor;
          }
          if (salonRecord.section_header_icon_color || salonRecord.branding?.sectionHeaderIconColor) {
            updatedSettings.sectionHeaderIconColor = salonRecord.section_header_icon_color || salonRecord.branding?.sectionHeaderIconColor;
          }
          if (salonRecord.section_header_bg_style || salonRecord.branding?.sectionHeaderBgStyle) {
            updatedSettings.sectionHeaderBgStyle = salonRecord.section_header_bg_style || salonRecord.branding?.sectionHeaderBgStyle;
          }
          if (salonRecord.section_header_border || salonRecord.branding?.sectionHeaderBorder) {
            updatedSettings.sectionHeaderBorder = salonRecord.section_header_border || salonRecord.branding?.sectionHeaderBorder;
          }
          if (salonRecord.section_header_btn_bg_color || salonRecord.branding?.sectionHeaderBtnBgColor) {
            updatedSettings.sectionHeaderBtnBgColor = salonRecord.section_header_btn_bg_color || salonRecord.branding?.sectionHeaderBtnBgColor;
          }
          if (salonRecord.section_header_btn_active_bg_color || salonRecord.branding?.sectionHeaderBtnActiveBgColor) {
            updatedSettings.sectionHeaderBtnActiveBgColor = salonRecord.section_header_btn_active_bg_color || salonRecord.branding?.sectionHeaderBtnActiveBgColor;
          }
          if (salonRecord.section_header_btn_border || salonRecord.branding?.sectionHeaderBtnBorder) {
            updatedSettings.sectionHeaderBtnBorder = salonRecord.section_header_btn_border || salonRecord.branding?.sectionHeaderBtnBorder;
          }
          if (salonRecord.section_header_btn_shadow || salonRecord.branding?.sectionHeaderBtnShadow) {
            updatedSettings.sectionHeaderBtnShadow = salonRecord.section_header_btn_shadow || salonRecord.branding?.sectionHeaderBtnShadow;
          }
          if (salonRecord.section_header_btn_blur || salonRecord.branding?.sectionHeaderBtnBlur) {
            updatedSettings.sectionHeaderBtnBlur = salonRecord.section_header_btn_blur || salonRecord.branding?.sectionHeaderBtnBlur;
          }
          if (salonRecord.section_header_btn_font || salonRecord.branding?.sectionHeaderBtnFont) {
            updatedSettings.sectionHeaderBtnFont = salonRecord.section_header_btn_font || salonRecord.branding?.sectionHeaderBtnFont;
          }

          // Barra de Navegação Inferior (BottomNav)
          if (salonRecord.nav_style || salonRecord.branding?.navStyle) {
            updatedSettings.navStyle = salonRecord.nav_style || salonRecord.branding?.navStyle;
          }
          if (salonRecord.nav_shape || salonRecord.branding?.navShape) {
            updatedSettings.navShape = salonRecord.nav_shape || salonRecord.branding?.navShape;
          }
          if (salonRecord.nav_border || salonRecord.branding?.navBorder) {
            updatedSettings.navBorder = salonRecord.nav_border || salonRecord.branding?.navBorder;
          }
          if (salonRecord.nav_icon_border || salonRecord.branding?.navIconBorder) {
            updatedSettings.navIconBorder = salonRecord.nav_icon_border || salonRecord.branding?.navIconBorder;
          }
          if (salonRecord.nav_bg_style || salonRecord.branding?.navBgStyle) {
            updatedSettings.navBgStyle = salonRecord.nav_bg_style || salonRecord.branding?.navBgStyle;
          }
          if (salonRecord.nav_bg_color || salonRecord.branding?.navBgColor) {
            updatedSettings.navBgColor = salonRecord.nav_bg_color || salonRecord.branding?.navBgColor;
          }
          if (salonRecord.nav_btn_bg_color || salonRecord.branding?.navBtnBgColor) {
            updatedSettings.navBtnBgColor = salonRecord.nav_btn_bg_color || salonRecord.branding?.navBtnBgColor;
          }
          if (salonRecord.nav_btn_active_bg_color || salonRecord.branding?.navBtnActiveBgColor) {
            updatedSettings.navBtnActiveBgColor = salonRecord.nav_btn_active_bg_color || salonRecord.branding?.navBtnActiveBgColor;
          }
          if (salonRecord.nav_active_color || salonRecord.branding?.navActiveColor) {
            updatedSettings.navActiveColor = salonRecord.nav_active_color || salonRecord.branding?.navActiveColor;
          }
          if (salonRecord.nav_text_color || salonRecord.branding?.navTextColor) {
            updatedSettings.navTextColor = salonRecord.nav_text_color || salonRecord.branding?.navTextColor;
          }
          if (salonRecord.nav_btn_shadow || salonRecord.branding?.navBtnShadow) {
            updatedSettings.navBtnShadow = salonRecord.nav_btn_shadow || salonRecord.branding?.navBtnShadow;
          }
          if (salonRecord.nav_btn_blur || salonRecord.branding?.navBtnBlur) {
            updatedSettings.navBtnBlur = salonRecord.nav_btn_blur || salonRecord.branding?.navBtnBlur;
          }
          if (salonRecord.nav_btn_font || salonRecord.branding?.navBtnFont) {
            updatedSettings.navBtnFont = salonRecord.nav_btn_font || salonRecord.branding?.navBtnFont;
          }
          if (salonRecord.welcome_style || salonRecord.branding?.welcomeStyle) {
            updatedSettings.welcomeStyle = salonRecord.welcome_style || salonRecord.branding?.welcomeStyle;
          }

          if (salonRecord.bio || salonRecord.branding?.bio) {
            updatedSettings.bio = salonRecord.bio || salonRecord.branding?.bio;
          }
          if (salonRecord.branding?.websiteUrl !== undefined) {
            updatedSettings.websiteUrl = salonRecord.branding.websiteUrl;
          }
          if (salonRecord.branding?.instagramUrl !== undefined) {
            updatedSettings.instagramUrl = salonRecord.branding.instagramUrl;
          }
          if (salonRecord.branding?.facebookUrl !== undefined) {
            updatedSettings.facebookUrl = salonRecord.branding.facebookUrl;
          }
          if (salonRecord.branding?.mapsUrl !== undefined) {
            updatedSettings.mapsUrl = salonRecord.branding.mapsUrl;
          }
          if (salonRecord.operating_hours?.days || salonRecord.branding?.operatingSchedule?.days) {
            updatedSettings.operatingSchedule = salonRecord.operating_hours?.days
              ? salonRecord.operating_hours
              : salonRecord.branding?.operatingSchedule;
          }
          if (salonRecord.branding?.pwaName) {
            updatedSettings.pwaName = salonRecord.branding.pwaName;
          }

          const resolvedDbColor = salonRecord.primary_color || salonRecord.branding?.primaryColor;
          const localAccentColor = localStorage.getItem('vagou_accent_color');
          const localTimestamp = Number(localStorage.getItem('vagou_accent_color_timestamp') || 0);
          const dbTimestamp = salonRecord.updated_at ? new Date(salonRecord.updated_at).getTime() : 0;

          // Se houver alteração de cor local mais recente que a atualização do banco, preserva a escolha local do usuário
          const rawAccentColor = (localAccentColor && localTimestamp > dbTimestamp)
            ? localAccentColor
            : (resolvedDbColor || localAccentColor || '#2B82C9');
          const finalAccentColor = sanitizeAccentColor(rawAccentColor);

          if (finalAccentColor) {
            updatedSettings.accentColor = finalAccentColor;
            localStorage.setItem('vagou_accent_color', finalAccentColor);
            setAccentColorContext(finalAccentColor);
          }

          setAdminSettings((prev) => {
            const next = { ...prev, ...updatedSettings };
            try {
              localStorage.setItem('vagou_salon_admin_settings', JSON.stringify(next));
            } catch {}
            updateDynamicPwaAssets(next.pwaName || next.salonName, next.salonIcon, next.accentColor, next.slogan);
            return next;
          });
        }

        const resolvedSlugKey = (salonRecord.slug || activeSlug || '').trim().toLowerCase();

        // 2. Buscar serviços reais do banco (respeitando lista vazia em salões reais sem injetar serviços demo)
        const servicesFromDb = await fetchSalonServices(salonRecord.id);
        if (isMounted && Array.isArray(servicesFromDb)) {
          const brandingCatalogMeta: any[] = Array.isArray(salonRecord.branding?.catalogServices)
            ? salonRecord.branding.catalogServices
            : [];

          const mappedServices: CatalogServiceItem[] = servicesFromDb.map((s: any) => {
            const metaMatch = brandingCatalogMeta.find(
              (m: any) => (m.id && m.id === s.id) || ((m.title || m.name) && (m.title || m.name) === (s.title || s.name))
            );
            const resolvedPhotos: string[] = Array.isArray(s.photos) && s.photos.length > 0
              ? s.photos
              : Array.isArray(s.slides) && s.slides.length > 0
              ? s.slides
              : Array.isArray(metaMatch?.photos) && metaMatch.photos.length > 0
              ? metaMatch.photos
              : s.image_url
              ? [s.image_url]
              : [];

            const resolvedVideoUrl: string =
              s.video_url ||
              (Array.isArray(s.videos) && s.videos.length > 0 ? s.videos[0]?.url : '') ||
              metaMatch?.videoUrl ||
              '';

            return {
              id: s.id,
              title: s.title || s.name || 'Serviço',
              description: s.description || metaMatch?.description || '',
              price: Number(s.price) || 0,
              duration: `${s.duration_minutes || 40} min`,
              category: s.category || 'Geral',
              image: s.image_url || resolvedPhotos[0] || metaMatch?.image || '',
              photos: resolvedPhotos,
              videoUrl: resolvedVideoUrl || undefined,
              displayMode: metaMatch?.displayMode || (resolvedVideoUrl ? 'video' : resolvedPhotos.length > 1 ? 'slideshow' : 'static'),
              mediaType: metaMatch?.mediaType || (resolvedVideoUrl ? 'video' : 'image'),
            };
          });
          setCatalogServicesList(mappedServices);
          try {
            if (resolvedSlugKey) {
              localStorage.setItem(`vagou_services_${resolvedSlugKey}`, JSON.stringify(mappedServices));
            }
            localStorage.setItem('vagou_custom_catalog_services', JSON.stringify(mappedServices));
          } catch {}
        }

        // Sincronizar utilidades operacionais em segundo plano (salon_utilities_records)
        syncAllLocalUtilitiesToDatabase(salonRecord.id);

        // 3. Buscar profissionais reais do banco (com suporte a campos completos e metadados de escala/comissão)
        const prosFromDb = await fetchSalonProfessionals(salonRecord.id);
        if (isMounted && Array.isArray(prosFromDb)) {
          if (prosFromDb.length > 0) {
            const brandingTeamMeta: any[] = Array.isArray(salonRecord.branding?.teamMembers)
              ? salonRecord.branding.teamMembers
              : [];

            const mappedPros: SalonProfessionalItem[] = prosFromDb.map((p: any) => {
              const metaMatch = brandingTeamMeta.find(
                (m: any) => (m.id && m.id === p.id) || (m.name && m.name === p.name)
              );
              const rawSpecs = Array.isArray(p.specialties)
                ? p.specialties
                : Array.isArray(metaMatch?.specialties)
                ? metaMatch.specialties
                : p.specialty
                ? String(p.specialty).split(',').map((s: string) => s.trim()).filter(Boolean)
                : ['Geral'];

              return {
                id: p.id,
                name: p.name,
                role:
                  p.role === 'admin'
                    ? 'Dono / Gerente'
                    : p.role === 'receptionist'
                    ? 'Recepcionista'
                    : p.specialty || 'Profissional',
                systemRole: p.role === 'admin' ? 'admin' : 'member',
                avatar: p.avatar_url || '',
                avatarUrl: p.avatar_url || '',
                phone: p.phone || metaMatch?.phone || '',
                email: p.email || metaMatch?.email || '',
                commissionRate:
                  p.commission_rate !== undefined && p.commission_rate !== null
                    ? Number(p.commission_rate)
                    : metaMatch?.commissionRate ?? (p.role === 'admin' ? 100 : 50),
                specialties: rawSpecs,
                workSchedule: p.work_schedule || p.schedule_config || metaMatch?.workSchedule || undefined,
                isActive: p.is_active !== false && metaMatch?.isActive !== false,
                rating: 5.0,
              };
            });
            setProfessionalsList(mappedPros);
            try {
              if (resolvedSlugKey) {
                localStorage.setItem(`vagou_pros_${resolvedSlugKey}`, JSON.stringify(mappedPros));
              }
              localStorage.setItem('vagou_custom_professionals', JSON.stringify(mappedPros));
            } catch {}
          } else {
            const fallbackOwnerPro: SalonProfessionalItem[] = [
              {
                id: salonRecord.id,
                name: salonRecord.trade_name || salonName || 'Profissional',
                role: 'Dono / Gerente',
                systemRole: 'admin',
                avatar: salonRecord.favicon_url || salonRecord.logo_url || '',
                avatarUrl: salonRecord.favicon_url || salonRecord.logo_url || '',
                rating: 5.0,
              },
            ];
            setProfessionalsList(fallbackOwnerPro);
          }
        }

        // 4. Buscar agendamentos reais do salão no banco
        const aptsFromDb = await fetchSalonAppointments(salonRecord.id);
        if (isMounted && Array.isArray(aptsFromDb) && aptsFromDb.length > 0) {
          const mappedApts = aptsFromDb.map((a) => mapDbAppointmentToBookingAppointment(a, salonRecord.trade_name));
          setAppointmentsList(mappedApts);
          try {
            localStorage.setItem('vagou_user_appointments', JSON.stringify(mappedApts));
          } catch {}
        }
      } catch (err) {
        console.warn('Consulta Supabase em segundo plano:', err);
      } finally {
        if (isMounted) {
          setIsLoadingSalon(false);
        }
      }
    }

    let unsubscribeSalonApts = () => {};
    loadDataFromSupabase().then(() => {
      const activeSalonId = currentSalonDbId || localStorage.getItem('vagou_salon_db_id');
      if (isSupabaseConfigured && activeSalonId) {
        unsubscribeSalonApts = subscribeToAppointments({ salonId: activeSalonId }, ({ eventType, newRow }) => {
          if (newRow && (eventType === 'INSERT' || eventType === 'UPDATE')) {
            const mapped = mapDbAppointmentToBookingAppointment(newRow, salonName);
            setAppointmentsList((prev) => {
              const index = prev.findIndex((a) => a.protocolCode === mapped.protocolCode || (a.id && a.id === mapped.id));
              let nextList: BookingAppointment[];
              if (index >= 0) {
                nextList = [...prev];
                nextList[index] = mapped;
              } else {
                nextList = [mapped, ...prev];
              }
              try {
                localStorage.setItem('vagou_user_appointments', JSON.stringify(nextList));
              } catch {}
              return nextList;
            });
          }
        });
      }
    });

    return () => { 
      isMounted = false; 
      unsubscribeSalonApts();
    };
  }, [salonName, activeSubdomain, initialSalonData?.id]);

  // Escuta de eventos para atualização instantânea do catálogo de serviços no CRUD
  useEffect(() => {
    const handleCatalogUpdated = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setCatalogServicesList(e.detail);
      }
    };
    window.addEventListener('vagou:catalog-updated', handleCatalogUpdated);
    return () => window.removeEventListener('vagou:catalog-updated', handleCatalogUpdated);
  }, []);

  // Handlers para persistência e sincronização em tempo real no Supabase
  const handleUpdateServices = async (newServices: CatalogServiceItem[]) => {
    setCatalogServicesList(newServices);
    try {
      if (effectiveSalonCacheSlug) {
        localStorage.setItem(`vagou_services_${effectiveSalonCacheSlug}`, JSON.stringify(newServices));
      }
      localStorage.setItem('vagou_custom_catalog_services', JSON.stringify(newServices));
    } catch {
      // ignore
    }

    window.dispatchEvent(new CustomEvent('vagou:catalog-updated', { detail: newServices }));

    const salonId = currentSalonDbId || localStorage.getItem('vagou_salon_db_id');
    if (salonId) {
      await syncAllServicesToDb(salonId, newServices);
    }
  };

  const handleUpdateProfessionals = async (newPros: SalonProfessionalItem[]) => {
    setProfessionalsList(newPros);
    try {
      if (effectiveSalonCacheSlug) {
        localStorage.setItem(`vagou_pros_${effectiveSalonCacheSlug}`, JSON.stringify(newPros));
      }
      localStorage.setItem('vagou_custom_professionals', JSON.stringify(newPros));
    } catch {
      // ignore
    }

    const salonId = currentSalonDbId || localStorage.getItem('vagou_salon_db_id');
    if (salonId) {
      await syncAllProfessionalsToDb(salonId, newPros);
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<SalonAdminSettings>) => {
    if (newSettings.defaultTheme) {
      setTheme(newSettings.defaultTheme);
      try {
        localStorage.setItem('vagou_user_theme_preference', newSettings.defaultTheme);
        localStorage.setItem('vagou_theme', newSettings.defaultTheme);
      } catch {}
    }
    if (newSettings.accentColor) {
      setAccentColorContext(newSettings.accentColor);
      try {
        localStorage.setItem('vagou_accent_color', newSettings.accentColor);
        localStorage.setItem('vagou_accent_color_timestamp', Date.now().toString());
      } catch {}
    }
    setAdminSettings((prev) => {
      const merged = { ...prev, ...newSettings };
      try {
        localStorage.setItem('vagou_salon_admin_settings', JSON.stringify(merged));
        if (merged.accentColor) {
          localStorage.setItem('vagou_accent_color', merged.accentColor);
          localStorage.setItem('vagou_accent_color_timestamp', Date.now().toString());
        }
        const effectiveName = merged.pwaName || merged.salonName || salonName;
        const effectiveIsDark = (merged.defaultTheme || theme) === 'dark';
        updateDynamicPwaAssets(
          effectiveName, 
          merged.salonIcon || merged.salonLogoDark || merged.salonLogo,
          merged.accentColor,
          merged.slogan,
          effectiveIsDark
        );
      } catch {
        // ignore
      }
      return merged;
    });

    const salonTarget = currentSalonDbId || localStorage.getItem('vagou_salon_db_id') || localStorage.getItem('vagou_salon_slug') || adminSettings.salonSlug || salonName.toLowerCase().replace(/\s+/g, '-');
    if (salonTarget) {
      const dbRes = await updateSalonSettingsInDb(salonTarget, newSettings);
      return dbRes;
    }
    return { success: false, error: 'Identificador do salão não encontrado' };
  };

  useEffect(() => {
    const effectiveName = adminSettings.pwaName || adminSettings.salonName || salonName;
    updateDynamicPwaAssets(
      effectiveName, 
      adminSettings.salonIcon || adminSettings.salonLogoDark || adminSettings.salonLogo,
      adminSettings.accentColor
    );
  }, [adminSettings.pwaName, adminSettings.salonName, adminSettings.salonIcon, adminSettings.salonLogoDark, adminSettings.salonLogo, adminSettings.accentColor, salonName]);

  const handleUpdateAppointments = async (newApts: BookingAppointment[]) => {
    // 1. Identificar agendamentos ou bloqueios removidos (ex: slots despausados)
    const removedApts = appointmentsList.filter(
      (oldApt) =>
        !newApts.some(
          (nApt) =>
            (nApt.protocolCode && nApt.protocolCode === oldApt.protocolCode) ||
            (nApt.id && nApt.id === oldApt.id)
        )
    );

    // 2. Atualizar estado local e cache no localStorage imediatamente
    setAppointmentsList(newApts);
    try {
      localStorage.setItem('vagou_user_appointments', JSON.stringify(newApts));
    } catch {
      // ignore
    }

    // 3. Notificar todos os componentes do app via CustomEvent
    window.dispatchEvent(new CustomEvent('vagou:appointments-updated', { detail: { appointments: newApts } }));

    // 4. Sincronizar exclusões de bloqueios/pausas no Supabase
    for (const rem of removedApts) {
      if (rem.protocolCode) {
        await removeBlockedSlotInDb(rem.protocolCode);
      }
    }

    // 5. Sincronizar inserções/atualizações no Supabase
    const salonId = currentSalonDbId || localStorage.getItem('vagou_salon_db_id');
    if (salonId) {
      for (const apt of newApts) {
        const payload = mapBookingAppointmentToDbPayload(apt, salonId);
        await upsertAppointmentInDb(payload);
      }
    }
  };

  const handleSalonLogin = (_pin?: string): boolean => {
    setIsClientAuthModalOpen(true);
    return false;
  };

  const handleSalonLogout = async () => {
    // 1. Limpeza SÍNCRONA imediata de todas as chaves de sessão no localStorage e sessionStorage
    try {
      const authKeysToRemove = [
        'vagou_auth_user_id',
        'vagou_client_id',
        'vagou_user_id',
        'vagou_active_partner',
        'vagou_user_email',
        'vagou_user_cpf',
        'vagou_user_phone',
        'vagou_user_avatar',
        'vagou_user_name',
        'vagou_user_username',
        'vagou_user_role',
        'vagou_user_profile',
        'vagou_is_superadmin',
        'vagou_client_session',
        'vagou_dashboard_user_role',
        'vagou_dashboard_logged_pro_name',
        'vagou_active_pro_id',
        'vagou_user_dependents',
        'vagou_partner_data',
      ];
      authKeysToRemove.forEach((key) => localStorage.removeItem(key));

      // Remove tokens de sessão do Supabase Auth armazenados no navegador (sb-*-auth-token)
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sb-') || k.includes('supabase.auth.token'))) {
          localStorage.removeItem(k);
        }
      }

      sessionStorage.removeItem('vagou_client_auth_modal_open');
      sessionStorage.removeItem('vagou_client_auth_modal_mode');
      sessionStorage.removeItem('vagou_register_wizard_draft');
    } catch {
      // ignore
    }

    // 2. Atualização imediata de estados da interface
    setCurrentUserName('Usuário');
    setCurrentUserAvatarUrl('');
    setIsUserLoggedInState(false);
    setIsProfileDrawerOpen(false);
    setIsClientAuthModalOpen(false);
    setIsPublicPreviewMode(true);
    setActiveTab('home');

    // 3. Disparo de eventos para todos os hooks (useSalonRole, useOwnerAccess, App, ProfileDrawer)
    window.dispatchEvent(new CustomEvent('vagou:auth-updated', { detail: { loggedOut: true } }));
    window.dispatchEvent(new CustomEvent('vagou:profile-updated', { detail: { name: '', avatarUrl: '' } }));

    // 4. Encerramento assíncrono no Supabase Auth e Firebase Auth sem travar a UI
    if (supabase) {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
    }
    try {
      const { getApps, getApp } = await import('firebase/app');
      const { getAuth, signOut } = await import('firebase/auth');
      if (getApps().length > 0) {
        await signOut(getAuth(getApp()));
      }
    } catch {}

    window.dispatchEvent(new CustomEvent('vagou:auth-updated', { detail: { loggedOut: true } }));
  };

  // Solicitação de acesso a Gerenciar Estabelecimento (Protegido por RBAC)
  const handleRequestManage = useCallback(() => {
    if (!isSalonLoggedIn) {
      setIsClientAuthModalOpen(true);
      return;
    }
    setIsPublicPreviewMode(false);
    setActiveTab('dados');
  }, [isSalonLoggedIn]);

  const [activeTab, setActiveTab] = useState<'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades' | 'dados' | 'visual' | 'preferencias' | 'layout' | 'pausar'>('home');
  const [previewTestTab, setPreviewTestTab] = useState<'home' | 'servicos' | 'vagas' | 'espaco'>('home');
  const [isPauseSlotsModalOpen, setIsPauseSlotsModalOpen] = useState(false);

  // Monitora se há horários pausados hoje para exibir indicador na barra inferior
  const hasPausedSlotsToday = useMemo(() => {
    const today = new Date();
    const todayIso = today.toISOString().split('T')[0];
    const shortToday = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    return appointmentsList.some((a) => {
      const isToday =
        a.dateIso === todayIso ||
        a.dayGroup === 'Hoje' ||
        a.dayGroup === shortToday ||
        (typeof a.dateTime === 'string' && (a.dateTime.includes('Hoje') || a.dateTime.includes(shortToday)));
      const isBlocked = a.isBlockedSlot || (a.status || '').toUpperCase() === 'BLOQUEADO';
      return isToday && isBlocked;
    });
  }, [appointmentsList]);

  // Reset de abas de gestão seguro: NÃO reseta enquanto role === 'loading'
  useEffect(() => {
    if (isRoleLoading) return; // Aguarda a resolução final do papel no banco

    const managementTabs = ['caixa', 'financeiro', 'equipe', 'personalizar', 'utilidades', 'dados', 'visual', 'preferencias', 'layout'];
    if (managementTabs.includes(activeTab) && !isOwnerOrManager) {
      setActiveTab('home');
    }
  }, [activeTab, isOwnerOrManager, isRoleLoading]);

  const [bookingService, setBookingService] = useState<CatalogServiceItem | null>(null);
  const [bookingTrigger, setBookingTrigger] = useState<number>(0);
  const [skipDateStep, setSkipDateStep] = useState<boolean>(false);
  const pendingBookingAuthRef = useRef<boolean>(false);
  const [activeBookingDraft, setActiveBookingDraft] = useState<BookingDraftItem | null>(() => getSavedBookingDraft());
  const [resumeDraftTarget, setResumeDraftTarget] = useState<BookingDraftItem | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [selectedPublicProfessional, setSelectedPublicProfessional] = useState<string>('any');

  useEffect(() => {
    const handleDraftUpdated = () => {
      setActiveBookingDraft(getSavedBookingDraft());
    };
    window.addEventListener('vagou:booking-draft-updated', handleDraftUpdated);
    return () => window.removeEventListener('vagou:booking-draft-updated', handleDraftUpdated);
  }, []);

  // Sub-abas e efeito swipe horizontal para a Seção Espaço (0: Equipe, 1: Estrutura, 2: Localização)
  const [espacoSlideIndex, setEspacoSlideIndex] = useState<number>(0);
  const [espacoSwipeDirection, setEspacoSwipeDirection] = useState<number>(1);

  // Paginação e efeito swap para o catálogo enquadrado de serviços (4 por visualização)
  const [servicePage, setServicePage] = useState<number>(0);
  const [swapDirection, setSwapDirection] = useState<number>(1);

  const [bookingIsDependent, setBookingIsDependent] = useState(false);
  const [bookingDependentName, setBookingDependentName] = useState('');
  const [bookingSelectedService, setBookingSelectedService] = useState<CatalogServiceItem | null>(null);
  const [bookingOpenModalFn, setBookingOpenModalFn] = useState<(() => void) | null>(null);

  // Estado para agendamento confirmado exibido dentro da seção do salão
  const [confirmedBookingData, setConfirmedBookingData] = useState<{
    protocolCode: string;
    serviceTitle: string;
    professionalName: string;
    salonName: string;
    dateTime: string;
    totalPrice: number;
    address: string;
    distanceKm?: number;
    etaMinutes?: number;
    maxDepartureTime?: string;
    uiTransportMode?: TransportMode;
    originFormattedAddress?: string;
    originLat?: number;
    originLng?: number;
    salonLat?: number;
    salonLng?: number;
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

  const activeBrandFont = adminSettings.brandFont || 'Poppins';
  const activeBrandFontFamily =
    activeBrandFont === 'Cormorant Garamond'
      ? "'Cormorant Garamond', Georgia, serif"
      : activeBrandFont === 'Oswald'
      ? "'Oswald', sans-serif"
      : activeBrandFont === 'Plus Jakarta Sans'
      ? "'Plus Jakarta Sans', sans-serif"
      : "'Poppins', sans-serif";

  // Auto-enriquecimento via ViaCEP caso o registro do salão tenha logradouro+cidade+UF (ou CEP) sem bairro/CEP completos
  useEffect(() => {
    let isCancelled = false;
    const rawCep = (adminSettings.cep || initialSalonData?.cep || '').replace(/\D/g, '');
    const rawStreet = (adminSettings.salonAddress || initialSalonData?.address || '').trim();
    const rawCidade = (adminSettings.cidade || initialSalonData?.city || '').trim();
    const rawUf = (adminSettings.uf || initialSalonData?.state || '').trim();
    const hasBairro = Boolean((adminSettings.bairro || initialSalonData?.neighborhood || '').trim());
    const hasFormattedCep = Boolean((adminSettings.cep || initialSalonData?.cep || '').trim());

    if (hasBairro && hasFormattedCep) return;

    const enrichFromViaCep = async () => {
      try {
        if (rawCep.length === 8) {
          const res = await fetch(`https://viacep.com.br/ws/${rawCep}/json/`);
          if (!res.ok) return;
          const data = await res.json();
          if (!isCancelled && data && !data.erro) {
            setAdminSettings((prev) => ({
              ...prev,
              salonAddress: prev.salonAddress || data.logradouro || '',
              bairro: prev.bairro || data.bairro || '',
              cidade: prev.cidade || data.localidade || '',
              uf: prev.uf || data.uf || '',
              cep: prev.cep || data.cep || '',
            }));
          }
        } else if (rawUf.length === 2 && rawCidade.length >= 3 && rawStreet.length >= 3) {
          const streetQuery = rawStreet.split(',')[0].replace(/^(rua|av\.?|avenida|alameda|travessa)\s+/i, '').trim();
          if (streetQuery.length < 3) return;
          const res = await fetch(
            `https://viacep.com.br/ws/${encodeURIComponent(rawUf)}/${encodeURIComponent(rawCidade)}/${encodeURIComponent(streetQuery)}/json/`
          );
          if (!res.ok) return;
          const list = await res.json();
          const first = Array.isArray(list) ? list[0] : null;
          if (!isCancelled && first && !first.erro) {
            setAdminSettings((prev) => ({
              ...prev,
              bairro: prev.bairro || first.bairro || '',
              cep: prev.cep || first.cep || '',
            }));
          }
        }
      } catch {
        // ignore network errors
      }
    };

    enrichFromViaCep();
    return () => {
      isCancelled = true;
    };
  }, [adminSettings.cep, adminSettings.salonAddress, adminSettings.cidade, adminSettings.uf, adminSettings.bairro, initialSalonData]);

  const salonInfo = useMemo(() => {
    const activeAmenityLabels =
      Array.isArray(adminSettings.amenities) && adminSettings.amenities.length > 0
        ? adminSettings.amenities
        : DEFAULT_SPACE_AMENITIES;

    const mappedAmenities = activeAmenityLabels.map((label) => ({
      icon: resolveSpaceAmenityIcon(label),
      label,
    }));

    const rawStreet = (adminSettings.salonAddress || initialSalonData?.address || primaryOffer?.salonAddress || '').trim();
    const rawNum = (adminSettings.numero || initialSalonData?.street_number || initialSalonData?.branding?.numero || '').trim();
    const rawComp = (adminSettings.complemento || initialSalonData?.complement || initialSalonData?.branding?.complemento || '').trim();
    const rawBairro = (adminSettings.bairro || initialSalonData?.neighborhood || initialSalonData?.branding?.bairro || '').trim();
    const rawCidade = (adminSettings.cidade || initialSalonData?.city || initialSalonData?.branding?.cidade || '').trim();
    const rawUf = (adminSettings.uf || initialSalonData?.state || initialSalonData?.branding?.uf || '').trim();
    const rawCep = (adminSettings.cep || initialSalonData?.cep || initialSalonData?.branding?.cep || '').trim();

    const hasInlineNumber = /,\s*\d+|n[º°]\s*\d+|\bs\/n\b/i.test(rawStreet);
    const streetWithNumber = rawStreet
      ? rawNum && !rawStreet.toLowerCase().includes(rawNum.toLowerCase())
        ? `${rawStreet}, ${rawNum}`
        : hasInlineNumber
        ? rawStreet
        : `${rawStreet}, s/n`
      : '';

    const cityUfPart = rawCidade && rawUf ? `${rawCidade}-${rawUf}` : (rawCidade || rawUf);
    const cepPart = rawCep ? `CEP ${rawCep}` : '';

    const completeAddressParts = [
      streetWithNumber,
      rawComp && !streetWithNumber.toLowerCase().includes(rawComp.toLowerCase()) ? rawComp : '',
      rawBairro && !streetWithNumber.toLowerCase().includes(rawBairro.toLowerCase()) ? rawBairro : '',
      cityUfPart && (!rawCidade || !streetWithNumber.toLowerCase().includes(rawCidade.toLowerCase())) ? cityUfPart : '',
      cepPart && (!rawCep || !streetWithNumber.toLowerCase().includes(rawCep.toLowerCase())) ? cepPart : '',
    ].filter(Boolean);

    const formattedFullAddress =
      adminSettings.operatingModel === 'home_delivery' && adminSettings.homeDeliverySettings?.areaDescription
        ? `Atendimento em Domicílio • ${adminSettings.homeDeliverySettings.areaDescription}`
        : completeAddressParts.join(', ');

    return {
      name: adminSettings.salonName || salonName,
      avatar: adminSettings.salonIcon || activeLogo || (hasActiveSubdomain ? '' : DEFAULT_ROTA99_ICON),
      coverImage: primaryOffer?.galleryImages?.[0] || primaryOffer?.imageUrl || 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80',
      rating: primaryOffer?.rating || 4.9,
      reviewsCount: primaryOffer?.reviewsCount || 84,
      distance: primaryOffer?.distance || '850m',
      address: formattedFullAddress || rawStreet,
      fullAddress: formattedFullAddress || rawStreet,
      city: rawCidade && rawUf ? `${rawCidade}-${rawUf}` : '',
      phone: adminSettings.salonPhone || '',
      hours: adminSettings.openingHours || 'Seg a Sáb: 09:00 às 20:00',
      verified: true,
      isHomeCare: adminSettings.operatingModel === 'home_delivery' || !!adminSettings.homeDeliverySettings?.enabled,
      description:
        adminSettings.spaceDescription ||
        adminSettings.bio ||
        primaryOffer?.description ||
        'Espaço premium especializado em estética masculina e feminina de alta precisão, barboterapia, cortes modernos e bem-estar.',
      amenities: mappedAmenities,
      professionals: professionalsList,
    };
  }, [salonName, primaryOffer, adminSettings, professionalsList, activeLogo, hasActiveSubdomain, initialSalonData]);

  const hasMultipleProfessionals = salonInfo.professionals.length > 1;
  const spaceTabLabel = salonInfo.isHomeCare ? 'Atendimento' : 'Espaço';
  const SpaceIcon = salonInfo.isHomeCare ? Car : Store;

  // Ícone da aba Serviços no modo cliente representando o layout em grade da seção
  const ServicesIcon = LayoutGrid;

  // Navegação direta entre abas tanto no modo público quanto no modo gerenciamento (sem efeito swap vertical)
  const handleSelectTab = useCallback((tab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades' | 'dados' | 'visual' | 'preferencias' | 'layout' | 'pausar') => {
    // Ação do Botão Pausar Agendamentos (Abre Modal de Emergência)
    if (tab === 'pausar') {
      if (!isOwnerOrManager && !isProfessional) {
        setIsClientAuthModalOpen(true);
        return;
      }
      hapticLight();
      setIsPauseSlotsModalOpen(true);
      return;
    }

    // Abas de gestão só para owner e manager
    if (tab === 'caixa' || tab === 'financeiro' || tab === 'utilidades' || tab === 'personalizar' || tab === 'equipe' || tab === 'dados' || tab === 'visual' || tab === 'preferencias' || tab === 'layout') {
      if (!isOwnerOrManager) {
        setIsClientAuthModalOpen(true);
        return;
      }
      setActiveTab(tab);
      return;
    }

    if (tab === 'espaco') {
      if (isGerMode) {
        if (!isOwnerOrManager) {
          setActiveTab('home');
          return;
        }
        setActiveTab('espaco');
        return;
      }
      setActiveTab('espaco');
      setEspacoSlideIndex(0);
      return;
    }

    if (tab === 'servicos') {
      if (isGerMode) {
        if (!isOwnerOrManager) {
          setIsClientAuthModalOpen(true);
          return;
        }
        setActiveTab('servicos');
        return;
      }
      setActiveTab('servicos');
      return;
    }

    if (tab === 'vagas' && !isGerMode) {
      if (!isUserLoggedInState && !checkHasActiveSession()) {
        setBookingService(null);
        pendingBookingAuthRef.current = true;
        setIsClientAuthModalOpen(true);
        return;
      }
      setBookingService(null);
      setActiveTab('vagas');
      return;
    }

    setActiveTab(tab);
  }, [isGerMode, isOwnerOrManager, isUserLoggedInState, checkHasActiveSession]);

  // Retorna diretamente para a tela de Opções do Menu (ProfileDrawer) sem fechar o menu por completo
  const handleBackToMenu = useCallback(() => {
    hapticLight();
    setActiveTab('home');
    setProfileDrawerInitialTab('menu');
    setIsProfileDrawerOpen(true);
  }, []);

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
    setResumeDraftTarget(null);
    const chosenService = srv || catalogServices[0];
    setBookingService(chosenService);
    setSkipDateStep(directToTimeGrid);
    setSelectedTimeSlotForBooking(timeSlot || null);
    if (dateIso) {
      setSelectedCalendarDateIso(dateIso);
    }

    // Bloqueio obrigatório: cliente pode navegar na vitrine, mas ao clicar em agendar deve fazer login ou cadastro
    if (!isGerMode && !isUserLoggedInState && !checkHasActiveSession()) {
      pendingBookingAuthRef.current = true;
      setIsClientAuthModalOpen(true);
      return;
    }

    setBookingTrigger((prev) => prev + 1);
    setActiveTab('vagas');
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

  const handleConfirmSchedule = async (bookingData: {
    service: CatalogServiceItem;
    professional: string;
    professionalAvatar?: string;
    dateIso: string;
    dateFormatted: string;
    timeSlot: string;
    salonName: string;
    salonAddress: string;
    price: number;
    offerId?: string;
    isDependentBooking?: boolean;
    dependentId?: string;
    dependentName?: string;
    clientPhone?: string;
    notes?: string;
    distanceKm?: number;
    etaMinutes?: number;
    prepBufferMinutes?: number;
    transportMode?: 'driving' | 'motorcycle' | 'walking' | 'bicycling' | 'transit';
    uiTransportMode?: TransportMode;
    maxDepartureTime?: string;
    originFormattedAddress?: string;
    originLat?: number;
    originLng?: number;
    salonLat?: number;
    salonLng?: number;
    selectedRouteSummary?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const rawCode = `VGA-${Math.floor(10000 + Math.random() * 90000)}`;

      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        let rawClientSession: any = null;
        try {
          const s = localStorage.getItem('vagou_client_session');
          if (s) rawClientSession = JSON.parse(s);
        } catch {}

        const rawStoredClientId = (localStorage.getItem('vagou_client_id') || rawClientSession?.id || rawClientSession?.clientId || '').trim();
        const storedClientId = rawStoredClientId.startsWith('guest-') ? '' : rawStoredClientId;
        const storedEmail = (localStorage.getItem('vagou_user_email') || localStorage.getItem('vagou_active_partner') || rawClientSession?.email || '').trim();
        const storedPhone = (localStorage.getItem('vagou_user_phone') || rawClientSession?.phone || bookingData.clientPhone || '').trim();
        const storedName = (localStorage.getItem('vagou_user_name') || rawClientSession?.name || currentUserName || 'Cliente').trim();

        if (!session?.user && !storedClientId && !storedEmail) {
          setIsClientAuthModalOpen(true);
          return { success: false, error: 'Faça login ou cadastre-se para realizar o agendamento.' };
        }

        // Garante linha do cliente em public.clients
        let clientRow: any = null;
        if (session?.user?.id) {
          const { data: existingClient } = await (supabase.from('clients') as any)
            .select('id, name, phone, email')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (existingClient) {
            clientRow = existingClient;
          } else {
            const ensured = await ensureClientRow(session.user.id, session.user.email, session.user.user_metadata);
            clientRow = ensured.client;
          }
        } else if (storedClientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storedClientId)) {
          const { data: existingClient } = await (supabase.from('clients') as any)
            .select('id, name, phone, email')
            .eq('id', storedClientId)
            .maybeSingle();
          if (existingClient) clientRow = existingClient;
        } else if (storedEmail) {
          const { data: existingClient } = await (supabase.from('clients') as any)
            .select('id, name, phone, email')
            .ilike('email', storedEmail)
            .maybeSingle();
          if (existingClient) clientRow = existingClient;
        }

        if (!clientRow?.id) {
          const { data: newClient, error: clientErr } = await (supabase.from('clients') as any)
            .insert({
              name: storedName || 'Cliente',
              email: storedEmail || null,
              phone: storedPhone || null,
            })
            .select('id, name, phone, email')
            .maybeSingle();
          if (newClient) {
            clientRow = newClient;
            try { localStorage.setItem('vagou_client_id', newClient.id); } catch {}
          } else {
            console.warn('Inserção remota de cliente bloqueada por RLS ou offline:', clientErr);
            // Fallback resiliente para garantir agendamento sem travar cliente
            const fallbackClientId = localStorage.getItem('vagou_client_id') || `guest-${Date.now()}`;
            clientRow = {
              id: fallbackClientId,
              name: storedName || currentUserName || 'Cliente',
              phone: storedPhone || null,
              email: storedEmail || null,
            };
            try { localStorage.setItem('vagou_client_id', fallbackClientId); } catch {}
          }
        }

        const finalClientName = bookingData.isDependentBooking && bookingData.dependentName
          ? bookingData.dependentName
          : (clientRow.name || storedName || currentUserName || 'Cliente');
        const finalPhone = (bookingData.clientPhone || clientRow.phone || storedPhone || 'Não informado').trim();

        // Determina horário de início e fim
        const [h, m] = bookingData.timeSlot.split(':').map(Number);
        const startTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
        const endMinutes = (h * 60 + m) + 45;
        const endH = Math.floor(endMinutes / 60) % 24;
        const endM = endMinutes % 60;
        const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

        // Localiza salon_id do banco com fallback resiliente
        let targetSalonId = currentSalonDbId || initialSalonData?.id || localStorage.getItem('vagou_salon_db_id');
        if (!targetSalonId || targetSalonId === 'temp') {
          const activeSlug = activeSubdomain || localStorage.getItem('vagou_salon_slug') || adminSettings.salonSlug || '';
          if (activeSlug) {
            const { data: foundSalon } = await (supabase.from('salons') as any)
              .select('id')
              .eq('slug', activeSlug)
              .maybeSingle();
            if (foundSalon?.id) targetSalonId = foundSalon.id;
          }
        }

        const appointmentPayload: Record<string, any> = {
          protocol_code: `#${rawCode}`,
          salon_id: targetSalonId,
          offer_id: bookingData.offerId || null,
          client_id: clientRow.id,
          client_name: finalClientName,
          client_phone: finalPhone,
          client_email: session?.user?.email || storedEmail || clientRow?.email || null,
          service_title: bookingData.service.title,
          service_category: bookingData.service.category || 'cabelo',
          price: bookingData.price,
          date_str: bookingData.dateIso,
          start_time: startTimeStr,
          end_time: endTimeStr,
          status: 'CONFIRMADO',
          notes: bookingData.notes || null,
          is_dependent: Boolean(bookingData.isDependentBooking),
          dependent_id: bookingData.isDependentBooking && bookingData.dependentId ? bookingData.dependentId : null,
          dependent_name: bookingData.isDependentBooking && bookingData.dependentName ? bookingData.dependentName : null,
          distance_km: bookingData.distanceKm ?? 4.2,
          eta_minutes: bookingData.etaMinutes ?? 15,
          prep_buffer_minutes: bookingData.prepBufferMinutes ?? 15,
          transport_mode: bookingData.transportMode || 'driving',
          selected_route_summary: bookingData.selectedRouteSummary || null,
        };

        let { error: insertErr } = await (supabase.from('appointments') as any)
          .insert(appointmentPayload)
          .select()
          .single();

        // Fallback resiliente caso o banco remoto ainda não possua todas as colunas extras de bol-020
        if (insertErr && (insertErr.code === 'PGRST204' || insertErr.code === '42703' || insertErr.message?.includes('column'))) {
          const fallbackPayload = { ...appointmentPayload };
          delete fallbackPayload.is_dependent;
          delete fallbackPayload.dependent_id;
          delete fallbackPayload.dependent_name;
          delete fallbackPayload.distance_km;
          delete fallbackPayload.eta_minutes;
          delete fallbackPayload.prep_buffer_minutes;
          delete fallbackPayload.transport_mode;
          delete fallbackPayload.selected_route_summary;
          const retry = await (supabase.from('appointments') as any)
            .insert(fallbackPayload)
            .select()
            .single();
          insertErr = retry.error;
        }

        if (insertErr) {
          console.warn('Aviso de inserção de agendamento:', insertErr);
          // Se for erro de RLS Policy (42501), assegura resiliência total gravando em localStorage sem travar a interface
          if (insertErr.code === '42501' || insertErr.message?.includes('row-level security')) {
            console.warn('⚠️ Supabase RLS Policy bloqueou gravação remota (42501). Salvando em modo offline resiliente.');
          } else {
            return { success: false, error: insertErr.message || 'Falha ao gravar agendamento no banco.' };
          }
        }
      }

      hapticSuccess();
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
      }

      // Salvar nos agendamentos do usuário para visualização em Minha Agenda (com dados BOL-020 + Dependente)
      try {
        const savedList = JSON.parse(localStorage.getItem('vagou_user_appointments') || '[]');
        const newRecord: BookingAppointment = {
          protocolCode: rawCode,
          service: bookingData.service.title,
          serviceTitle: bookingData.service.title,
          professional: bookingData.professional,
          professionalName: bookingData.professional,
          salonName: bookingData.salonName,
          dateTime: `${bookingData.dateFormatted} às ${bookingData.timeSlot}`,
          dayGroup: bookingData.dateFormatted,
          dateIso: bookingData.dateIso,
          time: bookingData.timeSlot,
          totalPrice: bookingData.price,
          status: 'CONFIRMADO',
          address: bookingData.salonAddress,
          is_dependent: Boolean(bookingData.isDependentBooking),
          dependent_name: bookingData.dependentName,
          distance_km: bookingData.distanceKm ?? 4.2,
          eta_minutes: bookingData.etaMinutes ?? 15,
          prep_buffer_minutes: bookingData.prepBufferMinutes ?? 15,
          transport_mode: bookingData.transportMode || 'driving',
          selected_route_summary: bookingData.selectedRouteSummary,
          ...(bookingData.originLat ? { originLat: bookingData.originLat, client_lat: bookingData.originLat } : {}),
          ...(bookingData.originLng ? { originLng: bookingData.originLng, client_lng: bookingData.originLng } : {}),
          ...(bookingData.salonLat ? { salonLat: bookingData.salonLat } : {}),
          ...(bookingData.salonLng ? { salonLng: bookingData.salonLng } : {}),
          ...(bookingData.originFormattedAddress ? { originFormattedAddress: bookingData.originFormattedAddress } : {}),
          ...(bookingData.maxDepartureTime ? { maxDepartureTime: bookingData.maxDepartureTime } : {}),
        } as BookingAppointment;
        const updatedApts = [newRecord, ...savedList];
        localStorage.setItem('vagou_user_appointments', JSON.stringify(updatedApts));
        setAppointmentsList(updatedApts);
      } catch {
        // ignore
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha inesperada ao agendar.' };
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

  // Controles de swipe/swap para os três blocos da Seção Espaço (0: Estrutura, 1: Estúdio 3D, 2: Localização & Radar)
  const handleNextEspacoSlide = () => {
    setEspacoSwipeDirection(1);
    setEspacoSlideIndex((prev) => (prev + 1) % 3);
  };

  const handlePrevEspacoSlide = () => {
    setEspacoSwipeDirection(-1);
    setEspacoSlideIndex((prev) => (prev - 1 + 3) % 3);
  };

  const sectionHeaderStyleData = useMemo(() => {
    return getSectionHeaderStyleData(adminSettings, isDark);
  }, [adminSettings, isDark]);

  if (isLoadingSalon && hasActiveSubdomain) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 font-['Poppins']">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#F7F9FC] text-[#333E48]'} font-sans transition-colors duration-200`}>
      {/* 1. CABEÇALHO DO APLICATIVO DO SALÃO (Padrão Institucional Mobile-First) */}
      <MobileHeader
        currentUser={{
          name: isUserLoggedInState && currentUserName ? currentUserName : 'Visitante',
          avatarUrl: currentUserAvatarUrl,
          jobTitle: isGerMode ? (isActiveProAdmin ? 'Proprietário / Gestor' : 'Profissional') : 'Usuário',
          companyName: salonInfo.name,
        }}
        logoUrl={adminSettings?.salonLogo || adminSettings?.salonLogoLight || adminSettings?.salonLogoDark || salonInfo?.avatar || salonInfo?.avatarUrl || ''}
        isGerMode={isGerMode}
        isSalonLoggedIn={isSalonLoggedIn}
        isProAdmin={isActiveProAdmin}
        userRole={
          !isGerMode
            ? 'COLLABORATOR'
            : activeTab === 'personalizar' || activeTab === 'dados' || activeTab === 'visual' || activeTab === 'layout' || activeTab === 'preferencias'
            ? 'SUPER_ADMIN'
            : 'MANAGER'
        }
        onChangeRole={(role: HeaderUserRole) => {
          hapticLight();
          if (role === 'COLLABORATOR') {
            setIsPublicPreviewMode(true);
            setActiveTab('home');
          } else if (role === 'MANAGER') {
            if (!isSalonLoggedIn) {
              setIsClientAuthModalOpen(true);
              return;
            }
            setIsPublicPreviewMode(false);
            setActiveTab('home');
          } else if (role === 'SUPER_ADMIN') {
            if (!isSalonLoggedIn) {
              setIsClientAuthModalOpen(true);
              return;
            }
            setIsPublicPreviewMode(false);
            setActiveTab('personalizar');
          }
        }}
        onLogout={() => {
          hapticMedium();
          if (isUserLoggedInState || isSalonLoggedIn) {
            handleSalonLogout();
          } else {
            setIsClientAuthModalOpen(true);
          }
        }}
        onOpenUserSection={(section) => {
          hapticLight();
          if (section === 'ALTERNAR_MODO') {
            setIsPublicPreviewMode(!isPublicPreviewMode);
            setActiveTab('home');
          } else if (section === 'MENU_COMPLETO') {
            setProfileDrawerInitialTab('menu');
            setIsProfileDrawerOpen(true);
          } else if (section === 'MINHA_AGENDA') {
            if (onNavigateToUserAppointments) {
              onNavigateToUserAppointments();
            } else {
              setProfileDrawerInitialTab('agenda');
              setIsProfileDrawerOpen(true);
            }
          } else if (section === 'TRAJETO_GPS') {
            setProfileDrawerInitialTab('trajeto');
            setIsProfileDrawerOpen(true);
          } else if (section === 'DEPENDENTES') {
            setProfileDrawerInitialTab('dependentes');
            setIsProfileDrawerOpen(true);
          } else if (section === 'DADOS_PESSOAIS') {
            if (onNavigateToUserDashboard) {
              onNavigateToUserDashboard();
            } else {
              setProfileDrawerInitialTab('dados');
              setIsProfileDrawerOpen(true);
            }
          } else if (section === 'CHAT_VAGOU') {
            setProfileDrawerInitialTab('chat');
            setIsProfileDrawerOpen(true);
          } else if (section === 'PRO_SERVICOS') {
            handleSelectTab('servicos');
          } else if (section === 'PRO_ESPACO') {
            handleSelectTab('espaco');
          } else if (section === 'PRO_EQUIPE') {
            handleSelectTab('equipe');
          } else if (section === 'PRO_PREFERENCIAS') {
            handleSelectTab('preferencias');
          } else if (section === 'PRO_UTILIDADES') {
            handleSelectTab('utilidades');
          }
        }}
      />

      {/* 2. ÁREA DE CONTEÚDO */}
      {isGerMode ? (
        /* MODO GERENCIAMENTO: TELAS DEDICADAS COM NAVEGAÇÃO EXCLUSIVAMENTE POR BOTÕES (COM BARRA DE ROLAGEM VERTICAL) */
        <main className="flex-1 min-h-0 w-full relative app-vertical-scroll flex flex-col">
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
                salonName={salonInfo.name}
                adminSettings={adminSettings}
              />
            </div>
          )}

          {(activeTab === 'personalizar' || activeTab === 'preferencias' || activeTab === 'dados' || activeTab === 'visual' || activeTab === 'layout' || activeTab === 'servicos' || activeTab === 'espaco' || activeTab === 'equipe') && (
            <div className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-start animate-in fade-in duration-150">
              <SalonCustomizationHub
                initialSubTab={
                  activeTab === 'servicos' ? 'servicos' :
                  activeTab === 'equipe' ? 'equipe' :
                  activeTab === 'espaco' ? 'espaco' :
                  activeTab === 'visual' ? 'visual' :
                  activeTab === 'dados' ? 'dados' :
                  activeTab === 'layout' ? 'layout' :
                  'hub'
                }
                adminSettings={adminSettings}
                onUpdateSettings={handleUpdateSettings}
                services={catalogServicesList}
                onUpdateServices={handleUpdateServices}
                professionals={professionalsList}
                onUpdateProfessionals={handleUpdateProfessionals}
                appointments={appointmentsList}
                onUpdateAppointments={handleUpdateAppointments}
                onBack={handleBackToMenu}
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
                onBack={handleBackToMenu}
                adminSettings={adminSettings}
                onUpdateSettings={handleUpdateSettings}
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
                adminSettings={adminSettings}
                onUpdateSettings={handleUpdateSettings}
                onBack={handleBackToMenu}
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
                adminSettings={adminSettings}
                onUpdateSettings={handleUpdateSettings}
                onBack={handleBackToMenu}
              />
            </div>
          )}
        </main>
      ) : (
        /* MODO PÚBLICO / CLIENTE: NAVEGAÇÃO POR ABAS DEDICADAS COM BARRA DE ROLAGEM VERTICAL */
        <main className="flex-1 min-h-0 w-full flex flex-col app-vertical-scroll relative">
          {/* SEÇÃO 1: INÍCIO */}
          {activeTab === 'home' && (
            <section
              id="section-home"
              data-tab-id="home"
              className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-between animate-in fade-in duration-150"
            >
              {/* SLIDER / CARROSSEL PUBLICITÁRIO OU PAINEL DIRETO */}
              {adminSettings.showHeroSlides !== false ? (
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
              ) : (
                <div className={`relative w-full h-full flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 sm:p-6 flex flex-col justify-between ${
                  isDark 
                    ? 'bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 text-slate-100 border-b border-slate-800' 
                    : 'bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 border-b border-slate-200'
                }`}>
                  <div className="space-y-4 max-w-lg mx-auto w-full pt-4">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider font-['Poppins']">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{adminSettings.category || 'Atendimento Oficial'}</span>
                      </div>
                      <h2 
                        className={`text-2xl sm:text-3xl font-black tracking-tight leading-tight font-['Poppins'] ${
                          isDark ? 'text-white' : 'text-slate-900'
                        }`}
                        style={{ fontFamily: activeBrandFontFamily }}
                      >
                        {adminSettings.logoTextFallback || salonInfo.name}
                      </h2>
                      {adminSettings.showSlogan !== false && adminSettings.slogan && (
                        <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
                          {adminSettings.slogan}
                        </p>
                      )}
                    </div>

                    {/* Atalhos Rápidos para Agendamento e Serviços */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          handleSelectTab('servicos');
                        }}
                        className="p-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-between shadow-xs transition active:scale-95 cursor-pointer font-['Poppins']"
                      >
                        <span className="text-white">Ver Catálogo de Serviços</span>
                        <Scissors className="w-4 h-4 text-white" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          handleSelectTab('vagas');
                        }}
                        className={`p-3 rounded-[4px] border font-bold text-xs flex items-center justify-between transition active:scale-95 cursor-pointer font-['Poppins'] ${
                          isDark 
                            ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-emerald-500/40' 
                            : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500/40 shadow-xs'
                        }`}
                      >
                        <span>Consultar Horários</span>
                        <Calendar className="w-4 h-4 text-emerald-400" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-slate-800/40 text-[11px] text-slate-400 max-w-lg mx-auto w-full">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {salonInfo.isOpenNow ? 'Aberto Agora' : 'Fechado no Momento'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        handleSelectTab('espaco');
                      }}
                      className="text-emerald-400 hover:underline font-bold cursor-pointer"
                    >
                      Ver equipe & espaço
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SEÇÃO 2: SERVIÇOS */}
          {activeTab === 'servicos' && (
            <section
              id="section-servicos"
              data-tab-id="servicos"
              className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-between animate-in fade-in duration-150"
            >
          {/* Subcabeçalho de Título da Seção: Serviços */}
          <div className={sectionHeaderStyleData.containerClass} style={sectionHeaderStyleData.containerStyle}>
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 shrink-0" style={sectionHeaderStyleData.iconStyle} />
              <h2 className={`text-xs sm:text-sm font-bold font-['Poppins'] ${
                !adminSettings.sectionHeaderTextColor ? (isDark ? 'text-white' : 'text-slate-900') : ''
              }`} style={sectionHeaderStyleData.titleStyle}>
                Catálogo de Serviços
              </h2>
            </div>
          </div>

          {/* PASSO 1: Seleção de Profissional (Visível Apenas se Múltiplos Profissionais) */}
          {hasMultipleProfessionals && (
            <div className={`w-full shrink-0 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-[#F7F9FC] border-[#EDF2F7]'} p-3 flex flex-col gap-2`}>
              <h3 className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-[#5F6C7B]'}`}>
                1. Com quem deseja agendar?
              </h3>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory">
                {/* Qualquer Profissional Livre */}
                <button
                  type="button"
                  onClick={() => setSelectedPublicProfessional('any')}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] snap-center transition cursor-pointer ${
                    selectedPublicProfessional === 'any'
                      ? 'bg-[#2B82C9] text-white font-bold shadow-xs'
                      : isDark
                        ? 'bg-slate-800 border border-slate-700 text-slate-300'
                        : 'bg-[#FFFFFF] border border-[#E2E8F0] text-[#5F6C7B]'
                  }`}
                >
                  <Users className={`w-3.5 h-3.5 shrink-0 ${selectedPublicProfessional === 'any' ? 'text-white' : 'text-[#2B82C9]'}`} />
                  <span className={`text-[11px] whitespace-nowrap ${selectedPublicProfessional === 'any' ? 'text-white font-bold' : ''}`}>
                    Qualquer Livre
                  </span>
                </button>

                {/* Lista de Profissionais */}
                {professionalsList.map(prof => {
                  const isSelected = selectedPublicProfessional === prof.name;
                  return (
                    <button
                      key={prof.id || prof.name}
                      type="button"
                      onClick={() => setSelectedPublicProfessional(prof.name)}
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] snap-center transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#2B82C9] text-white font-bold shadow-xs'
                          : isDark
                            ? 'bg-slate-800 border border-slate-700 text-slate-300'
                            : 'bg-[#FFFFFF] border border-[#E2E8F0] text-[#5F6C7B]'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-white/20">
                        {prof.avatar || prof.avatarUrl ? (
                          <img src={prof.avatar || prof.avatarUrl} alt={prof.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-[#2B82C9]'}`} />
                        )}
                      </div>
                      <span className={`text-[11px] whitespace-nowrap ${isSelected ? 'text-white font-bold' : ''}`}>
                        {prof.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

              {/* Grid de Serviços Fullwidth */}
              <div className="relative overflow-hidden select-none w-full flex-1 min-h-0 flex flex-col justify-between">
                {catalogServices.length === 0 ? (
                  <div className={`w-full flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 ${
                    isDark ? 'bg-slate-950 text-slate-200' : 'bg-[#F7F9FC] text-[#1E293B]'
                  }`}>
                    <div className="caixa-icon-halo">
                      <Scissors className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 max-w-xs">
                      <h3 className="text-sm font-bold font-display">
                        Catálogo em atualização
                      </h3>
                      <p className="text-xs text-[#5F6C7B]">
                        Os serviços e valores deste estabelecimento estão sendo configurados.
                      </p>
                    </div>
                    {!isUserLoggedInState && (
                      <button
                        type="button"
                        onClick={() => setIsClientAuthModalOpen(true)}
                        className="mt-1 px-4 py-2 rounded-[4px] bg-[#2B82C9] hover:bg-[#004A88] text-white font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                      >
                        <span className="text-white">Sou o Proprietário • Entrar</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className={`grid grid-cols-2 grid-rows-2 gap-2 p-2.5 w-full flex-1 min-h-0 ${
                      isDark ? 'bg-slate-950' : 'bg-[#F7F9FC]'
                    }`}
                  >
                    {currentServices.map((srv) => (
                      <div
                        key={srv.id}
                        onClick={() => handleOpenBooking(srv)}
                        className="caixa-tile group relative overflow-hidden transition-all duration-200 cursor-pointer bg-slate-950 h-full w-full rounded-[4px]"
                        title={`${srv.title} - R$ ${srv.price}`}
                      >
                        {/* Imagem, Slideshow de até 5 fotos ou Vídeo de 5s */}
                        <div className="relative w-full h-full overflow-hidden bg-slate-950 rounded-[4px]">
                          <ServiceCardMedia service={srv} />

                          {/* Gradiente Cinematográfico Escuro para Máximo Contraste */}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-black/25 group-hover:via-slate-950/65 transition-colors duration-300 pointer-events-none" />

                          {/* Topo do Card: Badge de Categoria */}
                          <div className="absolute top-2 left-2 right-2 z-10 pointer-events-none flex items-center justify-between gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-slate-950/85 backdrop-blur-md border border-white/15 text-white text-[9px] font-bold uppercase tracking-wider shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#39B29B]" />
                              {srv.category}
                            </span>
                          </div>

                          {/* Base do Card: Título + Preço */}
                          <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 z-10 flex flex-col justify-end pointer-events-none">
                            <h3 className="text-xs sm:text-[13px] font-bold text-white tracking-tight leading-tight line-clamp-1 font-display drop-shadow-xs">
                              {srv.title}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[#39B29B] font-mono-tabular font-black text-xs sm:text-sm tracking-tight drop-shadow-xs">
                                R$ {srv.price}
                              </span>
                              {srv.duration && (
                                <span className="text-[10px] text-slate-200 font-medium">
                                  • {srv.duration}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Barra de Paginação e Navegação */}
                {totalServicePages > 1 && (
                  <div
                    className={`w-full px-4 py-2 flex items-center justify-between border-t transition-colors select-none shrink-0 ${
                      isDark
                        ? 'bg-slate-950 border-slate-800/80 text-white'
                        : 'bg-[#FFFFFF] border-[#EDF2F7] text-[#1E293B]'
                    }`}
                  >
                    {/* Indicador de Página e Total */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] border text-xs font-bold font-mono-tabular ${
                          isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-200'
                            : 'bg-[#F7F9FC] border-[#D5E0EC] text-[#1E293B]'
                        }`}
                      >
                        <span className="text-[#2B82C9] font-extrabold">{servicePage + 1}</span>
                        <span className="text-[#94A3B8]">/</span>
                        <span className="text-[#5F6C7B]">{totalServicePages}</span>
                      </div>
                      <span
                        className={`text-[11px] font-semibold tracking-wide uppercase ${
                          isDark ? 'text-slate-300' : 'text-[#5F6C7B]'
                        }`}
                      >
                        Procedimentos
                      </span>
                    </div>

                    {/* Controles de Navegação com Setas */}
                    <div className="flex items-center gap-2">
                      {/* Botão Anterior */}
                      <button
                        type="button"
                        onClick={handlePrevServicePage}
                        className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition-all cursor-pointer ${
                          isDark
                            ? 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 active:scale-95'
                            : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#1E293B] border border-[#E2E8F0] active:scale-95'
                        }`}
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* Indicadores */}
                      <div className="flex items-center gap-1 px-1">
                        {Array.from({ length: totalServicePages }).map((_, dotIdx) => (
                          <button
                            key={dotIdx}
                            type="button"
                            onClick={() => {
                              setSwapDirection(dotIdx > servicePage ? 1 : -1);
                              setServicePage(dotIdx);
                            }}
                            className={`transition-all rounded-[4px] cursor-pointer ${
                              dotIdx === servicePage
                                ? 'w-5 h-2 bg-[#2B82C9]'
                                : isDark
                                ? 'w-2 h-2 bg-slate-800 hover:bg-slate-700'
                                : 'w-2 h-2 bg-[#D5E0EC] hover:bg-[#94A3B8]'
                            }`}
                            aria-label={`Ir para página ${dotIdx + 1}`}
                          />
                        ))}
                      </div>

                      {/* Botão Próximo */}
                      <button
                        type="button"
                        onClick={handleNextServicePage}
                        className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition-all cursor-pointer ${
                          isDark
                            ? 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 active:scale-95'
                            : 'bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#1E293B] border border-[#E2E8F0] active:scale-95'
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
          )}

          {/* SEÇÃO 3: AGENDAR (SEÇÃO EM TELA INTEIRA SOBRE #F7F9FC COM BOTÃO VOLTAR) */}
          {activeTab === 'vagas' && (
            <section
              id="section-vagas"
              data-tab-id="vagas"
              className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-start bg-[#F7F9FC] dark:bg-slate-950 animate-in fade-in duration-150"
            >
              {/* Subcabeçalho de Título da Seção: Agendamento com Botão Voltar */}
              <div className={sectionHeaderStyleData.containerClass} style={sectionHeaderStyleData.containerStyle}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectTab('servicos')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-[4px] bg-[#FFFFFF] dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 text-[#2B82C9] dark:text-slate-200 text-xs font-bold hover:bg-[#F1F5F9] transition cursor-pointer"
                    title="Voltar para Serviços"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-[#2B82C9] dark:text-emerald-400" />
                    <span>Voltar</span>
                  </button>
                  <h2 className={`text-xs sm:text-sm font-bold font-display ${
                    !adminSettings.sectionHeaderTextColor ? (isDark ? 'text-white' : 'text-[#1E293B]') : ''
                  }`} style={sectionHeaderStyleData.titleStyle}>
                    Agendamento & Vagas
                  </h2>
                </div>
                {bookingSelectedService ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (bookingOpenModalFn) bookingOpenModalFn();
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-bold text-xs transition cursor-pointer shrink-0 whitespace-nowrap ${
                      bookingIsDependent
                        ? 'bg-[#2B82C9] text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                        : 'bg-[#FFFFFF] border border-[#E2E8F0] text-[#1E293B] hover:bg-[#F1F5F9]'
                    }`}
                    title="Alterar para quem é o agendamento"
                  >
                    {bookingIsDependent ? (
                      <Users className="w-3.5 h-3.5 text-white shrink-0" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-[#2B82C9] shrink-0" />
                    )}
                    <span className={bookingIsDependent ? 'text-white font-bold' : ''}>
                      {bookingIsDependent && bookingDependentName ? bookingDependentName : 'Para Você'}
                    </span>
                  </button>
                ) : null}
              </div>

              <div className="flex-1 min-h-0 flex flex-col justify-start overflow-hidden w-full bg-[#F7F9FC] dark:bg-slate-950">
                <SalonBookingModal
                  isOpen={true}
                  inline={true}
                  onClose={() => handleSelectTab('servicos')}
                  salonId={currentSalonDbId || salonInfo.id}
                  salonName={salonInfo.name}
                  salonSlug={adminSettings.salonSlug || activeSubdomain || ''}
                  salonAddress={
                    salonInfo.address ||
                    [adminSettings.salonAddress, adminSettings.bairro, adminSettings.cidade, adminSettings.uf].filter(Boolean).join(', ') ||
                    ''
                  }
                  salonCep={adminSettings.cep || initialSalonData?.cep || ''}
                  salonCoords={
                    initialSalonData?.latitude && initialSalonData?.longitude
                      ? { lat: Number(initialSalonData.latitude), lng: Number(initialSalonData.longitude) }
                      : undefined
                  }
                  salonLogo={activeLogo || adminSettings.salonLogo || adminSettings.salonLogoDark || adminSettings.salonLogoLight || adminSettings.salonIcon}
                  salonLogoLight={adminSettings.salonLogoLight || ''}
                  salonLogoDark={adminSettings.salonLogoDark || ''}
                  primaryColor={adminSettings.accentColor || '#2B82C9'}
                  services={catalogServices}
                  professionals={professionalsList}
                  initialService={bookingService}
                  bookingTrigger={bookingTrigger}
                  resumeDraft={resumeDraftTarget}
                  skipDateStep={skipDateStep}
                  initialTimeSlot={selectedTimeSlotForBooking}
                  initialDateIso={selectedCalendarDateIso}
                  preSelectedProfessionalName={selectedPublicProfessional}
                  onBeneficiaryState={(state) => {
                    setBookingIsDependent(state.isDependentBooking);
                    setBookingDependentName(state.dependentName);
                    setBookingSelectedService(state.selectedService);
                    setBookingOpenModalFn(() => state.openBeneficiaryModal);
                  }}
                  onDraftSaved={(draft) => setActiveBookingDraft(draft)}
                  onNavigateToAgenda={() => {
                    if (onNavigateToUserAppointments) {
                      onNavigateToUserAppointments();
                    } else {
                      setProfileDrawerInitialTab('agenda');
                      setIsProfileDrawerOpen(true);
                    }
                  }}
                  onConfirmAppointment={handleConfirmSchedule}
                />
              </div>
            </section>
          )}

          {/* SEÇÃO 4: ESPAÇO, LOCALIZAÇÃO & EQUIPE */}
          {(activeTab === 'espaco' || activeTab === 'equipe') && (
            <section
              id="section-espaco"
              data-tab-id="espaco"
              className="w-full h-full flex-1 min-h-0 overflow-hidden flex flex-col justify-start animate-in fade-in duration-150"
            >
          {/* Subcabeçalho de Título da Seção: Espaço */}
          <div className={sectionHeaderStyleData.containerClass} style={sectionHeaderStyleData.containerStyle}>
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 shrink-0" style={sectionHeaderStyleData.iconStyle} />
              <h2 className={`text-xs sm:text-sm font-bold font-['Poppins'] ${
                !adminSettings.sectionHeaderTextColor ? (isDark ? 'text-white' : 'text-slate-900') : ''
              }`} style={sectionHeaderStyleData.titleStyle}>
                Espaço, Equipe & Localização
              </h2>
            </div>
            <span className="text-[10px] font-bold border px-2 py-0.5 rounded-[4px]" style={sectionHeaderStyleData.badgeStyle}>
              Conheça o local
            </span>
          </div>

              <div className="px-3.5 sm:px-4 py-2.5 space-y-2.5 flex-1 min-h-0 flex flex-col justify-start overflow-y-auto bg-[#F7F9FC] dark:bg-slate-950">
                {/* Abas de Navegação Interna da Seção Espaço (1. Estrutura | 2. Contatos | 3. Localização) */}
                <div className="grid grid-cols-3 gap-1.5 w-full shrink-0">
                  {/* Aba 1: Estrutura */}
                  <button
                    type="button"
                    onClick={() => {
                      setEspacoSwipeDirection(0 < espacoSlideIndex ? -1 : 1);
                      setEspacoSlideIndex(0);
                    }}
                    className={`py-2 px-1 rounded-[4px] text-center transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      espacoSlideIndex === 0
                        ? 'bg-[#2B82C9] text-white font-bold shadow-xs'
                        : isDark
                          ? 'bg-slate-900/80 text-slate-400 hover:text-white font-medium border border-slate-800'
                          : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B] font-medium border border-[#E2E8F0]'
                    }`}
                  >
                    <Store className={`w-3.5 h-3.5 shrink-0 ${
                      espacoSlideIndex === 0 ? 'text-white' : 'text-[#2B82C9]'
                    }`} />
                    <span className={`text-[11px] sm:text-xs tracking-tight truncate ${
                      espacoSlideIndex === 0 ? 'text-white font-bold' : ''
                    }`}>
                      Estrutura
                    </span>
                  </button>

                  {/* Aba 2: Contatos */}
                  <button
                    type="button"
                    onClick={() => {
                      setEspacoSwipeDirection(1 < espacoSlideIndex ? -1 : 1);
                      setEspacoSlideIndex(1);
                    }}
                    className={`py-2 px-1 rounded-[4px] text-center transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      espacoSlideIndex === 1
                        ? 'bg-[#2B82C9] text-white font-bold shadow-xs'
                        : isDark
                          ? 'bg-slate-900/80 text-slate-400 hover:text-white font-medium border border-slate-800'
                          : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B] font-medium border border-[#E2E8F0]'
                    }`}
                  >
                    <Phone className={`w-3.5 h-3.5 shrink-0 ${
                      espacoSlideIndex === 1 ? 'text-white' : 'text-[#2B82C9]'
                    }`} />
                    <span className={`text-[11px] sm:text-xs tracking-tight truncate ${
                      espacoSlideIndex === 1 ? 'text-white font-bold' : ''
                    }`}>
                      Contatos
                    </span>
                  </button>

                  {/* Aba 3: Localização */}
                  <button
                    type="button"
                    onClick={() => {
                      setEspacoSwipeDirection(2 < espacoSlideIndex ? -1 : 1);
                      setEspacoSlideIndex(2);
                    }}
                    className={`py-2 px-1 rounded-[4px] text-center transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      espacoSlideIndex === 2
                        ? 'bg-[#2B82C9] text-white font-bold shadow-xs'
                        : isDark
                          ? 'bg-slate-900/80 text-slate-400 hover:text-white font-medium border border-slate-800'
                          : 'bg-[#F1F5F9] text-[#5F6C7B] hover:text-[#1E293B] font-medium border border-[#E2E8F0]'
                    }`}
                  >
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${
                      espacoSlideIndex === 2 ? 'text-white' : 'text-[#2B82C9]'
                    }`} />
                    <span className={`text-[11px] sm:text-xs tracking-tight truncate ${
                      espacoSlideIndex === 2 ? 'text-white font-bold' : ''
                    }`}>
                      Localização
                    </span>
                  </button>
                </div>

                {/* Container de Conteúdo das Abas de Espaço */}
                <div className="relative overflow-hidden select-none flex-1 min-h-0 flex flex-col justify-between">
                  <AnimatePresence mode="wait" custom={espacoSwipeDirection}>
                    {/* SLIDE 0: ESTRUTURA DO ESPAÇO */}
                    {espacoSlideIndex === 0 && (
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
                        {/* ABA 1: CARDS DE ESTRUTURA DO ESPAÇO & COMODIDADES (DIRETO NA SUPERFÍCIE - SEM CAIXA DENTRO DE CAIXA) */}
                        <div className="grid grid-cols-2 auto-rows-fr gap-2.5 flex-1 min-h-0 py-0.5">
                          {salonInfo.amenities.map((amenity, idx) => (
                            <div
                              key={idx}
                              className={`caixa-tile p-3.5 flex flex-col items-center justify-center text-center gap-2.5 ${
                                isDark ? 'text-slate-200' : 'text-[#1E293B]'
                              }`}
                            >
                              <div className="caixa-icon-halo">
                                <amenity.icon className="w-5 h-5 text-[#2B82C9] shrink-0" />
                              </div>
                              <span className="text-xs font-bold leading-snug line-clamp-2">
                                {amenity.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* SLIDE 1: CONTATOS (CARDS DIRETOS NA SUPERFÍCIE - SEM CAIXA DENTRO DE CAIXA) */}
                    {espacoSlideIndex === 1 && (
                      <motion.div
                        key="slide-espaco-contatos"
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
                        <div className="grid grid-cols-2 grid-rows-3 gap-2 flex-1 min-h-0 py-0.5">
                          {/* WhatsApp */}
                          <a
                            href={
                              adminSettings.salonPhone
                                ? `https://wa.me/55${adminSettings.salonPhone.replace(/\D/g, '')}`
                                : '#'
                            }
                            target={adminSettings.salonPhone ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            className={`caixa-tile p-2.5 flex flex-col items-center justify-center text-center gap-1 relative group ${
                              isDark ? 'text-slate-200' : 'text-[#1E293B]'
                            }`}
                          >
                            {adminSettings.salonPhone && (
                              <ExternalLink className="w-3.5 h-3.5 text-[#2B82C9] absolute top-2 right-2 shrink-0" />
                            )}
                            <div className="caixa-icon-halo">
                              <MessageCircle className="w-4 h-4 text-[#2B82C9] shrink-0" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6C7B] dark:text-slate-400 block">
                              WhatsApp
                            </span>
                            <span className="font-mono-tabular text-[11px] font-bold truncate max-w-full block">
                              {adminSettings.salonPhone || 'Não informado'}
                            </span>
                          </a>

                          {/* Telefone Fixo */}
                          <a
                            href={
                              adminSettings.phoneLandline
                                ? `tel:${adminSettings.phoneLandline.replace(/\D/g, '')}`
                                : '#'
                            }
                            className={`caixa-tile p-2.5 flex flex-col items-center justify-center text-center gap-1 relative group ${
                              isDark ? 'text-slate-200' : 'text-[#1E293B]'
                            }`}
                          >
                            {adminSettings.phoneLandline && (
                              <ExternalLink className="w-3.5 h-3.5 text-[#2B82C9] absolute top-2 right-2 shrink-0" />
                            )}
                            <div className="caixa-icon-halo">
                              <Phone className="w-4 h-4 text-[#2B82C9] shrink-0" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6C7B] dark:text-slate-400 block">
                              Telefone Fixo
                            </span>
                            <span className="font-mono-tabular text-[11px] font-bold truncate max-w-full block">
                              {adminSettings.phoneLandline || 'Não informado'}
                            </span>
                          </a>

                          {/* E-mail */}
                          <a
                            href={adminSettings.email ? `mailto:${adminSettings.email}` : '#'}
                            className={`caixa-tile p-2.5 flex flex-col items-center justify-center text-center gap-1 relative group ${
                              isDark ? 'text-slate-200' : 'text-[#1E293B]'
                            }`}
                          >
                            {adminSettings.email && (
                              <ExternalLink className="w-3.5 h-3.5 text-[#2B82C9] absolute top-2 right-2 shrink-0" />
                            )}
                            <div className="caixa-icon-halo">
                              <Mail className="w-4 h-4 text-[#2B82C9] shrink-0" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6C7B] dark:text-slate-400 block">
                              E-mail
                            </span>
                            <span className="text-[11px] font-bold truncate max-w-full block">
                              {adminSettings.email || 'Não informado'}
                            </span>
                          </a>

                          {/* Instagram */}
                          <a
                            href={
                              adminSettings.instagramUrl
                                ? adminSettings.instagramUrl.startsWith('http')
                                  ? adminSettings.instagramUrl
                                  : `https://instagram.com/${adminSettings.instagramUrl.replace(/^@/, '')}`
                                : '#'
                            }
                            target={adminSettings.instagramUrl ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            className={`caixa-tile p-2.5 flex flex-col items-center justify-center text-center gap-1 relative group ${
                              isDark ? 'text-slate-200' : 'text-[#1E293B]'
                            }`}
                          >
                            {adminSettings.instagramUrl && (
                              <ExternalLink className="w-3.5 h-3.5 text-[#2B82C9] absolute top-2 right-2 shrink-0" />
                            )}
                            <div className="caixa-icon-halo">
                              <Instagram className="w-4 h-4 text-[#2B82C9] shrink-0" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6C7B] dark:text-slate-400 block">
                              Instagram
                            </span>
                            <span className="text-[11px] font-bold truncate max-w-full block">
                              {adminSettings.instagramUrl || 'Não informado'}
                            </span>
                          </a>

                          {/* Facebook */}
                          <a
                            href={
                              adminSettings.facebookUrl
                                ? adminSettings.facebookUrl.startsWith('http')
                                  ? adminSettings.facebookUrl
                                  : `https://${adminSettings.facebookUrl}`
                                : '#'
                            }
                            target={adminSettings.facebookUrl ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            className={`caixa-tile p-2.5 flex flex-col items-center justify-center text-center gap-1 relative group ${
                              isDark ? 'text-slate-200' : 'text-[#1E293B]'
                            }`}
                          >
                            {adminSettings.facebookUrl && (
                              <ExternalLink className="w-3.5 h-3.5 text-[#2B82C9] absolute top-2 right-2 shrink-0" />
                            )}
                            <div className="caixa-icon-halo">
                              <Facebook className="w-4 h-4 text-[#2B82C9] shrink-0" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6C7B] dark:text-slate-400 block">
                              Facebook
                            </span>
                            <span className="text-[11px] font-bold truncate max-w-full block">
                              {adminSettings.facebookUrl || 'Não informado'}
                            </span>
                          </a>

                          {/* Site Oficial */}
                          <a
                            href={
                              adminSettings.websiteUrl
                                ? adminSettings.websiteUrl.startsWith('http')
                                  ? adminSettings.websiteUrl
                                  : `https://${adminSettings.websiteUrl}`
                                : '#'
                            }
                            target={adminSettings.websiteUrl ? '_blank' : undefined}
                            rel="noopener noreferrer"
                            className={`caixa-tile p-2.5 flex flex-col items-center justify-center text-center gap-1 relative group ${
                              isDark ? 'text-slate-200' : 'text-[#1E293B]'
                            }`}
                          >
                            {adminSettings.websiteUrl && (
                              <ExternalLink className="w-3.5 h-3.5 text-[#2B82C9] absolute top-2 right-2 shrink-0" />
                            )}
                            <div className="caixa-icon-halo">
                              <Globe className="w-4 h-4 text-[#2B82C9] shrink-0" />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6C7B] dark:text-slate-400 block">
                              Site
                            </span>
                            <span className="text-[11px] font-bold truncate max-w-full block">
                              {adminSettings.websiteUrl || 'Não informado'}
                            </span>
                          </a>
                        </div>
                      </motion.div>
                    )}

                    {/* SLIDE 2: LOCALIZAÇÃO, ENDEREÇO COMPLETO & MAPA OCUPANDO A MAIOR PARTE DA SEÇÃO */}
                    {espacoSlideIndex === 2 && (
                      <motion.div
                        key="slide-espaco-mapa"
                        custom={espacoSwipeDirection}
                        initial={{ opacity: 0, x: espacoSwipeDirection > 0 ? 40 : -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: espacoSwipeDirection > 0 ? -40 : 40 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="flex-1 min-h-0 flex flex-col gap-2"
                      >
                        {/* Bloco Superior Compacto: Endereço Completo (Endereço, número, Complemento, Bairro, Cidade-UF e CEP) + Horário */}
                        <div className="caixa-card p-3 space-y-1.5 shrink-0">
                          <div className="flex items-start gap-2 text-xs">
                            <MapPin className="w-4 h-4 text-[#2B82C9] shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <span className={`font-bold block leading-snug break-words ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>
                                {salonInfo.fullAddress || salonInfo.address || 'Endereço em atualização'}
                              </span>
                            </div>
                          </div>
                          <div className={`flex items-center gap-2 text-[11px] font-medium ${
                            isDark ? 'text-slate-400' : 'text-[#5F6C7B]'
                          }`}>
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-0.5" />
                            <span>{salonInfo.hours}</span>
                          </div>
                        </div>

                        {/* Mapa Interativo com Marcador do Salão, Arrasto de 1 Dedo, Zoom de 2 Dedos, KM/Tempo e Ações (No App, Google Maps, Waze) */}
                        <SalonSpaceInteractiveMap
                          salonName={salonInfo.name}
                          salonAvatar={salonInfo.avatar}
                          salonAddress={salonInfo.fullAddress || salonInfo.address}
                          salonCep={adminSettings.cep || initialSalonData?.cep}
                          initialSalonLat={
                            typeof initialSalonData?.latitude === 'number'
                              ? initialSalonData.latitude
                              : undefined
                          }
                          initialSalonLng={
                            typeof initialSalonData?.longitude === 'number'
                              ? initialSalonData.longitude
                              : undefined
                          }
                          userAvatarUrl={currentUserAvatarUrl}
                          isDark={isDark}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>
          )}
        </main>
      )}

      {/* Banner Flutuante de Pré-Agendamento Pausado (Retomada em 1 Toque) */}
      {!isGerMode && activeBookingDraft && (
        <div className={`shrink-0 z-30 px-3 py-2 border-t flex items-center justify-between gap-2 transition-colors ${
          isDark ? 'bg-slate-900 border-amber-500/40 text-white' : 'bg-amber-50 border-amber-300 text-slate-900'
        }`}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Bookmark className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold truncate">
                Pré-Agendamento: {activeBookingDraft.combinedServiceTitle}
              </div>
              <div className="text-[10px] text-amber-400 font-semibold truncate">
                {activeBookingDraft.dateFormatted} às {activeBookingDraft.timeSlot} • Não garante vaga até confirmar
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                setResumeDraftTarget({ ...activeBookingDraft });
                if (!isGerMode && !isUserLoggedInState && !checkHasActiveSession()) {
                  pendingBookingAuthRef.current = true;
                  setIsClientAuthModalOpen(true);
                  return;
                }
                setActiveTab('vagas');
              }}
              className="px-2.5 py-1 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold transition cursor-pointer whitespace-nowrap"
            >
              <span className="text-white">Retomar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                saveBookingDraft(null);
                setActiveBookingDraft(null);
                setResumeDraftTarget(null);
              }}
              className={`w-6 h-6 rounded-[4px] flex items-center justify-center transition cursor-pointer ${
                isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-amber-200/60 text-slate-700 hover:text-slate-900'
              }`}
              title="Descartar pré-agendamento"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Barra de Navegação Inferior Nativa do Estabelecimento (4 Abas: Início/Painel, Serviços/Gestão, Agendar/Agenda, Espaço/Gerenciar) */}
      {(() => {
        const isEditingMode = isGerMode && [
          'personalizar', 'preferencias', 'dados', 'visual', 'layout', 'servicos', 'espaco', 'equipe'
        ].includes(activeTab);

        const isHeroOverlay = !isGerMode && activeTab === 'home' && adminSettings.showHeroSlides !== false;

        return (
          <footer className={`w-full z-30 shrink-0 ${
            isHeroOverlay && (adminSettings.navBgStyle === 'transparent' || adminSettings.navBgStyle === 'glass')
              ? '-mt-[80px] pointer-events-none'
              : ''
          }`}>
            <div className="pointer-events-auto w-full">
              <BottomNav
                activeTab={isEditingMode ? previewTestTab : activeTab}
                onSelectTab={(tab) => {
                  if (isEditingMode) {
                    hapticLight();
                    setPreviewTestTab(tab as any);
                    return;
                  }
                  handleSelectTab(tab);
                }}
                spaceTabLabel={spaceTabLabel}
                SpaceIcon={SpaceIcon}
                ServicesIcon={ServicesIcon}
                isProfessionalMode={isEditingMode ? false : isGerMode}
                currentPersona={isEditingMode ? 'cliente' : currentPersona}
                isProAdmin={isEditingMode ? false : isActiveProAdmin}
                isOwnerOrManager={isEditingMode ? false : isGerMode}
                isProfessionalStaff={isEditingMode ? false : (isGerMode && isProfessional)}
                hasPausedSlots={hasPausedSlotsToday}
                navStyle={adminSettings.navStyle || 'minimal'}
                navShape={adminSettings.navShape || 'square'}
                navBorder={adminSettings.navBorder || 'bordered'}
                navBgStyle={adminSettings.navBgStyle || 'solid'}
                navBgColor={
                  !adminSettings.navBgColor || adminSettings.navBgColor.trim().toLowerCase() === '#f1f5f9'
                    ? '#005CA9'
                    : adminSettings.navBgColor
                }
                navBtnBgColor={adminSettings.navBtnBgColor}
                navBtnActiveBgColor={adminSettings.navBtnActiveBgColor}
                navActiveColor={adminSettings.navActiveColor || '#10b981'}
                navTextColor={adminSettings.navTextColor}
              />
            </div>
          </footer>
        );
      })()}

      {/* 2. SEÇÃO EM TELA INTEIRA DE AGENDAMENTO CONFIRMADO (SOBRE #F7F9FC) */}
      {confirmedBookingData && (
        <div className={`fixed inset-0 z-50 w-full max-w-[430px] mx-auto flex flex-col justify-between overflow-y-auto animate-in fade-in duration-200 ${
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#F7F9FC] text-[#333E48]'
        }`}>
          <div className="w-full px-4 py-3 border-b border-[#EDF2F7] dark:border-slate-800 bg-[#FFFFFF] dark:bg-slate-900 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => setConfirmedBookingData(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] bg-[#F1F5F9] dark:bg-slate-800 text-[#1E293B] dark:text-slate-200 text-xs font-bold hover:bg-[#E2E8F0] transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#2B82C9]" />
              <span>Voltar</span>
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-[#008B47]">
              Comprovante Oficial
            </span>
          </div>

          <div className="p-4 flex-1 flex flex-col items-center justify-center text-center space-y-4">
            {/* Ícone de Sucesso */}
            <div className="w-14 h-14 rounded-[4px] bg-[#008B47] text-white flex items-center justify-center shadow-xs">
              <Check className="w-8 h-8 stroke-[3] text-white" />
            </div>

            <div className="space-y-1">
              <h2 className={`text-lg font-bold font-display ${isDark ? 'text-white' : 'text-[#1E293B]'}`}>
                Agendamento confirmado!
              </h2>
              <p className="text-xs text-[#5F6C7B] max-w-xs mx-auto">
                Sua vaga está garantida. Apresente o código abaixo ao chegar no estabelecimento.
              </p>
            </div>

            {/* Card com Detalhes do Voucher (.caixa-card sem box dentro de box) */}
            <div className={`w-full p-4 text-left space-y-3 ${
              isDark ? 'bg-slate-900 border border-slate-800 rounded-[4px]' : 'caixa-card'
            }`}>
              <div className="flex items-center justify-between pb-2.5 border-b border-[#EDF2F7] dark:border-slate-800/80">
                <span className="text-xs font-bold text-[#5F6C7B]">Código Protocolo</span>
                <span className="text-xs font-mono-tabular font-bold text-white bg-[#2B82C9] px-2.5 py-1 rounded-[4px]">
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

                {confirmedBookingData.maxDepartureTime && (
                  <div className={`pt-2 border-t space-y-1.5 ${isDark ? 'border-slate-800/80' : 'border-slate-200'}`}>
                    {confirmedBookingData.originFormattedAddress && (
                      <div className="text-[11px] font-extrabold text-emerald-400 truncate">
                        {confirmedBookingData.originFormattedAddress}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Distância / Trajeto:</span>
                      </span>
                      <span className={`font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                        {(confirmedBookingData.distanceKm ?? 4.2).toFixed(1).replace('.', ',')} km •{' '}
                        {Math.floor((confirmedBookingData.etaMinutes ?? 15) / 60)}h e{' '}
                        {String((confirmedBookingData.etaMinutes ?? 15) % 60).padStart(2, '0')}m
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Horário Máx. de saída:</span>
                      </span>
                      <span className="font-black text-emerald-400">
                        {confirmedBookingData.maxDepartureTime}
                      </span>
                    </div>

                    {/* Botões Diretos de Navegação / App no Comprovante Confirmado */}
                    {(() => {
                      const mode = confirmedBookingData.uiTransportMode || 'car';
                      const links = buildTransportDeepLinks({
                        originAddress: confirmedBookingData.originFormattedAddress,
                        originLat: confirmedBookingData.originLat,
                        originLng: confirmedBookingData.originLng,
                        salonName: confirmedBookingData.salonName,
                        salonAddress: confirmedBookingData.address || salonInfo.address,
                        salonLat: confirmedBookingData.salonLat,
                        salonLng: confirmedBookingData.salonLng,
                        transportMode: mode,
                      });

                      if (mode === 'transit') {
                        return (
                          <div className="pt-1">
                            <a
                              href={links.googleMapsTransitUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-2 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                            >
                              <Bus className="w-3.5 h-3.5 text-white shrink-0" />
                              <span className="text-white">Ver Linhas e Baldeações no Maps</span>
                              <ExternalLink className="w-3 h-3 text-white shrink-0" />
                            </a>
                          </div>
                        );
                      }

                      if (mode === 'rideshare') {
                        return (
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <a
                              href={links.uberUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-2 px-2.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                            >
                              <Smartphone className="w-3.5 h-3.5 text-white shrink-0" />
                              <span className="text-white">Abrir Uber</span>
                              <ExternalLink className="w-3 h-3 text-white shrink-0" />
                            </a>
                            <a
                              href={links.app99Url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`py-2 px-2.5 rounded-[4px] font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                                isDark
                                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-400'
                                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                              }`}
                            >
                              <Car className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>Abrir 99</span>
                              <ExternalLink className="w-3 h-3 text-amber-500 shrink-0" />
                            </a>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <a
                            href={links.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-2 px-2.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                          >
                            {mode === 'motorcycle' ? (
                              <Bike className="w-3.5 h-3.5 text-white shrink-0" />
                            ) : (
                              <MapPin className="w-3.5 h-3.5 text-white shrink-0" />
                            )}
                            <span className="text-white">
                              Maps ({TRANSPORT_MODE_META[mode].shortLabel})
                            </span>
                            <ExternalLink className="w-3 h-3 text-white shrink-0" />
                          </a>
                          <a
                            href={links.wazeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`py-2 px-2.5 rounded-[4px] font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                              isDark
                                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
                            }`}
                          >
                            <Navigation className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Abrir Waze</span>
                            <ExternalLink className="w-3 h-3 text-emerald-500 shrink-0" />
                          </a>
                        </div>
                      );
                    })()}
                  </div>
                )}

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
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white font-bold text-xs rounded transition shadow-md shadow-emerald-900/30 uppercase tracking-wider font-['Poppins'] flex items-center justify-center gap-2 cursor-pointer"
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
              className="inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:underline font-bold pt-1 cursor-pointer"
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
        initialSubTab={profileDrawerInitialTab}
        onClose={() => {
          setIsProfileDrawerOpen(false);
          setProfileDrawerInitialTab('menu');
        }}
        userName={currentUserName}
        userAvatarUrl={currentUserAvatarUrl}
        onUpdateUserName={(newName) => setCurrentUserName(newName)}
        onUpdateUserAvatar={(newAvatar) => {
          setCurrentUserAvatarUrl(newAvatar);
          try {
            if (newAvatar) {
              localStorage.setItem('vagou_user_avatar', newAvatar);
            } else {
              localStorage.removeItem('vagou_user_avatar');
            }
          } catch {}
        }}
        onNavigateToSchedule={() => handleSelectTab('vagas')}
        onNavigateTab={handleSelectTab}
        salonName={salonInfo.name}
        salonPhone="5511987654321"
        isSalonLoggedIn={isSalonLoggedIn}
        currentPersona={currentPersona}
        isProAdmin={isActiveProAdmin}
        isGerMode={isGerMode}
        onToggleMode={() => {
          hapticMedium();
          setIsPublicPreviewMode(!isPublicPreviewMode);
          if (isPublicPreviewMode) {
            setActiveTab('home');
          }
        }}
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

      {/* Modal de Autenticação/Cadastro Seguro do Cliente (100% White-Label Nativo do Salão) */}
      {isClientAuthModalOpen && (
        <SalonClientAuthModal
          isOpen={isClientAuthModalOpen}
          onClose={() => {
            pendingBookingAuthRef.current = false;
            setIsClientAuthModalOpen(false);
          }}
          salonName={salonInfo.name}
          salonSlug={adminSettings.salonSlug || activeSubdomain || ''}
          salonLogo={activeLogo || adminSettings.salonIcon || ''}
          salonLogoLight={adminSettings.salonLogoLight || ''}
          salonLogoDark={adminSettings.salonLogoDark || ''}
          primaryColor={adminSettings.accentColor || '#20C933'}
          secondaryColor={adminSettings.secondaryColor || ''}
          themeMode={isDark ? 'dark' : 'light'}
          onAuthenticated={(user, _role) => {
            setIsUserLoggedInState(true);
            if (user?.name) {
              setCurrentUserName(user.name);
            }
            setIsClientAuthModalOpen(false);
            if (pendingBookingAuthRef.current || bookingService || resumeDraftTarget) {
              pendingBookingAuthRef.current = false;
              if (bookingService) {
                setBookingTrigger((prev) => prev + 1);
              }
              setActiveTab('vagas');
            }
          }}
        />
      )}

      {/* Modal de Pausa Emergencial de Agendamentos */}
      <PauseSlotsModal
        isOpen={isPauseSlotsModalOpen}
        onClose={() => setIsPauseSlotsModalOpen(false)}
        appointments={appointmentsList}
        onUpdateAppointments={handleUpdateAppointments}
        salonName={salonInfo.name}
        activeProName={
          teamMembersList.find((m) => m.id === activeProId)?.name ||
          professionalsList.find((p) => p.id === activeProId)?.name ||
          'Profissional'
        }
      />
    </div>
  );
};
