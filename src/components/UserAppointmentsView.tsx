import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  User, 
  ArrowLeft, 
  CheckCircle, 
  Clock3, 
  Scissors,
  Check,
  Info,
  Baby,
  Navigation,
  Map as MapIcon,
  AlertTriangle,
  Bookmark,
  ArrowLeftRight,
  X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { BookingAppointment, SwapTargetQueueItem } from '../types';
import { resolveClientAvatarsMap, isValidAvatarUrlString, KNOWN_CLIENT_AVATARS_MAP } from '../lib/supabase';
import { hapticLight, hapticMedium, hapticSuccess } from '../utils/haptics';
import {
  LiveRouteDepartureModal,
  LiveTrackingDrawerModal,
} from './live-tracking/LiveTrackingModal';
import { RouteSimulatorModal } from './live-tracking/RouteSimulatorModal';
import {
  getSavedBookingDraft,
  saveBookingDraft,
  BookingDraftItem,
  checkInterSalonSlotCollision,
} from '../utils/bookingSlots';

const FREE_SLOTS_CANDIDATES = [
  '09:00',
  '10:30',
  '11:30',
  '13:30',
  '15:00',
  '16:00',
  '17:30',
  '18:30',
];

const isRealLogoUrl = (url?: string | null): url is string =>
  Boolean(
    url &&
    typeof url === 'string' &&
    url.trim().length > 0 &&
    !url.includes('unsplash.com') &&
    !url.includes('placeholder') &&
    !url.startsWith('data:image/svg+xml')
  );

const getCompanyLogo = (item: BookingAppointment, isDarkTheme: boolean): string => {
  if (isRealLogoUrl(item.salonLogo)) return item.salonLogo.trim();
  try {
    const directLogo = localStorage.getItem('vagou_salon_logo');
    const darkLogo = localStorage.getItem('vagou_salon_logo_dark');
    const lightLogo = localStorage.getItem('vagou_salon_logo_light');
    if (isDarkTheme && isRealLogoUrl(darkLogo)) return darkLogo.trim();
    if (!isDarkTheme && isRealLogoUrl(lightLogo)) return lightLogo.trim();
    if (isRealLogoUrl(directLogo)) return directLogo.trim();
    if (isRealLogoUrl(darkLogo)) return darkLogo.trim();
    if (isRealLogoUrl(lightLogo)) return lightLogo.trim();

    const rawAdmin = localStorage.getItem('vagou_admin_settings');
    if (rawAdmin) {
      const parsed = JSON.parse(rawAdmin);
      const logo = isDarkTheme
        ? (parsed.salonLogoDark || parsed.salonLogo || parsed.salonLogoLight)
        : (parsed.salonLogoLight || parsed.salonLogo || parsed.salonLogoDark);
      if (isRealLogoUrl(logo)) return logo.trim();
    }
  } catch {}
  return '';
};

const getProfessionalAvatar = (
  proName?: string,
  directAvatar?: string | null,
  avatarMap?: Record<string, string>
): string => {
  if (isValidAvatarUrlString(directAvatar)) return directAvatar.trim();
  if (!proName) return '';
  const cleanName = proName
    .replace(/\s*\(designado\)/i, '')
    .replace(/\s*\(qualquer\)/i, '')
    .toLowerCase()
    .trim();
  if (!cleanName) return '';

  const firstName = cleanName.split(/\s+/)[0];

  if (avatarMap) {
    if (isValidAvatarUrlString(avatarMap[cleanName])) return avatarMap[cleanName].trim();
    if (firstName && isValidAvatarUrlString(avatarMap[firstName])) return avatarMap[firstName].trim();
  }

  try {
    const storageKeys = ['vagou_salon_team_members', 'vagou_team_members', 'vagou_custom_professionals'];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('vagou_pros_') && !storageKeys.includes(k)) {
        storageKeys.push(k);
      }
    }

    for (const key of storageKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      const found = parsed.find((p: any) => {
        const pName = String(p?.name || '').toLowerCase().trim();
        return pName === cleanName || (firstName.length >= 3 && pName.split(/\s+/)[0] === firstName);
      });
      const candidate = found?.avatarUrl || found?.avatar || found?.photoUrl;
      if (isValidAvatarUrlString(candidate)) {
        return candidate.trim();
      }
    }
  } catch {}

  if (isValidAvatarUrlString(KNOWN_CLIENT_AVATARS_MAP[cleanName])) {
    return KNOWN_CLIENT_AVATARS_MAP[cleanName];
  }
  if (firstName && isValidAvatarUrlString(KNOWN_CLIENT_AVATARS_MAP[firstName])) {
    return KNOWN_CLIENT_AVATARS_MAP[firstName];
  }

  return '';
};

const extractTimeFromAppointment = (apt: BookingAppointment): string => {
  if (apt.time && /^\d{2}:\d{2}/.test(apt.time.trim())) {
    return apt.time.trim().slice(0, 5);
  }
  const match = (apt.dateTime || '').match(/(\d{2}:\d{2})/);
  return match ? match[1] : '15:30';
};

const replaceTimeInDateTime = (dateTimeStr: string | undefined, newTime: string): string => {
  if (!dateTimeStr) return `Hoje, às ${newTime}`;
  if (/(\d{2}:\d{2})/.test(dateTimeStr)) {
    return dateTimeStr.replace(/(\d{2}:\d{2})/, newTime);
  }
  return `${dateTimeStr} às ${newTime}`;
};

