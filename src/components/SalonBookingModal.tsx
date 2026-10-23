import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X, Calendar, Clock, User, Users, CheckCircle2, ChevronLeft, ChevronRight,
  Sparkles, Star, Scissors, ArrowLeft, Building2, AlertCircle,
  Check, Video, Images, Phone, Plus, Navigation, MapPin, Search,
  Sun, Sunset, Moon, Bookmark, RotateCcw, Loader2, Car
} from 'lucide-react';
import { supabase, isSupabaseConfigured, fetchClientFamilyMembers, generateUuidV4 } from '../lib/supabase';
import { syncClientDependentToDatabase } from '../services/mnvSupabaseSync';
import { ServiceOffer, CatalogServiceItem, UserFamilyDependent } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  getAvailableSlotsForDate,
  fetchBusySlotsDirectly,
  resolveAddressDistanceToSalon,
  saveBookingDraft,
  BookingDraftItem,
  BookingSlotItem,
} from '../utils/bookingSlots';
import { hapticLight, hapticMedium, hapticSuccess } from '../utils/haptics';
import { SalonClientAuthModal } from './SalonClientAuthModal';

export type { CatalogServiceItem };

export interface SalonProfessionalItem {
  id?: string;
  name: string;
  role?: string;
  avatar?: string;
  avatarUrl?: string;
  rating?: number;
  systemRole?: 'admin' | 'member';
}

interface SalonBookingModalProps {
  isOpen?: boolean;
  inline?: boolean;
  onClose?: () => void;
  salonId?: string;
  salonName: string;
  salonAddress?: string;
  salonCep?: string;
  salonLogo?: string;
  salonCoords?: { lat: number; lng: number };
  primaryColor?: string;
  services: CatalogServiceItem[];
  professionals: SalonProfessionalItem[];
  initialService?: CatalogServiceItem | null;
  bookingTrigger?: number;
  resumeDraft?: BookingDraftItem | null;
  baseOffer?: ServiceOffer;
  skipDateStep?: boolean;
  initialTimeSlot?: string | null;
  initialDateIso?: string;
  preSelectedProfessionalName?: string;
  onDraftSaved?: (draft: BookingDraftItem | null) => void;
  onConfirmAppointment: (bookingData: {
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
    transportMode?: 'driving' | 'motorcycle' | 'walking' | 'transit';
    selectedRouteSummary?: string;
  }) => Promise<{ success: boolean; error?: string } | void> | void;
}

type Step = 'service' | 'date' | 'professionals_and_time';

const PREP_BUFFER_MINUTES = 15;

