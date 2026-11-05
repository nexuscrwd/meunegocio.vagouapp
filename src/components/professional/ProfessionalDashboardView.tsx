import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  Clock, CalendarCheck, User, Zap, Check, Play, Pause, Plus, X,
  ArrowRightLeft, AlertCircle, ArrowLeft, Users, CheckCircle2,
  MessageCircle, Scissors, Navigation, MapPin, Lock
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { SalonAdminSettings, CatalogServiceItem, BookingAppointment, SalonProfessionalItem, UserPersona } from '../../types';
import { hapticLight, hapticSuccess, hapticMedium } from '../../utils/haptics';
import { PixCheckoutModal } from './PixCheckoutModal';
import { LiveTrackingDrawerModal } from '../live-tracking/LiveTrackingModal';
import { resolveClientAvatarsMap, isValidAvatarUrlString, KNOWN_CLIENT_AVATARS_MAP } from '../../lib/supabase';

const getAppointmentDurationMinutes = (app: BookingAppointment): number => {
  if (typeof app.durationMinutes === 'number' && app.durationMinutes > 0) {
    return app.durationMinutes;
  }
  if (app.duration) {
    const matchMin = app.duration.match(/(\d+)\s*min/i);
    const matchHour = app.duration.match(/(\d+)\s*h/i);
    if (matchMin) return parseInt(matchMin[1], 10);
    if (matchHour) return parseInt(matchHour[1], 10) * 60;
    const numericOnly = parseInt(app.duration, 10);
    if (!isNaN(numericOnly) && numericOnly > 0) return numericOnly;
  }
  return 45;
};

const calculateAppointmentTimes = (app: BookingAppointment) => {
  const startTimeStr = app.time || '10:00';
  const [startH, startM] = startTimeStr.split(':').map((v) => parseInt(v, 10) || 0);
  const durationMinutes = getAppointmentDurationMinutes(app);
  const durHours = Math.floor(durationMinutes / 60);
  const durMins = durationMinutes % 60;
  const durationHhMm = `${String(durHours).padStart(2, '0')}:${String(durMins).padStart(2, '0')}`;

  const totalEndMins = (startH * 60 + startM + durationMinutes) % (24 * 60);
  const endH = Math.floor(totalEndMins / 60);
  const endM = totalEndMins % 60;
  const endTimeHhMm = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  return { startTimeStr, durationMinutes, durationHhMm, endTimeHhMm };
};

export interface DashboardTeamMember {
  id: string;
  name: string;
  role: 'admin' | 'professional';
  roleLabel: string;
  commissionRate: number;
  avatar?: string;
}

const DEFAULT_TEAM_MEMBERS: DashboardTeamMember[] = [];