const PT_MONTHS_MAP: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

const getAppointmentTimestampMs = (apt: BookingAppointment): number => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // 1. Extrair horário (HH:MM)
  const timeStr = extractTimeFromAppointment(apt);
  const [hhStr, mmStr] = timeStr.split(':');
  const hours = Number.isFinite(Number(hhStr)) ? Number(hhStr) : 12;
  const minutes = Number.isFinite(Number(mmStr)) ? Number(mmStr) : 0;
  const timeOffsetMs = (hours * 60 + minutes) * 60 * 1000;

  // 2. Se houver dateIso explícito (YYYY-MM-DD...)
  if (apt.dateIso) {
    const isoMatch = apt.dateIso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const y = Number(isoMatch[1]);
      const m = Number(isoMatch[2]) - 1;
      const d = Number(isoMatch[3]);
      return new Date(y, m, d).getTime() + timeOffsetMs;
    }
    const parsedIso = Date.parse(apt.dateIso);
    if (!Number.isNaN(parsedIso)) {
      return parsedIso;
    }
  }

  // 3. Analisar texto combinado de dayGroup + dateTime
  const raw = `${apt.dayGroup || ''} ${apt.dateTime || ''}`.toLowerCase().trim();

  if (raw.includes('depois de amanhã') || raw.includes('depois de amanha')) {
    return todayStart + 2 * ONE_DAY_MS + timeOffsetMs;
  }
  if (raw.includes('amanhã') || raw.includes('amanha')) {
    return todayStart + ONE_DAY_MS + timeOffsetMs;
  }
  if (raw.includes('hoje')) {
    return todayStart + timeOffsetMs;
  }

  // Formato DD/MM/YYYY, DD/MM/YY ou DD/MM
  const slashMatch = raw.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]) - 1;
    let year = slashMatch[3] ? Number(slashMatch[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    return new Date(year, month, day).getTime() + timeOffsetMs;
  }

  // Formato "12 Nov", "15 de setembro", etc.
  const ptMonthMatch = raw.match(/(\d{1,2})\s*(?:de\s*)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i);
  if (ptMonthMatch) {
    const day = Number(ptMonthMatch[1]);
    const monthKey = ptMonthMatch[2].toLowerCase().slice(0, 3);
    const month = PT_MONTHS_MAP[monthKey] ?? now.getMonth();
    const yearMatch = raw.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
    return new Date(year, month, day).getTime() + timeOffsetMs;
  }

  return todayStart + timeOffsetMs;
};

const isTerminalAppointmentStatus = (status?: string): boolean => {
  const s = (status || '').toUpperCase().trim();
  return s === 'CANCELADO' || s === 'CONCLUÍDO' || s === 'CONCLUIDO';
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 260,
      damping: 22,
    }
  }
};

interface UserAppointmentsViewProps {
  appointments: BookingAppointment[];
  onBack: () => void;
  onCancelAppointment?: (protocolCode: string, reason?: string) => void;
  onUpdateAppointments?: (updatedList: BookingAppointment[]) => void;
  onRescheduleAppointment?: (appointment: BookingAppointment) => void;
}

