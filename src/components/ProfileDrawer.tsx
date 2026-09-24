import React, { useState, useEffect } from 'react';
import { 
  X, User, Mail, Phone, MapPin, Calendar, Clock, 
  Check, Moon, Sun, MessageCircle, MessageSquare, Send, ShieldCheck, 
  ChevronRight, ArrowRight, Sparkles, CheckCircle2, 
  Scissors, LayoutDashboard, Store, LogOut, Users, DollarSign, Wrench, Wallet,
  ArrowLeftRight, AlertCircle, RotateCcw, Timer, Ban, HelpCircle, Info, Layers
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticSuccess, hapticMedium } from '../utils/haptics';
import { BookingAppointment, UserProfile, UserPersona, ClientSwapGovernance, SwapTargetQueueItem } from '../types';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userAvatarUrl?: string;
  onUpdateUserName?: (name: string) => void;
  onNavigateToSchedule?: () => void;
  onNavigateTab?: (tab: 'home' | 'servicos' | 'vagas' | 'espaco' | 'equipe' | 'financeiro' | 'caixa' | 'personalizar' | 'utilidades') => void;
  salonName?: string;
  salonPhone?: string;
  isSalonLoggedIn?: boolean;
  currentPersona?: UserPersona;
  isProAdmin?: boolean;
  onRequestManage?: () => void;
  onOpenAdminPanel?: () => void;
  onLoginSalon?: (pin: string) => boolean;
  onLogoutSalon?: () => void;
  allAppointments?: BookingAppointment[];
  onUpdateAppointments?: (appointments: BookingAppointment[]) => void;
  onNavigateToUserAppointments?: () => void;
  onNavigateToUserDashboard?: () => void;
}

const DEFAULT_SWAP_GOVERNANCE: ClientSwapGovernance = {
  optIn: true,
  monthlyQuota: 2,
  usedThisMonth: 0,
  activeRejections: 0,
  consecutiveTimeouts: 0,
  isBannedFromRequesting: false,
};

export interface CandidateSlotInfo {
  time: string;
  duration: string;
  durationMinutes: number;
  customerName: string;
  customerPhone?: string;
  service?: string;
  isLeadTimeValid: boolean;
  leadTimeReason?: string;
  isDurationCompatible: boolean;
  durationReason?: string;
  isEligible: boolean;
}

export const parseDurationInMinutes = (durationStr?: string): number => {
  if (!durationStr) return 45;
  const lower = durationStr.toLowerCase().trim();
  let total = 0;
  const hourMatch = lower.match(/(\d+)\s*h/);
  if (hourMatch) {
    total += parseInt(hourMatch[1], 10) * 60;
  }
  const minMatch = lower.match(/(\d+)\s*m/);
  if (minMatch) {
    total += parseInt(minMatch[1], 10);
  }
  if (!hourMatch && !minMatch) {
    const numOnly = parseInt(lower.replace(/\D/g, ''), 10);
    if (!isNaN(numOnly) && numOnly > 0) total = numOnly;
  }
  return total > 0 ? total : 45;
};

export const checkSlotLeadTime = (slotTime: string, dayGroup?: string): { isLeadTimeValid: boolean; reason?: string } => {
  const isToday = !dayGroup || dayGroup.toLowerCase().includes('hoje');
  if (!isToday) {
    return { isLeadTimeValid: true };
  }

  const parts = slotTime.split(':');
  if (parts.length < 2) return { isLeadTimeValid: true };

  const slotHour = parseInt(parts[0], 10);
  const slotMinute = parseInt(parts[1], 10);
  if (isNaN(slotHour) || isNaN(slotMinute)) return { isLeadTimeValid: true };

  const now = new Date();
  const slotDate = new Date();
  slotDate.setHours(slotHour, slotMinute, 0, 0);

  const diffMs = slotDate.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 0) {
    return { isLeadTimeValid: false, reason: 'Horário encerrado' };
  }

  if (diffMinutes < 60) {
    return { isLeadTimeValid: false, reason: `Menos de 1h de antecedência (${diffMinutes > 0 ? diffMinutes + 'min' : 'agora'})` };
  }

  return { isLeadTimeValid: true };
};

const DEFAULT_PROFILE: UserProfile = {
  name: 'Usuário',
  email: '',
  phone: '',
  address: '',
  swapGovernance: DEFAULT_SWAP_GOVERNANCE,
};