export const SalonBookingModal: React.FC<SalonBookingModalProps> = ({
  isOpen = true,
  inline = false,
  onClose,
  salonId = '',
  salonName,
  salonAddress = '',
  salonCep = '',
  salonLogo,
  salonCoords = { lat: -23.5621, lng: -46.4795 },
  primaryColor = '#00a033',
  services,
  professionals,
  initialService,
  bookingTrigger = 0,
  resumeDraft = null,
  baseOffer,
  skipDateStep = false,
  initialTimeSlot,
  initialDateIso,
  preSelectedProfessionalName,
  onDraftSaved,
  onConfirmAppointment,
}) => {
  const { isDark } = useTheme();

  // 1. Selected Services State (Suporta 1 ou mais serviços)
  const [selectedServices, setSelectedServices] = useState<CatalogServiceItem[]>(() => {
    if (initialService) return [initialService];
    return [];
  });

  // Controle se o usuário clicou em "+ Mais Serviços" para adicionar procedimentos extras
  const [isAddingExtraServices, setIsAddingExtraServices] = useState(false);

  const toggleServiceSelection = (srv: CatalogServiceItem) => {
    hapticLight();
    setSelectedServices((prev) => {
      const exists = prev.some((s) => s.id === srv.id);
      if (exists) {
        return prev.filter((s) => s.id !== srv.id);
      } else {
        return [...prev, srv];
      }
    });
  };

  // Objeto consolidado de serviços selecionados
  const selectedService = useMemo(() => {
    if (selectedServices.length === 0) return null;
    if (selectedServices.length === 1) return selectedServices[0];

    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const combinedTitle = selectedServices.map((s) => s.title).join(' + ');

    let totalMinutes = 0;
    let canParseMinutes = true;
    for (const s of selectedServices) {
      const match = String(s.duration || '').match(/(\d+)/);
      if (match) {
        totalMinutes += parseInt(match[1], 10);
      } else {
        canParseMinutes = false;
        break;
      }
    }
    const combinedDuration = canParseMinutes
      ? `${totalMinutes} min`
      : selectedServices.map((s) => s.duration).join(' + ');

    return {
      id: selectedServices.map((s) => s.id).join('+'),
      title: combinedTitle,
      price: totalPrice,
      duration: combinedDuration,
      category: selectedServices[0]?.category || 'Combo',
    } as CatalogServiceItem;
  }, [selectedServices]);

  // Step state: 'service' -> 'date' -> 'professionals_and_time' (Resumo abre em modal independente)
  const [currentStep, setCurrentStep] = useState<Step>(() => {
    if (initialTimeSlot) return 'professionals_and_time';
    if (initialService) return skipDateStep ? 'professionals_and_time' : 'date';
    return 'service';
  });

  // Modal Inline "Para Você ou Dependente?" (abre após escolha do serviço e antes da data)
  const [isBeneficiaryModalOpen, setIsBeneficiaryModalOpen] = useState(false);
  const [hasChosenBeneficiary, setHasChosenBeneficiary] = useState(false);

  // Modal Independente de Resumo Final / Pré-Salvamento
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [draftSavedFeedback, setDraftSavedFeedback] = useState<string | null>(null);

  // 2. Date Selection State (Monthly Calendar)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayIso = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const [currentViewMonth, setCurrentViewMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [selectedDateIso, setSelectedDateIso] = useState<string>(() => {
    const d = new Date();
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // 3. Professional Selection State ('any' or professional name)
  const [selectedProfessional, setSelectedProfessional] = useState<string>(preSelectedProfessionalName || 'any');

  // 4. Time Slot & Period Selection (Ordem obrigatória: Manhã, Tarde, Noite, Todos)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(initialTimeSlot || null);
  const [timePeriodFilter, setTimePeriodFilter] = useState<'manha' | 'tarde' | 'noite' | 'todos'>('manha');

  // 5. Comparador de Endereço em Tempo Real + Cálculo Preditivo (Deslocamento + 15 min preparo)
  const [addressQuery, setAddressQuery] = useState<string>(() => {
    return localStorage.getItem('vagou_client_test_address') || '08235-770';
  });
  const [salonDestQuery, setSalonDestQuery] = useState<string>(() => {
    return salonCep || salonAddress || '08285-010';
  });
  const [resolvedAddressLabel, setResolvedAddressLabel] = useState<string>('Parque Guarani, São Paulo/SP');
  const [resolvedSalonLabel, setResolvedSalonLabel] = useState<string>(salonCep || salonAddress || '08285-010');
  const [distanceKm, setDistanceKm] = useState<number>(6.6);
  const [etaMinutes, setEtaMinutes] = useState<number>(17);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);

  // Sincronizar CEP/Endereço real do salão assim que hidratar do Supabase
  useEffect(() => {
    const nextDest = (salonCep || salonAddress || '').trim();
    if (nextDest && nextDest !== salonDestQuery) {
      setSalonDestQuery(nextDest);
    }
  }, [salonCep, salonAddress]);

  // Horários ocupados vindos do banco de dados
  const [busySlotsFromDb, setBusySlotsFromDb] = useState<
    Array<{ start_time: string; end_time: string; professional_id?: string; professional_name?: string }>
  >([]);
  const [isLoadingBusySlots, setIsLoadingBusySlots] = useState(false);

  // Relógio em tempo real para manter o cálculo de Hora Atual + ETA + 15 min sempre preciso
  const [currentTimeTick, setCurrentTimeTick] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeTick(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Estado de Autenticação e Dependentes (Conta Família sincronizada com o banco)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDependentBooking, setIsDependentBooking] = useState(false);
  const [dependentId, setDependentId] = useState<string>('');
  const [dependentName, setDependentName] = useState('');
  const [registeredDependents, setRegisteredDependents] = useState<UserFamilyDependent[]>(() => {
    try {
      const raw = localStorage.getItem('vagou_user_dependents');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  // Mini-formulário inline para "+ Cadastrar Dependente" dentro do modal "Para Você ou Dependente?"
  const [isCreatingDependentInline, setIsCreatingDependentInline] = useState(false);
  const [newDepFullName, setNewDepFullName] = useState('');
  const [newDepRelationship, setNewDepRelationship] = useState<'son' | 'daughter' | 'spouse' | 'parent' | 'other'>('son');
  const [newDepBirthDate, setNewDepBirthDate] = useState('');
  const [newDepNotes, setNewDepNotes] = useState('');
  const [isSavingInlineDependent, setIsSavingInlineDependent] = useState(false);

  const [clientPhoneInput, setClientPhoneInput] = useState(() => {
    return localStorage.getItem('vagou_user_phone') || '';
  });
  const [bookingErrorMessage, setBookingErrorMessage] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Carregar dependentes reais do cliente no Supabase (public.dependents / public.client_family_members)
  useEffect(() => {
    async function loadClientDependentsFromDb() {
      try {
        const rawLocal = localStorage.getItem('vagou_user_dependents');
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) setRegisteredDependents(parsed);
        }
      } catch {}

      if (!isSupabaseConfigured || !supabase) return;
      try {
        let parentClientId = localStorage.getItem('vagou_client_id') || '';
        const cleanEmail = (localStorage.getItem('vagou_user_email') || '').trim().toLowerCase();

        if ((!parentClientId || parentClientId.length < 10) && cleanEmail) {
          const { data: cRow } = await (supabase.from('clients') as any)
            .select('id')
            .ilike('email', `%${cleanEmail}%`)
            .maybeSingle();
          if (cRow?.id) {
            parentClientId = cRow.id;
            localStorage.setItem('vagou_client_id', cRow.id);
          }
        }

        if (parentClientId && parentClientId.length > 10) {
          const remoteDeps = await fetchClientFamilyMembers(parentClientId);
          if (Array.isArray(remoteDeps) && remoteDeps.length > 0) {
            const normalized: UserFamilyDependent[] = remoteDeps.map((d: any) => ({
              id: d.id,
              parent_client_id: d.parent_client_id || d.guardian_client_id || parentClientId,
              full_name: d.full_name || d.name || 'Dependente',
              relationship: d.relationship || 'other',
              birth_date: d.birth_date || undefined,
              notes: d.notes || undefined,
              is_unlinked: Boolean(d.is_unlinked),
              created_at: d.created_at || new Date().toISOString(),
            }));
            setRegisteredDependents(normalized);
            localStorage.setItem('vagou_user_dependents', JSON.stringify(normalized));
          }
        }
      } catch {}
    }

    loadClientDependentsFromDb();
  }, [isOpen, isBeneficiaryModalOpen]);

  // Consultar horários ocupados no banco sempre que a data ou o salão mudar
  useEffect(() => {
    let active = true;
    async function loadBusySlots() {
      if (!selectedDateIso) return;
      setIsLoadingBusySlots(true);
      const effectiveSalonId = salonId || localStorage.getItem('vagou_salon_db_id') || '';
      const slots = await fetchBusySlotsDirectly(effectiveSalonId, selectedDateIso);
      if (active) {
        setBusySlotsFromDb(slots);
        setIsLoadingBusySlots(false);
      }
    }
    loadBusySlots();
    return () => {
      active = false;
    };
  }, [salonId, selectedDateIso, isSummaryModalOpen]);

  // Reagir imediatamente quando o usuário clica em um Serviço na Vitrine (corrige bug do modo inline)
  const prevBookingTriggerRef = useRef<number>(bookingTrigger);
  const prevInitialServiceIdRef = useRef<string | undefined>(initialService?.id);

  useEffect(() => {
    const triggerChanged = bookingTrigger > 0 && bookingTrigger !== prevBookingTriggerRef.current;
    const serviceChanged = initialService && initialService.id !== prevInitialServiceIdRef.current;

    if (triggerChanged || serviceChanged) {
      prevBookingTriggerRef.current = bookingTrigger;
      prevInitialServiceIdRef.current = initialService?.id;

      if (initialService) {
        setSelectedServices([initialService]);
        setIsAddingExtraServices(false);
        if (initialDateIso) setSelectedDateIso(initialDateIso);
        if (initialTimeSlot) {
          setSelectedTimeSlot(initialTimeSlot);
          setCurrentStep('professionals_and_time');
          setIsSummaryModalOpen(true);
        } else {
          // Pula a etapa redundante de seleção de serviço, avança direto para Data e abre o modal "Para Você ou Dependente?"
          setSelectedTimeSlot(null);
          setCurrentStep(skipDateStep ? 'professionals_and_time' : 'date');
          setIsBeneficiaryModalOpen(true);
        }
      }
    }
  }, [bookingTrigger, initialService, skipDateStep, initialTimeSlot, initialDateIso]);

  // Restaurar rascunho pré-salvo quando solicitado pelo cliente (Banner Flutuante ou Minha Agenda)
  useEffect(() => {
    if (!resumeDraft) return;
    if (Array.isArray(resumeDraft.services) && resumeDraft.services.length > 0) {
      setSelectedServices(resumeDraft.services as CatalogServiceItem[]);
    }
    setSelectedDateIso(resumeDraft.dateIso);
    setSelectedProfessional(resumeDraft.professional || 'any');
    setSelectedTimeSlot(resumeDraft.timeSlot);
    setIsDependentBooking(Boolean(resumeDraft.isDependentBooking));
    setDependentId(resumeDraft.dependentId || '');
    setDependentName(resumeDraft.dependentName || '');
    if (resumeDraft.clientPhone) setClientPhoneInput(resumeDraft.clientPhone);
    if (resumeDraft.distanceKm) setDistanceKm(resumeDraft.distanceKm);
    if (resumeDraft.etaMinutes) setEtaMinutes(resumeDraft.etaMinutes);
    if (resumeDraft.clientAddressQuery) {
      setAddressQuery(resumeDraft.clientAddressQuery);
      setResolvedAddressLabel(resumeDraft.clientAddressQuery);
    }
    setHasChosenBeneficiary(true);
    setCurrentStep('professionals_and_time');
    setIsSummaryModalOpen(true);
  }, [resumeDraft]);

  // Rastrear abertura em modo modal tradicional (!inline)
  const prevIsOpenRef = useRef(false);
  useEffect(() => {
    if (!inline && isOpen && !prevIsOpenRef.current) {
      if (initialDateIso) setSelectedDateIso(initialDateIso);
      if (initialService) {
        setSelectedServices([initialService]);
        setCurrentStep(skipDateStep ? 'professionals_and_time' : 'date');
        setIsBeneficiaryModalOpen(true);
      } else {
        setSelectedServices([]);
        setCurrentStep('service');
      }
      if (initialTimeSlot) {
        setSelectedTimeSlot(initialTimeSlot);
        setIsSummaryModalOpen(true);
      } else {
        setSelectedTimeSlot(null);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [inline, isOpen, skipDateStep, initialTimeSlot, initialDateIso, initialService]);

  // Handler para salvar novo dependente inline sem sair do fluxo de agendamento
  const handleSaveInlineDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepFullName.trim()) return;
    setIsSavingInlineDependent(true);
    hapticLight();

    const newId = generateUuidV4();
    const newDepItem: UserFamilyDependent = {
      id: newId,
      full_name: newDepFullName.trim(),
      relationship: newDepRelationship,
      birth_date: newDepBirthDate || undefined,
      notes: newDepNotes.trim() || undefined,
      is_unlinked: false,
      created_at: new Date().toISOString(),
    };

    const updatedList = [...registeredDependents, newDepItem];
    setRegisteredDependents(updatedList);
    try {
      localStorage.setItem('vagou_user_dependents', JSON.stringify(updatedList));
    } catch {}

    // Sincronizar no Supabase (public.dependents + public.client_family_members)
    if (isSupabaseConfigured && supabase) {
      try {
        let parentClientId = localStorage.getItem('vagou_client_id') || '';
        const cleanEmail = (localStorage.getItem('vagou_user_email') || '').trim().toLowerCase();
        if ((!parentClientId || parentClientId.length < 10) && cleanEmail) {
          const { data: cRow } = await (supabase.from('clients') as any)
            .select('id')
            .ilike('email', `%${cleanEmail}%`)
            .maybeSingle();
          if (cRow?.id) {
            parentClientId = cRow.id;
            localStorage.setItem('vagou_client_id', cRow.id);
          }
        }
        if (parentClientId && parentClientId.length > 10) {
          await syncClientDependentToDatabase(parentClientId, {
            id: newId,
            fullName: newDepItem.full_name,
            relationship: newDepItem.relationship,
            birthDate: newDepItem.birth_date || null,
            notes: newDepItem.notes || null,
            isUnlinked: false,
          });
        }
      } catch {}
    }

    setIsDependentBooking(true);
    setDependentId(newDepItem.id);
    setDependentName(newDepItem.full_name);
    setHasChosenBeneficiary(true);
    setNewDepFullName('');
    setNewDepBirthDate('');
    setNewDepNotes('');
    setIsCreatingDependentInline(false);
    setIsSavingInlineDependent(false);
    setIsBeneficiaryModalOpen(false);
    setCurrentStep('date');
    hapticSuccess();
  };

  // Handler do Comparador de Endereço em Tempo Real (Origem Cliente -> Destino Salão via OSRM)
  const runRouteCalculation = async (originInput: string, destInput: string) => {
    if (!originInput.trim()) return;
    setIsCalculatingRoute(true);
    try {
      const result = await resolveAddressDistanceToSalon(
        originInput,
        salonCoords,
        destInput || salonCep || salonAddress || '08285-010'
      );
      setResolvedAddressLabel(result.formattedAddress);
      if (result.salonFormattedAddress) {
        setResolvedSalonLabel(result.salonFormattedAddress);
      }
      setDistanceKm(result.distanceKm);
      setEtaMinutes(result.etaMinutes);
      setSelectedTimeSlot(null);
      try {
        localStorage.setItem('vagou_client_test_address', originInput.trim());
      } catch {}
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  const handleSimulateAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    hapticLight();
    await runRouteCalculation(addressQuery, salonDestQuery);
  };

  // Auto-calcular rota real ao abrir ou quando digitar um CEP completo de 8 dígitos
  useEffect(() => {
    const cleanOriginDigits = addressQuery.replace(/\D/g, '');
    if (cleanOriginDigits.length === 8 || addressQuery.trim().length >= 6) {
      const timer = setTimeout(() => {
        runRouteCalculation(addressQuery, salonDestQuery);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [addressQuery, salonDestQuery]);

  // Monthly Calendar Generation
  const monthData = useMemo(() => {
    const year = currentViewMonth.getFullYear();
    const month = currentViewMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const monthNameFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
    const monthLabel = monthNameFormatter.format(currentViewMonth);

    const daysGrid: Array<{
      dayNumber: number | null;
      isoString: string | null;
      isToday: boolean;
      isDisabled: boolean;
      isClosed: boolean;
    }> = [];

    for (let i = 0; i < firstDayIndex; i++) {
      daysGrid.push({ dayNumber: null, isoString: null, isToday: false, isDisabled: true, isClosed: false });
    }

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      dateObj.setHours(0, 0, 0, 0);

      const iso = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      const isPast = dateObj < today;
      const isSunday = dateObj.getDay() === 0;

      const isDisabled = isPast || isSunday;
      const isToday = dateObj.getTime() === today.getTime();

      daysGrid.push({
        dayNumber: d,
        isoString: iso,
        isToday,
        isDisabled,
        isClosed: isSunday,
      });
    }

    return {
      monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      daysGrid,
      year,
      month,
    };
  }, [currentViewMonth, today]);

  const handlePrevMonth = () => {
    const prev = new Date(currentViewMonth);
    prev.setMonth(prev.getMonth() - 1);
    if (
      prev.getFullYear() < today.getFullYear() ||
      (prev.getFullYear() === today.getFullYear() && prev.getMonth() < today.getMonth())
    ) {
      return;
    }
    setCurrentViewMonth(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentViewMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentViewMonth(next);
  };

  // Cálculo de bloqueio preditivo (Hora Atual + Deslocamento + 15 min preparo) e Abas de Período
  const isSelectedDateToday = selectedDateIso === todayIso;
  const nowMinutes = currentTimeTick.getHours() * 60 + currentTimeTick.getMinutes();
  const totalLeadMinutes = etaMinutes + PREP_BUFFER_MINUTES;
  const minAllowedMinutesToday = nowMinutes + totalLeadMinutes;

  const minAllowedTimeFormatted = useMemo(() => {
    const clamped = Math.min(23 * 60 + 59, minAllowedMinutesToday);
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }, [minAllowedMinutesToday]);

  // Regra de Indisponibilização Automática de Abas de Período Passadas (Manhã < 12:00, Tarde < 18:00)
  const isManhaPeriodDisabled = isSelectedDateToday && (nowMinutes >= 12 * 60 || minAllowedMinutesToday > 11 * 60 + 30);
  const isTardePeriodDisabled = isSelectedDateToday && (nowMinutes >= 18 * 60 || minAllowedMinutesToday > 17 * 60 + 30);

  // Auto-selecionar o período ativo válido sempre que a data ou o horário mínimo mudar
  useEffect(() => {
    if (isSelectedDateToday) {
      if (isTardePeriodDisabled && (timePeriodFilter === 'manha' || timePeriodFilter === 'tarde')) {
        setTimePeriodFilter('noite');
      } else if (isManhaPeriodDisabled && timePeriodFilter === 'manha') {
        setTimePeriodFilter('tarde');
      }
    } else {
      if (timePeriodFilter === 'todos') return;
    }
  }, [isSelectedDateToday, isManhaPeriodDisabled, isTardePeriodDisabled, selectedDateIso]);

  // Gerar os slots de horário com validação no banco + regra de deslocamento + 15 min
  const generatedSlots = useMemo(() => {
    return getAvailableSlotsForDate(selectedDateIso, selectedProfessional, {
      travelMinutes: etaMinutes,
      prepMinutes: PREP_BUFFER_MINUTES,
      busySlots: busySlotsFromDb,
      nowOverride: currentTimeTick,
    });
  }, [selectedDateIso, selectedProfessional, etaMinutes, busySlotsFromDb, currentTimeTick]);

  // Agrupamento de slots por período (Manhã, Tarde, Noite)
  const slotsByPeriod = useMemo(() => {
    return {
      manha: generatedSlots.filter((s) => s.period === 'manha'),
      tarde: generatedSlots.filter((s) => s.period === 'tarde'),
      noite: generatedSlots.filter((s) => s.period === 'noite'),
    };
  }, [generatedSlots]);

  // Agrupar serviços por categoria
  const groupedServices = useMemo(() => {
    const groups: Record<string, CatalogServiceItem[]> = {};
    services.forEach((srv) => {
      const cat = srv.category?.trim() || 'Geral';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(srv);
    });
    return groups;
  }, [services]);

  if (!isOpen) return null;

  const [, selMonth, selDay] = selectedDateIso.split('-');
  const shortDateFormatted = `${selDay}/${selMonth}`;

  const activeProfObj = professionals.find((p) => p.name === selectedProfessional);
  const resolvedProfessionalName = activeProfObj?.name || (professionals[0]?.name ?? 'Equipe do Salão');
  const resolvedProfessionalAvatar = activeProfObj?.avatar || professionals[0]?.avatar;

  // Pré-Salvar Agendamento como Rascunho (Não trava a vaga no banco até a confirmação)
  const handleSaveAsDraft = () => {
    if (!selectedService || !selectedTimeSlot) return;
    hapticMedium();

    const draftItem: BookingDraftItem = {
      id: `draft-${Date.now()}`,
      salonId: salonId || localStorage.getItem('vagou_salon_db_id') || undefined,
      salonName,
      salonAddress,
      services: selectedServices.map((s) => ({
        id: s.id,
        title: s.title,
        price: s.price,
        duration: s.duration,
        category: s.category,
      })),
      combinedServiceTitle: selectedService.title,
      totalPrice: selectedService.price,
      professional: selectedProfessional === 'any' ? resolvedProfessionalName : selectedProfessional,
      professionalAvatar: resolvedProfessionalAvatar,
      dateIso: selectedDateIso,
      dateFormatted: shortDateFormatted,
      timeSlot: selectedTimeSlot,
      isDependentBooking,
      dependentId: isDependentBooking ? dependentId : undefined,
      dependentName: isDependentBooking ? dependentName.trim() : undefined,
      clientPhone: clientPhoneInput.trim() || undefined,
      clientAddressQuery: addressQuery.trim() || resolvedAddressLabel,
      distanceKm,
      etaMinutes,
      prepBufferMinutes: PREP_BUFFER_MINUTES,
      savedAt: new Date().toISOString(),
    };

    saveBookingDraft(draftItem);
    onDraftSaved?.(draftItem);
    setDraftSavedFeedback('Pré-agendamento salvo! Você pode retomá-lo no aviso da tela ou em Minha Agenda.');
    setTimeout(() => {
      setDraftSavedFeedback(null);
      setIsSummaryModalOpen(false);
    }, 1400);
  };

  // Confirmar Agendamento Final no Banco de Dados (com campos preditivos BOL-020)
  const handleConfirmFinal = async () => {
    setBookingErrorMessage('');
    if (!selectedService || !selectedTimeSlot) return;

    if (isDependentBooking && !dependentName.trim()) {
      setBookingErrorMessage('Selecione ou informe o dependente para concluir.');
      return;
    }

    const cleanPhone = clientPhoneInput.trim() || localStorage.getItem('vagou_user_phone') || '';
    if (!cleanPhone) {
      setBookingErrorMessage('Informe um telefone WhatsApp de contato.');
      return;
    }

    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        hapticMedium();
        setIsAuthModalOpen(true);
        return;
      }
    }

    setIsSubmittingBooking(true);
    try {
      const result = await onConfirmAppointment({
        service: selectedService,
        professional: selectedProfessional === 'any' ? `${resolvedProfessionalName} (Designado)` : selectedProfessional,
        professionalAvatar: resolvedProfessionalAvatar,
        dateIso: selectedDateIso,
        dateFormatted: shortDateFormatted,
        timeSlot: selectedTimeSlot,
        salonName,
        salonAddress,
        price: selectedService.price,
        offerId: baseOffer?.id,
        isDependentBooking,
        dependentId: isDependentBooking ? dependentId : undefined,
        dependentName: isDependentBooking ? dependentName.trim() : undefined,
        clientPhone: cleanPhone,
        notes: isDependentBooking ? `Dependente: ${dependentName.trim()}` : undefined,
        distanceKm,
        etaMinutes,
        prepBufferMinutes: PREP_BUFFER_MINUTES,
        transportMode: 'driving',
        selectedRouteSummary: `${resolvedAddressLabel} (${distanceKm.toFixed(1)} km • ~${etaMinutes} min + 15 min preparo)`,
      });

      if (result && !result.success && result.error) {
        setBookingErrorMessage(result.error);
        setIsSubmittingBooking(false);
        return;
      }

      // Limpar rascunho pré-salvo após confirmação oficial no banco
      saveBookingDraft(null);
      onDraftSaved?.(null);
      setIsSummaryModalOpen(false);
      hapticSuccess();
      onClose?.();
    } catch (err: any) {
      setBookingErrorMessage(err?.message || 'Falha ao realizar agendamento.');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Renderizador de grade de horários para um período específico
  const renderPeriodSlotsBlock = (
    periodKey: 'manha' | 'tarde' | 'noite',
    label: string,
    PeriodIcon: React.ElementType,
    slots: BookingSlotItem[],
    isPeriodBlocked: boolean
  ) => {
    const availableCount = slots.filter((s) => s.available).length;
    return (
      <div key={periodKey} className="space-y-1.5">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <PeriodIcon className={`w-3.5 h-3.5 ${isPeriodBlocked ? 'text-slate-500' : 'text-emerald-500'}`} />
            <span className={`text-[11px] font-bold uppercase tracking-wider font-['Poppins'] ${
              isPeriodBlocked
                ? isDark ? 'text-slate-600 line-through' : 'text-slate-400 line-through'
                : isDark ? 'text-slate-200' : 'text-slate-800'
            }`}>
              {label}
            </span>
          </div>
          <span className={`text-[10px] font-semibold ${
            availableCount > 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {isPeriodBlocked ? 'Período encerrado hoje' : `${availableCount} livres`}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {slots.map((slot) => {
            const isSelected = selectedTimeSlot === slot.time;
            const isAvailable = slot.available && !isPeriodBlocked;

            return (
              <button
                key={slot.time}
                type="button"
                disabled={!isAvailable}
                onClick={() => {
                  hapticLight();
                  setSelectedTimeSlot(slot.time);
                  setIsSummaryModalOpen(true);
                }}
                title={
                  !isAvailable
                    ? slot.reason === 'busy'
                      ? 'Horário já ocupado no banco'
                      : slot.reason === 'travel_buffer'
                      ? `Insuficiente para deslocamento (${etaMinutes}m + 15m preparo)`
                      : 'Horário já passou'
                    : `Agendar às ${slot.time}`
                }
                className={`py-2 px-1 rounded-[4px] text-xs font-bold border transition flex items-center justify-center gap-1 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500 border-emerald-500 text-white font-black shadow-sm'
                    : !isAvailable
                    ? isDark
                      ? 'bg-slate-900/30 border-slate-900 text-slate-600 line-through opacity-40 cursor-not-allowed'
                      : 'bg-slate-100/60 border-slate-200 text-slate-300 line-through opacity-45 cursor-not-allowed'
                    : isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-emerald-500 hover:text-white'
                    : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500 hover:text-emerald-700'
                }`}
              >
                <Clock className={`w-3 h-3 ${
                  isSelected
                    ? 'text-white'
                    : isAvailable
                    ? 'text-emerald-500'
                    : isDark
                    ? 'text-slate-600'
                    : 'text-slate-300'
                }`} />
                <span className={isSelected ? 'text-white' : ''}>{slot.time}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const bookingContent = (
    <div
      className={`w-full flex flex-col overflow-hidden transition-colors ${
        inline ? 'h-full border-0 rounded-none' : 'max-w-lg border rounded-[4px] max-h-[92vh] shadow-2xl'
      } ${
        isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'
      }`}
      role={inline ? undefined : 'dialog'}
      aria-modal={inline ? undefined : 'true'}
    >
      {/* Header Limpo & Stepper Inteligente com Seleções Reais */}
      <div className={`px-3 py-2 border-b sticky top-0 z-10 transition-colors space-y-2 ${
        isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-100/95 border-slate-200'
      }`}>
        {/* Linha 1: Sub-Cabeçalho de Título com Botão Voltar + Beneficiário/Mais Serviços */}
        <div className="flex items-center justify-between gap-2 min-h-7">
          <div className="flex items-center gap-2 min-w-0">
            {currentStep !== 'service' && (
              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  if (currentStep === 'date') {
                    setIsAddingExtraServices(true);
                    setCurrentStep('service');
                  } else if (currentStep === 'professionals_and_time') {
                    setCurrentStep('date');
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-bold transition cursor-pointer shrink-0 ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800 hover:text-slate-950'
                }`}
                title="Voltar etapa"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Voltar</span>
              </button>
            )}

            {!inline && onClose && currentStep === 'service' && (
              <button
                type="button"
                onClick={onClose}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-bold transition cursor-pointer shrink-0 ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800 hover:text-slate-950'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Voltar</span>
              </button>
            )}

            {/* Sub-Cabeçalho de Título da Seção */}
            <div className="flex items-center gap-1.5 min-w-0">
              <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <h2 className={`text-xs sm:text-sm font-bold font-['Poppins'] truncate ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                {currentStep === 'service'
                  ? 'Agendar Horário • Serviços'
                  : currentStep === 'date'
                  ? 'Agendar Horário • Data'
                  : 'Agendar Horário • Horários'}
              </h2>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5 ml-auto">
            {selectedService && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setIsBeneficiaryModalOpen(true);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-bold text-xs transition cursor-pointer shrink-0 whitespace-nowrap ${
                  isDependentBooking
                    ? 'bg-emerald-500 text-white'
                    : isDark
                    ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                    : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                }`}
                title="Alterar para quem é o agendamento"
              >
                {isDependentBooking ? (
                  <Users className="w-3.5 h-3.5 text-white shrink-0" />
                ) : (
                  <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                )}
                <span className={isDependentBooking ? 'text-white' : ''}>
                  {isDependentBooking && dependentName ? dependentName : 'Para Você'}
                </span>
              </button>
            )}

            {selectedService && currentStep !== 'service' && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setIsAddingExtraServices(true);
                  setCurrentStep('service');
                }}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap"
                title="Adicionar mais serviços"
              >
                <Plus className="w-3.5 h-3.5 text-white shrink-0" />
                <span className="text-white">Mais</span>
              </button>
            )}

            {!inline && onClose && (
              <button
                type="button"
                onClick={onClose}
                className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition cursor-pointer shrink-0 ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-950'
                }`}
                aria-label="Fechar modal"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Linha 2 (div selecionada): Abas Dinâmicas Exibindo o Valor Selecionado (Serviço Abreviado | Data | Horário) */}
        <div className="grid grid-cols-3 gap-1.5">
          {(() => {
            // 1. Nome abreviado do serviço (ex: "Tratamento capilar fio a fio" -> "Tratamento capilar")
            const getAbbreviatedServiceLabel = (): string => {
              if (!selectedServices.length) return 'Serviço';
              const rawTitle = selectedServices[0].title.trim();
              const words = rawTitle.split(/\s+/);
              const connectors = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'no', 'na', 'com']);
              let shortTitle = rawTitle;
              if (words.length > 2) {
                const secondWord = words[1].toLowerCase();
                shortTitle = connectors.has(secondWord)
                  ? words.slice(0, 3).join(' ')
                  : words.slice(0, 2).join(' ');
              }
              return selectedServices.length > 1
                ? `${shortTitle} +${selectedServices.length - 1}`
                : shortTitle;
            };

            // 2. Data: se o cliente ainda não chegou na seção de data, mostra "Data"; senão, mostra a data selecionada
            const dateStepLabel =
              currentStep !== 'service' && selectedDateIso ? shortDateFormatted : 'Data';

            // 3. Horário: se não houver horário selecionado, mostra "Horário"; quando selecionado, mostra o horário
            const timeStepLabel = selectedTimeSlot ? selectedTimeSlot : 'Horário';

            const dynamicSteps: Array<{
              key: Step;
              label: string;
              hasValue: boolean;
              Icon: React.ElementType;
            }> = [
              {
                key: 'service',
                label: getAbbreviatedServiceLabel(),
                hasValue: selectedServices.length > 0,
                Icon: Scissors,
              },
              {
                key: 'date',
                label: dateStepLabel,
                hasValue: currentStep !== 'service' && Boolean(selectedDateIso),
                Icon: Calendar,
              },
              {
                key: 'professionals_and_time',
                label: timeStepLabel,
                hasValue: Boolean(selectedTimeSlot),
                Icon: Clock,
              },
            ];

            const stepOrder: Record<Step, number> = {
              service: 1,
              date: 2,
              professionals_and_time: 3,
            };
            const currentOrder = stepOrder[currentStep];

            return dynamicSteps.map((st, idx) => {
              const thisOrder = idx + 1;
              const isPassed = thisOrder < currentOrder;
              const isCurrent = thisOrder === currentOrder;
              const StepIcon = st.Icon;

              return (
                <button
                  key={st.key}
                  type="button"
                  disabled={!isPassed}
                  onClick={() => {
                    if (isPassed) {
                      hapticLight();
                      if (st.key === 'service') setIsAddingExtraServices(true);
                      setCurrentStep(st.key);
                    }
                  }}
                  title={st.label}
                  className={`flex flex-col gap-1 min-w-0 ${
                    isPassed ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div
                    className={`flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-[4px] min-w-0 w-full transition-colors ${
                      isCurrent
                        ? isDark
                          ? 'text-emerald-400'
                          : 'text-emerald-700'
                        : isPassed || st.hasValue
                        ? isDark
                          ? 'text-slate-100'
                          : 'text-slate-800'
                        : isDark
                        ? 'text-slate-500'
                        : 'text-slate-400'
                    }`}
                  >
                    <StepIcon
                      className={`w-3 h-3 shrink-0 ${
                        isCurrent || isPassed || st.hasValue
                          ? 'text-emerald-500'
                          : isDark
                          ? 'text-slate-600'
                          : 'text-slate-400'
                      }`}
                    />
                    <span className="text-[11px] sm:text-xs font-extrabold truncate">
                      {st.label}
                    </span>
                  </div>
                  <div
                    className={`h-1.5 w-full rounded-[4px] transition-all duration-300 ${
                      isCurrent
                        ? 'bg-emerald-500'
                        : isPassed
                        ? 'bg-emerald-600'
                        : isDark
                        ? 'bg-slate-800'
                        : 'bg-slate-200'
                    }`}
                  />
                </button>
              );
            });
          })()}
        </div>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 no-scrollbar">
        {/* ============================================================ */}
        {/* ETAPA 1: SELEÇÃO DE SERVIÇO (OU ADICIONAR MAIS SERVIÇOS) */}
        {/* ============================================================ */}
        {currentStep === 'service' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {services.length === 0 ? (
              <div className={`p-8 rounded-[4px] border text-center my-4 ${
                isDark ? 'bg-slate-900/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                <Scissors className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Não há serviço cadastrado neste estabelecimento
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {(Object.entries(groupedServices) as [string, CatalogServiceItem[]][]).map(([categoryName, catServices]) => (
                  <div key={categoryName} className="space-y-1.5">
                    <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <h3 className={`text-[11px] font-black uppercase tracking-wider font-['Poppins'] ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        {categoryName}
                      </h3>
                      <span className={`text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        ({catServices.length})
                      </span>
                    </div>

                    <div className="space-y-2">
                      {catServices.map((srv) => {
                        const isSelected = selectedServices.some((s) => s.id === srv.id);
                        const isVideoMode = (srv.displayMode === 'video' || srv.mediaType === 'video') && !!srv.videoUrl;
                        const isSlideshowMode = srv.displayMode === 'slideshow' && !!(srv.photos && srv.photos.length > 1);
                        return (
                          <button
                            key={srv.id}
                            type="button"
                            onClick={() => {
                              if (isAddingExtraServices) {
                                toggleServiceSelection(srv);
                              } else {
                                hapticMedium();
                                setSelectedServices([srv]);
                                setCurrentStep('date');
                                if (!hasChosenBeneficiary) {
                                  setIsBeneficiaryModalOpen(true);
                                }
                              }
                            }}
                            className={`w-full p-2.5 rounded-[4px] transition-all flex items-center justify-between gap-3 text-left cursor-pointer border ${
                              isSelected
                                ? isDark
                                  ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                                  : 'bg-emerald-50/80 border-emerald-500/50 text-slate-900'
                                : isDark
                                ? 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 text-slate-200'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className={`w-5 h-5 rounded-[4px] flex items-center justify-center shrink-0 transition-all border ${
                                isSelected
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : isDark
                                  ? 'border-slate-700 bg-slate-950'
                                  : 'border-slate-300 bg-white'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-white" />}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <h4 className={`text-xs font-bold leading-snug truncate ${
                                    isSelected
                                      ? isDark ? 'text-emerald-400' : 'text-emerald-800'
                                      : isDark ? 'text-white' : 'text-slate-900'
                                  }`}>
                                    {srv.title}
                                  </h4>
                                  {isVideoMode && (
                                    <span className="shrink-0 px-1 py-0.2 rounded-[4px] bg-emerald-500 text-white text-[8px] font-black uppercase flex items-center gap-0.5">
                                      <Video className="w-2.5 h-2.5 text-white" />
                                      <span className="text-white">5s</span>
                                    </span>
                                  )}
                                  {isSlideshowMode && (
                                    <span className="shrink-0 px-1 py-0.2 rounded-[4px] bg-emerald-500 text-white text-[8px] font-black uppercase flex items-center gap-0.5">
                                      <Images className="w-2.5 h-2.5 text-white" />
                                      <span className="text-white">Slide</span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 mt-1 text-[10px]">
                                  <span className={`inline-flex items-center gap-1 font-medium ${
                                    isDark ? 'text-slate-400' : 'text-slate-500'
                                  }`}>
                                    <Clock className="w-3 h-3 text-emerald-400" />
                                    <span>{srv.duration}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <span className={`text-sm font-extrabold ${
                                isSelected
                                  ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                                  : isDark ? 'text-slate-100' : 'text-slate-900'
                              }`}>
                                R$ {srv.price.toFixed(0)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* ETAPA 2: CALENDÁRIO MENSAL DE DATAS */}
        {/* ============================================================ */}
        {currentStep === 'date' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className={`space-y-3 transition-all ${
              !selectedService ? 'pointer-events-none opacity-40 select-none' : ''
            }`}>
              <div className="flex items-center justify-between px-1 py-1">
                <button
                  type="button"
                  disabled={!selectedService}
                  onClick={handlePrevMonth}
                  className={`p-2 rounded-[4px] transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="text-center">
                  <h3 className={`text-sm font-black uppercase tracking-wider font-['Poppins'] ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    {monthData.monthLabel}
                  </h3>
                </div>

                <button
                  type="button"
                  disabled={!selectedService}
                  onClick={handleNextMonth}
                  className={`p-2 rounded-[4px] transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                  <div key={day} className={`text-[10px] font-bold py-1 uppercase ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {day}
                  </div>
                ))}

                {monthData.daysGrid.map((item, index) => {
                  if (item.dayNumber === null) {
                    return <div key={`empty-${index}`} className="h-10" />;
                  }

                  const isSelected = selectedService && selectedDateIso === item.isoString;
                  const isDayDisabled = !selectedService || item.isDisabled;

                  return (
                    <button
                      key={item.isoString || index}
                      type="button"
                      disabled={isDayDisabled}
                      onClick={() => {
                        if (item.isoString && selectedService) {
                          hapticLight();
                          setSelectedDateIso(item.isoString);
                          setSelectedTimeSlot(null);
                        }
                      }}
                      className={`h-11 rounded-[4px] font-bold text-xs transition-all relative flex flex-col items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500 text-white font-black shadow-md z-10'
                          : isDayDisabled
                          ? isDark
                            ? 'bg-slate-950/40 text-slate-700 cursor-not-allowed border border-slate-900/50 opacity-40'
                            : 'bg-slate-100/50 text-slate-300 cursor-not-allowed border border-slate-200/40 opacity-40'
                          : isDark
                          ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-emerald-500/40'
                          : 'bg-slate-50 hover:bg-emerald-50/50 text-slate-800 border border-slate-200 hover:border-emerald-500/40'
                      }`}
                    >
                      <span className={isSelected ? 'text-white' : ''}>{item.dayNumber}</span>
                      {item.isToday && !isSelected && (
                        <span className={`text-[8px] font-black uppercase ${
                          isDark ? 'text-emerald-400' : 'text-emerald-700'
                        }`}>Hoje</span>
                      )}
                      {item.isClosed && (
                        <span className="text-[8px] text-rose-500 font-bold">Fechado</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ETAPA 3: PROFISSIONAIS + COMPARADOR DE ENDEREÇO + HORÁRIOS */}
        {/* ============================================================ */}
        {currentStep === 'professionals_and_time' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            {/* BLOCO 1: SELEÇÃO DE PROFISSIONAIS */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setSelectedProfessional('any');
                    setSelectedTimeSlot(null);
                  }}
                  className={`min-w-[105px] flex-shrink-0 p-1.5 px-2 rounded-[4px] border text-left flex items-center gap-2 transition cursor-pointer ${
                    selectedProfessional === 'any'
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                      : isDark
                      ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-[4px] flex items-center justify-center flex-shrink-0 ${
                    selectedProfessional === 'any'
                      ? 'bg-white/20 text-white'
                      : isDark
                      ? 'bg-emerald-600/30 text-emerald-400'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    <Sparkles className={`w-3.5 h-3.5 ${selectedProfessional === 'any' ? 'text-white' : ''}`} />
                  </div>
                  <span className={`text-[11px] font-bold truncate ${selectedProfessional === 'any' ? 'text-white' : ''}`}>
                    Qualquer
                  </span>
                </button>

                {professionals.map((prof, idx) => {
                  const isSelected = selectedProfessional === prof.name;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setSelectedProfessional(prof.name);
                        setSelectedTimeSlot(null);
                      }}
                      className={`min-w-[115px] max-w-[135px] flex-shrink-0 p-1.5 px-2 rounded-[4px] border text-left flex items-center gap-2 transition cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                          : isDark
                          ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {prof.avatar && !prof.avatar.includes('unsplash.com') && !prof.avatar.startsWith('data:image/svg+xml') ? (
                        <img
                          src={prof.avatar}
                          alt={prof.name}
                          className="w-6 h-6 rounded-[4px] object-cover flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`w-6 h-6 rounded-[4px] flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                        }`}>
                          <User className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : ''}`} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h5 className={`text-[11px] font-bold truncate leading-tight ${
                          isSelected ? 'text-white' : isDark ? 'text-slate-200' : 'text-slate-800'
                        }`}>
                          {prof.name}
                        </h5>
                        {prof.rating && (
                          <div className={`flex items-center gap-0.5 text-[9px] leading-tight ${
                            isSelected ? 'text-white/90' : 'text-amber-400'
                          }`}>
                            <Star className="w-2.5 h-2.5 fill-current" />
                            <span>{prof.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BLOCO 2: COMPARADOR DE ENDEREÇO EM TEMPO REAL (Deslocamento Real OSRM + 15 min Preparo) */}
            <div className={`pt-1.5 border-t space-y-1.5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Navigation className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className={`text-[11px] font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Comparador de Distância & Tempo (+15m preparo)
                  </span>
                </div>
                {isSelectedDateToday && (
                  <span className="px-2 py-0.5 rounded-[4px] bg-emerald-500 text-white text-[10px] font-extrabold whitespace-nowrap">
                    Liberado após {minAllowedTimeFormatted}
                  </span>
                )}
              </div>

              <form onSubmit={handleSimulateAddress} className="grid grid-cols-12 gap-1.5 items-center">
                <div className="relative col-span-5 sm:col-span-5">
                  <MapPin className="w-3 h-3 text-emerald-500 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={addressQuery}
                    onChange={(e) => setAddressQuery(e.target.value)}
                    placeholder="Seu CEP/Endereço"
                    title="Origem (Seu CEP ou Endereço)"
                    className={`w-full pl-6 pr-1.5 py-1 text-[11px] rounded-[4px] border outline-hidden transition-colors ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
                    }`}
                  />
                </div>
                <div className="relative col-span-4 sm:col-span-4">
                  <input
                    type="text"
                    value={salonDestQuery}
                    onChange={(e) => setSalonDestQuery(e.target.value)}
                    placeholder="CEP Salão"
                    title={`Destino (${salonName}): ${resolvedSalonLabel}`}
                    className={`w-full px-2 py-1 text-[11px] rounded-[4px] border outline-hidden transition-colors ${
                      isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300 focus:border-emerald-500'
                        : 'bg-slate-50 border-slate-300 text-slate-700 focus:border-emerald-600'
                    }`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCalculatingRoute || !addressQuery.trim()}
                  className="col-span-3 sm:col-span-3 py-1 px-2 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap"
                >
                  {isCalculatingRoute ? (
                    <Loader2 className="w-3 h-3 animate-spin text-white" />
                  ) : (
                    <Search className="w-3 h-3 text-white" />
                  )}
                  <span className="text-white">Calcular</span>
                </button>
              </form>

              {/* Resumo Ao Vivo da Equação de Deslocamento + Atalhos Rápidos de Teste */}
              <div className="flex items-center justify-between gap-1.5 flex-wrap text-[10px]">
                <div className={`flex items-center gap-1.5 font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  <Car className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>
                    <strong className="text-emerald-400">{distanceKm.toFixed(1)} km</strong> • <strong>{etaMinutes} min</strong> carro + <strong>15 min</strong> saída ={' '}
                    <strong className="text-emerald-400">{totalLeadMinutes} min total</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {[
                    { label: '17m (+15m=32m)', eta: 17, km: 6.6 },
                    { label: '30m (+15m=45m)', eta: 30, km: 11.5 },
                    { label: '45m (+15m=1h)', eta: 45, km: 18.0 },
                  ].map((preset) => {
                    const activePreset = etaMinutes === preset.eta;
                    return (
                      <button
                        key={preset.eta}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setEtaMinutes(preset.eta);
                          setDistanceKm(preset.km);
                          setResolvedAddressLabel(`Simulação (${preset.km} km)`);
                          setSelectedTimeSlot(null);
                        }}
                        className={`px-1.5 py-0.5 rounded-[4px] font-bold transition cursor-pointer whitespace-nowrap ${
                          activePreset
                            ? 'bg-emerald-500 text-white'
                            : isDark
                            ? 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                      >
                        <span className={activePreset ? 'text-white' : ''}>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* BLOCO 3: TABELA DE HORÁRIOS CLASSIFICADA POR PERÍODO (Manhã -> Tarde -> Noite -> Todos) */}
            <div className={`pt-2 border-t space-y-2.5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-1.5 flex-wrap">
                <h4 className={`text-[11px] font-bold font-['Poppins'] flex items-center gap-1 uppercase tracking-wider ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Horários ({shortDateFormatted})</span>
                  {isLoadingBusySlots && <Loader2 className="w-3 h-3 animate-spin text-emerald-500 ml-1" />}
                </h4>

                {/* Filtro de Turnos na Ordem Obrigatória: Manhã, Tarde, Noite, Todos */}
                <div className={`flex items-center gap-0.5 p-0.5 rounded-[4px] border ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}>
                  {(
                    [
                      { key: 'manha', label: 'Manhã', disabled: isManhaPeriodDisabled },
                      { key: 'tarde', label: 'Tarde', disabled: isTardePeriodDisabled },
                      { key: 'noite', label: 'Noite', disabled: false },
                      { key: 'todos', label: 'Todos', disabled: false },
                    ] as const
                  ).map((tab) => {
                    const isActive = timePeriodFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        disabled={tab.disabled}
                        onClick={() => {
                          if (!tab.disabled) {
                            hapticLight();
                            setTimePeriodFilter(tab.key);
                          }
                        }}
                        className={`px-2 py-1 rounded-[4px] text-[10px] font-bold transition whitespace-nowrap ${
                          tab.disabled
                            ? isDark
                              ? 'text-slate-700 line-through cursor-not-allowed opacity-50'
                              : 'text-slate-300 line-through cursor-not-allowed opacity-50'
                            : isActive
                            ? 'bg-emerald-500 text-white font-extrabold cursor-pointer'
                            : isDark
                            ? 'text-slate-400 hover:text-white cursor-pointer'
                            : 'text-slate-600 hover:text-slate-900 cursor-pointer'
                        }`}
                      >
                        <span className={isActive && !tab.disabled ? 'text-white' : ''}>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Renderização Classificada por Período (Manhã, Tarde, Noite) */}
              <div className="space-y-3">
                {(timePeriodFilter === 'manha' || timePeriodFilter === 'todos') &&
                  renderPeriodSlotsBlock('manha', 'Manhã (08h às 11h30)', Sun, slotsByPeriod.manha, isManhaPeriodDisabled)}

                {(timePeriodFilter === 'tarde' || timePeriodFilter === 'todos') &&
                  renderPeriodSlotsBlock('tarde', 'Tarde (12h às 17h30)', Sunset, slotsByPeriod.tarde, isTardePeriodDisabled)}

                {(timePeriodFilter === 'noite' || timePeriodFilter === 'todos') &&
                  renderPeriodSlotsBlock('noite', 'Noite (18h às 20h30)', Moon, slotsByPeriod.noite, false)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* RODAPÉ FIXO DE AÇÃO (sticky bottom-0 z-20) */}
      {/* ============================================================ */}
      {(currentStep !== 'professionals_and_time' || Boolean(selectedTimeSlot)) && (
        <div className={`px-3.5 py-2 border-t shrink-0 sticky bottom-0 z-20 transition-colors ${
          isDark ? 'bg-[#151A1E]/95 border-slate-800 backdrop-blur-md' : 'bg-white/95 border-slate-200 backdrop-blur-md'
        }`}>
          {currentStep === 'service' && (
            <button
              id="btn-avancar-data"
              type="button"
              disabled={selectedServices.length === 0}
              onClick={() => {
                if (selectedServices.length > 0) {
                  hapticMedium();
                  setIsAddingExtraServices(false);
                  setCurrentStep('date');
                  if (!hasChosenBeneficiary) {
                    setIsBeneficiaryModalOpen(true);
                  }
                }
              }}
              className={`w-full py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-[4px] transition flex items-center justify-center gap-1.5 ${
                selectedServices.length > 0
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer active:scale-98'
                  : isDark
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              <span className={selectedServices.length > 0 ? 'text-white' : ''}>
                {selectedServices.length > 1
                  ? `Concluir Serviços (${selectedServices.length} itens • R$ ${selectedServices.reduce((acc, s) => acc + s.price, 0)})`
                  : selectedServices.length === 1
                  ? `Avançar para Data (${selectedServices[0].title} • R$ ${selectedServices[0].price})`
                  : 'Selecione ao menos 1 serviço'}
              </span>
              <ChevronRight className={`w-3.5 h-3.5 ${selectedServices.length > 0 ? 'text-white' : ''}`} />
            </button>
          )}

          {currentStep === 'date' && (
            <button
              id="btn-avancar-horarios"
              type="button"
              disabled={!selectedService || !selectedDateIso}
              onClick={() => {
                if (selectedService && selectedDateIso) {
                  hapticMedium();
                  setCurrentStep('professionals_and_time');
                }
              }}
              className={`w-full py-2.5 px-4 font-black text-xs uppercase tracking-wider rounded-[4px] transition flex items-center justify-center gap-1.5 font-['Poppins'] ${
                selectedService && selectedDateIso
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer active:scale-98'
                  : isDark
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              <span className={selectedService && selectedDateIso ? 'text-white' : ''}>
                Escolher Horário ({shortDateFormatted})
              </span>
              <ChevronRight className={`w-3.5 h-3.5 ${selectedService && selectedDateIso ? 'text-white' : ''}`} />
            </button>
          )}

          {currentStep === 'professionals_and_time' && selectedTimeSlot && (
            <button
              id="btn-avancar-confirmacao"
              type="button"
              onClick={() => {
                hapticMedium();
                setIsSummaryModalOpen(true);
              }}
              className="w-full py-2 px-4 font-black text-xs uppercase tracking-wider rounded-[4px] transition flex items-center justify-center gap-1.5 font-['Poppins'] bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer active:scale-98"
            >
              <span className="text-white">
                Revisar & Confirmar ({selectedTimeSlot})
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // MODAL COMPACTO 1: "PARA VOCÊ OU DEPENDENTE?" (Logo após escolha do serviço)
  // ============================================================================
  const beneficiaryModalNode = isBeneficiaryModalOpen && selectedService && (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md border rounded-[4px] p-4 shadow-2xl space-y-3.5 transition-colors ${
          isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold font-['Poppins']">Para quem é o agendamento?</h3>
            <p className="text-[11px] text-emerald-400 font-semibold truncate flex items-center gap-1 mt-0.5">
              <Scissors className="w-3 h-3 text-emerald-500 shrink-0" />
              <span className="truncate">{selectedService.title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setHasChosenBeneficiary(true);
              setIsBeneficiaryModalOpen(false);
            }}
            className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition cursor-pointer ${
              isDark ? 'bg-slate-900 text-slate-400 hover:text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Botões Principais: Para Você vs Para Dependente */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              setIsDependentBooking(false);
              setDependentId('');
              setDependentName('');
              setHasChosenBeneficiary(true);
              setIsBeneficiaryModalOpen(false);
              setCurrentStep('date');
            }}
            className={`p-3 rounded-[4px] border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
              !isDependentBooking
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : isDark
                ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-emerald-500/50'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-emerald-500/50'
            }`}
          >
            <User className={`w-5 h-5 ${!isDependentBooking ? 'text-white' : 'text-emerald-500'}`} />
            <span className={!isDependentBooking ? 'text-white' : ''}>Para Você</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setIsDependentBooking(true);
            }}
            className={`p-3 rounded-[4px] border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
              isDependentBooking
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : isDark
                ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-emerald-500/50'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-emerald-500/50'
            }`}
          >
            <Users className={`w-5 h-5 ${isDependentBooking ? 'text-white' : 'text-emerald-500'}`} />
            <span className={isDependentBooking ? 'text-white' : ''}>Para Dependente</span>
          </button>
        </div>

        {/* Lista de Dependentes do Banco + Botão "+ Cadastrar Dependente" */}
        {isDependentBooking && (
          <div className="space-y-2.5 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
            {registeredDependents.length > 0 && !isCreatingDependentInline && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Selecione o Dependente:
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                  {registeredDependents.map((dep) => {
                    const isSelectedDep = dependentName === dep.full_name;
                    const relLabel =
                      dep.relationship === 'son'
                        ? 'Filho(a)'
                        : dep.relationship === 'daughter'
                        ? 'Filha'
                        : dep.relationship === 'spouse'
                        ? 'Cônjuge'
                        : dep.relationship === 'parent'
                        ? 'Pai / Mãe'
                        : 'Familiar';
                    return (
                      <button
                        key={dep.id}
                        type="button"
                        onClick={() => {
                          hapticMedium();
                          setDependentId(dep.id);
                          setDependentName(dep.full_name);
                          setHasChosenBeneficiary(true);
                          setIsBeneficiaryModalOpen(false);
                          setCurrentStep('date');
                        }}
                        className={`w-full p-2.5 rounded-[4px] border text-left flex items-center justify-between transition cursor-pointer ${
                          isSelectedDep
                            ? 'bg-emerald-500 border-emerald-500 text-white font-bold'
                            : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-emerald-500/50'
                            : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-emerald-500/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <User className={`w-4 h-4 shrink-0 ${isSelectedDep ? 'text-white' : 'text-emerald-500'}`} />
                          <span className={`text-xs font-bold truncate ${isSelectedDep ? 'text-white' : ''}`}>
                            {dep.full_name}
                          </span>
                        </div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] ${
                          isSelectedDep
                            ? 'bg-white/20 text-white'
                            : isDark
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {relLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Botão ou Formulário Inline "+ Cadastrar Dependente" */}
            {!isCreatingDependentInline ? (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setIsCreatingDependentInline(true);
                }}
                className="w-full py-2 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span className="text-white">Cadastrar Dependente</span>
              </button>
            ) : (
              <form onSubmit={handleSaveInlineDependent} className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400">Novo Dependente (Conta Família)</span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingDependentInline(false)}
                    className="text-[10px] font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>

                <input
                  type="text"
                  required
                  value={newDepFullName}
                  onChange={(e) => setNewDepFullName(e.target.value)}
                  placeholder="Nome completo do dependente"
                  className={`w-full px-3 py-2 text-xs rounded-[4px] border outline-hidden ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newDepRelationship}
                    onChange={(e) => setNewDepRelationship(e.target.value as any)}
                    className={`w-full px-2.5 py-2 text-xs rounded-[4px] border outline-hidden ${
                      isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    <option value="son">Filho(a)</option>
                    <option value="spouse">Cônjuge</option>
                    <option value="parent">Pai / Mãe</option>
                    <option value="other">Familiar</option>
                  </select>

                  <input
                    type="date"
                    value={newDepBirthDate}
                    onChange={(e) => setNewDepBirthDate(e.target.value)}
                    className={`w-full px-2.5 py-2 text-xs rounded-[4px] border outline-hidden ${
                      isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <input
                  type="text"
                  value={newDepNotes}
                  onChange={(e) => setNewDepNotes(e.target.value)}
                  placeholder="Observações (opcional)"
                  className={`w-full px-3 py-2 text-xs rounded-[4px] border outline-hidden ${
                    isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />

                <button
                  type="submit"
                  disabled={isSavingInlineDependent || !newDepFullName.trim()}
                  className="w-full py-2.5 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Check className="w-4 h-4 text-white" />
                  <span className="text-white">
                    {isSavingInlineDependent ? 'Salvando...' : 'Salvar e Avançar para Data'}
                  </span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // MODAL INDEPENDENTE 2: RESUMO DO AGENDAMENTO + PRÉ-SALVAR / CONFIRMAR
  // ============================================================================
  const summaryModalNode = isSummaryModalOpen && selectedService && selectedTimeSlot && (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={`w-full max-w-md border rounded-[4px] overflow-hidden shadow-2xl flex flex-col max-h-[92vh] transition-colors ${
          isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Cabeçalho do Modal Independente de Resumo */}
        <div className={`px-4 py-3 border-b flex items-center justify-between ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <h3 className="text-sm font-extrabold font-['Poppins']">Resumo do Agendamento</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsSummaryModalOpen(false)}
            className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition cursor-pointer ${
              isDark ? 'bg-slate-800 text-slate-300 hover:text-white' : 'bg-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Resumo */}
        <div className="p-4 space-y-3 overflow-y-auto no-scrollbar text-xs">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Scissors className="w-3.5 h-3.5 text-emerald-500" /> Serviço:
              </span>
              <span className="font-bold text-right">{selectedService.title}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                {isDependentBooking ? (
                  <Users className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                )}
                Beneficiário:
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsSummaryModalOpen(false);
                  setIsBeneficiaryModalOpen(true);
                }}
                className="font-bold text-emerald-400 hover:underline cursor-pointer"
              >
                {isDependentBooking && dependentName ? `${dependentName} (Dependente)` : 'Para Você (Titular)'}
              </button>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-emerald-500" /> Estabelecimento:
              </span>
              <span className="font-bold text-right">{salonName}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <User className="w-3.5 h-3.5 text-emerald-500" /> Profissional:
              </span>
              <span className="font-bold text-right">
                {selectedProfessional === 'any' ? resolvedProfessionalName : selectedProfessional}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Data e Horário:
              </span>
              <span className="font-extrabold text-emerald-400">
                {shortDateFormatted} às {selectedTimeSlot}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Car className="w-3.5 h-3.5 text-emerald-500" /> Deslocamento + Preparo:
              </span>
              <span className="font-semibold text-right">
                {distanceKm.toFixed(1)} km • {etaMinutes}m + 15m = {totalLeadMinutes}m
              </span>
            </div>

            <div className={`flex justify-between items-center pt-2.5 border-t ${
              isDark ? 'border-slate-800' : 'border-slate-200'
            }`}>
              <span className="font-bold text-slate-400">Total a pagar no local:</span>
              <span className="font-black text-base text-emerald-400">
                R$ {selectedService.price.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          {/* Telefone de Contato */}
          <div className={`space-y-1.5 pt-2.5 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-500" />
              <span>WhatsApp de Contato</span>
            </label>
            <input
              type="tel"
              value={clientPhoneInput}
              onChange={(e) => setClientPhoneInput(e.target.value)}
              placeholder="(00) 00000-0000"
              className={`w-full px-3 py-2 text-xs rounded-[4px] border outline-hidden ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-white focus:border-emerald-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-600'
              }`}
            />
          </div>

          {/* Aviso de Erro */}
          {bookingErrorMessage && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-[4px] text-rose-400 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{bookingErrorMessage}</span>
            </div>
          )}

          {/* Feedback de Pré-Salvamento */}
          {draftSavedFeedback && (
            <div className="p-2.5 bg-emerald-500 text-white rounded-[4px] text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-white shrink-0" />
              <span className="text-white">{draftSavedFeedback}</span>
            </div>
          )}
        </div>

        {/* Rodapé Fixo do Modal de Resumo: Confirmar, Pausar/Pré-Salvar, Revisar ou Cancelar */}
        <div className={`p-3.5 border-t sticky bottom-0 z-20 space-y-2 ${
          isDark ? 'bg-[#151A1E] border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            id="btn-confirmar-agendamento-final"
            type="button"
            disabled={isSubmittingBooking}
            onClick={handleConfirmFinal}
            className={`w-full py-2.5 px-4 font-black text-xs uppercase tracking-wider rounded-[4px] transition flex items-center justify-center gap-2 font-['Poppins'] ${
              isSubmittingBooking
                ? 'bg-slate-700 text-slate-400 cursor-wait'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer active:scale-98'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            <span className="text-white">{isSubmittingBooking ? 'Confirmando...' : 'Confirmar Agendamento'}</span>
          </button>

          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={handleSaveAsDraft}
              className={`py-2 px-2 rounded-[4px] border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 border-amber-500/40 text-amber-400'
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800'
              }`}
              title="Salva o rascunho para concluir depois (não trava a vaga)"
            >
              <Bookmark className="w-3.5 h-3.5 shrink-0" />
              <span>Pré-Salvar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                setIsSummaryModalOpen(false);
              }}
              className={`py-2 px-2 rounded-[4px] border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                isDark
                  ? 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Revisar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                setIsSummaryModalOpen(false);
                setSelectedTimeSlot(null);
              }}
              className={`py-2 px-2 rounded-[4px] border text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                isDark
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                  : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
              }`}
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              <span>Cancelar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) {
    return (
      <>
        {bookingContent}
        {beneficiaryModalNode}
        {summaryModalNode}
        <SalonClientAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          salonName={salonName}
          salonLogo={salonLogo}
          primaryColor={primaryColor}
          onAuthenticated={() => {
            setIsAuthModalOpen(false);
            handleConfirmFinal();
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        {bookingContent}
      </div>
      {beneficiaryModalNode}
      {summaryModalNode}
      <SalonClientAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        salonName={salonName}
        salonLogo={salonLogo}
        primaryColor={primaryColor}
        onAuthenticated={() => {
          setIsAuthModalOpen(false);
          handleConfirmFinal();
        }}
      />
    </>
  );
};