export const UserAppointmentsView: React.FC<UserAppointmentsViewProps> = ({
  appointments,
  onBack,
  onCancelAppointment,
  onUpdateAppointments,
  onRescheduleAppointment,
}) => {
  const { isDark } = useTheme();
  const [departureModalApt, setDepartureModalApt] = useState<BookingAppointment | null>(null);
  const [departureModalStep, setDepartureModalStep] = useState<'question' | 'not_leaving' | 'cancel_reason' | 'in_app_map'>('in_app_map');
  const [drawerViewerState, setDrawerViewerState] = useState<{
    appointment: BookingAppointment;
    initialTab: 'timeline' | 'map';
  } | null>(null);
  const [savedDraft, setSavedDraft] = useState<BookingDraftItem | null>(() => getSavedBookingDraft());
  const [isRouteSimulatorOpen, setIsRouteSimulatorOpen] = useState<boolean>(false);
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const [resolvedAvatars, setResolvedAvatars] = useState<Record<string, string>>(() => {
    let map: Record<string, string> = { ...KNOWN_CLIENT_AVATARS_MAP };
    try {
      const cached = localStorage.getItem('vagou_client_avatars_map');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          map = { ...map, ...parsed };
        }
      }
    } catch {}
    return map;
  });

  // Estados do Modal Unificado "Remarcar" (Opção 1: Horários Livres + Permuta em Cascata)
  const [rescheduleModalApt, setRescheduleModalApt] = useState<BookingAppointment | null>(null);
  const [rescheduleMode, setRescheduleMode] = useState<'free' | 'swap'>('free');
  const [selectedFreeSlot, setSelectedFreeSlot] = useState<string>('');
  const [selectedSwapSlots, setSelectedSwapSlots] = useState<string[]>([]);
  const [swapMessage, setSwapMessage] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    resolveClientAvatarsMap()
      .then((map) => {
        if (mounted && map) {
          setResolvedAvatars((prev) => ({ ...prev, ...map }));
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleSingleAppointmentUpdate = (updated: BookingAppointment) => {
    const nextList = appointments.map((apt) =>
      apt.protocolCode === updated.protocolCode || (apt.id && apt.id === updated.id)
        ? { ...apt, ...updated }
        : apt
    );
    if (onUpdateAppointments) {
      onUpdateAppointments(nextList);
    }
    try {
      localStorage.setItem('vagou_appointments', JSON.stringify(nextList));
    } catch {}
    if (departureModalApt && departureModalApt.protocolCode === updated.protocolCode) {
      setDepartureModalApt(updated);
    }
    if (drawerViewerState && drawerViewerState.appointment.protocolCode === updated.protocolCode) {
      setDrawerViewerState({ ...drawerViewerState, appointment: updated });
    }
    if (rescheduleModalApt && rescheduleModalApt.protocolCode === updated.protocolCode) {
      setRescheduleModalApt(updated);
    }
  };

  const openRescheduleAndSwapModal = (item: BookingAppointment) => {
    setRescheduleModalApt(item);
    const existingCascade =
      item.swapRequest?.cascadeTargets
        ?.filter((t) => t.status === 'pending')
        .map((t) => t.slotTime) || [];
    if (existingCascade.length > 0) {
      setRescheduleMode('swap');
      setSelectedSwapSlots(existingCascade);
      setSwapMessage(item.swapRequest?.message || '');
    } else {
      setRescheduleMode('free');
      setSelectedFreeSlot('');
      setSelectedSwapSlots([]);
      setSwapMessage('');
    }
  };

  const handleConfirmDirectReschedule = () => {
    if (!rescheduleModalApt || !selectedFreeSlot) return;
    hapticSuccess();
    const updated: BookingAppointment = {
      ...rescheduleModalApt,
      time: selectedFreeSlot,
      dateTime: replaceTimeInDateTime(rescheduleModalApt.dateTime, selectedFreeSlot),
      status: 'CONFIRMADO',
      swapRequest: undefined,
    };
    handleSingleAppointmentUpdate(updated);
    setRescheduleModalApt(null);
    setSelectedFreeSlot('');
  };

  const getRealOccupiedCandidates = (targetApt: BookingAppointment) => {
    const targetTime = extractTimeFromAppointment(targetApt);
    const targetPro = (targetApt.professionalName || targetApt.professional || '').toLowerCase().trim();
    const targetDate = targetApt.dateIso || targetApt.dayGroup || '';

    return appointments
      .filter((item) => {
        if (!item.protocolCode || item.protocolCode === targetApt.protocolCode) return false;
        if (isTerminalAppointmentStatus(item.status)) return false;
        const itemTime = extractTimeFromAppointment(item);
        if (!itemTime || itemTime === targetTime) return false;
        const itemPro = (item.professionalName || item.professional || '').toLowerCase().trim();
        if (targetPro && itemPro && targetPro !== itemPro) return false;
        const itemDate = item.dateIso || item.dayGroup || '';
        if (targetDate && itemDate && targetDate !== itemDate) return false;
        return true;
      })
      .map((item) => ({
        time: extractTimeFromAppointment(item),
        clientName: item.customerName || item.clientName || 'Cliente',
        phone: item.customerPhone || item.clientPhone || '',
        durationMin: Number(item.durationMinutes) || 45,
      }));
  };

  const handleSendCascadeSwap = () => {
    if (!rescheduleModalApt || selectedSwapSlots.length === 0) return;
    hapticSuccess();
    const realCandidates = getRealOccupiedCandidates(rescheduleModalApt);
    const currentTime = extractTimeFromAppointment(rescheduleModalApt);
    const firstSlot = selectedSwapSlots[0];
    const firstCandidate = realCandidates.find((c) => c.time === firstSlot);

    const cascadeQueue: SwapTargetQueueItem[] = selectedSwapSlots.map((slot, idx) => {
      const candidate = realCandidates.find((c) => c.time === slot);
      return {
        slotTime: slot,
        clientName: candidate?.clientName || `Cliente (${slot})`,
        phone: candidate?.phone || '',
        status: 'pending',
        notifiedAt: idx === 0 ? Date.now() : undefined,
      };
    });

    const updated: BookingAppointment = {
      ...rescheduleModalApt,
      status: 'ALTERADO',
      swapRequest: {
        isClientSwap: true,
        message:
          swapMessage.trim() ||
          `Troca solicitada: meu horário das ${currentTime} pelo das ${firstSlot}.`,
        clientA: {
          name: rescheduleModalApt.clientName || 'Você',
          originalTime: currentTime,
          requestedTime: firstSlot,
        },
        clientB: {
          name: firstCandidate?.clientName || `Cliente (${firstSlot})`,
          originalTime: firstSlot,
          accepted: false,
          phone: firstCandidate?.phone,
        },
        status: 'pending_client_b',
        rejectedSlots: rescheduleModalApt.swapRequest?.rejectedSlots || [],
        cascadeTargets: cascadeQueue,
        currentCascadeIndex: 0,
        timeoutSecondsPerTarget: 900,
        lastTargetUpdatedAt: Date.now(),
      },
    };
    handleSingleAppointmentUpdate(updated);
    setRescheduleModalApt(null);
    setSelectedSwapSlots([]);
    setSwapMessage('');
  };

  const handleAcceptSwapOnCard = (item: BookingAppointment) => {
    if (!item.swapRequest) return;
    hapticSuccess();
    const newTime = item.swapRequest.clientA.requestedTime;
    const updated: BookingAppointment = {
      ...item,
      time: newTime,
      dateTime: replaceTimeInDateTime(item.dateTime, newTime),
      status: 'CONFIRMADO',
      swapRequest: {
        ...item.swapRequest,
        clientB: {
          ...item.swapRequest.clientB,
          accepted: true,
        },
        status: 'confirmed',
      },
    };
    handleSingleAppointmentUpdate(updated);
  };

  const handleCancelSwapOnCard = (item: BookingAppointment) => {
    hapticLight();
    const updated: BookingAppointment = {
      ...item,
      status: 'CONFIRMADO',
      swapRequest: undefined,
    };
    handleSingleAppointmentUpdate(updated);
  };

  // Filtrar apenas agendamentos reais do cliente e ordenar cronologicamente (o mais próximo em 1º de cima para baixo)
  const clientAppointments = [...appointments]
    .filter((apt) => !apt.isBlockedSlot && apt.protocolCode)
    .sort((a, b) => {
      const aTerminal = isTerminalAppointmentStatus(a.status);
      const bTerminal = isTerminalAppointmentStatus(b.status);
      if (aTerminal !== bTerminal) {
        return aTerminal ? 1 : -1;
      }
      return getAppointmentTimestampMs(a) - getAppointmentTimestampMs(b);
    });

  const getStatusBadge = (status?: string) => {
    const s = (status || 'CONFIRMADO').toUpperCase();
    
    switch (s) {
      case 'CONFIRMADO':
      case 'AGENDADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-bold bg-emerald-500 border border-emerald-400 text-white whitespace-nowrap">
            <Check className="w-3.5 h-3.5 text-white" />
            Confirmado
          </span>
        );
      case 'ALTERADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-bold bg-emerald-500 border border-emerald-400 text-white whitespace-nowrap">
            <ArrowLeftRight className="w-3.5 h-3.5 text-white" />
            Em Permuta
          </span>
        );
      case 'PENDENTE':
      case 'EM ANDAMENTO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-bold bg-amber-400 border border-amber-500 text-slate-950 whitespace-nowrap">
            <Clock3 className="w-3.5 h-3.5 text-slate-950" />
            Pendente
          </span>
        );
      case 'CONCLUÍDO':
      case 'CONCLUIDO':
        return (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-bold border whitespace-nowrap ${
            isDark 
              ? 'bg-slate-800 border-slate-700 text-slate-300' 
              : 'bg-slate-200 border-slate-300 text-slate-700'
          }`}>
            <CheckCircle className="w-3.5 h-3.5" />
            Concluído
          </span>
        );
      case 'CANCELADO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-xs font-bold bg-rose-500 border border-rose-400 text-white whitespace-nowrap">
            Cancelado
          </span>
        );
    }
  };

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${
      isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* HEADER DA SEÇÃO */}
      <header className={`shrink-0 h-14 border-b flex items-center justify-between px-4 sticky top-0 z-40 ${
        isDark ? 'bg-slate-950/95 border-slate-800/80' : 'bg-white/95 border-slate-200 shadow-xs'
      } backdrop-blur-md`}>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              onBack();
            }}
            className={`w-9 h-9 rounded-[4px] flex items-center justify-center transition active:scale-95 cursor-pointer ${
              isDark ? 'hover:bg-slate-900 border border-slate-800' : 'hover:bg-slate-100 border border-slate-200'
            }`}
            aria-label="Voltar para o salão"
          >
            <ArrowLeft className="w-5 h-5 text-emerald-400" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-base font-extrabold tracking-tight font-['Poppins']">Minha Agenda</h1>
            <p className="text-[10px] text-slate-400 leading-none">Vagou achou.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setIsRouteSimulatorOpen(true);
            }}
            className="px-2.5 py-1 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            title="Simulador de Trajeto GPS (Teste)"
          >
            <Navigation className="w-3.5 h-3.5 text-white" />
            <span className="text-white">Trajeto</span>
          </button>
          <span className={`text-[11px] font-bold px-2 py-1 rounded-[4px] ${
            isDark ? 'bg-slate-900 border border-slate-800' : 'bg-slate-100 border border-slate-200'
          }`}>
            {clientAppointments.length} Ativos
          </span>
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO ROLANTE */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {/* CARD DE PRÉ-AGENDAMENTO PAUSADO (RASCUNHO) */}
        {savedDraft && (
          <div className={`w-full rounded-[4px] p-4 border space-y-2.5 ${
            isDark ? 'bg-slate-900 border-amber-500/50 text-white' : 'bg-amber-50 border-amber-300 text-slate-900'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[4px] bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold">
                <Bookmark className="w-3 h-3" />
                <span>Pré-Agendamento (Não garante vaga)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  saveBookingDraft(null);
                  setSavedDraft(null);
                }}
                className="text-[11px] font-bold text-rose-400 hover:underline cursor-pointer"
              >
                Descartar
              </button>
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-emerald-400">{savedDraft.combinedServiceTitle}</h3>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {savedDraft.isDependentBooking && savedDraft.dependentName
                  ? `Dependente: ${savedDraft.dependentName}`
                  : 'Para Você (Titular)'}{' '}
                • {savedDraft.professional}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/40">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{savedDraft.dateFormatted} às {savedDraft.timeSlot}</span>
              </span>
              <span className="font-extrabold">R$ {savedDraft.totalPrice.toFixed(0)}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onBack();
              }}
              className="w-full py-2.5 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Check className="w-4 h-4 text-white" />
              <span className="text-white">Retomar e Confirmar Vaga</span>
            </button>
          </div>
        )}

        {clientAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <div className={`w-16 h-16 rounded-[4px] flex items-center justify-center border ${
              isDark ? 'bg-slate-900/60 border-slate-800 text-slate-500' : 'bg-white border-slate-200 text-slate-400 shadow-xs'
            }`}>
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold">Nenhum agendamento ativo</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Você ainda não tem nenhum horário agendado ou pendente neste estabelecimento.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onBack();
              }}
              className="px-5 py-2.5 rounded-[4px] bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 transition cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <Scissors className="w-4 h-4 text-white" />
              <span>Ver Serviços & Agendar</span>
            </button>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {clientAppointments.map((item, idx) => {
              const rawPro = (item.professionalName || item.professional || '').trim();
              const isAnyPro = !rawPro || 
                rawPro.toLowerCase() === 'any' || 
                rawPro.toLowerCase().includes('sem preferência') || 
                rawPro.toLowerCase().includes('qualquer') ||
                rawPro.toLowerCase() === 'especialista';
              const proAvatar = getProfessionalAvatar(rawPro, item.professionalAvatar, resolvedAvatars);
              const hasValidProAvatar = Boolean(proAvatar && !failedAvatars[proAvatar]);
              const companyLogo = getCompanyLogo(item, isDark);
              const hasValidCompanyLogo = Boolean(companyLogo && !failedLogos[companyLogo]);
              const companyName = item.salonName || 'Estabelecimento';
              const isAppointmentPaid = Boolean(
                item.isPaid ||
                item.paidAt ||
                (item as any).payment_status === 'paid' ||
                (item as any).payment_status === 'PAGO' ||
                (item as any).paymentStatus === 'paid'
              );

              const activeCascadeTargets = item.swapRequest?.cascadeTargets || [];

              return (
                <motion.div
                  key={item.id || item.protocolCode || idx}
                  variants={itemVariants}
                  className={`w-full rounded-[4px] p-4 border flex flex-col space-y-3 ${
                    isDark 
                      ? 'bg-slate-900 border-slate-800 hover:border-slate-700' 
                      : 'bg-white border-slate-200 shadow-xs hover:shadow-sm'
                  } transition-all`}
                >
                  {/* TOPO: Cabeçalho do Card (Logo Oficial ou Logo Provisório do Cabeçalho + Nome da Empresa e Serviço) */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800/20 pb-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`h-10 min-w-[68px] px-2.5 rounded-[4px] border flex items-center justify-center shadow-2xs overflow-hidden shrink-0 ${
                          isDark
                            ? 'bg-slate-800/90 border-slate-700 text-white'
                            : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        {hasValidCompanyLogo ? (
                          <img
                            src={companyLogo}
                            alt={companyName}
                            className="max-h-7 max-w-[80px] object-contain"
                            referrerPolicy="no-referrer"
                            onError={() => setFailedLogos((prev) => ({ ...prev, [companyLogo]: true }))}
                          />
                        ) : (
                          <span
                            className={`font-display font-extrabold text-xs tracking-wider uppercase select-none ${
                              isDark ? 'text-white' : 'text-slate-700'
                            }`}
                          >
                            Logo
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span
                            className={`text-xs font-extrabold tracking-tight truncate max-w-[180px] sm:max-w-[260px] ${
                              isDark ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {companyName}
                          </span>
                          {item.is_dependent && item.dependent_name && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                              <Baby className="w-2.5 h-2.5" />
                              <span>{item.dependent_name}</span>
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-extrabold leading-tight text-emerald-400 truncate">
                          {item.serviceTitle || item.service || 'Serviço Personalizado'}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* CORPO: Esquerda (Profissional acima de Data e Horário) | Lado Oposto Direito (Status e abaixo dele o Valor + Status Pagto) */}
                  <div className="flex items-center justify-between gap-3 text-xs">
                    {/* Lado Esquerdo: 1º Profissional (acima) e 2º Data e Horário (abaixo) */}
                    <div className="space-y-2.5 min-w-0 flex-1">
                      {/* Div Profissional (Acima) */}
                      <div>
                        {rawPro && !isAnyPro ? (
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-[4px] border overflow-hidden flex items-center justify-center shrink-0 shadow-2xs ${
                                isDark
                                  ? 'bg-slate-800 border-slate-700 text-slate-200'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              {hasValidProAvatar ? (
                                <img
                                  src={proAvatar}
                                  alt={rawPro}
                                  className="w-full h-full object-cover"
                                  loading="eager"
                                  decoding="async"
                                  crossOrigin="anonymous"
                                  referrerPolicy="no-referrer"
                                  onError={() => setFailedAvatars((prev) => ({ ...prev, [proAvatar]: true }))}
                                />
                              ) : (
                                <User className="w-4 h-4 text-emerald-500 dark:text-emerald-400 stroke-[1.75]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] text-slate-400 font-medium">Profissional</div>
                              <div className={`font-bold truncate max-w-[140px] sm:max-w-[180px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                {rawPro}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5 text-slate-400">
                            <div
                              className={`w-8 h-8 rounded-[4px] border flex items-center justify-center shrink-0 ${
                                isDark
                                  ? 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                                  : 'bg-slate-100 border-slate-200 text-slate-500'
                              }`}
                            >
                              <User className="w-4 h-4 text-emerald-500 dark:text-emerald-400 stroke-[1.75]" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] text-slate-400 font-medium">Profissional</div>
                              <div className="font-semibold text-slate-400 truncate text-xs">Sem preferência</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Div Data e Horário (Abaixo do Profissional) */}
                      <div className="flex items-center gap-2.5 text-slate-400">
                        <div
                          className={`w-8 h-8 rounded-[4px] border flex items-center justify-center shrink-0 ${
                            isDark
                              ? 'bg-slate-800/60 border-slate-700/60'
                              : 'bg-slate-100 border-slate-200'
                          }`}
                        >
                          <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-400 font-medium">Data e Horário</div>
                          <div className={`font-bold truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                            {item.dateTime || 'Hoje, às 15:30'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lado Oposto (Direito): Status acima e abaixo dele o Valor + Status do Pagamento */}
                    <div className="flex flex-col items-end justify-center gap-2 shrink-0">
                      {getStatusBadge(item.status)}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-emerald-400 font-mono tabular-nums whitespace-nowrap">
                          R$ {item.totalPrice.toFixed(2)}
                        </span>
                        {isAppointmentPaid ? (
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-emerald-500 text-white font-extrabold text-[10px] leading-none shadow-2xs whitespace-nowrap">
                            Pago
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-blue-500 text-white font-extrabold text-[10px] leading-none shadow-2xs whitespace-nowrap">
                            À pagar
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* FAIXA COMPACTA DE PERMUTA EM CASCATA ATIVA */}
                  {item.swapRequest?.isClientSwap && item.swapRequest.status === 'pending_client_b' && (
                    <div className="pt-2.5 border-t border-slate-800/30 flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-bold text-emerald-400 truncate">
                          Permuta:{' '}
                          {activeCascadeTargets.length > 0
                            ? activeCascadeTargets.map((t) => t.slotTime).join(' ➔ ')
                            : item.swapRequest.clientA.requestedTime}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAcceptSwapOnCard(item)}
                          className="px-2 py-1 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] cursor-pointer whitespace-nowrap"
                        >
                          Simular Aceite
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelSwapOnCard(item)}
                          className="px-2 py-1 rounded-[4px] text-rose-400 hover:bg-rose-500/10 font-bold text-[10px] cursor-pointer whitespace-nowrap"
                        >
                          Cancelar Permuta
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Alertas de Adversidade Ativa ou Motivo de Cancelamento */}
                  {item.active_adversity ? (
                    <div className="pt-2 border-t border-slate-800/40">
                      <div className="p-2 rounded-[4px] bg-amber-500/15 text-amber-300 text-[11px] flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            {item.active_adversity.label} ({item.active_adversity.street})
                          </span>
                        </span>
                        <span className="font-mono tabular-nums font-black text-amber-400">
                          +{item.active_adversity.addedMinutes} min
                        </span>
                      </div>
                    </div>
                  ) : item.cancellation_reason ? (
                    <div className="pt-2 border-t border-slate-800/40 text-[11px] text-rose-400 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Motivo do cancelamento: <strong>{item.cancellation_reason}</strong></span>
                    </div>
                  ) : null}

                  {/* RODAPÉ: Botões Divididos na Ordem -> Cancelar | Remarcar | Ir */}
                  {item.status !== 'CANCELADO' && item.status !== 'CONCLUÍDO' && item.status !== 'concluido' && item.status !== 'cancelado' && (
                    <div className="grid grid-cols-3 gap-2 border-t border-slate-800/10 pt-3 mt-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setDepartureModalStep('cancel_reason');
                          setDepartureModalApt(item);
                        }}
                        className="py-2 px-2.5 rounded-[4px] bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white font-bold text-xs flex items-center justify-center transition cursor-pointer active:scale-95 whitespace-nowrap"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          hapticLight();
                          openRescheduleAndSwapModal(item);
                        }}
                        className={`py-2 px-2.5 rounded-[4px] border font-bold text-xs flex items-center justify-center gap-1 transition cursor-pointer active:scale-95 whitespace-nowrap ${
                          isDark
                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                            : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                        }`}
                      >
                        <span>Remarcar</span>
                      </button>

                      <button
                        type="button"
                        id={`btn-ir-${item.protocolCode}`}
                        onClick={() => {
                          hapticLight();
                          if (item.service_location_type === 'home_delivery') {
                            setDrawerViewerState({ appointment: item, initialTab: 'map' });
                          } else {
                            setDepartureModalStep('in_app_map');
                            setDepartureModalApt(item);
                          }
                        }}
                        className="py-2 px-2.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs whitespace-nowrap"
                      >
                        {item.service_location_type === 'home_delivery' ? (
                          <MapIcon className="w-3.5 h-3.5 text-white shrink-0" />
                        ) : (
                          <Navigation className="w-3.5 h-3.5 text-white shrink-0" />
                        )}
                        <span className="text-white">Ir</span>
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* MODAL UNIFICADO DE REMARCAÇÃO & PERMUTA EM CASCATA (OPÇÃO 1) */}
        {rescheduleModalApt && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div
              className={`w-full sm:max-w-md max-h-[88vh] rounded-t-[8px] sm:rounded-[4px] border flex flex-col overflow-hidden ${
                isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
            >
              {/* Topo Fixo do Modal */}
              <div className="px-4 py-3 border-b border-slate-800/30 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowLeftRight className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-extrabold truncate">Remarcar Horário</h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      Atual: {rescheduleModalApt.dateTime || extractTimeFromAppointment(rescheduleModalApt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRescheduleModalApt(null)}
                  className={`w-8 h-8 rounded-[4px] flex items-center justify-center cursor-pointer ${
                    isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Seletor de Modo: Horários Livres vs Permuta (Ocupados) */}
              <div className="grid grid-cols-2 gap-1.5 p-3 border-b border-slate-800/20 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setRescheduleMode('free');
                  }}
                  className={`py-2 px-2.5 rounded-[4px] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    rescheduleMode === 'free'
                      ? 'bg-emerald-500 text-white'
                      : isDark
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Clock className={`w-3.5 h-3.5 ${rescheduleMode === 'free' ? 'text-white' : 'text-emerald-400'}`} />
                  <span className={rescheduleMode === 'free' ? 'text-white' : ''}>Horários Livres</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setRescheduleMode('swap');
                  }}
                  className={`py-2 px-2.5 rounded-[4px] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    rescheduleMode === 'swap'
                      ? 'bg-emerald-500 text-white'
                      : isDark
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <ArrowLeftRight className={`w-3.5 h-3.5 ${rescheduleMode === 'swap' ? 'text-white' : 'text-emerald-400'}`} />
                  <span className={rescheduleMode === 'swap' ? 'text-white' : ''}>Permuta (Ocupados)</span>
                </button>
              </div>

              {/* Conteúdo Rolante */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(() => {
                  const getSlotConflict = (slotTime: string) =>
                    checkInterSalonSlotCollision({
                      slotTime,
                      dateStr: rescheduleModalApt.dateIso,
                      currentSalonName: rescheduleModalApt.salonName,
                      candidateServiceDurationMin: rescheduleModalApt.durationMinutes ?? 45,
                      excludeAppointmentProtocol: rescheduleModalApt.protocolCode,
                      clientAppointments,
                    });

                  const firstConflictExample = FREE_SLOTS_CANDIDATES.map((s) => getSlotConflict(s)).find(
                    Boolean
                  );

                  return rescheduleMode === 'free' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400">Vagas livres hoje (Troca imediata)</span>
                        {onRescheduleAppointment && (
                          <button
                            type="button"
                            onClick={() => {
                              const target = rescheduleModalApt;
                              setRescheduleModalApt(null);
                              onRescheduleAppointment(target);
                            }}
                            className="text-emerald-400 font-bold hover:underline cursor-pointer"
                          >
                            Outra data
                          </button>
                        )}
                      </div>

                      {firstConflictExample && (
                        <div className="px-2.5 py-1.5 rounded-[4px] bg-amber-500/15 text-amber-400 text-[11px] font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{firstConflictExample.message}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-2">
                        {FREE_SLOTS_CANDIDATES.filter(
                          (s) => s !== extractTimeFromAppointment(rescheduleModalApt)
                        ).map((slot) => {
                          const isSelected = selectedFreeSlot === slot;
                          const conflict = getSlotConflict(slot);
                          return (
                            <button
                              key={slot}
                              type="button"
                              disabled={Boolean(conflict)}
                              title={conflict ? conflict.message : `Remarcar para ${slot}`}
                              onClick={() => {
                                if (conflict) return;
                                hapticLight();
                                setSelectedFreeSlot(slot);
                              }}
                              className={`py-2.5 rounded-[4px] font-mono text-xs font-bold flex items-center justify-center transition ${
                                conflict
                                  ? 'bg-amber-500/10 text-amber-400/70 line-through cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-emerald-500 text-white cursor-pointer'
                                  : isDark
                                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200 cursor-pointer'
                              }`}
                            >
                              <span className={isSelected ? 'text-white' : ''}>{slot}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-400">
                          Selecione até 3 ocupados (Fila A ➔ B ➔ C)
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {selectedSwapSlots.length}/3
                        </span>
                      </div>

                      {firstConflictExample && (
                        <div className="px-2.5 py-1.5 rounded-[4px] bg-amber-500/15 text-amber-400 text-[11px] font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{firstConflictExample.message}</span>
                        </div>
                      )}

                      {(() => {
                        const realOccupiedCandidates = getRealOccupiedCandidates(rescheduleModalApt);
                        if (realOccupiedCandidates.length === 0) {
                          return (
                            <div className={`p-4 rounded-[4px] text-center text-xs font-medium ${
                              isDark ? 'bg-slate-800/60 text-slate-400' : 'bg-slate-100 text-slate-600'
                            }`}>
                              Nenhum horário ocupado disponível para permuta nesta data.
                            </div>
                          );
                        }
                        return (
                          <div className="grid grid-cols-3 gap-2">
                            {realOccupiedCandidates.map((candidate) => {
                              const orderIndex = selectedSwapSlots.indexOf(candidate.time);
                              const isSelected = orderIndex !== -1;
                              const conflict = getSlotConflict(candidate.time);
                              return (
                                <button
                                  key={candidate.time}
                                  type="button"
                                  disabled={Boolean(conflict)}
                                  title={conflict ? conflict.message : `Permutar às ${candidate.time}`}
                                  onClick={() => {
                                    if (conflict) return;
                                    hapticLight();
                                    setSelectedSwapSlots((prev) => {
                                      if (prev.includes(candidate.time)) {
                                        return prev.filter((t) => t !== candidate.time);
                                      }
                                      if (prev.length >= 3) return prev;
                                      return [...prev, candidate.time];
                                    });
                                  }}
                                  className={`py-2 px-2 rounded-[4px] flex flex-col items-center justify-center gap-0.5 transition ${
                                    conflict
                                      ? 'bg-amber-500/10 text-amber-400/70 line-through cursor-not-allowed'
                                      : isSelected
                                      ? 'bg-emerald-500 text-white cursor-pointer'
                                      : isDark
                                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200 cursor-pointer'
                                  }`}
                                >
                                  <div className="flex items-center gap-1">
                                    <span className={`font-mono text-xs font-extrabold ${isSelected ? 'text-white' : ''}`}>
                                      {candidate.time}
                                    </span>
                                    {isSelected && (
                                      <span className="text-[10px] font-black text-white">
                                        ({orderIndex + 1}º)
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-[10px] truncate max-w-full ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                    {candidate.clientName}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {selectedSwapSlots.length > 0 && (
                        <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5 pt-1">
                          <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
                          <span>Ordem de disparo: {selectedSwapSlots.join(' ➔ ')}</span>
                        </div>
                      )}

                      <input
                        type="text"
                        value={swapMessage}
                        onChange={(e) => setSwapMessage(e.target.value)}
                        placeholder="Mensagem rápida opcional (ex: Imprevisto no trabalho)"
                        className={`w-full px-3 py-2 rounded-[4px] text-xs border outline-hidden ${
                          isDark
                            ? 'bg-slate-950 border-slate-800 text-white placeholder:text-slate-500'
                            : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>
                  );
                })()}
              </div>

              {/* Rodapé Fixo de Ação (sticky bottom-0 z-20) */}
              <div
                className={`p-3 border-t sticky bottom-0 z-20 flex items-center gap-2 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setRescheduleModalApt(null)}
                  className={`py-2.5 px-4 rounded-[4px] font-bold text-xs cursor-pointer whitespace-nowrap ${
                    isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Fechar
                </button>

                {rescheduleMode === 'free' ? (
                  <button
                    type="button"
                    disabled={!selectedFreeSlot}
                    onClick={handleConfirmDirectReschedule}
                    className={`flex-1 py-2.5 px-4 rounded-[4px] font-extrabold text-xs flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                      selectedFreeSlot
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Check className={`w-4 h-4 ${selectedFreeSlot ? 'text-white' : 'text-slate-500'}`} />
                    <span className={selectedFreeSlot ? 'text-white' : 'text-slate-500'}>
                      {selectedFreeSlot ? `Confirmar às ${selectedFreeSlot}` : 'Escolha um horário livre'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={selectedSwapSlots.length === 0}
                    onClick={handleSendCascadeSwap}
                    className={`flex-1 py-2.5 px-4 rounded-[4px] font-extrabold text-xs flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                      selectedSwapSlots.length > 0
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <ArrowLeftRight className={`w-4 h-4 ${selectedSwapSlots.length > 0 ? 'text-white' : 'text-slate-500'}`} />
                    <span className={selectedSwapSlots.length > 0 ? 'text-white' : 'text-slate-500'}>
                      {selectedSwapSlots.length > 0
                        ? `Solicitar Permuta (${selectedSwapSlots.length})`
                        : 'Escolha até 3 horários'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL PRÉ-PARTIDA (ETA + 10 MIN) & TRAÇADOR DE ROTA GOOGLE MAPS IN-APP */}
        {departureModalApt && (
          <LiveRouteDepartureModal
            isOpen={Boolean(departureModalApt)}
            appointment={departureModalApt}
            initialStep={departureModalStep}
            onClose={() => setDepartureModalApt(null)}
            onUpdateAppointment={handleSingleAppointmentUpdate}
            onCancelWithReason={(proto, reason) => {
              if (onCancelAppointment) {
                onCancelAppointment(proto, reason);
              }
            }}
            onRequestReschedule={(apt) => {
              setDepartureModalApt(null);
              openRescheduleAndSwapModal(apt);
            }}
            onOpenLiveViewer={(apt, tab) => {
              setDepartureModalApt(null);
              setDrawerViewerState({ appointment: apt, initialTab: tab });
            }}
          />
        )}

        {/* MODAL PROVISÓRIO DE TESTE DE TRAJETO GPS */}
        {isRouteSimulatorOpen && (
          <RouteSimulatorModal
            isOpen={isRouteSimulatorOpen}
            onClose={() => setIsRouteSimulatorOpen(false)}
            onStartRoute={(testAppointment) => {
              setIsRouteSimulatorOpen(false);
              setDepartureModalApt(testAppointment);
            }}
          />
        )}

        {/* GAVETA DE RASTREAMENTO AO VIVO (LINHA SHOPEE/CORREIOS ⇄ MAPA 10S) */}
        {drawerViewerState && (
          <LiveTrackingDrawerModal
            isOpen={Boolean(drawerViewerState)}
            appointment={drawerViewerState.appointment}
            initialTab={drawerViewerState.initialTab}
            viewerRole="client"
            onClose={() => setDrawerViewerState(null)}
            onUpdateAppointment={handleSingleAppointmentUpdate}
          />
        )}

        {/* NOTA DE COBERTURA & AJUDA */}
        <div className={`rounded-[4px] p-3.5 border flex items-start gap-3 ${
          isDark ? 'bg-slate-900/40 border-slate-800/80 text-slate-400' : 'bg-slate-100/60 border-slate-200 text-slate-500'
        }`}>
          <Info className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-normal space-y-1">
            <p className="font-bold text-emerald-400">Precisa reagendar ou realizar uma permuta?</p>
            <p>
              Toque em Remarcar para trocar para um horário livre imediatamente ou solicitar permuta em cascata com até 3 horários ocupados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