const DEFAULT_APPOINTMENTS: BookingAppointment[] = [];

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  userName = 'Usuário',
  userAvatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  onUpdateUserName,
  onNavigateToSchedule,
  onNavigateTab,
  salonName = 'Meu Estabelecimento',
  salonPhone = '',
  isSalonLoggedIn = false,
  currentPersona = 'cliente',
  isProAdmin = false,
  onRequestManage,
  onOpenAdminPanel,
  onLoginSalon,
  onLogoutSalon,
  allAppointments,
  onUpdateAppointments,
  onNavigateToUserAppointments,
  onNavigateToUserDashboard,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [activeSubTab, setActiveSubTab] = useState<'menu' | 'agenda' | 'dados' | 'config'>('menu');

  // Estado do Chat Interno no App
  const [isAppChatOpen, setIsAppChatOpen] = useState(false);
  const [drawerChatMessages, setDrawerChatMessages] = useState<Array<{ id: string; sender: 'user' | 'salon' | 'system'; text: string; timestamp: string }>>([
    {
      id: 'sys-1',
      sender: 'system',
      text: 'Chat oficial do aplicativo. Suas mensagens são seguras e registradas no Vagou.',
      timestamp: '10:00',
    },
    {
      id: 'salon-1',
      sender: 'salon',
      text: `Olá! Como podemos ajudar com seu agendamento na ${salonName}?`,
      timestamp: '10:01',
    }
  ]);
  const [inputDrawerChatMessage, setInputDrawerChatMessage] = useState('');

  const handleSendDrawerChatMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputDrawerChatMessage.trim()) return;
    hapticSuccess();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newMsg = {
      id: `user-${Date.now()}`,
      sender: 'user' as const,
      text: inputDrawerChatMessage.trim(),
      timestamp: timeStr,
    };
    setDrawerChatMessages(prev => [...prev, newMsg]);
    setInputDrawerChatMessage('');

    setTimeout(() => {
      const replyTime = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
      setDrawerChatMessages(prev => [
        ...prev,
        {
          id: `salon-${Date.now()}`,
          sender: 'salon',
          text: 'Recebemos sua mensagem! Nossa equipe responderá em instantes pelo próprio aplicativo.',
          timestamp: replyTime,
        }
      ]);
    }, 1100);
  };

  // Estado dos Dados Pessoais do Usuário
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('vagou_user_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_PROFILE, ...parsed, name: userName || parsed.name };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_PROFILE, name: userName };
  });

  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccessToast, setSavedSuccessToast] = useState(false);

  // Estado dos Agendamentos
  const [appointments, setAppointments] = useState<BookingAppointment[]>(() => {
    if (allAppointments && allAppointments.length > 0) {
      return allAppointments;
    }
    try {
      const saved = localStorage.getItem('vagou_user_appointments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_APPOINTMENTS;
  });

  useEffect(() => {
    if (allAppointments && allAppointments.length > 0) {
      setAppointments(allAppointments);
    }
  }, [allAppointments]);

  // Governança e Regras de Reciprocidade de Troca
  const [swapGovernance, setSwapGovernance] = useState<ClientSwapGovernance>(() => {
    try {
      const saved = localStorage.getItem('vagou_client_swap_governance');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SWAP_GOVERNANCE,
          ...parsed,
          isBannedFromRequesting: (parsed.activeRejections || 0) >= 5,
        };
      }
    } catch {}
    return profile.swapGovernance || DEFAULT_SWAP_GOVERNANCE;
  });

  const updateSwapGovernance = (updater: (prev: ClientSwapGovernance) => ClientSwapGovernance) => {
    setSwapGovernance(prev => {
      const next = updater(prev);
      next.isBannedFromRequesting = (next.activeRejections || 0) >= 5;
      try {
        localStorage.setItem('vagou_client_swap_governance', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Modais de Bloqueio Educativo / Alerta de Governança
  const [governanceWarning, setGovernanceWarning] = useState<{
    isOpen: boolean;
    type: 'optInRequired' | 'banned' | 'quotaExceeded';
  } | null>(null);

  // Modal e Fluxo de Solicitação de Troca de Horário (Cascata até 3 Alvos: B -> C -> D)
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapTargetAppointment, setSwapTargetAppointment] = useState<BookingAppointment | null>(null);
  const [selectedSwapSlots, setSelectedSwapSlots] = useState<string[]>([]);
  const [swapIncentiveMessage, setSwapIncentiveMessage] = useState<string>(
    'Amiga(o)! Por favor, me dê essa ajuda, preciso realizar o serviço hoje, mas tive um imprevisto e só consigo nesse horário. Se você puder aceitar, serei eternamente grato(a)!'
  );

  // Helper para buscar slots ocupados do mesmo dia e profissional para propor troca (com travas de antecedência e duração)
  const getCandidateSlots = (appointment: BookingAppointment): CandidateSlotInfo[] => {
    const list = allAppointments && allAppointments.length > 0 ? allAppointments : appointments;
    const currentPro = appointment.professionalName || appointment.professional || '';
    const currentDay = appointment.dayGroup || (appointment.dateTime ? appointment.dateTime.split(',')[0].trim() : 'Hoje');
    const currentTime = appointment.time || (appointment.dateTime ? appointment.dateTime.split('às')[1]?.trim() : '');
    const requesterDuration = parseDurationInMinutes(appointment.duration || '45 min');

    let rawCandidates = list.filter(item => {
      const itemPro = item.professionalName || item.professional || '';
      const itemDay = item.dayGroup || (item.dateTime ? item.dateTime.split(',')[0].trim() : 'Hoje');
      const itemTime = item.time || (item.dateTime ? item.dateTime.split('às')[1]?.trim() : '');
      const isSamePro = !itemPro || !currentPro || itemPro.toLowerCase() === currentPro.toLowerCase();
      const isSameDay = !itemDay || !currentDay || itemDay.toLowerCase().includes(currentDay.toLowerCase()) || currentDay.toLowerCase().includes(itemDay.toLowerCase());
      const isDifferentTime = itemTime !== currentTime;
      return isSamePro && isSameDay && isDifferentTime && item.status !== 'CANCELADO';
    });

    // Apenas agendamentos reais concorrentes da mesma agenda/data
    return rawCandidates.map(item => {
      const time = item.time || (item.dateTime ? item.dateTime.split('às')[1]?.trim() : '15:00');
      const duration = item.duration || '45 min';
      const durationMinutes = parseDurationInMinutes(duration);
      const isDurationCompatible = durationMinutes <= requesterDuration;
      const durationReason = !isDurationCompatible 
        ? `Duração incompatível (${durationMinutes}min > ${requesterDuration}min)` 
        : undefined;

      const leadTimeCheck = checkSlotLeadTime(time, item.dayGroup || currentDay);
      const isLeadTimeValid = leadTimeCheck.isLeadTimeValid;
      const leadTimeReason = leadTimeCheck.reason;

      const isEligible = isDurationCompatible && isLeadTimeValid;

      return {
        time,
        duration,
        durationMinutes,
        customerName: item.customerName || item.clientName || `Cliente das ${time}`,
        customerPhone: item.customerPhone || item.clientPhone,
        service: item.service || item.serviceTitle,
        isLeadTimeValid,
        leadTimeReason,
        isDurationCompatible,
        durationReason,
        isEligible,
      };
    });
  };

  // Alternar seleção de slot (até 3 na fila em cascata)
  const handleToggleSwapSlot = (slotTime: string) => {
    hapticLight();
    setSelectedSwapSlots(prev => {
      if (prev.includes(slotTime)) {
        return prev.filter(s => s !== slotTime);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, slotTime];
    });
  };

  // Disparo da Fila em Cascata (Cliente A seleciona até 3 horários: B -> C -> D)
  const handleSendSwapProposal = (appointment: BookingAppointment, targetSlots: string[], message: string) => {
    if (!swapGovernance.optIn) {
      setGovernanceWarning({ isOpen: true, type: 'optInRequired' });
      return;
    }
    if (swapGovernance.isBannedFromRequesting || swapGovernance.activeRejections >= 5) {
      setGovernanceWarning({ isOpen: true, type: 'banned' });
      return;
    }
    if (swapGovernance.usedThisMonth >= swapGovernance.monthlyQuota) {
      setGovernanceWarning({ isOpen: true, type: 'quotaExceeded' });
      return;
    }
    if (targetSlots.length === 0) return;

    hapticSuccess();
    const candidateSlots = getCandidateSlots(appointment);

    // Constrói a fila em cascata
    const cascadeTargets: SwapTargetQueueItem[] = targetSlots.map((slot, index) => {
      const targetItem = candidateSlots.find(item => item.time === slot);
      return {
        slotTime: slot,
        customerName: targetItem?.customerName || `Cliente das ${slot}`,
        customerPhone: targetItem?.customerPhone || '',
        status: 'pending',
        sentAt: index === 0 ? Date.now() : undefined,
        expiresAt: index === 0 ? Date.now() + 20 * 60 * 1000 : undefined,
      };
    });

    const firstTarget = cascadeTargets[0];

    const updatedSwap = {
      isClientSwap: true,
      message: message.trim(),
      clientA: {
        name: profile.name || userName || 'Usuário',
        originalTime: appointment.time || '14:00',
        requestedTime: firstTarget.slotTime,
        phone: profile.phone || '',
      },
      clientB: {
        name: firstTarget.customerName || 'Cliente do Horário',
        originalTime: firstTarget.slotTime,
        accepted: false,
        rejected: false,
        phone: firstTarget.customerPhone || '',
      },
      status: 'pending_client_b' as const,
      rejectedSlots: appointment.swapRequest?.rejectedSlots || [],
      cascadeTargets,
      currentCascadeIndex: 0,
      timeoutSecondsPerTarget: 1200, // 20 min
      lastTargetUpdatedAt: Date.now(),
    };

    // Incrementa cota de trocas do mês
    updateSwapGovernance(prev => ({
      ...prev,
      usedThisMonth: prev.usedThisMonth + 1,
    }));

    const newAppointments = (allAppointments && allAppointments.length > 0 ? allAppointments : appointments).map(item => {
      if (item.protocolCode === appointment.protocolCode || item.id === appointment.id) {
        return {
          ...item,
          status: 'ALTERADO',
          swapRequest: updatedSwap,
        };
      }
      return item;
    });

    setAppointments(newAppointments);
    try {
      localStorage.setItem('vagou_user_appointments', JSON.stringify(newAppointments));
    } catch {}
    if (onUpdateAppointments) {
      onUpdateAppointments(newAppointments);
    }
    setIsSwapModalOpen(false);
  };

  // Avanço automático na cascata (caso o alvo recuse ativamente ou o tempo de 20 min expire)
  const handleAdvanceCascade = (appointment: BookingAppointment, reason: 'rejected' | 'timeout') => {
    hapticLight();
    const currentSwap = appointment.swapRequest;
    if (!currentSwap || !currentSwap.cascadeTargets) return;

    const currentIndex = currentSwap.currentCascadeIndex ?? 0;
    const currentTarget = currentSwap.cascadeTargets[currentIndex];
    if (!currentTarget) return;

    const updatedTargets = [...currentSwap.cascadeTargets];
    updatedTargets[currentIndex] = {
      ...currentTarget,
      status: reason === 'rejected' ? 'rejected' : 'timeout',
    };

    const nextIndex = currentIndex + 1;
    const hasNext = nextIndex < updatedTargets.length;

    if (hasNext) {
      // Repassa para o próximo alvo da fila (ex: Cliente C ou D)
      const nextTarget = updatedTargets[nextIndex];
      updatedTargets[nextIndex] = {
        ...nextTarget,
        status: 'pending',
        sentAt: Date.now(),
        expiresAt: Date.now() + 20 * 60 * 1000,
      };

      const updatedSwap = {
        ...currentSwap,
        cascadeTargets: updatedTargets,
        currentCascadeIndex: nextIndex,
        clientB: {
          name: nextTarget.customerName || `Cliente das ${nextTarget.slotTime}`,
          originalTime: nextTarget.slotTime,
          accepted: false,
          rejected: false,
          phone: nextTarget.customerPhone || '',
        },
        clientA: {
          ...currentSwap.clientA,
          requestedTime: nextTarget.slotTime,
        },
        lastTargetUpdatedAt: Date.now(),
        status: 'pending_client_b' as const,
      };

      const newAppointments = (allAppointments && allAppointments.length > 0 ? allAppointments : appointments).map(item => {
        if (item.protocolCode === appointment.protocolCode || item.id === appointment.id) {
          return {
            ...item,
            swapRequest: updatedSwap,
          };
        }
        return item;
      });

      setAppointments(newAppointments);
      try {
        localStorage.setItem('vagou_user_appointments', JSON.stringify(newAppointments));
      } catch {}
      if (onUpdateAppointments) {
        onUpdateAppointments(newAppointments);
      }
    } else {
      // Fila esgotada (todos os alvos recusaram ou expiraram)
      const updatedSwap = {
        ...currentSwap,
        cascadeTargets: updatedTargets,
        status: 'rejected' as const,
      };

      const newAppointments = (allAppointments && allAppointments.length > 0 ? allAppointments : appointments).map(item => {
        if (item.protocolCode === appointment.protocolCode || item.id === appointment.id) {
          return {
            ...item,
            status: 'CONFIRMADO',
            swapRequest: updatedSwap,
          };
        }
        return item;
      });

      setAppointments(newAppointments);
      try {
        localStorage.setItem('vagou_user_appointments', JSON.stringify(newAppointments));
      } catch {}
      if (onUpdateAppointments) {
        onUpdateAppointments(newAppointments);
      }
    }
  };

  // Cancelar proposta enviada
  const handleCancelSwapProposal = (appointment: BookingAppointment) => {
    hapticLight();
    const newAppointments = (allAppointments && allAppointments.length > 0 ? allAppointments : appointments).map(item => {
      if (item.protocolCode === appointment.protocolCode || item.id === appointment.id) {
        const { swapRequest, ...rest } = item;
        return {
          ...rest,
          status: 'CONFIRMADO',
        };
      }
      return item;
    });

    setAppointments(newAppointments);
    try {
      localStorage.setItem('vagou_user_appointments', JSON.stringify(newAppointments));
    } catch {}
    if (onUpdateAppointments) {
      onUpdateAppointments(newAppointments);
    }
  };

  // Cliente Alvo aceita proposta de troca
  const handleAcceptIncomingSwap = (appointmentWithSwap: BookingAppointment) => {
    hapticSuccess();
    const currentSwap = appointmentWithSwap.swapRequest;
    if (!currentSwap) return;

    // Reseta vácuos consecutivos se respondeu positivamente
    updateSwapGovernance(prev => ({
      ...prev,
      consecutiveTimeouts: 0,
    }));

    const updatedTargets = currentSwap.cascadeTargets ? [...currentSwap.cascadeTargets] : [];
    const currentIndex = currentSwap.currentCascadeIndex ?? 0;
    if (updatedTargets[currentIndex]) {
      updatedTargets[currentIndex] = {
        ...updatedTargets[currentIndex],
        status: 'accepted',
      };
    }

    const updatedSwap = {
      ...currentSwap,
      cascadeTargets: updatedTargets,
      clientB: {
        ...currentSwap.clientB,
        accepted: true,
        rejected: false,
      },
      status: 'pending_salon_confirmation' as const,
    };

    const newAppointments = (allAppointments && allAppointments.length > 0 ? allAppointments : appointments).map(item => {
      if (item.protocolCode === appointmentWithSwap.protocolCode || item.id === appointmentWithSwap.id) {
        return {
          ...item,
          swapRequest: updatedSwap,
        };
      }
      return item;
    });

    setAppointments(newAppointments);
    try {
      localStorage.setItem('vagou_user_appointments', JSON.stringify(newAppointments));
    } catch {}
    if (onUpdateAppointments) {
      onUpdateAppointments(newAppointments);
    }
  };

  // Cliente Alvo recusa ativamente a troca (Soma 1 no contador de recusas ativas com limite de 5)
  const handleRejectIncomingSwap = (appointmentWithSwap: BookingAppointment) => {
    hapticLight();
    // Incrementa recusa ativa do cliente
    updateSwapGovernance(prev => {
      const newRejections = prev.activeRejections + 1;
      return {
        ...prev,
        activeRejections: newRejections,
        isBannedFromRequesting: newRejections >= 5,
      };
    });

    // Avança para o próximo da cascata
    handleAdvanceCascade(appointmentWithSwap, 'rejected');
  };

  // Cliente Alvo deixa tempo expirar (Simulação de Vácuo / Timeout)
  const handleTimeoutIncomingSwap = (appointmentWithSwap: BookingAppointment) => {
    hapticLight();
    // Incrementa contador de vácuos consecutivos
    updateSwapGovernance(prev => {
      const newTimeouts = prev.consecutiveTimeouts + 1;
      const shouldDeactivate = newTimeouts >= 3;
      return {
        ...prev,
        consecutiveTimeouts: newTimeouts,
        optIn: shouldDeactivate ? false : prev.optIn,
      };
    });

    // Avança para o próximo da cascata sem penalidade imediata se for < 3
    handleAdvanceCascade(appointmentWithSwap, 'timeout');
  };

  // Propostas recebidas (Incoming Swaps) pendentes de resposta do cliente
  const incomingSwapRequests = (allAppointments && allAppointments.length > 0 ? allAppointments : appointments).filter(
    app => app.swapRequest?.isClientSwap && app.swapRequest?.status === 'pending_client_b'
  );

  // Preferências
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('vagou_notifications_pref') !== 'disabled';
  });

  const [hapticsEnabled, setHapticsEnabled] = useState(() => {
    return localStorage.getItem('vagou_haptics_pref') !== 'disabled';
  });

  // Salvar preferências
  const handleToggleNotifications = () => {
    hapticLight();
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    localStorage.setItem('vagou_notifications_pref', next ? 'enabled' : 'disabled');
  };

  const handleToggleHaptics = () => {
    hapticLight();
    const next = !hapticsEnabled;
    setHapticsEnabled(next);
    localStorage.setItem('vagou_haptics_pref', next ? 'enabled' : 'disabled');
  };

  const handleToggleSwapOptIn = () => {
    hapticLight();
    updateSwapGovernance(prev => ({
      ...prev,
      optIn: !prev.optIn,
    }));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    hapticSuccess();
    try {
      localStorage.setItem('vagou_user_profile', JSON.stringify(profile));
    } catch {
      // ignore
    }
    if (onUpdateUserName && profile.name.trim()) {
      onUpdateUserName(profile.name.trim());
    }
    setIsEditing(false);
    setSavedSuccessToast(true);
    setTimeout(() => {
      setSavedSuccessToast(false);
    }, 2500);
  };

  // Fechar ao pressionar a tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* Container do Drawer com limite de largura mobile */}
      <div 
        className={`w-full max-w-md h-full flex flex-col shadow-2xl transition-transform animate-in slide-in-from-right duration-250 cursor-default ${
          isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. CABEÇALHO DO MENU DO USUÁRIO */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            {activeSubTab !== 'menu' ? (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setActiveSubTab('menu');
                  setIsEditing(false);
                }}
                className={`p-1.5 rounded transition active:scale-95 cursor-pointer ${
                  isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-700'
                }`}
                title="Voltar ao Menu"
                aria-label="Voltar ao Menu"
              >
                <ChevronRight className="w-5 h-5 rotate-180 text-emerald-500" />
              </button>
            ) : null}

            <div>
              <h2 className="text-sm font-bold tracking-tight uppercase font-['Poppins']">
                {activeSubTab === 'menu' && 'Menu do Cliente'}
                {activeSubTab === 'agenda' && 'Minha Agenda'}
                {activeSubTab === 'dados' && 'Meus Dados Pessoais'}
                {activeSubTab === 'config' && 'Configurações'}
              </h2>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {salonName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onClose();
            }}
            className={`w-8 h-8 rounded flex items-center justify-center transition active:scale-95 cursor-pointer ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900'
            }`}
            title="Fechar menu"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. CORPO DO DRAWER COM ROLAGEM */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* TOAST DE FEEDBACK DE SALVAMENTO */}
          {savedSuccessToast && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded flex items-center gap-2.5 text-emerald-400 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Dados pessoais atualizados com sucesso!</span>
            </div>
          )}

          {/* VISTA 1: MENU PRINCIPAL DE OPÇÕES */}
          {activeSubTab === 'menu' && (
            <div className="space-y-4">
              {/* CARD DE IDENTIFICAÇÃO DO USUÁRIO COM BOTÃO DE TEMA NO LADO DIREITO OPOSTO */}
              <div className={`p-3.5 sm:p-4 rounded border flex items-center justify-between gap-3 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded overflow-hidden ring-2 ring-emerald-500 shrink-0 bg-slate-800 flex items-center justify-center">
                    {userAvatarUrl ? (
                      <img 
                        src={userAvatarUrl} 
                        alt={profile.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-base font-bold text-white">
                        {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold truncate">{profile.name}</h3>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                        currentPersona === 'admin'
                          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                          : currentPersona === 'profissional'
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {currentPersona === 'admin' ? 'Admin Dono' : currentPersona === 'profissional' ? 'Profissional' : 'Cliente'}
                      </span>
                    </div>
                    <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {profile.email}
                    </p>
                    <p className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {profile.phone}
                    </p>
                  </div>
                </div>

                {/* Botão Modo Claro/Escuro (Lado direito oposto ao avatar) */}
                <button
                  type="button"
                  id="drawer-theme-toggle-btn"
                  onClick={() => {
                    hapticLight();
                    toggleTheme();
                  }}
                  className={`px-2.5 py-2 rounded border flex flex-col items-center justify-center gap-1 transition active:scale-95 cursor-pointer shrink-0 ${
                    isDark 
                      ? 'bg-slate-800/90 hover:bg-slate-750 text-amber-400 border-slate-700' 
                      : 'bg-slate-100 hover:bg-slate-200 text-amber-600 border-slate-200 shadow-xs'
                  }`}
                  title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
                  aria-label="Alternar Modo Claro / Escuro"
                >
                  {isDark ? (
                    <Moon className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-[9.5px] font-bold tracking-tight uppercase whitespace-nowrap">
                    {isDark ? 'Escuro' : 'Claro'}
                  </span>
                </button>
              </div>

              {/* LISTA DE OPÇÕES DO MENU */}
              <div className="space-y-2">
                {/* MODO PRO - ADMINISTRADOR: Caixa + Agenda + Financeiro */}
                {currentPersona !== 'cliente' && isProAdmin && (
                  <>
                    <button
                      type="button"
                      id="menu-option-caixa"
                      onClick={() => {
                        hapticLight();
                        onClose();
                        onNavigateTab?.('caixa');
                      }}
                      className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                        isDark 
                          ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold font-['Poppins']">Caixa (Dia & Semana)</div>
                          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Entradas de hoje, métodos de pagamento e metas
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </button>

                    <button
                      type="button"
                      id="menu-option-agenda-admin"
                      onClick={() => {
                        hapticLight();
                        onClose();
                        onNavigateTab?.('vagas');
                      }}
                      className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                        isDark 
                          ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold font-['Poppins']">Agenda Geral</div>
                          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Todos os atendimentos e horários
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </button>
                  </>
                )}

                {/* MODO PRO - MEMBRO / PROFISSIONAL: Apenas Caixa, Agenda e Comissões Próprias */}
                {currentPersona !== 'cliente' && !isProAdmin && (
                  <>
                    <button
                      type="button"
                      id="menu-option-caixa-pro"
                      onClick={() => {
                        hapticLight();
                        onClose();
                        onNavigateTab?.('caixa');
                      }}
                      className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                        isDark 
                          ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold font-['Poppins']">Caixa (Dia & Semana)</div>
                          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Suas entradas e metas da cadeira
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </button>

                    <button
                      type="button"
                      id="menu-option-agenda"
                      onClick={() => {
                        hapticLight();
                        onClose();
                        onNavigateTab?.('vagas');
                      }}
                      className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                        isDark 
                          ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold font-['Poppins']">Minha Agenda</div>
                          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Seus atendimentos e agendamentos
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </button>

                    <button
                      type="button"
                      id="menu-option-comissoes"
                      onClick={() => {
                        hapticLight();
                        onClose();
                        onNavigateTab?.('financeiro');
                      }}
                      className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                        isDark 
                          ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold font-['Poppins']">Minhas Comissões</div>
                          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Seus repasses e atendimentos realizados
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </button>
                  </>
                )}

                {/* Opção: Minha Agenda */}
                {currentPersona === 'cliente' && (
                  <button
                    type="button"
                    id="menu-option-minha-agenda-client"
                    onClick={() => {
                      hapticLight();
                      onClose();
                      if (onNavigateToUserAppointments) {
                        onNavigateToUserAppointments();
                      } else {
                        setActiveSubTab('agenda');
                      }
                    }}
                    className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                      isDark 
                        ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                        : 'bg-white hover:bg-emerald-50/50 border-emerald-200 text-slate-900 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-xs font-bold font-['Poppins']">Minha Agenda</div>
                        <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Ver agendamentos e propostas de permuta
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  </button>
                )}

                {/* Opção: Meus Dados Pessoais */}
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    if (onNavigateToUserDashboard) {
                      onClose();
                      onNavigateToUserDashboard();
                    } else {
                      setActiveSubTab('dados');
                    }
                  }}
                  className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-['Poppins']">Meus Dados Pessoais</div>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Nome, e-mail, telefone e endereço
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </button>

                {/* Opção: Chat no App com o Estabelecimento */}
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setIsAppChatOpen(true);
                  }}
                  className={`w-full p-3.5 rounded-[4px] border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                    isDark 
                      ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[4px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-['Poppins']">Chat no App Vagou</div>
                      <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        Mensagens diretas com a equipe
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </button>

                {/* Opção: Utilidades & Ferramentas (Modo Gerenciamento) */}
                {currentPersona !== 'cliente' && (
                  <button
                    type="button"
                    id="menu-option-utilidades"
                    onClick={() => {
                      hapticLight();
                      onClose();
                      onNavigateTab?.('utilidades');
                    }}
                    className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                      isDark 
                        ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold font-['Poppins']">Utilidades & Ferramentas</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500 text-white shadow-xs">Gestão</span>
                        </div>
                        <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Água, luz, previsão de insumos e bancada
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  </button>
                )}

                {/* ÚLTIMA OPÇÃO DA LISTA DO MENU: Gerenciar Estabelecimento (Exclusivo Administrador Pro) */}
                {currentPersona !== 'cliente' && isProAdmin && (
                  <button
                    type="button"
                    id="menu-option-personalizar"
                    onClick={() => {
                      hapticLight();
                      onClose();
                      if (onRequestManage) {
                        onRequestManage();
                      } else {
                        onNavigateTab?.('personalizar');
                      }
                    }}
                    className={`w-full p-3.5 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer ${
                      isDark 
                        ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-white' 
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold font-['Poppins']">Gerenciar Estabelecimento</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">Admin</span>
                        </div>
                        <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Espaço, catálogo de serviços e equipe
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                  </button>
                )}

                {/* Desconectar do Modo Pro */}
                {currentPersona !== 'cliente' && onLogoutSalon && (
                  <button
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      onClose();
                      onLogoutSalon();
                    }}
                    className={`w-full p-3 rounded border flex items-center justify-between text-left transition active:scale-[0.99] cursor-pointer mt-3 ${
                      isDark 
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400' 
                        : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-4 h-4" />
                      <span className="text-xs font-bold font-['Poppins']">Sair da Conta Pro</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold">Desconectar</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VISTA 2: MINHA AGENDA */}
          {activeSubTab === 'agenda' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-['Poppins']">
                  Histórico de Agendamentos
                </span>
                <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {appointments.length} itens
                </span>
              </div>

              {/* BANNER DE PROPOSTA DE TROCA RECEBIDA (INCOMING SWAP) */}
              {incomingSwapRequests.length > 0 && (
                <div className="space-y-2">
                  {incomingSwapRequests.map((reqApt) => {
                    const swap = reqApt.swapRequest!;
                    return (
                      <div 
                        key={reqApt.id || reqApt.protocolCode}
                        className={`p-3.5 rounded border-2 transition ${
                          isDark 
                            ? 'bg-slate-900 border-amber-500/80 shadow-lg' 
                            : 'bg-amber-50/90 border-amber-500 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
                            <ArrowLeftRight className="w-3 h-3" /> Proposta de Troca Recebida
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <Timer className="w-3 h-3 text-amber-400" />
                            <span>20 min restantes</span>
                          </span>
                        </div>

                        <div className="mt-2 text-xs">
                          <p className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            <strong className="text-emerald-400">{swap.clientA.name}</strong> propôs trocar de horário com você:
                          </p>
                          <div className={`mt-1.5 p-2 rounded flex items-center justify-around text-center ${
                            isDark ? 'bg-slate-950 border border-slate-800' : 'bg-white border border-amber-200'
                          }`}>
                            <div>
                              <div className="text-[9px] uppercase font-bold text-slate-400">Seu Horário Atual</div>
                              <div className="text-xs font-black text-rose-400">{swap.clientA.requestedTime}</div>
                            </div>
                            <ArrowLeftRight className="w-4 h-4 text-amber-400" />
                            <div>
                              <div className="text-[9px] uppercase font-bold text-slate-400">Novo Horário Proposto</div>
                              <div className="text-xs font-black text-emerald-400">{swap.clientA.originalTime}</div>
                            </div>
                          </div>
                        </div>

                        {swap.message && (
                          <div className={`mt-2 p-2 rounded text-xs space-y-1 ${
                            isDark ? 'bg-slate-950/80 border border-slate-800 text-slate-300' : 'bg-white border border-amber-200 text-slate-700'
                          }`}>
                            <div className="text-[9px] font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" /> Mensagem de Incentivo:
                            </div>
                            <p className="italic text-[11px] leading-relaxed">"{swap.message}"</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-2.5">
                          <button
                            type="button"
                            onClick={() => handleRejectIncomingSwap(reqApt)}
                            className={`py-2 px-3 rounded text-xs font-bold transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 ${
                              isDark 
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' 
                                : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                            }`}
                            title="Recusar ativamente conta 1 no seu limite de 5 recusas"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Recusar Troca</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAcceptIncomingSwap(reqApt)}
                            className="py-2 px-3 rounded bg-[#20C933] hover:bg-[#1bb32d] text-white text-xs font-bold transition active:scale-98 shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5] text-white" />
                            <span className="text-white">Aceitar Troca</span>
                          </button>
                        </div>

                        {/* Botão de teste/simulação de vácuo sem penalidade ativa */}
                        <div className="pt-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleTimeoutIncomingSwap(reqApt)}
                            className="text-[10px] text-slate-500 hover:text-slate-400 underline cursor-pointer"
                          >
                            Simular timeout/vácuo (20 min expirados - passa p/ próximo)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {appointments.length === 0 ? (
                <div className={`p-6 rounded border text-center space-y-3 ${
                  isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'
                }`}>
                  <Calendar className="w-8 h-8 text-emerald-500 mx-auto opacity-60" />
                  <p className="text-xs font-medium">Você ainda não possui agendamentos cadastrados.</p>
                  {onNavigateToSchedule && (
                    <button
                      type="button"
                      onClick={() => {
                        hapticMedium();
                        onClose();
                        onNavigateToSchedule();
                      }}
                      className="px-4 py-2 bg-[#20C933] hover:bg-[#1bb32d] text-white text-xs font-bold rounded uppercase tracking-wider cursor-pointer"
                    >
                      Agendar Agora
                    </button>
                  )}
                </div>
              ) : (
                appointments.map((item, idx) => {
                  const swap = item.swapRequest;
                  const isPendingB = swap?.isClientSwap && swap.status === 'pending_client_b';
                  const isRejected = swap?.isClientSwap && swap.status === 'rejected';
                  const isPendingSalon = swap?.isClientSwap && swap.status === 'pending_salon_confirmation';

                  return (
                    <div
                      key={item.protocolCode || idx}
                      className={`p-3.5 rounded border space-y-2.5 transition ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-emerald-400 border border-slate-700">
                          #{item.protocolCode}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'CONFIRMADO' 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : item.status === 'ALTERADO' || isPendingB || isPendingSalon
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {isPendingB ? 'CASCATA EM ANDAMENTO' : isPendingSalon ? 'TROCA EM APROVAÇÃO' : item.status}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold">{item.service}</h4>
                        <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          Profissional: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{item.professional}</strong>
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{item.dateTime || `${item.dayGroup} às ${item.time}`}</span>
                        </div>
                        <span className="font-bold text-xs">
                          R$ {Number(item.totalPrice).toFixed(2).replace('.', ',')}
                        </span>
                      </div>

                      {/* ESTADO 1: FILA EM CASCATA ATIVA (A -> B -> C -> D) */}
                      {isPendingB && swap && (
                        <div className={`p-3 rounded text-xs space-y-2.5 ${
                          isDark ? 'bg-amber-500/10 border border-amber-500/30 text-slate-300' : 'bg-amber-50 border border-amber-200 text-slate-700'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                              <Layers className="w-3 h-3" /> Fila em Cascata Automática
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelSwapProposal(item)}
                              className="text-[10px] font-semibold text-rose-400 hover:underline cursor-pointer"
                            >
                              Cancelar Fila
                            </button>
                          </div>

                          {/* Lista dos Alvos da Cascata */}
                          <div className="space-y-1.5">
                            {(swap.cascadeTargets && swap.cascadeTargets.length > 0 
                              ? swap.cascadeTargets 
                              : [{ slotTime: swap.clientA.requestedTime, status: 'pending', customerName: swap.clientB.name }]
                            ).map((target, tIdx) => {
                              const isCurrent = (swap.currentCascadeIndex ?? 0) === tIdx;
                              const isPast = (swap.currentCascadeIndex ?? 0) > tIdx;
                              const isRejectedTarget = target.status === 'rejected';
                              const isTimeoutTarget = target.status === 'timeout';
                              const isAcceptedTarget = target.status === 'accepted';

                              return (
                                <div 
                                  key={tIdx}
                                  className={`p-2 rounded flex items-center justify-between text-[11px] transition ${
                                    isCurrent
                                      ? 'bg-amber-500/20 border border-amber-500/50 text-white font-bold'
                                      : isPast
                                      ? 'bg-slate-900/50 opacity-60 text-slate-400'
                                      : isDark ? 'bg-slate-900/40 text-slate-400' : 'bg-white/60 text-slate-500'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-4 h-4 rounded-full bg-slate-800 text-[9px] font-mono flex items-center justify-center text-slate-300">
                                      {tIdx + 1}º
                                    </span>
                                    <span>Horário <strong>{target.slotTime}</strong></span>
                                  </div>

                                  <div className="flex items-center gap-1.5 text-[10px]">
                                    {isAcceptedTarget && (
                                      <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                        <Check className="w-3 h-3" /> Aceitou
                                      </span>
                                    )}
                                    {isRejectedTarget && (
                                      <span className="text-rose-400 flex items-center gap-0.5">
                                        <X className="w-3 h-3" /> Recusou
                                      </span>
                                    )}
                                    {isTimeoutTarget && (
                                      <span className="text-slate-400 flex items-center gap-0.5">
                                        <Timer className="w-3 h-3" /> Expirou (Vácuo)
                                      </span>
                                    )}
                                    {isCurrent && !isAcceptedTarget && !isRejectedTarget && !isTimeoutTarget && (
                                      <span className="text-amber-300 font-bold flex items-center gap-1">
                                        <Clock className="w-3 h-3 animate-pulse" /> Aguardando Alvo
                                      </span>
                                    )}
                                    {!isPast && !isCurrent && (
                                      <span className="text-slate-500">Na Fila</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Simulação de avanço da cascata para testes rápidos */}
                          <div className="pt-1 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleAdvanceCascade(item, 'rejected')}
                              className="flex-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition cursor-pointer"
                            >
                              Simular Recusa (Pula p/ Próximo)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdvanceCascade(item, 'timeout')}
                              className="flex-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition cursor-pointer"
                            >
                              Simular Timeout (20 min)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ESTADO 2: FILA EM CASCATA ESGOTADA OU RECUSADA */}
                      {isRejected && swap && (
                        <div className={`p-2.5 rounded text-xs space-y-2 ${
                          isDark ? 'bg-rose-500/10 border border-rose-500/30' : 'bg-rose-50 border border-rose-200'
                        }`}>
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-400">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Os horários selecionados na cascata não puderam aceitar a troca.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              hapticLight();
                              setSwapTargetAppointment(item);
                              const candidates = getCandidateSlots(item).filter(c => c.isEligible && !swap.rejectedSlots?.includes(c.time || ''));
                              setSelectedSwapSlots(candidates.slice(0, 3).map(c => c.time || ''));
                              setIsSwapModalOpen(true);
                            }}
                            className="w-full py-2 bg-[#20C933] hover:bg-[#1bb32d] active:scale-98 text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-white" />
                            <span className="text-white">Montar Nova Fila em Cascata</span>
                          </button>
                        </div>
                      )}

                      {/* ESTADO 3: TROCA ACEITA PELO CLIENTE, AGUARDANDO CONFIRMAÇÃO DO SALÃO */}
                      {isPendingSalon && (
                        <div className={`p-2.5 rounded text-xs space-y-1 ${
                          isDark ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300' : 'bg-blue-50 border border-blue-200 text-blue-800'
                        }`}>
                          <div className="flex items-center gap-1.5 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span>Troca Aceita na Cascata!</span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Aguardando validação final do salão na aba de agendamentos.
                          </p>
                        </div>
                      )}

                      {/* ESTADO 4: HORÁRIO CONFIRMADO -> BOTÃO SOLICITAR TROCA */}
                      {!isPendingB && !isRejected && !isPendingSalon && item.status === 'CONFIRMADO' && (
                        <button
                          type="button"
                          onClick={() => {
                            hapticLight();
                            if (!swapGovernance.optIn) {
                              setGovernanceWarning({ isOpen: true, type: 'optInRequired' });
                              return;
                            }
                            if (swapGovernance.isBannedFromRequesting || swapGovernance.activeRejections >= 5) {
                              setGovernanceWarning({ isOpen: true, type: 'banned' });
                              return;
                            }
                            if (swapGovernance.usedThisMonth >= swapGovernance.monthlyQuota) {
                              setGovernanceWarning({ isOpen: true, type: 'quotaExceeded' });
                              return;
                            }
                            setSwapTargetAppointment(item);
                            const candidates = getCandidateSlots(item).filter(c => c.isEligible);
                            setSelectedSwapSlots(candidates.slice(0, 1).map(c => c.time || ''));
                            setIsSwapModalOpen(true);
                          }}
                          className={`w-full py-2 px-3 rounded border text-[11px] font-bold flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer ${
                            isDark
                              ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                              : 'border-emerald-600/40 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          <span>Solicitar Troca de Horário (Cascata)</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}

              {onNavigateToSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    onClose();
                    onNavigateToSchedule();
                  }}
                  className="w-full py-3 mt-2 bg-[#20C933] hover:bg-[#1bb32d] active:scale-[0.99] text-white font-bold text-xs rounded transition uppercase tracking-wider font-['Poppins'] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Scissors className="w-4 h-4 text-white" />
                  <span className="text-white">AGENDAR NOVO HORÁRIO</span>
                </button>
              )}
            </div>
          )}

          {/* VISTA 3: MEUS DADOS PESSOAIS */}
          {activeSubTab === 'dados' && (
            <div className="space-y-4">
              <form onSubmit={handleSaveProfile} className="space-y-3">
                {/* Campo Nome */}
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <User className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Nome Completo</span>
                  </label>
                  <input
                    type="text"
                    value={profile.name}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    required
                    className={`w-full px-3 py-2.5 rounded text-xs border outline-hidden transition ${
                      !isEditing
                        ? isDark ? 'bg-slate-900/60 border-slate-800/60 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        : isDark ? 'bg-slate-900 border-emerald-500 text-white focus:ring-1 focus:ring-emerald-500' : 'bg-white border-emerald-500 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                </div>

                {/* Campo E-mail */}
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <Mail className="w-3.5 h-3.5 text-emerald-500" />
                    <span>E-mail</span>
                  </label>
                  <input
                    type="email"
                    value={profile.email}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    required
                    className={`w-full px-3 py-2.5 rounded text-xs border outline-hidden transition ${
                      !isEditing
                        ? isDark ? 'bg-slate-900/60 border-slate-800/60 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        : isDark ? 'bg-slate-900 border-emerald-500 text-white focus:ring-1 focus:ring-emerald-500' : 'bg-white border-emerald-500 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                </div>

                {/* Campo Telefone */}
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Telefone / WhatsApp</span>
                  </label>
                  <input
                    type="tel"
                    value={profile.phone}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    required
                    className={`w-full px-3 py-2.5 rounded text-xs border outline-hidden transition ${
                      !isEditing
                        ? isDark ? 'bg-slate-900/60 border-slate-800/60 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        : isDark ? 'bg-slate-900 border-emerald-500 text-white focus:ring-1 focus:ring-emerald-500' : 'bg-white border-emerald-500 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                </div>

                {/* Campo Endereço */}
                <div className="space-y-1">
                  <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Endereço Residencial</span>
                  </label>
                  <input
                    type="text"
                    value={profile.address}
                    disabled={!isEditing}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className={`w-full px-3 py-2.5 rounded text-xs border outline-hidden transition ${
                      !isEditing
                        ? isDark ? 'bg-slate-900/60 border-slate-800/60 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                        : isDark ? 'bg-slate-900 border-emerald-500 text-white focus:ring-1 focus:ring-emerald-500' : 'bg-white border-emerald-500 text-slate-900 focus:ring-1 focus:ring-emerald-500'
                    }`}
                  />
                </div>

                {/* BOTÕES DE AÇÃO DOS DADOS */}
                <div className="pt-2">
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setIsEditing(true);
                      }}
                      className="w-full py-3 bg-[#20C933] hover:bg-[#1bb32d] active:scale-[0.99] text-white font-bold text-xs rounded transition uppercase tracking-wider font-['Poppins'] cursor-pointer flex items-center justify-center gap-2"
                    >
                      <User className="w-4 h-4" />
                      <span>EDITAR DADOS</span>
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setIsEditing(false);
                        }}
                        className={`flex-1 py-3 rounded border text-xs font-bold transition cursor-pointer ${
                          isDark 
                            ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300' 
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        }`}
                      >
                        CANCELAR
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-3 bg-[#20C933] hover:bg-[#1bb32d] active:scale-[0.99] text-white font-bold text-xs rounded transition uppercase tracking-wider font-['Poppins'] cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>SALVAR</span>
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* VISTA 4: CONFIGURAÇÕES & PREFERÊNCIAS */}
          {activeSubTab === 'config' && (
            <div className="space-y-3">
              {/* Notificações no App */}
              <div className={`p-3.5 rounded border flex items-center justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold font-['Poppins']">Lembretes de Horário</div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Receber aviso 1h antes no aplicativo
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleNotifications}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  title="Ativar/Desativar Lembretes"
                  aria-label="Ativar/Desativar Lembretes"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Vibração Tátil */}
              <div className={`p-3.5 rounded border flex items-center justify-between ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="space-y-0.5">
                  <div className="text-xs font-bold font-['Poppins']">Vibração Tátil (Haptics)</div>
                  <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Feedback ao clicar em botões e abas
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleHaptics}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    hapticsEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  title="Ativar/Desativar Vibração"
                  aria-label="Ativar/Desativar Vibração"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      hapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* REDE SOLIDÁRIA DE TROCAS & GOVERNANÇA */}
              <div className={`p-3.5 rounded border space-y-3 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold font-['Poppins'] flex items-center gap-1.5">
                      <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
                      <span>Rede Solidária de Trocas</span>
                    </div>
                    <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Disponível para negociar e ceder horários
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleSwapOptIn}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      swapGovernance.optIn ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                    title="Ativar/Desativar Opt-in de Trocas"
                    aria-label="Ativar/Desativar Opt-in de Trocas"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        swapGovernance.optIn ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Métricas de Governança Flat */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className={`p-2 rounded border text-center ${
                    isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Cota Mensal</span>
                    <span className="text-xs font-black text-emerald-400">
                      {swapGovernance.usedThisMonth} / {swapGovernance.monthlyQuota}
                    </span>
                    <span className="text-[8px] text-slate-500 block">máx 2/mês</span>
                  </div>

                  <div className={`p-2 rounded border text-center ${
                    isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Recusas Ativas</span>
                    <span className={`text-xs font-black ${swapGovernance.activeRejections >= 4 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {swapGovernance.activeRejections} / 5
                    </span>
                    <span className="text-[8px] text-slate-500 block">limite p/ ban</span>
                  </div>

                  <div className={`p-2 rounded border text-center ${
                    isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Vácuos</span>
                    <span className={`text-xs font-black ${swapGovernance.consecutiveTimeouts >= 2 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {swapGovernance.consecutiveTimeouts} / 3
                    </span>
                    <span className="text-[8px] text-slate-500 block">pausa inatividade</span>
                  </div>
                </div>

                {/* Regras e Governança Explicada */}
                <div className="space-y-1 text-[10px] text-slate-400 leading-relaxed border-t border-slate-800/60 pt-2">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Regras de Reciprocidade & Permuta de Horários</span>
                  </div>
                  <p>• <strong>Reciprocidade:</strong> Apenas clientes com opt-in ativo na Rede Solidária podem solicitar e receber trocas.</p>
                  <p>• <strong>Antecedência Mínima ($\ge$ 1h):</strong> O horário proposto deve ser pelo menos 1 hora à frente para dar margem de deslocamento e preparo.</p>
                  <p>• <strong>Compatibilidade de Duração:</strong> O tempo do serviço do convidado não pode exceder o seu para não sobrecarregar ou atrasar a agenda do salão.</p>
                  <p>• <strong>Fair-Play & Vácuo:</strong> Recusar 5 vezes ativamente suspende solicitações. Timeout (vácuo) não pune, mas 3 vácuos seguidos desativam o opt-in por inatividade.</p>
                  <p>• <strong>Cota Mensal:</strong> Máximo de 2 pedidos de troca por mês para garantir a estabilidade das reservas.</p>
                </div>
              </div>

              {/* Segurança e Privacidade */}
              <div className={`p-3.5 rounded border space-y-1.5 ${
                isDark ? 'bg-slate-900/60 border-slate-800/80 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
              }`}>
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Privacidade e Segurança</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Seus dados e agendamentos estão protegidos de acordo com a LGPD e são transmitidos de forma criptografada para {salonName}.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 3. RODAPÉ FIXO DO MENU */}
        <div className={`p-3 border-t text-center text-[10px] shrink-0 ${
          isDark ? 'bg-slate-900/80 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400'
        }`}>
          <span>{salonName} • App Oficial do Estabelecimento</span>
        </div>
      </div>

      {/* Modal do Chat Interno no App (Cliente -> Salão) */}
      {isAppChatOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`w-full max-w-md h-[85vh] sm:h-[550px] rounded-t-[4px] sm:rounded-[4px] border flex flex-col overflow-hidden shadow-2xl ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
          }`}>
            {/* Cabeçalho do Chat */}
            <div className={`p-3 border-b shrink-0 flex items-center justify-between ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-[4px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-black shrink-0">
                  <Scissors className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {salonName}
                    </h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Online no Vagou" />
                  </div>
                  <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Chat Oficial Vagou</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAppChatOpen(false)}
                className={`p-1.5 rounded-[4px] border transition cursor-pointer ${
                  isDark ? 'border-slate-800 hover:bg-slate-800 text-slate-400' : 'border-slate-200 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 bg-slate-950/40">
              {drawerChatMessages.map((msg) => {
                if (msg.sender === 'system') {
                  return (
                    <div key={msg.id} className="my-2 p-2 rounded-[4px] bg-slate-900/90 border border-slate-800 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{msg.text}</span>
                    </div>
                  );
                }

                const isUser = msg.sender === 'user';

                return (
                  <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] p-2.5 rounded-[4px] text-xs ${
                      isUser
                        ? 'bg-emerald-500 text-white font-medium'
                        : isDark
                        ? 'bg-slate-800 text-slate-100 border border-slate-700 font-medium'
                        : 'bg-slate-100 text-slate-900 border border-slate-200 font-medium'
                    }`}>
                      <p>{msg.text}</p>
                      <span className={`block text-[9px] mt-1 text-right font-mono ${
                        isUser ? 'text-white/80' : 'text-slate-400'
                      }`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendDrawerChatMessage} className={`p-2.5 border-t shrink-0 flex items-center gap-2 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <input
                type="text"
                value={inputDrawerChatMessage}
                onChange={(e) => setInputDrawerChatMessage(e.target.value)}
                placeholder="Digite sua mensagem no aplicativo..."
                className={`flex-1 px-3 py-2 rounded-[4px] border text-xs font-medium outline-hidden transition ${
                  isDark 
                    ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-500 focus:border-emerald-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500'
                }`}
              />
              <button
                type="submit"
                disabled={!inputDrawerChatMessage.trim()}
                className="py-2 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer active:scale-98"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Solicitação de Troca de Horário com Cascata Prioritária (A -> B -> C -> D) */}
      {isSwapModalOpen && swapTargetAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className={`w-full max-w-md max-h-[90vh] rounded-t-[4px] sm:rounded-[4px] border flex flex-col overflow-hidden shadow-2xl ${
            isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Header do Modal */}
            <div className={`p-3.5 border-b shrink-0 flex items-center justify-between ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <ArrowLeftRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs">Solicitar Troca em Cascata</h3>
                  <p className="text-[10px] text-slate-400">Selecione até 3 horários em ordem de preferência</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSwapModalOpen(false)}
                className={`p-1.5 rounded transition ${
                  isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo com Rolagem */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Seu Horário Atual */}
              <div className={`p-2.5 rounded border text-xs space-y-1 ${
                isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-[10px] uppercase font-bold text-slate-400">Seu Horário Atual:</span>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{swapTargetAppointment.dateTime || `${swapTargetAppointment.dayGroup} às ${swapTargetAppointment.time}`}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">#{swapTargetAppointment.protocolCode}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {swapTargetAppointment.service} • {swapTargetAppointment.professional}
                </div>
              </div>

              {/* Banner Informativo da Cascata e Regras da Permuta */}
              <div className={`p-2.5 rounded border text-[11px] space-y-1.5 ${
                isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Fila em Cascata Automática (B → C → D) & Travas de Segurança:</span>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-300">
                  A proposta é enviada a <strong>um cliente por vez</strong>. Se houver recusa ou expiração (20 min), migra automaticamente para o próximo.
                </p>

                {/* Banner de Travas de Permuta */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60 text-[9.5px]">
                  <div className="flex items-start gap-1">
                    <Clock className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Antecedência $\ge$ 1h:</strong> Tempo hábil para o deslocamento do convidado.</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <Timer className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Duração $\le$ {parseDurationInMinutes(swapTargetAppointment.duration || '45 min')}min:</strong> Não extrapola seu tempo e protege a agenda do salão.</span>
                  </div>
                </div>
              </div>

              {/* Seleção de Horários Alvo com Prioridade */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Escolha até 3 Horários Alvo (Toque p/ definir fila):</span>
                  <span className="text-[10px] font-semibold text-emerald-400">
                    {selectedSwapSlots.length}/3 selecionados
                  </span>
                </label>

                {(() => {
                  const candidateSlots = getCandidateSlots(swapTargetAppointment);
                  const rejectedList = swapTargetAppointment.swapRequest?.rejectedSlots || [];
                  const reqDurationMin = parseDurationInMinutes(swapTargetAppointment.duration || '45 min');

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {candidateSlots.map((candidate) => {
                        const slotTime = candidate.time;
                        const isRejected = rejectedList.includes(slotTime);
                        const priorityIndex = selectedSwapSlots.indexOf(slotTime);
                        const isSelected = priorityIndex !== -1;
                        const isDisabled = isRejected || !candidate.isEligible;

                        return (
                          <button
                            key={slotTime}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => {
                              if (isDisabled) return;
                              hapticLight();
                              if (isSelected) {
                                setSelectedSwapSlots(prev => prev.filter(t => t !== slotTime));
                              } else {
                                if (selectedSwapSlots.length >= 3) {
                                  setSelectedSwapSlots(prev => [...prev.slice(1), slotTime]);
                                } else {
                                  setSelectedSwapSlots(prev => [...prev, slotTime]);
                                }
                              }
                            }}
                            className={`p-2 rounded border text-center transition cursor-pointer flex flex-col items-center justify-center relative min-h-[62px] ${
                              isDisabled
                                ? 'opacity-40 border-dashed border-slate-800 bg-slate-950/60 cursor-not-allowed text-slate-500'
                                : isSelected
                                ? 'border-emerald-500 bg-emerald-500/20 text-white ring-1 ring-emerald-500'
                                : isDark
                                ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {isSelected && (
                              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                                {priorityIndex + 1}º
                              </span>
                            )}

                            <div className="flex items-center gap-1 font-mono font-bold text-xs">
                              <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>{slotTime}</span>
                            </div>

                            <span className="text-[9.5px] text-slate-400 truncate max-w-full font-medium">
                              {candidate.service} ({candidate.duration})
                            </span>

                            <span className={`text-[8.5px] uppercase font-bold mt-0.5 ${
                              isRejected
                                ? 'text-rose-400'
                                : !candidate.isDurationCompatible
                                ? 'text-amber-400'
                                : !candidate.isLeadTimeValid
                                ? 'text-rose-400'
                                : isSelected
                                ? 'text-emerald-400'
                                : 'text-slate-400'
                            }`}>
                              {isRejected 
                                ? 'Recusado' 
                                : !candidate.isDurationCompatible
                                ? `Duração Incompatível (${candidate.durationMinutes}m > ${reqDurationMin}m)`
                                : !candidate.isLeadTimeValid
                                ? `Margem < 1h (${candidate.leadTimeReason})`
                                : isSelected 
                                ? `${priorityIndex + 1}º da Fila` 
                                : 'Elegível p/ Troca'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Caixa de Mensagem de Incentivo / Apelo */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mensagem de Incentivo / Apelo Fraterno:</span>
                  </span>
                </label>
                <textarea
                  rows={4}
                  value={swapIncentiveMessage}
                  onChange={(e) => setSwapIncentiveMessage(e.target.value)}
                  placeholder="Explique seu imprevisto com carinho para motivar o colega a aceitar a troca (ex: 'Tive um imprevisto na escola do meu filho, se puder me ajudar ficarei muito grato!')..."
                  className={`w-full p-2.5 rounded border text-xs font-medium outline-hidden leading-relaxed transition ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500' 
                      : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                  }`}
                />
                <p className="text-[10px] text-slate-500 leading-tight">
                  Essa mensagem será exibida a cada cliente da cascata para gerar empatia e motivar a aceitação.
                </p>
              </div>
            </div>

            {/* Rodapé Fixo de Ação */}
            <div className={`p-3 border-t shrink-0 flex gap-2 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setIsSwapModalOpen(false)}
                className={`flex-1 py-2.5 rounded border text-xs font-bold transition cursor-pointer ${
                  isDark 
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' 
                    : 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-700'
                }`}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={selectedSwapSlots.length === 0}
                onClick={() => {
                  if (swapTargetAppointment && selectedSwapSlots.length > 0) {
                    handleSendSwapProposal(swapTargetAppointment, selectedSwapSlots, swapIncentiveMessage);
                  }
                }}
                className="flex-1 py-2.5 bg-[#20C933] hover:bg-[#1bb32d] disabled:opacity-40 disabled:hover:bg-[#20C933] text-white font-bold text-xs rounded transition uppercase tracking-wider font-['Poppins'] flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5 text-white" />
                <span className="text-white">
                  Iniciar Fila ({selectedSwapSlots.length} Alvo{selectedSwapSlots.length > 1 ? 's' : ''})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DE AVISO DE GOVERNANÇA & REGRAS DE TROCA */}
      {governanceWarning?.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className={`w-full max-w-sm rounded-[4px] border p-4 space-y-3.5 shadow-2xl ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {governanceWarning.type === 'optInRequired' && (
              <>
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-bold">Ativação de Reciprocidade Necessária</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Para solicitar uma troca, você precisa estar disponível para ajudar outros clientes também ativando a <strong>"Rede Solidária de Trocas"</strong> em suas preferências.
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setGovernanceWarning({ isOpen: false, type: null })}
                    className="flex-1 py-2 rounded border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition cursor-pointer"
                  >
                    Agora Não
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      const updated = { ...swapGovernance, optIn: true };
                      setSwapGovernance(updated);
                      localStorage.setItem('vagou_client_swap_governance', JSON.stringify(updated));
                      setGovernanceWarning({ isOpen: false, type: null });
                    }}
                    className="flex-1 py-2 rounded bg-[#20C933] hover:bg-[#1bb32d] text-white text-xs font-bold transition cursor-pointer shadow-md"
                  >
                    Ativar e Continuar
                  </button>
                </div>
              </>
            )}

            {governanceWarning.type === 'banned' && (
              <>
                <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-bold text-rose-400">Solicitações de Troca Suspensas</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você atingiu o limite de <strong>5 recusas ativas de trocas</strong>. Para garantir a cooperação mútua na rede, novas solicitações estão temporariamente suspensas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGovernanceWarning({ isOpen: false, type: null })}
                  className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Entendi
                </button>
              </>
            )}

            {governanceWarning.type === 'quotaExceeded' && (
              <>
                <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-sm font-bold text-amber-400">Limite Mensal Atingido</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Você já utilizou sua cota de <strong>2 solicitações de troca neste mês</strong>. Seu limite será renovado no início do próximo mês.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGovernanceWarning({ isOpen: false, type: null })}
                  className="w-full py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  Entendi
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