export interface ProfessionalDashboardViewProps {
  adminSettings?: SalonAdminSettings;
  onUpdateSettings?: (settings: Partial<SalonAdminSettings>) => void;
  services?: CatalogServiceItem[];
  appointments?: BookingAppointment[];
  onUpdateAppointments?: (appointments: BookingAppointment[]) => void;
  professionals?: SalonProfessionalItem[];
  onNavigateTab?: (tab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades' | 'dados' | 'visual') => void;
  onOpenNewService?: () => void;
  onOpenNewAppointment?: () => void;
  onLogout?: () => void;
  salonName?: string;
  currentUserName?: string;
  currentPersona?: UserPersona;
  isProAdmin?: boolean;
  activeProId?: string;
  onSelectActiveProId?: (id: string) => void;
  onRequestManage?: () => void;
}

export const ProfessionalDashboardView: React.FC<ProfessionalDashboardViewProps> = ({
  adminSettings,
  onUpdateSettings,
  services = [],
  appointments = [],
  onUpdateAppointments,
  professionals = [],
  onNavigateTab,
  onOpenNewService,
  onOpenNewAppointment,
  onLogout,
  salonName = 'Meu Estabelecimento',
  currentUserName,
  currentPersona = 'admin',
  isProAdmin,
  activeProId,
  onSelectActiveProId,
  onRequestManage,
}) => {
  const { isDark } = useTheme();

  // Lista consolidada de membros da equipe com taxas de comissão
  const teamList = useMemo<DashboardTeamMember[]>(() => {
    try {
      const saved = localStorage.getItem('vagou_salon_team_members') || localStorage.getItem('vagou_team_members');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any, idx: number) => ({
            id: m.id || `pro-${idx}`,
            name: m.name || `Profissional ${idx + 1}`,
            role: m.role === 'admin' ? 'admin' : 'professional',
            roleLabel: m.role === 'admin' ? 'Dono / Gerente' : (m.specialties?.join(', ') || 'Profissional da Equipe'),
            commissionRate: typeof m.commissionRate === 'number' ? m.commissionRate : (m.role === 'admin' ? 100 : 50),
            avatar: m.avatarUrl || m.avatar || '',
          }));
        }
      }
    } catch {}

    if (professionals && professionals.length > 0) {
      return professionals.map((p, idx) => {
        const isOwner = p.role?.toLowerCase().includes('dono') || p.role?.toLowerCase().includes('gerente') || idx === 0;
        return {
          id: p.id || `pro-${idx}`,
          name: p.name,
          role: isOwner ? 'admin' : 'professional',
          roleLabel: p.role || (isOwner ? 'Dono / Gerente' : 'Profissional da Equipe'),
          commissionRate: isOwner ? 100 : 50,
          avatar: p.avatar || p.avatarUrl || '',
        };
      });
    }

    if (currentUserName) {
      return [{
        id: 'owner-1',
        name: currentUserName,
        role: 'admin',
        roleLabel: 'Proprietário',
        commissionRate: 100,
        avatar: '',
      }];
    }

    return [];
  }, [professionals, currentUserName]);

  // Papel do usuário logado: 'admin' (Dono) ou 'professional' (Colaborador)
  const [userRole, setUserRole] = useState<'admin' | 'professional'>(() => {
    try {
      const saved = localStorage.getItem('vagou_dashboard_user_role');
      if (saved === 'admin' || saved === 'professional') return saved;
    } catch {}
    return 'admin';
  });

  // Nome do profissional que está logado atualmente
  const [loggedProfessionalName, setLoggedProfessionalName] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('vagou_dashboard_logged_pro_name');
      if (saved) return saved;
    } catch {}
    return currentUserName || 'Profissional';
  });

  // Filtro ativo de visualização no Dashboard: 'all' (Todo o Salão) ou nome do profissional
  const [selectedFilterPro, setSelectedFilterPro] = useState<string>(() => {
    try {
      const savedRole = localStorage.getItem('vagou_dashboard_user_role');
      const savedPro = localStorage.getItem('vagou_dashboard_selected_pro');
      if (savedRole === 'professional') {
        return localStorage.getItem('vagou_dashboard_logged_pro_name') || currentUserName || 'Profissional';
      }
      if (savedPro) return savedPro;
    } catch {}
    return 'all';
  });

  // Estados de Filtro para os Atendimentos do Painel
  const [timeFilter, setTimeFilter] = useState<'proximo' | 'hoje' | 'semana' | 'mes'>('proximo');

  // Mapa local de status do atendimento (Ex: 'EM ANDAMENTO' ou 'CONCLUÍDO')
  const [localAppointmentStatuses, setLocalAppointmentStatuses] = useState<Record<string, string>>({});

  // Mapa reativo de avatares de clientes resolvidos (com inicialização síncrona imediata para celular)
  const [resolvedClientAvatars, setResolvedClientAvatars] = useState<Record<string, string>>(() => {
    let initialMap: Record<string, string> = { ...KNOWN_CLIENT_AVATARS_MAP };
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('vagou_client_avatars_map');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            initialMap = { ...initialMap, ...parsed };
          }
        }
        const userAv = localStorage.getItem('vagou_user_avatar');
        if (isValidAvatarUrlString(userAv)) {
          const uName = (localStorage.getItem('vagou_user_name') || '').trim().toLowerCase();
          const uEmail = (localStorage.getItem('vagou_user_email') || '').trim().toLowerCase();
          const uPhone = (localStorage.getItem('vagou_user_phone') || '').replace(/\D/g, '');
          if (uName) initialMap[uName] = userAv.trim();
          if (uEmail) initialMap[uEmail] = userAv.trim();
          if (uPhone.length >= 8) {
            initialMap[uPhone] = userAv.trim();
            initialMap[uPhone.slice(-9)] = userAv.trim();
            initialMap[uPhone.slice(-8)] = userAv.trim();
          }
        }
      } catch {}
    }
    return initialMap;
  });
  const [failedAvatarUrls, setFailedAvatarUrls] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    const syncAvatars = () => {
      resolveClientAvatarsMap()
        .then((map) => {
          if (isMounted && map && Object.keys(map).length > 0) {
            setResolvedClientAvatars((prev) => ({ ...prev, ...map }));
          }
        })
        .catch(() => {});
    };

    syncAvatars();
    window.addEventListener('focus', syncAvatars);
    window.addEventListener('storage', syncAvatars);
    window.addEventListener('vagou:profile-updated', syncAvatars);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', syncAvatars);
      window.removeEventListener('storage', syncAvatars);
      window.removeEventListener('vagou:profile-updated', syncAvatars);
    };
  }, []);

  const getAppointmentClientAvatar = useCallback((app: BookingAppointment): string => {
    const directCandidates = [
      app.clientAvatar,
      app.customerAvatar,
      (app as any).avatarUrl,
      (app as any).avatar,
      (app as any).photoUrl,
    ];
    for (const c of directCandidates) {
      if (isValidAvatarUrlString(c)) return c.trim();
    }

    const cId = String(app.client_user_id || (app as any).client_id || '').trim().toLowerCase();
    if (cId && resolvedClientAvatars[cId]) return resolvedClientAvatars[cId];

    const cEmail = String(app.customerEmail || (app as any).client_email || '').trim().toLowerCase();
    if (cEmail && resolvedClientAvatars[cEmail]) return resolvedClientAvatars[cEmail];

    const cPhone = String(app.clientPhone || app.customerPhone || '').replace(/\D/g, '');
    if (cPhone.length >= 8) {
      if (resolvedClientAvatars[cPhone]) return resolvedClientAvatars[cPhone];
      if (resolvedClientAvatars[cPhone.slice(-9)]) return resolvedClientAvatars[cPhone.slice(-9)];
      if (resolvedClientAvatars[cPhone.slice(-8)]) return resolvedClientAvatars[cPhone.slice(-8)];
    }

    const rawName = String(app.clientName || app.customerName || '').trim().toLowerCase();
    if (rawName) {
      if (resolvedClientAvatars[rawName]) return resolvedClientAvatars[rawName];
      const stripped = rawName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (stripped && resolvedClientAvatars[stripped]) return resolvedClientAvatars[stripped];
      const firstName = rawName.split(' ')[0];
      if (firstName && resolvedClientAvatars[firstName]) return resolvedClientAvatars[firstName];
      
      // Match por chave contida no mapa
      for (const [key, url] of Object.entries(resolvedClientAvatars) as [string, string][]) {
        if (key.length >= 4 && (rawName.includes(key) || key.includes(rawName))) {
          return String(url);
        }
      }

      if (KNOWN_CLIENT_AVATARS_MAP[rawName]) return KNOWN_CLIENT_AVATARS_MAP[rawName];
      if (firstName && KNOWN_CLIENT_AVATARS_MAP[firstName]) return KNOWN_CLIENT_AVATARS_MAP[firstName];
    }

    return '';
  }, [resolvedClientAvatars]);

  const handleUpdateAppointmentStatus = useCallback((appKey: string, newStatus: string) => {
    hapticLight();
    setLocalAppointmentStatuses((prev) => ({
      ...prev,
      [appKey]: newStatus,
    }));
  }, []);

  // Função utilitária para verificar se um agendamento pertence ao profissional filtrado
  const matchesSelectedPro = useCallback((app: BookingAppointment) => {
    if (selectedFilterPro === 'all') return true;
    const appPro = (app.professionalName || app.professional || '').trim().toLowerCase();
    const target = selectedFilterPro.trim().toLowerCase();
    if (!appPro) return false;
    return appPro.includes(target) || target.includes(appPro);
  }, [selectedFilterPro]);

  // Contagem para Badges das categorias no período selecionado
  const categoryCounts = React.useMemo(() => {
    const counts = {
      concluidos: 0,
      confirmados: 0,
      pendentes: 0,
      cancelados: 0,
    };

    appointments.forEach((app) => {
      // Filtragem por Profissional Ativo
      if (!matchesSelectedPro(app)) return;

      let appDate = new Date();
      if (app.dateIso) {
        appDate = new Date(app.dateIso + 'T00:00:00');
      } else {
        const match = app.dateTime?.match(/(\d{2})\/(\d{2})/);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const year = new Date().getFullYear();
          appDate = new Date(year, month, day);
        } else if (app.dayGroup === 'Hoje' || app.dateTime?.includes('Hoje')) {
          appDate = new Date();
        }
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      let matchesTime = true;
      if (timeFilter === 'hoje') {
        matchesTime = appDate >= todayStart && appDate <= todayEnd;
      } else if (timeFilter === 'proximo') {
        matchesTime = appDate >= todayStart;
      } else if (timeFilter === 'semana') {
        const sunday = new Date(todayStart);
        sunday.setDate(todayStart.getDate() - todayStart.getDay());
        const saturday = new Date(sunday);
        saturday.setDate(sunday.getDate() + 6);
        saturday.setHours(23, 59, 59, 999);
        matchesTime = appDate >= sunday && appDate <= saturday;
      } else if (timeFilter === 'mes') {
        matchesTime = appDate.getMonth() === now.getMonth() && appDate.getFullYear() === now.getFullYear();
      }

      if (matchesTime) {
        const appKey = app.protocolCode || app.id || `${app.time}-${app.clientName}`;
        const st = (localAppointmentStatuses[appKey] || app.status || '').toUpperCase();
        if (st === 'CONCLUÍDO' || st === 'CONCLUIDO') {
          counts.concluidos++;
        } else if (st === 'CONFIRMADO' || st === 'AGENDADO') {
          counts.confirmados++;
        } else if (st === 'PENDENTE' || st === 'ALTERADO') {
          counts.pendentes++;
        } else if (st === 'CANCELADO') {
          counts.cancelados++;
        }
      }
    });

    return counts;
  }, [appointments, timeFilter, matchesSelectedPro, localAppointmentStatuses]);

  // Atendimento iniciado e em andamento no momento (se houver)
  const inProgressAppointment = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return appointments.find((app) => {
      if (!matchesSelectedPro(app)) return false;
      const appKey = app.protocolCode || app.id || `${app.time}-${app.clientName}`;
      const effectiveStatus = localAppointmentStatuses[appKey] || app.status || '';
      const st = effectiveStatus.toUpperCase();
      if (!st.includes('ATEND') && !st.includes('INICI')) return false;

      let appDate = new Date();
      if (app.dateIso) {
        appDate = new Date(app.dateIso + 'T00:00:00');
      } else {
        const match = app.dateTime?.match(/(\d{2})\/(\d{2})/);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const year = new Date().getFullYear();
          appDate = new Date(year, month, day);
        } else if (app.dayGroup === 'Hoje' || app.dateTime?.includes('Hoje')) {
          appDate = new Date();
        }
      }
      return appDate >= todayStart && appDate <= todayEnd;
    }) || null;
  }, [appointments, matchesSelectedPro, localAppointmentStatuses]);

  // Próximo atendimento do dia para o profissional ativo (excluindo os já iniciados)
  const nextAppointment = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const upcoming = appointments.filter((app) => {
      if (!matchesSelectedPro(app)) return false;
      const appKey = app.protocolCode || app.id || `${app.time}-${app.clientName}`;
      const effectiveStatus = localAppointmentStatuses[appKey] || app.status || '';
      const st = effectiveStatus.toUpperCase();
      if (st === 'CANCELADO' || st === 'CONCLUÍDO' || st === 'CONCLUIDO' || st.includes('ATEND') || st.includes('INICI')) return false;

      let appDate = new Date();
      if (app.dateIso) {
        appDate = new Date(app.dateIso + 'T00:00:00');
      } else {
        const match = app.dateTime?.match(/(\d{2})\/(\d{2})/);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const year = new Date().getFullYear();
          appDate = new Date(year, month, day);
        }
      }
      return appDate >= todayStart && appDate <= todayEnd;
    });

    return upcoming.sort((a, b) => (a.time || '').localeCompare(b.time || ''))[0] || null;
  }, [appointments, matchesSelectedPro, localAppointmentStatuses]);

  // Ação de iniciar atendimento do próximo cliente
  const handleStartAppointment = useCallback((protocolCode?: string) => {
    if (!protocolCode) return;
    hapticSuccess();
    setLocalAppointmentStatuses((prev) => ({
      ...prev,
      [protocolCode]: 'EM ATENDIMENTO'
    }));

    if (onUpdateAppointments && appointments.length > 0) {
      const updated = appointments.map((a) => {
        if (a.protocolCode === protocolCode) {
          return { ...a, status: 'EM ATENDIMENTO' };
        }
        return a;
      });
      onUpdateAppointments(updated);
      try {
        localStorage.setItem('vagou_salon_appointments', JSON.stringify(updated));
      } catch {}
    }
  }, [appointments, onUpdateAppointments]);

  // Estado para o Checkout PIX Pós-Serviço
  const [pixCheckoutAppointment, setPixCheckoutAppointment] = useState<BookingAppointment | null>(null);

  // Ação de finalizar atendimento em andamento e abrir o PixCheckoutModal
  const handleCompleteAppointment = useCallback((protocolCode?: string, targetApp?: BookingAppointment) => {
    if (!protocolCode) return;
    hapticSuccess();
    setLocalAppointmentStatuses((prev) => ({
      ...prev,
      [protocolCode]: 'CONCLUÍDO'
    }));

    const matchedApp =
      targetApp ||
      appointments.find((a) => a.protocolCode === protocolCode || a.id === protocolCode) ||
      null;

    if (onUpdateAppointments && appointments.length > 0) {
      const updated = appointments.map((a) => {
        if (a.protocolCode === protocolCode || a.id === protocolCode) {
          return { ...a, status: 'CONCLUÍDO' };
        }
        return a;
      });
      onUpdateAppointments(updated);
      try {
        localStorage.setItem('vagou_salon_appointments', JSON.stringify(updated));
      } catch {}
    }

    if (matchedApp) {
      setPixCheckoutAppointment(matchedApp);
    }
  }, [appointments, onUpdateAppointments]);

  // Ação de confirmar atendimento diretamente pelo card
  const handleConfirmAppointment = useCallback((protocolCode?: string) => {
    if (!protocolCode) return;
    hapticSuccess();
    setLocalAppointmentStatuses((prev) => ({
      ...prev,
      [protocolCode]: 'CONFIRMADO'
    }));

    if (onUpdateAppointments && appointments.length > 0) {
      const updated = appointments.map((a) => {
        if (a.protocolCode === protocolCode || a.id === protocolCode) {
          return { ...a, status: 'CONFIRMADO', tracking_status: 'arrived' as const };
        }
        return a;
      });
      onUpdateAppointments(updated);
      try {
        localStorage.setItem('vagou_salon_appointments', JSON.stringify(updated));
      } catch {}
    }
  }, [appointments, onUpdateAppointments]);

  // Estados para o Modal Operacional de Atendimento (Iniciar, Pausar, Adicionar Mais Tempo, Concluir, Transferir)
  const [actionModalAppointment, setActionModalAppointment] = useState<BookingAppointment | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [timeExtensionFeedback, setTimeExtensionFeedback] = useState<string | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferSuccessMessage, setTransferSuccessMessage] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelJustification, setCancelJustification] = useState('');
  const [liveTrackingAppointment, setLiveTrackingAppointment] = useState<BookingAppointment | null>(null);

  // Agendamentos com fallback de MOCK para teste e averiguação imediata dos 3 cards no ambiente de dev
  const effectiveAppointments = useMemo(() => {
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const shortToday = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    const hasTodayApts = (appointments || []).some((a) => {
      return (
        a.dateIso === todayIso ||
        a.dayGroup === 'Hoje' ||
        a.dayGroup === shortToday ||
        (typeof a.dateTime === 'string' && (a.dateTime.includes('Hoje') || a.dateTime.includes(shortToday)))
      );
    });

    if (hasTodayApts && Array.isArray(appointments) && appointments.length > 0) {
      return appointments;
    }

    // Mock Appointments de Teste para o Atendimento Atual, Próximo e Pendente
    const mock1: BookingAppointment = {
      id: 'mock-app-current',
      protocolCode: '#VGA-2001',
      clientName: 'Carlos Eduardo',
      customerName: 'Carlos Eduardo',
      clientAvatar: 'https://xemenxdhuoekytyhmgyt.supabase.co/storage/v1/object/public/avatars/elisa-pires-1790537020614.jpg',
      clientPhone: '11987654321',
      serviceTitle: 'Corte de Cabelo + Barba',
      service: 'Corte de Cabelo + Barba',
      serviceName: 'Corte de Cabelo + Barba',
      salonName: salonName || 'Meu Estabelecimento',
      professionalName: currentUserName || 'Profissional',
      professional: currentUserName || 'Profissional',
      dateTime: `Hoje, 10:00`,
      dayGroup: 'Hoje',
      time: '10:00',
      duration: '45m',
      durationMinutes: 45,
      totalPrice: 65,
      status: 'EM ATENDIMENTO',
      dateIso: todayIso,
      tracking_status: 'idle',
    };

    const mock2: BookingAppointment = {
      id: 'mock-app-next',
      protocolCode: '#VGA-2002',
      clientName: 'Lucas Gabriel',
      customerName: 'Lucas Gabriel',
      clientAvatar: 'https://xemenxdhuoekytyhmgyt.supabase.co/storage/v1/object/public/avatars/elisa-pires-1790537020614.jpg',
      clientPhone: '11976543210',
      serviceTitle: 'Barba Espartana',
      service: 'Barba Espartana',
      serviceName: 'Barba Espartana',
      salonName: salonName || 'Meu Estabelecimento',
      professionalName: currentUserName || 'Profissional',
      professional: currentUserName || 'Profissional',
      dateTime: `Hoje, 11:00`,
      dayGroup: 'Hoje',
      time: '11:00',
      duration: '30m',
      durationMinutes: 30,
      totalPrice: 40,
      status: 'CONFIRMADO',
      dateIso: todayIso,
      tracking_status: 'live_sharing', // Trajeto Compartilhado ao Vivo (VERDE)
    };

    const mock3: BookingAppointment = {
      id: 'mock-app-pending',
      protocolCode: '#VGA-2003',
      clientName: 'Matheus Silva',
      customerName: 'Matheus Silva',
      clientAvatar: 'https://xemenxdhuoekytyhmgyt.supabase.co/storage/v1/object/public/avatars/elisa-pires-1790537020614.jpg',
      clientPhone: '11965432109',
      serviceTitle: 'Corte Degradê Navalhado',
      service: 'Corte Degradê Navalhado',
      serviceName: 'Corte Degradê Navalhado',
      salonName: salonName || 'Meu Estabelecimento',
      professionalName: currentUserName || 'Profissional',
      professional: currentUserName || 'Profissional',
      dateTime: `Hoje, 14:00`,
      dayGroup: 'Hoje',
      time: '14:00',
      duration: '40m',
      durationMinutes: 40,
      totalPrice: 50,
      status: 'PENDENTE',
      dateIso: todayIso,
      tracking_status: 'idle', // Ainda não em trajeto (OPACO)
    };

    return [mock1, mock2, mock3, ...(appointments || [])];
  }, [appointments, salonName, currentUserName]);

  // Fila ativa de hoje para o profissional ativo (excluindo concluídos e cancelados)
  const todayActiveAppointments = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const activeList = effectiveAppointments.filter((app) => {
      if (!matchesSelectedPro(app)) return false;
      const appKey = app.protocolCode || app.id || `${app.time}-${app.clientName}`;
      const effectiveStatus = localAppointmentStatuses[appKey] || app.status || '';
      const st = effectiveStatus.toUpperCase();
      if (st === 'CANCELADO' || st === 'CONCLUÍDO' || st === 'CONCLUIDO') return false;

      let appDate = new Date();
      if (app.dateIso) {
        appDate = new Date(app.dateIso + 'T00:00:00');
      } else {
        const match = app.dateTime?.match(/(\d{2})\/(\d{2})/);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const year = new Date().getFullYear();
          appDate = new Date(year, month, day);
        } else if (app.dayGroup === 'Hoje' || app.dateTime?.includes('Hoje')) {
          appDate = new Date();
        }
      }
      return appDate >= todayStart && appDate <= todayEnd;
    });

    // Ordenação: 1º em atendimento / pausado, depois por horário ascendente
    return activeList.sort((a, b) => {
      const keyA = a.protocolCode || a.id || `${a.time}-${a.clientName}`;
      const keyB = b.protocolCode || b.id || `${b.time}-${b.clientName}`;
      const stA = (localAppointmentStatuses[keyA] || a.status || '').toUpperCase();
      const stB = (localAppointmentStatuses[keyB] || b.status || '').toUpperCase();
      const isProgA = stA.includes('ATEND') || stA.includes('INICI') || stA.includes('PAUS');
      const isProgB = stB.includes('ATEND') || stB.includes('INICI') || stB.includes('PAUS');

      if (isProgA && !isProgB) return -1;
      if (!isProgA && isProgB) return 1;

      return (a.time || '').localeCompare(b.time || '');
    });
  }, [effectiveAppointments, matchesSelectedPro, localAppointmentStatuses]);

  // Três slots de atendimento na fila prioritária
  const currentCardAppointment = useMemo(() => {
    const inProgress = todayActiveAppointments.find((a) => {
      const k = a.protocolCode || a.id || `${a.time}-${a.clientName}`;
      const st = (localAppointmentStatuses[k] || a.status || '').toUpperCase();
      return st.includes('ATEND') || st.includes('INICI') || st.includes('PAUS');
    });
    return inProgress || todayActiveAppointments[0] || null;
  }, [todayActiveAppointments, localAppointmentStatuses]);

  const nextCardAppointment = useMemo(() => {
    const remaining = todayActiveAppointments.filter((a) => {
      if (currentCardAppointment && (a.protocolCode === currentCardAppointment.protocolCode || a.id === currentCardAppointment.id)) {
        return false;
      }
      const k = a.protocolCode || a.id || `${a.time}-${a.clientName}`;
      const st = (localAppointmentStatuses[k] || a.status || '').toUpperCase();
      return st !== 'PENDENTE';
    });
    return remaining[0] || null;
  }, [todayActiveAppointments, currentCardAppointment, localAppointmentStatuses]);

  const confirmationCardAppointment = useMemo(() => {
    const pending = effectiveAppointments.find((a) => {
      if (!matchesSelectedPro(a)) return false;
      const k = a.protocolCode || a.id || `${a.time}-${a.clientName}`;
      const st = (localAppointmentStatuses[k] || a.status || '').toUpperCase();
      if (st === 'CANCELADO' || st === 'CONCLUÍDO' || st === 'CONCLUIDO') return false;

      const isAlreadyShown =
        (currentCardAppointment && (a.protocolCode === currentCardAppointment.protocolCode || a.id === currentCardAppointment.id)) ||
        (nextCardAppointment && (a.protocolCode === nextCardAppointment.protocolCode || a.id === nextCardAppointment.id));

      return !isAlreadyShown && (st.includes('PEND') || st.includes('AGEND'));
    });

    return pending || todayActiveAppointments.find((a) => {
      const isAlreadyShown =
        (currentCardAppointment && (a.protocolCode === currentCardAppointment.protocolCode || a.id === currentCardAppointment.id)) ||
        (nextCardAppointment && (a.protocolCode === nextCardAppointment.protocolCode || a.id === nextCardAppointment.id));
      return !isAlreadyShown;
    }) || null;
  }, [effectiveAppointments, todayActiveAppointments, matchesSelectedPro, localAppointmentStatuses, currentCardAppointment, nextCardAppointment]);

  // Trava Operacional de Mitigação: O próximo atendimento não pode ser iniciado sem a conclusão ou definição do anterior
  const isModalBlockedByPrevious = useMemo(() => {
    if (!actionModalAppointment || !currentCardAppointment) return false;
    const modalKey = actionModalAppointment.protocolCode || actionModalAppointment.id || `${actionModalAppointment.time}-${actionModalAppointment.clientName}`;
    const firstKey = currentCardAppointment.protocolCode || currentCardAppointment.id || `${currentCardAppointment.time}-${currentCardAppointment.clientName}`;

    // Se o agendamento no modal for o segundo (ou posterior ao primeiro), verifica se o primeiro ainda está ativo
    if (modalKey !== firstKey) {
      const firstStatus = (localAppointmentStatuses[firstKey] || currentCardAppointment.status || '').toUpperCase();
      const isFirstFinished = firstStatus.includes('CONCLU') || firstStatus.includes('CANCEL');
      return !isFirstFinished;
    }
    return false;
  }, [actionModalAppointment, currentCardAppointment, localAppointmentStatuses]);

  // Colegas da equipe disponíveis para transferência (excluindo o profissional atual)
  const availableColleaguesForTransfer = useMemo(() => {
    const currentProName = (activeProId || selectedFilterPro || currentUserName || '').trim().toLowerCase();
    const list = teamList.filter((m) => {
      const mName = m.name.trim().toLowerCase();
      const mId = m.id.trim().toLowerCase();
      if (mName === currentProName || mId === currentProName) return false;
      if (selectedFilterPro !== 'all' && (mName.includes(selectedFilterPro.toLowerCase()) || selectedFilterPro.toLowerCase().includes(mName))) {
        return false;
      }
      return true;
    });
    return list;
  }, [teamList, activeProId, selectedFilterPro, currentUserName]);

  // Abertura do Modal de Operações do Atendimento
  const handleOpenActionModal = useCallback((app: BookingAppointment) => {
    hapticLight();
    const appKey = app.protocolCode || app.id || `${app.time}-${app.clientName}`;
    const effectiveStatus = localAppointmentStatuses[appKey] || app.status || 'CONFIRMADO';
    setActionModalAppointment({ ...app, status: effectiveStatus });
    setTimeExtensionFeedback(null);
    setIsTransferOpen(false);
    setTransferSuccessMessage(null);
    setIsCancelModalOpen(false);
    setCancelJustification('');
    setIsActionModalOpen(true);
  }, [localAppointmentStatuses]);

  // Transferência / Repasse de Atendimento para outro profissional do mesmo estabelecimento (Apenas se NÃO iniciado)
  const handleTransferAppointment = useCallback((targetPro: DashboardTeamMember) => {
    if (!actionModalAppointment) return;
    const appKey = actionModalAppointment.protocolCode || actionModalAppointment.id || `${actionModalAppointment.time}-${actionModalAppointment.clientName}`;
    const effectiveStatus = (localAppointmentStatuses[appKey] || actionModalAppointment.status || '').toUpperCase();
    
    // Trava lógica estrita: atendimento já iniciado não pode ser transferido
    if (effectiveStatus.includes('ATEND') || effectiveStatus.includes('INICI')) {
      return;
    }

    hapticSuccess();

    const updatedList = appointments.map((a) => {
      const k = a.protocolCode || a.id || `${a.time}-${a.clientName}`;
      if (k === appKey) {
        return {
          ...a,
          professional: targetPro.name,
          professionalName: targetPro.name,
          professionalId: targetPro.id,
        };
      }
      return a;
    });

    if (onUpdateAppointments) {
      onUpdateAppointments(updatedList);
    }
    try {
      localStorage.setItem('vagou_salon_appointments', JSON.stringify(updatedList));
    } catch {}

    setTransferSuccessMessage(`Atendimento transferido para ${targetPro.name}!`);
    setTimeout(() => {
      setTransferSuccessMessage(null);
      setIsTransferOpen(false);
      setIsActionModalOpen(false);
      setActionModalAppointment(null);
    }, 1200);
  }, [actionModalAppointment, appointments, onUpdateAppointments]);

  // Ações do Modal de Atendimento: Iniciar / Retomar, Pausar, Adicionar Tempo, Concluir
  const handleStartFromModal = useCallback(() => {
    if (!actionModalAppointment || isModalBlockedByPrevious) return;
    const protocolCode = actionModalAppointment.protocolCode || actionModalAppointment.id;
    handleStartAppointment(protocolCode);
    setActionModalAppointment((prev) => prev ? { ...prev, status: 'EM ATENDIMENTO' } : null);
  }, [actionModalAppointment, isModalBlockedByPrevious, handleStartAppointment]);

  const handlePauseFromModal = useCallback(() => {
    if (!actionModalAppointment) return;
    hapticMedium();
    const appKey = actionModalAppointment.protocolCode || actionModalAppointment.id || `${actionModalAppointment.time}-${actionModalAppointment.clientName}`;
    const currentSt = (localAppointmentStatuses[appKey] || actionModalAppointment.status || '').toUpperCase();
    const newSt = currentSt === 'PAUSADO' ? 'EM ATENDIMENTO' : 'PAUSADO';

    setLocalAppointmentStatuses((prev) => ({
      ...prev,
      [appKey]: newSt
    }));

    const updatedApp = { ...actionModalAppointment, status: newSt };
    setActionModalAppointment(updatedApp);

    if (onUpdateAppointments && appointments.length > 0) {
      const updatedList = appointments.map((a) => {
        const k = a.protocolCode || a.id || `${a.time}-${a.clientName}`;
        if (k === appKey) {
          return { ...a, status: newSt };
        }
        return a;
      });
      onUpdateAppointments(updatedList);
      try {
        localStorage.setItem('vagou_salon_appointments', JSON.stringify(updatedList));
      } catch {}
    }
  }, [actionModalAppointment, localAppointmentStatuses, onUpdateAppointments, appointments]);

  const handleAddMoreTime = useCallback((additionalMinutes: number) => {
    if (!actionModalAppointment) return;
    hapticLight();
    const currentDur = getAppointmentDurationMinutes(actionModalAppointment);
    const newDur = currentDur + additionalMinutes;
    const newDurText = newDur >= 60 
      ? `${Math.floor(newDur / 60)}h${newDur % 60 > 0 ? (newDur % 60) + 'min' : ''}`
      : `${newDur} min`;

    const appKey = actionModalAppointment.protocolCode || actionModalAppointment.id || `${actionModalAppointment.time}-${actionModalAppointment.clientName}`;
    
    const updatedApp: BookingAppointment = {
      ...actionModalAppointment,
      duration: newDurText,
      durationMinutes: newDur,
    };
    setActionModalAppointment(updatedApp);

    const { endTimeHhMm } = calculateAppointmentTimes(updatedApp);
    setTimeExtensionFeedback(`+${additionalMinutes} min adicionados (término previsto às ${endTimeHhMm})`);

    if (onUpdateAppointments && appointments.length > 0) {
      const updatedList = appointments.map((a) => {
        const k = a.protocolCode || a.id || `${a.time}-${a.clientName}`;
        if (k === appKey) {
          return updatedApp;
        }
        return a;
      });
      onUpdateAppointments(updatedList);
      try {
        localStorage.setItem('vagou_salon_appointments', JSON.stringify(updatedList));
      } catch {}
    }
  }, [actionModalAppointment, onUpdateAppointments, appointments]);

  const handleCompleteFromModal = useCallback(() => {
    if (!actionModalAppointment) return;
    const protocolCode = actionModalAppointment.protocolCode || actionModalAppointment.id;
    handleCompleteAppointment(protocolCode, actionModalAppointment);
    setIsActionModalOpen(false);
    setActionModalAppointment(null);
  }, [actionModalAppointment, handleCompleteAppointment]);

  const handleCancelAppointmentFromModal = useCallback(() => {
    if (!actionModalAppointment || !cancelJustification.trim()) return;
    hapticMedium();
    const reason = cancelJustification.trim();
    const appKey = actionModalAppointment.protocolCode || actionModalAppointment.id || `${actionModalAppointment.time}-${actionModalAppointment.clientName}`;
    const protocolCode = actionModalAppointment.protocolCode || actionModalAppointment.id;

    setLocalAppointmentStatuses((prev) => ({
      ...prev,
      [appKey]: 'CANCELADO',
      ...(protocolCode ? { [protocolCode]: 'CANCELADO' } : {}),
    }));

    const sourceList = appointments.length > 0 ? appointments : effectiveAppointments;
    const updatedList = sourceList.map((a) => {
      const k = a.protocolCode || a.id || `${a.time}-${a.clientName}`;
      if (k === appKey || (protocolCode && (a.protocolCode === protocolCode || a.id === protocolCode))) {
        return {
          ...a,
          status: 'CANCELADO',
          cancellation_reason: reason,
          notes: reason,
        };
      }
      return a;
    });

    if (onUpdateAppointments) {
      onUpdateAppointments(updatedList);
    }
    try {
      localStorage.setItem('vagou_salon_appointments', JSON.stringify(updatedList));
    } catch {}

    setIsCancelModalOpen(false);
    setCancelJustification('');
    setIsActionModalOpen(false);
    setActionModalAppointment(null);
  }, [actionModalAppointment, cancelJustification, onUpdateAppointments, appointments, effectiveAppointments]);

  const renderAppointmentCard = (app: BookingAppointment, cardType: 'atual' | 'proximo' | 'confirmacao') => {
    const appKey = app.protocolCode || app.id || `${app.time}-${app.clientName}`;
    const effectiveStatus = (localAppointmentStatuses[appKey] || app.status || '').toUpperCase();
    const isProgress = effectiveStatus.includes('ATEND') || effectiveStatus.includes('INICI');
    const isPaused = effectiveStatus.includes('PAUS');
    const isConfirmed = effectiveStatus.includes('CONFIRM') || effectiveStatus === 'CONFIRMADO';

    const isArrived = Boolean(
      app.tracking_status === 'arrived' ||
      effectiveStatus.includes('LOCAL') ||
      effectiveStatus.includes('CHEG') ||
      effectiveStatus.includes('PRESEN') ||
      (app as any).isClientAtSalon
    );

    const isLiveSharing = Boolean(
      !isArrived && (
        app.tracking_status === 'live_sharing' ||
        app.tracking_status === 'arriving_5min' ||
        app.tracking_status === 'hurry_confirmed'
      )
    );

    const isEnRouteNoMap = Boolean(
      !isArrived && !isLiveSharing && (
        app.tracking_status === 'on_way_no_map' ||
        effectiveStatus.includes('CAMINHO') ||
        (app as any).isClientEnRoute
      )
    );

    const isDelayedOrImminent = Boolean(
      !isArrived && !isLiveSharing && !isEnRouteNoMap && (() => {
        const now = new Date();
        const [startH, startM] = (app.time || '10:00').split(':').map((v) => parseInt(v, 10) || 0);
        const appMinutes = startH * 60 + startM;
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        return currentMinutes >= (appMinutes - 10);
      })()
    );

    const isEnRoute = Boolean(
      isLiveSharing ||
      isEnRouteNoMap ||
      isArrived
    );

    const isBlockedOrPause = Boolean(
      app.isBlockedSlot ||
      (app.service || '').toLowerCase().includes('pausa') ||
      (app.serviceTitle || '').toLowerCase().includes('pausa') ||
      (app.clientName || '').toLowerCase().includes('pausa') ||
      effectiveStatus.includes('BLOQ')
    );

    const rawFullName = (app.clientName || app.customerName || 'Cliente').trim();
    const serviceText = app.serviceName || app.service || app.serviceTitle || 'Atendimento';

    const clientAvatarUrl = getAppointmentClientAvatar(app);
    const hasValidClientAvatar = Boolean(clientAvatarUrl && !failedAvatarUrls[clientAvatarUrl]);

    const { startTimeStr, durationHhMm, endTimeHhMm } = calculateAppointmentTimes(app);

    const clientFirstName = rawFullName.split(' ')[0] || 'Cliente';
    const cardClientPhone = (app.clientPhone || app.customerPhone || '').replace(/\D/g, '');
    const cardHasPhone = cardClientPhone.length >= 10;
    const cardDefaultMsg = `Olá ${clientFirstName}! Tudo bem? Seu atendimento de ${serviceText} às ${startTimeStr} no Vagou está agendado. Você já está a caminho?`;
    const cardWhatsappUrl = cardHasPhone
      ? `https://wa.me/55${cardClientPhone}?text=${encodeURIComponent(cardDefaultMsg)}`
      : `https://wa.me/?text=${encodeURIComponent(cardDefaultMsg)}`;

    const cardId = cardType === 'atual' 
      ? 'professional-current-appointment-card'
      : cardType === 'proximo'
        ? 'professional-next-appointment-card'
        : 'professional-confirmation-appointment-card';

    return (
      <div
        key={`${appKey}-${cardType}`}
        id={cardId}
        onClick={() => handleOpenActionModal(app)}
        title="Clique para abrir opções e ações do atendimento"
        className={`w-full rounded-[4px] select-none transition-all duration-200 overflow-hidden cursor-pointer ${
          isDark 
            ? isProgress && cardType === 'atual'
              ? 'bg-slate-900 border border-emerald-500/80 ring-1 ring-emerald-500/40' 
              : 'bg-slate-900 border border-slate-800' 
            : isProgress && cardType === 'atual'
              ? 'caixa-card ring-1 ring-[#008B47]/40' 
              : 'caixa-card'
        }`}
      >
        {/* 1. Parte Superior (EM CIMA): Identificação do Cliente + Status do Card + Ações Rápidas */}
        <div
          onClick={() => handleOpenActionModal(app)}
          title="Clique para abrir detalhes do atendimento"
          className={`px-3 py-2.5 border-b flex items-center justify-between gap-2.5 cursor-pointer ${
            isProgress && cardType === 'atual'
              ? 'bg-[#008B47]/10 border-[#EDF2F7] dark:border-emerald-500/30'
              : isDark
              ? 'bg-slate-850 border-slate-800'
              : 'bg-[#F7F9FC] border-[#EDF2F7]'
          }`}
        >
          {/* Cliente: Avatar/Ícone do Cliente em cima + Nome + Status */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={`w-10 h-10 rounded shrink-0 flex items-center justify-center font-bold text-xs shadow-2xs overflow-hidden border ${
                isBlockedOrPause
                  ? isDark
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-amber-50 border-amber-200 text-amber-600'
                  : isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200'
                    : 'bg-white border-slate-200 text-slate-700'
              }`}
              title={isBlockedOrPause ? 'Pausa de Horário' : rawFullName}
            >
              {isBlockedOrPause ? (
                <div className="flex items-center justify-center w-full h-full">
                  <Lock className="w-5 h-5 text-amber-500 stroke-[1.75]" />
                </div>
              ) : hasValidClientAvatar ? (
                <div className="flex items-center justify-center w-full h-full overflow-hidden">
                  <img
                    src={clientAvatarUrl}
                    alt={rawFullName}
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.dataset.retried) {
                        target.dataset.retried = 'true';
                        target.src = clientAvatarUrl + (clientAvatarUrl.includes('?') ? '&' : '?') + 't=' + Date.now();
                      } else {
                        setFailedAvatarUrls((prev) => ({ ...prev, [clientAvatarUrl]: true }));
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <User className="w-5 h-5 text-emerald-500 dark:text-emerald-400 stroke-[1.75]" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className={`font-bold text-sm truncate leading-tight ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {rawFullName}
              </h3>

              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {/* 1. Atendimento Atual: Estritamente exclusivo ("Em Atendimento", "No Local", "Atrasado", "Em Trajeto" ou "Aguardando") */}
                {cardType === 'atual' && (
                  <>
                    {isProgress ? (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-[#008B47] text-white shadow-2xs whitespace-nowrap">
                        <Zap className="w-2.5 h-2.5 text-white fill-white animate-pulse" />
                        <span className="text-white">Em Atendimento</span>
                      </span>
                    ) : isPaused ? (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-amber-500 text-white shadow-2xs whitespace-nowrap">
                        <Pause className="w-2.5 h-2.5 text-white fill-white" />
                        <span className="text-white">Pausado</span>
                      </span>
                    ) : isArrived ? (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-[#008B47] text-white shadow-2xs whitespace-nowrap">
                        <MapPin className="w-2.5 h-2.5 text-white" />
                        <span className="text-white">No Local</span>
                      </span>
                    ) : isDelayedOrImminent ? (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-rose-600 text-white shadow-2xs whitespace-nowrap">
                        <AlertCircle className="w-2.5 h-2.5 text-white" />
                        <span className="text-white">Atrasado</span>
                      </span>
                    ) : isLiveSharing ? (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-emerald-500 text-white shadow-2xs whitespace-nowrap">
                        <Navigation className="w-2.5 h-2.5 fill-white text-white animate-pulse" />
                        <span className="text-white">Em Trajeto</span>
                      </span>
                    ) : isEnRouteNoMap ? (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-blue-500 text-white shadow-2xs whitespace-nowrap">
                        <Navigation className="w-2.5 h-2.5 text-white" />
                        <span className="text-white">Em Trajeto</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-amber-500 text-white shadow-2xs whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5 text-white" />
                        <span className="text-white">Aguardando</span>
                      </span>
                    )}
                  </>
                )}

                {/* 2. Próximo Atendimento */}
                {cardType === 'proximo' && (
                  <>
                    <span
                      className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 whitespace-nowrap ${
                        isDark
                          ? 'bg-slate-800 text-slate-200 border border-slate-700'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5 text-slate-400" />
                      <span>Próximo</span>
                    </span>

                    {isArrived ? (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-[#008B47] text-white shadow-2xs whitespace-nowrap">
                        <MapPin className="w-2.5 h-2.5 text-white" />
                        <span className="text-white">No Local</span>
                      </span>
                    ) : isLiveSharing ? (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-emerald-500 text-white shadow-2xs whitespace-nowrap">
                        <Navigation className="w-2.5 h-2.5 fill-white text-white animate-pulse" />
                        <span className="text-white">Em Trajeto</span>
                      </span>
                    ) : isEnRouteNoMap ? (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-blue-500 text-white shadow-2xs whitespace-nowrap">
                        <Navigation className="w-2.5 h-2.5 text-white" />
                        <span className="text-white">Em Trajeto</span>
                      </span>
                    ) : isDelayedOrImminent ? (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-rose-600 text-white shadow-2xs whitespace-nowrap">
                        <AlertCircle className="w-2.5 h-2.5 text-white" />
                        <span className="text-white">Atrasado</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-amber-500 text-white shadow-2xs whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5 text-white" />
                        <span className="text-white">Aguardando</span>
                      </span>
                    )}
                  </>
                )}

                {/* 3. Confirmação de Atendimento (Legendas ultra-resumidas sem sobreposição) */}
                {cardType === 'confirmacao' && (
                  <>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 whitespace-nowrap ${
                        isDark
                          ? 'bg-slate-800 text-slate-200 border border-slate-700'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span>A Confirmar</span>
                    </span>

                    {isConfirmed ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-emerald-500 text-white whitespace-nowrap">
                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                        <span className="text-white">Confirmado</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 bg-amber-500 text-white whitespace-nowrap">
                        <Clock className="w-2.5 h-2.5 text-white" />
                        <span className="text-white">Aguardando</span>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Botões de Ação Rápida sob condições de espera / atraso: Mensagem WhatsApp e Rastrear Trajeto */}
          {!isProgress && (
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <a
                href={cardWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  hapticLight();
                }}
                className={`w-8 h-8 rounded-[4px] border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                  isDark
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                }`}
                title={`Enviar mensagem no WhatsApp para ${clientFirstName}`}
              >
                <MessageCircle className="w-4 h-4 text-emerald-500" />
              </a>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hapticLight();
                  setLiveTrackingAppointment(app);
                }}
                className={`h-8 px-2.5 rounded-[4px] border flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer shadow-2xs ${
                  isLiveSharing
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-xs'
                    : isDark
                      ? 'opacity-50 hover:opacity-75 bg-slate-800/80 text-slate-400 border-slate-700'
                      : 'opacity-50 hover:opacity-75 bg-slate-100 text-slate-500 border-slate-300'
                }`}
                title={
                  isLiveSharing
                    ? 'Trajeto GPS compartilhado ao vivo pelo cliente (Clique para rastrear)'
                    : 'Cliente ainda não compartilhou trajeto GPS ao vivo'
                }
              >
                <Navigation
                  className={`w-3.5 h-3.5 ${
                    isLiveSharing
                      ? 'text-white fill-white animate-pulse'
                      : isDark
                        ? 'text-slate-400'
                        : 'text-slate-500'
                  }`}
                />
                <span
                  className={
                    isLiveSharing
                      ? 'text-white font-bold'
                      : isDark
                        ? 'text-slate-400'
                        : 'text-slate-500'
                  }
                >
                  Rastrear
                </span>
              </button>
            </div>
          )}
        </div>

        {/* 2. Parte Inferior (ABAIXO DO CLIENTE): Descrição do Serviço + Horário */}
        <div className="p-3 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {/* Descrição do Serviço */}
            <p
              className={`text-xs font-bold truncate flex items-center gap-1.5 ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 shrink-0 text-[#005CA9] dark:text-emerald-400" />
              <span className="truncate">{serviceText}</span>
            </p>

            {/* Horário e Duração */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
              <Clock className="w-3 h-3 shrink-0 text-slate-400" />
              <span>
                {startTimeStr} → {endTimeHhMm} ({durationHhMm})
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyAppointmentCard = (cardType: 'atual' | 'proximo' | 'confirmacao') => {
    if (cardType === 'atual') {
      return (
        <div 
          id="professional-current-appointment-card-empty"
          style={{ minHeight: '65px' }}
          className={`p-3 rounded border flex flex-col items-center justify-center select-none w-full text-center ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 shadow-xs text-slate-900'
          }`}
        >
          <Clock className={`w-4 h-4 mb-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
          <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
            Em Atendimento
          </p>
          <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            Nenhum atendimento em andamento no momento
          </p>
        </div>
      );
    }

    if (cardType === 'proximo') {
      return (
        <div 
          id="professional-next-appointment-card-empty"
          style={{ minHeight: '65px' }}
          className={`p-3 rounded border border-dashed flex flex-col items-center justify-center select-none w-full text-center ${
            isDark ? 'bg-slate-900/40 border-slate-800/80 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          <Navigation className="w-4 h-4 mb-0.5 opacity-60 text-emerald-500" />
          <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Próximo
          </p>
          <span className="text-[10px] font-medium text-slate-500">Sem próximo cliente na fila</span>
        </div>
      );
    }

    return (
      <div 
        id="professional-confirmation-appointment-card-empty"
        style={{ minHeight: '65px' }}
        className={`p-3 rounded-[4px] border border-dashed flex flex-col items-center justify-center select-none w-full text-center ${
          isDark ? 'bg-slate-900/40 border-slate-800/80 text-slate-500' : 'bg-[#FFFFFF] border-[#D5E0EC] text-[#5F6C7B]'
        }`}
      >
        <CheckCircle2 className="w-4 h-4 mb-0.5 text-[#008B47]" />
        <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-[#1E293B]'}`}>
          Confirmação de Atendimento
        </p>
        <span className="text-[10px] font-medium text-[#5F6C7B]">Nenhum atendimento pendente de confirmação</span>
      </div>
    );
  };

  return (
    <div className={`w-full h-full flex-1 min-h-0 flex flex-col overflow-y-auto no-scrollbar ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#F7F9FC] text-[#333E48]'
    }`}>
      {/* 2. Conteúdo Rolável: Fila & Agenda seguido de Dashboard & Metas */}
      <div className="p-2.5 flex flex-col gap-3 flex-1">
        {/* Bloco de Atendimentos Prioritários: Atual / Próximo e Confirmação */}
        <div className="space-y-2.5 pb-6">
          {/* Título do Grupo de Atendimento */}
          <div className="flex items-center justify-between px-0.5 pt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5F6C7B] dark:text-slate-400 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-[#005CA9] dark:text-emerald-400 shrink-0" />
              <span>Fila de Atendimento da Cadeira</span>
            </span>
          </div>

          {/* Card 1: Atendimento Atual (Na Cadeira / Em Atendimento) */}
          {currentCardAppointment ? (
            renderAppointmentCard(currentCardAppointment, 'atual')
          ) : (
            renderEmptyAppointmentCard('atual')
          )}

          {/* Card 2: Próximo Atendimento (com status "A caminho: Sim" ou "Não") */}
          {nextCardAppointment ? (
            renderAppointmentCard(nextCardAppointment, 'proximo')
          ) : (
            renderEmptyAppointmentCard('proximo')
          )}

          {/* Card 3: Confirmação de Atendimento */}
          {confirmationCardAppointment ? (
            renderAppointmentCard(confirmationCardAppointment, 'confirmacao')
          ) : (
            renderEmptyAppointmentCard('confirmacao')
          )}
        </div>
      </div>

      {/* Seção Operacional em Tela Inteira de Atendimento (Iniciar, Pausar, Adicionar Mais Tempo, Concluir) */}
      {isActionModalOpen && actionModalAppointment && (() => {
        const appKey = actionModalAppointment.protocolCode || actionModalAppointment.id || `${actionModalAppointment.time}-${actionModalAppointment.clientName}`;
        const effectiveStatus = (localAppointmentStatuses[appKey] || actionModalAppointment.status || '').toUpperCase();
        const isProgress = effectiveStatus.includes('ATEND') || effectiveStatus.includes('INICI');
        const isPaused = effectiveStatus.includes('PAUS');

        const clientFullName = (actionModalAppointment.clientName || actionModalAppointment.customerName || 'Cliente').trim();
        const modalFirstName = clientFullName.split(' ')[0] || 'Cliente';
        const serviceName = actionModalAppointment.serviceName || actionModalAppointment.service || actionModalAppointment.serviceTitle || 'Serviço';
        const { startTimeStr, durationMinutes, durationHhMm, endTimeHhMm } = calculateAppointmentTimes(actionModalAppointment);
        const isModalConfirmed = effectiveStatus.includes('CONFIRM') || effectiveStatus === 'CONFIRMADO';

        const modalClientPhone = (actionModalAppointment.clientPhone || actionModalAppointment.customerPhone || '').replace(/\D/g, '');
        const modalHasPhone = modalClientPhone.length >= 10;
        const modalDefaultMsg = isProgress
          ? `Olá ${modalFirstName}! Tudo bem? Seu atendimento de ${serviceName} no Vagou está em andamento na bancada.`
          : `Olá ${modalFirstName}! Tudo bem? Seu horário de ${serviceName} às ${startTimeStr} no Vagou está registrado. Já estamos à disposição!`;
        const modalWhatsappUrl = modalHasPhone
          ? `https://wa.me/55${modalClientPhone}?text=${encodeURIComponent(modalDefaultMsg)}`
          : null;

        return (
          <div 
            id="professional-appointment-action-modal-overlay"
            className={`fixed inset-0 z-[9999] w-full max-w-[430px] mx-auto h-full flex flex-col overflow-hidden animate-in fade-in duration-150 select-none ${
              isDark ? 'bg-slate-950 text-white' : 'bg-[#F7F9FC] text-[#333E48]'
            }`}
          >
            <div 
              id="professional-appointment-action-modal"
              className={`w-full h-full flex flex-col justify-between overflow-y-auto no-scrollbar relative p-4 gap-4 ${
                isDark ? 'bg-slate-950 text-white' : 'bg-[#F7F9FC] text-[#333E48]'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabeçalho da Seção com Botão Voltar e Status */}
              <div className="flex items-center justify-between border-b pb-2.5 border-[#EDF2F7] dark:border-slate-800/80">
                <button 
                  type="button"
                  id="modal-close-action-button"
                  onClick={() => {
                    hapticLight();
                    setIsActionModalOpen(false);
                    setActionModalAppointment(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs font-bold transition cursor-pointer ${
                    isDark ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800' : 'bg-[#FFFFFF] hover:bg-[#F1F5F9] text-[#005CA9] border border-[#E2E8F0]'
                  }`}
                  title="Voltar"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#005CA9] dark:text-emerald-400" />
                  <span>Voltar</span>
                </button>

                <div className="flex items-center gap-2">
                  {isProgress ? (
                    <span className="px-2 py-0.5 rounded-[4px] bg-[#008B47] text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                      <Zap className="w-3 h-3 text-white fill-white animate-pulse" />
                      <span>Em Atendimento</span>
                    </span>
                  ) : isPaused ? (
                    <span className="px-2 py-0.5 rounded-[4px] bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1">
                      <Pause className="w-3 h-3 text-white fill-white" />
                      <span>Atendimento Pausado</span>
                    </span>
                  ) : (
                    <span className={`px-2 py-0.5 rounded-[4px] font-bold text-[10px] uppercase tracking-wider ${
                      isDark ? 'bg-slate-800 text-slate-300' : 'bg-[#005CA9] text-white'
                    }`}>
                      Aguardando Início
                    </span>
                  )}
                </div>
              </div>

              {/* Informações do Cliente e Serviço + Botão WhatsApp no Modal */}
              <div className={`p-3 flex items-center justify-between gap-3 ${isDark ? 'bg-slate-900 border border-slate-800 rounded-[4px]' : 'caixa-card'}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {(() => {
                    const modalAvatar = getAppointmentClientAvatar(actionModalAppointment);
                    const hasModalAvatar = Boolean(modalAvatar && !failedAvatarUrls[modalAvatar]);
                    return (
                      <div className="caixa-icon-halo shrink-0 overflow-hidden">
                        {hasModalAvatar ? (
                          <img
                            src={modalAvatar}
                            alt={clientFullName}
                            className="w-full h-full object-cover"
                            loading="eager"
                            decoding="async"
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (!target.dataset.retried) {
                                target.dataset.retried = 'true';
                                target.src = modalAvatar + (modalAvatar.includes('?') ? '&' : '?') + 't=' + Date.now();
                              } else {
                                setFailedAvatarUrls((prev) => ({ ...prev, [modalAvatar]: true }));
                              }
                            }}
                          />
                        ) : (
                          <User className="w-5 h-5 stroke-[1.75]" />
                        )}
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm truncate leading-snug">
                      {clientFullName}
                    </h3>
                    <p className="text-xs text-[#5F6C7B] truncate">
                      {serviceName}
                    </p>
                  </div>
                </div>

                {modalWhatsappUrl && (
                  <a
                    href={modalWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => hapticLight()}
                    className={`h-9 px-3 rounded-[4px] border flex items-center gap-1.5 text-xs font-bold transition active:scale-95 cursor-pointer shrink-0 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-750'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    }`}
                    title={`Enviar WhatsApp para ${modalFirstName}`}
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-500" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>

              {/* Régua de Horários e Duração */}
              <div className={`grid grid-cols-3 gap-2 p-2.5 rounded border text-center ${
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                    Início
                  </span>
                  <span className={`font-mono text-xs font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {startTimeStr}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                    Duração
                  </span>
                  <span className={`font-mono text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {durationHhMm} ({durationMinutes}m)
                  </span>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                    Término
                  </span>
                  <span className={`font-mono text-xs font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                    {endTimeHhMm}
                  </span>
                </div>
              </div>

              {/* Feedback de Adição de Tempo */}
              {timeExtensionFeedback && (
                <div className="p-2 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-1.5 animate-in fade-in duration-150">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{timeExtensionFeedback}</span>
                </div>
              )}

              {/* Trava Operacional: Alerta se Cadeira Ocupada pelo atendimento anterior */}
              {isModalBlockedByPrevious && (
                <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-start gap-2 text-amber-300 text-xs animate-in fade-in duration-150">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div className="flex-1">
                    <p className="font-bold text-[11px] leading-tight text-amber-200">Cadeira Ocupada no Momento</p>
                    <p className="text-[10px] text-amber-300/80 mt-0.5 leading-snug">
                      Conclua o atendimento anterior para liberar a cadeira, ou transfira este cliente para um colega da equipe caso o procedimento atual tenha atrasado.
                    </p>
                  </div>
                </div>
              )}

              {/* Feedback de Transferência Concluída */}
              {transferSuccessMessage && (
                <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-white font-bold text-xs flex items-center justify-center gap-2 text-center animate-in fade-in duration-150">
                  <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                  <span>{transferSuccessMessage}</span>
                </div>
              )}

              {/* Seção Principal: Ações Operacionais OU Tela de Transferência para Colega */}
              {isTransferOpen ? (
                <div className="flex flex-col gap-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b pb-1.5 border-slate-800">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>Repassar para Colega</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsTransferOpen(false)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Voltar</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-400">
                    Selecione o profissional disponível para assumir este atendimento:
                  </p>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar pr-0.5">
                    {availableColleaguesForTransfer.map((colleague) => (
                      <div 
                        key={colleague.id}
                        className={`flex items-center justify-between p-2 rounded-lg border transition ${
                          isDark ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {colleague.avatar ? (
                            <img src={colleague.avatar} alt={colleague.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                              {colleague.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate leading-tight">{colleague.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{colleague.roleLabel}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          id={`modal-btn-transfer-to-${colleague.id}`}
                          onClick={() => handleTransferAppointment(colleague)}
                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider shrink-0 transition cursor-pointer active:scale-95"
                        >
                          Repassar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Ação 0: Confirmar Presença (se ainda não confirmado e não iniciado) */}
                  {!isProgress && !isModalConfirmed && (
                    <button
                      type="button"
                      id="modal-btn-confirm-appointment"
                      onClick={() => {
                        const protocolCode = actionModalAppointment.protocolCode || actionModalAppointment.id;
                        handleConfirmAppointment(protocolCode);
                      }}
                      className="w-full py-2.5 px-4 rounded bg-[#005CA9] hover:bg-[#004A87] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition cursor-pointer active:scale-98"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span className="text-white">Confirmar Presença</span>
                    </button>
                  )}

                  {/* Ação 1: Iniciar / Retomar Atendimento OU Pausar */}
                  {!isProgress ? (
                    <button
                      type="button"
                      id="modal-btn-start-appointment"
                      disabled={isModalBlockedByPrevious}
                      onClick={handleStartFromModal}
                      className={`w-full py-2.5 px-4 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition ${
                        isModalBlockedByPrevious
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer active:scale-98'
                      }`}
                      title={isModalBlockedByPrevious ? 'Conclua o atendimento anterior para iniciar este' : undefined}
                    >
                      <Play className={`w-4 h-4 ${isModalBlockedByPrevious ? 'text-slate-500' : 'text-white fill-white'}`} />
                      <span className={isModalBlockedByPrevious ? '' : 'text-white'}>{isModalBlockedByPrevious ? 'Início Bloqueado (Cadeira Ocupada)' : (isPaused ? 'Retomar Atendimento' : 'Iniciar Atendimento')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      id="modal-btn-pause-appointment"
                      onClick={handlePauseFromModal}
                      className="w-full py-2.5 px-4 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition cursor-pointer active:scale-98"
                    >
                      <Pause className="w-4 h-4 text-white fill-white" />
                      <span>Pausar Atendimento</span>
                    </button>
                  )}

                  {/* Ação 2: Adicionar Mais Tempo (Estender) */}
                  <div className={`p-2.5 rounded border flex flex-col gap-1.5 ${
                    isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>Adicionar Mais Tempo</span>
                      </span>
                      <span className="text-[9px] text-slate-500">
                        Estende o término
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[5, 10, 15, 30].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          id={`modal-btn-add-time-${mins}`}
                          onClick={() => handleAddMoreTime(mins)}
                          className={`py-1.5 px-1 rounded border border-dashed font-mono font-bold text-[11px] flex items-center justify-center gap-0.5 transition cursor-pointer active:scale-95 ${
                            isDark 
                              ? 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-white' 
                              : 'border-emerald-500/60 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                          }`}
                          title={`Adicionar +${mins} minutos à duração`}
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>{mins}m</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ação 3: Finalizar Serviço & Cobrar PIX */}
                  <button
                    type="button"
                    id="modal-btn-complete-appointment"
                    onClick={handleCompleteFromModal}
                    className="w-full py-2.5 px-4 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition cursor-pointer active:scale-98"
                  >
                    <Check className="w-4 h-4 text-white stroke-[2.5]" />
                    <span>Finalizar Serviço</span>
                  </button>

                  {/* Ação 4: Repassar / Transferir Atendimento para Colega do Estabelecimento (Apenas atendimentos NÃO iniciados) */}
                  {!isProgress && (
                    <button
                      type="button"
                      id="modal-btn-open-transfer"
                      onClick={() => {
                        hapticLight();
                        setIsTransferOpen(true);
                      }}
                      className={`w-full py-2 px-3 rounded border font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 ${
                        isDark 
                          ? 'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 hover:text-white' 
                          : 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700'
                      }`}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Transferir para Colega</span>
                    </button>
                  )}

                  {/* Ação 5: Cancelar Atendimento (Abre Modal de Justificativa) */}
                  <button
                    type="button"
                    id="modal-btn-open-cancel"
                    onClick={() => {
                      hapticLight();
                      setCancelJustification('');
                      setIsCancelModalOpen(true);
                    }}
                    className={`w-full py-2 px-3 rounded border font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 ${
                      isDark
                        ? 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-white'
                        : 'border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar Atendimento</span>
                  </button>
                </div>
              )}

              {/* Botão Secundário Fechar */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  id="modal-btn-dismiss"
                  onClick={() => {
                    hapticLight();
                    setIsCancelModalOpen(false);
                    setIsActionModalOpen(false);
                    setActionModalAppointment(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white font-medium py-1 transition cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Modal de Justificativa de Cancelamento de Atendimento (Sobreposto ao Modal Operacional) */}
            {isCancelModalOpen && (
              <div
                id="professional-cancel-justification-modal-overlay"
                className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
                onClick={() => {
                  hapticLight();
                  setIsCancelModalOpen(false);
                }}
              >
                <div
                  id="professional-cancel-justification-modal"
                  className={`w-full max-w-sm rounded border p-4 shadow-2xl space-y-3.5 relative animate-in zoom-in-95 duration-150 ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Cabeçalho do Modal de Justificativa */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${
                        isDark ? 'bg-rose-500/15 text-rose-400' : 'bg-rose-100 text-rose-600'
                      }`}>
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-black leading-tight truncate">
                          Cancelar Atendimento
                        </h3>
                        <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {clientFullName} • {startTimeStr}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setIsCancelModalOpen(false);
                      }}
                      className={`p-1.5 rounded transition cursor-pointer ${
                        isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                      aria-label="Fechar modal de justificativa"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Motivos Rápidos */}
                  <div className="space-y-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      Motivo do Cancelamento
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        'Cliente desmarcou',
                        'Não compareceu (No-Show)',
                        'Imprevisto do profissional',
                        'Solicitou reagendamento',
                      ].map((preset) => {
                        const isSelected = cancelJustification === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              hapticLight();
                              setCancelJustification(preset);
                            }}
                            className={`py-1.5 px-2 rounded border text-[10px] font-bold text-left truncate transition cursor-pointer ${
                              isSelected
                                ? 'bg-rose-600 border-rose-600 text-white'
                                : isDark
                                ? 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Campo de Justificativa */}
                  <div className="space-y-1">
                    <label
                      htmlFor="cancel-justification-textarea"
                      className={`text-[10px] font-bold uppercase tracking-wider block ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      Justificativa Obrigatória
                    </label>
                    <textarea
                      id="cancel-justification-textarea"
                      rows={3}
                      value={cancelJustification}
                      onChange={(e) => setCancelJustification(e.target.value)}
                      placeholder="Descreva o motivo do cancelamento..."
                      className={`w-full rounded border p-2.5 text-xs focus:outline-none transition resize-none ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-rose-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-rose-500'
                      }`}
                    />
                  </div>

                  {/* Ações Fixas do Modal de Justificativa */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      id="cancel-modal-btn-back"
                      onClick={() => {
                        hapticLight();
                        setIsCancelModalOpen(false);
                      }}
                      className={`py-2.5 px-3 rounded border font-bold text-xs uppercase tracking-wider transition cursor-pointer ${
                        isDark
                          ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                          : 'border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      id="cancel-modal-btn-confirm"
                      disabled={!cancelJustification.trim()}
                      onClick={handleCancelAppointmentFromModal}
                      className={`py-2.5 px-3 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                        cancelJustification.trim()
                          ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer active:scale-98 shadow-xs'
                          : isDark
                          ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${cancelJustification.trim() ? 'text-white' : ''}`} />
                      <span className={cancelJustification.trim() ? 'text-white' : ''}>Confirmar</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Modal de Checkout PIX Pós-Serviço */}
      <PixCheckoutModal
        isOpen={Boolean(pixCheckoutAppointment)}
        onClose={() => setPixCheckoutAppointment(null)}
        salonName={adminSettings?.salonName || salonName}
        salonCity={adminSettings?.cidade || 'BRASIL'}
        clientName={pixCheckoutAppointment?.clientName || pixCheckoutAppointment?.customerName || 'Cliente'}
        clientPhone={pixCheckoutAppointment?.clientPhone || pixCheckoutAppointment?.customerPhone || ''}
        serviceTitle={pixCheckoutAppointment?.serviceTitle || pixCheckoutAppointment?.service || 'Atendimento'}
        initialAmount={Number(pixCheckoutAppointment?.totalPrice || 45)}
        protocolCode={pixCheckoutAppointment?.protocolCode}
        pixKeys={adminSettings?.pixKeys}
        fallbackPixKey={adminSettings?.pixKey}
        onConfirmPaid={(paidAmount, method) => {
          if (!pixCheckoutAppointment || !onUpdateAppointments) return;
          const targetCode = pixCheckoutAppointment.protocolCode || pixCheckoutAppointment.id;
          const updated = appointments.map((a) => {
            if (a.protocolCode === targetCode || a.id === targetCode) {
              return {
                ...a,
                status: 'CONCLUÍDO',
                totalPrice: paidAmount,
                isPaid: true,
                paymentMethod: method,
                paidAt: new Date().toISOString(),
              };
            }
            return a;
          });
          onUpdateAppointments(updated);
          try {
            localStorage.setItem('vagou_salon_appointments', JSON.stringify(updated));
          } catch {}
        }}
      />

      {/* Modal de Rastreamento em Tempo Real do Cliente */}
      {liveTrackingAppointment && (
        <LiveTrackingDrawerModal
          isOpen={Boolean(liveTrackingAppointment)}
          appointment={liveTrackingAppointment}
          initialTab="map"
          viewerRole="salon"
          onClose={() => setLiveTrackingAppointment(null)}
          onUpdateAppointment={(updated) => {
            if (!onUpdateAppointments) return;
            const targetCode = updated.protocolCode || updated.id;
            const updatedList = (appointments.length > 0 ? appointments : effectiveAppointments).map((a) => {
              if (a.protocolCode === targetCode || a.id === targetCode) {
                return updated;
              }
              return a;
            });
            onUpdateAppointments(updatedList);
            try {
              localStorage.setItem('vagou_salon_appointments', JSON.stringify(updatedList));
            } catch {}
          }}
        />
      )}
    </div>
  );
};
