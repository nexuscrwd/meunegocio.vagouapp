/**
 * Hook de Fluxo de Agendamento — VagouApp Meu Negócio
 * 
 * Orquestra todo o estado e ações do fluxo de agendamento:
 * - Seleção de serviços (múltiplos)
 * - Seleção de data (calendário mensal)
 * - Seleção de profissional + horários
 * - Beneficiário (titular vs dependente)
 * - Origem + transporte + cálculo de rota
 * - Resumo + confirmação final
 * - Rascunho (salvar/restaurar)
 * - Autenticação do cliente
 * 
 * Usa services puros (bookingService, transportService) — sem lógica de negócio no componente.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  CatalogServiceItem,
  SalonProfessionalItem,
  BookingSlotItem,
  BookingDraftItem,
  UserFamilyDependent,
  TransportMode,
  BusySlotRecord,
} from '../types/booking';
import {
  validateBookingConfirmData,
  getSavedBookingDraft,
  saveBookingDraft,
  createBookingDraftFromState,
  confirmAppointmentInDatabase,
  loadClientDependents,
  saveDependentToDatabase,
  fetchBusySlotsDirectly,
  fetchAvailableProfessionalsForDate,
  getAvailableSlotsForDate,
  type BookingConfirmData,
  type ValidationResult,
} from '../services/bookingService';
import { useTransportCalculator } from './useTransportCalculator';
import { formatMaxDepartureTime, TRANSPORT_MODE_META } from '../services/transportService';
import { hapticLight, hapticMedium, hapticSuccess } from '../utils/haptics';
import { PREP_BUFFER_MINUTES, STORAGE_KEYS } from '../types/booking';

// ============================================================================
// TIPOS DE ESTADO
// ============================================================================

type BookingStep = 'service' | 'date' | 'professionals_and_time';

interface BeneficiaryModalState {
  isOpen: boolean;
  isDependentBooking: boolean;
  dependentId: string;
  dependentName: string;
  hasChosenBeneficiary: boolean;
  isCreatingDependentInline: boolean;
  newDepFullName: string;
  newDepRelationship: 'son' | 'daughter' | 'spouse' | 'parent' | 'other';
  newDepBirthDate: string;
  newDepNotes: string;
  isSavingInlineDependent: boolean;
}

interface OriginModalState {
  isOpen: boolean;
  mode: 'choice' | 'custom_cep';
  originType: 'home' | 'other';
  customCepInput: string;
  hasCalculatedCustomCep: boolean;
}

interface SummaryModalState {
  isOpen: boolean;
  draftSavedFeedback: string | null;
}

interface AuthModalState {
  isOpen: boolean;
  pendingAction: 'start_booking' | 'confirm_final';
}

interface ConfirmIntentModalState {
  isOpen: boolean;
  pendingService: CatalogServiceItem | null;
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export interface UseBookingFlowProps {
  // Dados do salão (vêm do pai)
  salonId?: string;
  salonName: string;
  salonAddress?: string;
  salonCep?: string;
  salonSlug?: string;
  salonCoords?: { lat: number; lng: number };
  primaryColor?: string;
  services: CatalogServiceItem[];
  professionals: SalonProfessionalItem[];
  
  // Estado inicial (para deep link / retomar rascunho)
  initialService?: CatalogServiceItem | null;
  initialDateIso?: string;
  initialTimeSlot?: string | null;
  preSelectedProfessionalName?: string;
  resumeDraft?: BookingDraftItem | null;
  skipDateStep?: boolean;
  
  // Callbacks
  onDraftSaved?: (draft: BookingDraftItem | null) => void;
  onConfirmAppointment?: (data: BookingConfirmData) => Promise<{ success: boolean; error?: string } | void>;
  onClose?: () => void;
}

export interface UseBookingFlowReturn {
  // Estado global
  currentStep: BookingStep;
  isLoading: boolean;
  error: string | null;
  
  // Serviços
  selectedServices: CatalogServiceItem[];
  selectedService: CatalogServiceItem | null; // combinado
  isAddingExtraServices: boolean;
  groupedServices: Record<string, CatalogServiceItem[]>;
  toggleService: (srv: CatalogServiceItem) => void;
  setAddingExtraServices: (v: boolean) => void;
  promptScheduleService: (srv: CatalogServiceItem) => void;
  
  // Data
  selectedDateIso: string;
  currentViewMonth: Date;
  monthData: { monthLabel: string; daysGrid: any[]; year: number; month: number };
  setSelectedDate: (iso: string) => void;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  
  // Profissionais + Horários
  selectedProfessional: string;
  selectedTimeSlot: string | null;
  timePeriodFilter: 'manha' | 'tarde' | 'noite' | 'todos';
  generatedSlots: BookingSlotItem[];
  slotsByPeriod: { manha: BookingSlotItem[]; tarde: BookingSlotItem[]; noite: BookingSlotItem[] };
  availableProfessionals: SalonProfessionalItem[];
  isLoadingBusySlots: boolean;
  isManhaPeriodDisabled: boolean;
  isTardePeriodDisabled: boolean;
  setSelectedProfessional: (name: string) => void;
  setSelectedTimeSlot: (time: string) => void;
  setTimePeriodFilter: (period: 'manha' | 'tarde' | 'noite' | 'todos') => void;
  
  // Beneficiário
  beneficiary: BeneficiaryModalState;
  openBeneficiaryModal: () => void;
  closeBeneficiaryModal: () => void;
  setDependentBooking: (isDependent: boolean) => void;
  selectDependent: (dep: UserFamilyDependent) => void;
  startCreateDependent: () => void;
  cancelCreateDependent: () => void;
  saveInlineDependent: (e: React.FormEvent) => Promise<void>;
  
  // Origem + Transporte
  origin: OriginModalState;
  transport: ReturnType<typeof useTransportCalculator>;
  openOriginModal: () => void;
  closeOriginModal: () => void;
  setOriginType: (type: 'home' | 'other') => void;
  handleCustomCepChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  calculateCustomCep: (e?: React.FormEvent) => Promise<void>;
  
  // Resumo + Confirmação
  summary: SummaryModalState;
  openSummaryModal: () => void;
  closeSummaryModal: () => void;
  saveAsDraft: () => void;
  handleConfirmFinal: (bypassAuth?: boolean) => Promise<void>;
  maxDepartureTime: string;
  transportLinks: ReturnType<typeof buildTransportDeepLinks>;
  
  // Confirmação Inicial (modal "Deseja agendar?")
  confirmIntent: ConfirmIntentModalState;
  openConfirmIntent: (srv: CatalogServiceItem) => void;
  closeConfirmIntent: () => void;
  handleConfirmIntent: () => Promise<void>;
  
  // Autenticação
  auth: AuthModalState;
  checkAuth: () => Promise<boolean>;
  
  // Utilitários
  clearError: () => void;
  resetFlow: () => void;
}

// ============================================================================
// HOOK IMPLEMENTAÇÃO
// ============================================================================

export function useBookingFlow({
  salonId = '',
  salonName,
  salonAddress = '',
  salonCep = '',
  salonSlug = '',
  salonCoords = { lat: -23.5621, lng: -46.4795 },
  primaryColor = '#00a033',
  services,
  professionals,
  initialService,
  initialDateIso,
  initialTimeSlot,
  preSelectedProfessionalName,
  resumeDraft,
  skipDateStep = false,
  onDraftSaved,
  onConfirmAppointment,
  onClose,
}: UseBookingFlowProps): UseBookingFlowReturn {
  
  // ============================================================================
  // ESTADO BASE
  // ============================================================================
  
  const [currentStep, setCurrentStep] = useState<BookingStep>(() => {
    if (initialTimeSlot) return 'professionals_and_time';
    return 'service';
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ============================================================================
  // SERVIÇOS
  // ============================================================================
  
  const [selectedServices, setSelectedServices] = useState<CatalogServiceItem[]>(() => {
    if (resumeDraft?.services?.length) return resumeDraft.services;
    if (initialService) return [initialService];
    return [];
  });
  
  const [isAddingExtraServices, setIsAddingExtraServices] = useState(false);
  
  const toggleService = useCallback((srv: CatalogServiceItem) => {
    hapticLight();
    setSelectedServices(prev => {
      const exists = prev.some(s => s.id === srv.id);
      return exists ? prev.filter(s => s.id !== srv.id) : [...prev, srv];
    });
  }, []);
  
  const selectedService = useMemo(() => {
    if (selectedServices.length === 0) return null;
    if (selectedServices.length === 1) return selectedServices[0];
    
    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const combinedTitle = selectedServices.map(s => s.title).join(' + ');
    let totalMinutes = 0;
    let canParse = true;
    for (const s of selectedServices) {
      const match = String(s.duration || '').match(/(\d+)/);
      if (match) totalMinutes += parseInt(match[1], 10);
      else { canParse = false; break; }
    }
    return {
      id: selectedServices.map(s => s.id).join('+'),
      title: combinedTitle,
      price: totalPrice,
      duration: canParse ? `${totalMinutes} min` : selectedServices.map(s => s.duration).join(' + '),
      category: selectedServices[0]?.category || 'Combo',
    } as CatalogServiceItem;
  }, [selectedServices]);
  
  const groupedServices = useMemo(() => {
    const groups: Record<string, CatalogServiceItem[]> = {};
    services.forEach(srv => {
      const cat = srv.category?.trim() || 'Geral';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(srv);
    });
    return groups;
  }, [services]);
  
  // ============================================================================
  // DATA / CALENDÁRIO
  // ============================================================================
  
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayIso = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }, []);
  
  const [currentViewMonth, setCurrentViewMonth] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  });
  
  const [selectedDateIso, setSelectedDateIso] = useState<string>(() => {
    if (resumeDraft?.dateIso) return resumeDraft.dateIso;
    if (initialDateIso) return initialDateIso;
    const d = new Date();
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  
  const monthData = useMemo(() => {
    const year = currentViewMonth.getFullYear();
    const month = currentViewMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentViewMonth);
    
    const daysGrid = [];
    for (let i = 0; i < firstDayIndex; i++) {
      daysGrid.push({ dayNumber: null, isoString: null, isToday: false, isDisabled: true, isClosed: false });
    }
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      dateObj.setHours(0,0,0,0);
      const iso = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
      const isPast = dateObj < today;
      const isSunday = dateObj.getDay() === 0;
      daysGrid.push({
        dayNumber: day,
        isoString: iso,
        isToday: dateObj.getTime() === today.getTime(),
        isDisabled: isPast || isSunday,
        isClosed: isSunday,
      });
    }
    return { monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), daysGrid, year, month };
  }, [currentViewMonth, today]);
  
  const handlePrevMonth = useCallback(() => {
    const prev = new Date(currentViewMonth);
    prev.setMonth(prev.getMonth() - 1);
    if (prev.getFullYear() < today.getFullYear() || (prev.getFullYear() === today.getFullYear() && prev.getMonth() < today.getMonth())) return;
    setCurrentViewMonth(prev);
  }, [currentViewMonth, today]);
  
  const handleNextMonth = useCallback(() => {
    const next = new Date(currentViewMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentViewMonth(next);
  }, [currentViewMonth]);
  
  // ============================================================================
  // PROFISSIONAIS + HORÁRIOS
  // ============================================================================
  
  const [selectedProfessional, setSelectedProfessional] = useState<string>(() => 
    resumeDraft?.professional || preSelectedProfessionalName || 'any'
  );
  
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(() => 
    resumeDraft?.timeSlot || initialTimeSlot || null
  );
  
  const [timePeriodFilter, setTimePeriodFilter] = useState<'manha' | 'tarde' | 'noite' | 'todos'>('manha');
  
  const [busySlotsFromDb, setBusySlotsFromDb] = useState<BusySlotRecord[]>([]);
  const [availableProfessionalsForDate, setAvailableProfessionalsForDate] = useState<SalonProfessionalItem[]>(() =>
    professionals.filter(p => p.isActive !== false && !String(p.role || '').toLowerCase().includes('recep'))
  );
  const [isLoadingBusySlots, setIsLoadingBusySlots] = useState(false);
  
  const [currentTimeTick, setCurrentTimeTick] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTimeTick(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  
  // Carrega busy slots e profissionais disponíveis
  useEffect(() => {
    let active = true;
    async function load() {
      if (!selectedDateIso) return;
      setIsLoadingBusySlots(true);
      const effectiveSalonId = salonId || localStorage.getItem(STORAGE_KEYS.SALON_DB_ID) || localStorage.getItem(STORAGE_KEYS.SALON_SLUG) || '';
      const slots = await fetchBusySlotsDirectly(effectiveSalonId, selectedDateIso);
      const availablePros = await fetchAvailableProfessionalsForDate(effectiveSalonId, selectedDateIso, professionals, slots);
      if (active) {
        setBusySlotsFromDb(slots);
        setAvailableProfessionalsForDate(availablePros);
        setIsLoadingBusySlots(false);
      }
    }
    load();
    return () => { active = false; };
  }, [salonId, selectedDateIso, professionals]);
  
  // Auto-seleciona profissional se só houver 1 disponível
  useEffect(() => {
    if (availableProfessionalsForDate.length === 1) {
      const single = availableProfessionalsForDate[0].name;
      if (selectedProfessional !== single) setSelectedProfessional(single);
    } else if (availableProfessionalsForDate.length > 1) {
      if (selectedProfessional !== 'any' && !availableProfessionalsForDate.some(p => p.name === selectedProfessional)) {
        setSelectedProfessional('any');
      }
    }
  }, [availableProfessionalsForDate, selectedProfessional]);
  
  // Gera slots disponíveis
  const generatedSlots = useMemo(() => {
    return getAvailableSlotsForDate(selectedDateIso, selectedProfessional, {
      travelMinutes: transport.resolvedRoute?.etaMinutes || 0,
      prepMinutes: PREP_BUFFER_MINUTES,
      busySlots: busySlotsFromDb,
      availableProfessionals: availableProfessionalsForDate,
      nowOverride: currentTimeTick,
    });
  }, [selectedDateIso, selectedProfessional, transport.resolvedRoute?.etaMinutes, busySlotsFromDb, availableProfessionalsForDate, currentTimeTick]);
  
  const slotsByPeriod = useMemo(() => ({
    manha: generatedSlots.filter(s => s.period === 'manha'),
    tarde: generatedSlots.filter(s => s.period === 'tarde'),
    noite: generatedSlots.filter(s => s.period === 'noite'),
  }), [generatedSlots]);
  
  // Períodos desabilitados (hoje)
  const isSelectedDateToday = selectedDateIso === todayIso;
  const nowMinutes = currentTimeTick.getHours() * 60 + currentTimeTick.getMinutes();
  const totalLeadMinutes = (transport.resolvedRoute?.etaMinutes || 0) + PREP_BUFFER_MINUTES;
  const minAllowedMinutesToday = nowMinutes + totalLeadMinutes;
  const isManhaPeriodDisabled = isSelectedDateToday && (nowMinutes >= 12*60 || minAllowedMinutesToday > 11*60+30);
  const isTardePeriodDisabled = isSelectedDateToday && (nowMinutes >= 18*60 || minAllowedMinutesToday > 17*60+30);
  
  // Auto-seleciona período válido
  useEffect(() => {
    if (isSelectedDateToday) {
      if (isTardePeriodDisabled && (timePeriodFilter === 'manha' || timePeriodFilter === 'tarde')) setTimePeriodFilter('noite');
      else if (isManhaPeriodDisabled && timePeriodFilter === 'manha') setTimePeriodFilter('tarde');
    }
  }, [isSelectedDateToday, isManhaPeriodDisabled, isTardePeriodDisabled, timePeriodFilter]);
  
  // ============================================================================
  // TRANSPORTE (hook dedicado)
  // ============================================================================
  
  const transport = useTransportCalculator(
    // origin address inicial
    resumeDraft?.clientAddressQuery || 
    localStorage.getItem(STORAGE_KEYS.USER_CEP) || 
    localStorage.getItem(STORAGE_KEYS.USER_ADDRESS) || 
    '08235-770',
    // salon coords
    salonCoords,
    // salon address
    salonAddress || salonCep
  );
  
  // Sincroniza maxDepartureTime quando timeSlot muda
  useEffect(() => {
    if (selectedTimeSlot && transport.resolvedRoute) {
      const maxDep = formatMaxDepartureTime(selectedTimeSlot, transport.resolvedRoute.etaMinutes);
      transport.updateMaxDepartureTime(maxDep);
    } else {
      transport.updateMaxDepartureTime(null);
    }
  }, [selectedTimeSlot, transport.resolvedRoute]);
  
  // ============================================================================
  // DEPENDENTES / BENEFICIÁRIO
  // ============================================================================
  
  const [beneficiary, setBeneficiaryState] = useState<BeneficiaryModalState>({
    isOpen: false,
    isDependentBooking: resumeDraft?.isDependentBooking || false,
    dependentId: resumeDraft?.dependentId || '',
    dependentName: resumeDraft?.dependentName || '',
    hasChosenBeneficiary: !!resumeDraft?.dependentName,
    isCreatingDependentInline: false,
    newDepFullName: '',
    newDepRelationship: 'son',
    newDepBirthDate: '',
    newDepNotes: '',
    isSavingInlineDependent: false,
  });
  
  const [registeredDependents, setRegisteredDependents] = useState<UserFamilyDependent[]>([]);
  
  // Carrega dependentes
  useEffect(() => {
    loadClientDependents().then(deps => setRegisteredDependents(deps));
  }, [beneficiary.isOpen]);
  
  const openBeneficiaryModal = useCallback(() => {
    setBeneficiaryState(prev => ({ ...prev, isOpen: true }));
  }, []);
  
  const closeBeneficiaryModal = useCallback(() => {
    setBeneficiaryState(prev => ({ ...prev, isOpen: false, hasChosenBeneficiary: true }));
  }, []);
  
  const setDependentBooking = useCallback((isDependent: boolean) => {
    setBeneficiaryState(prev => ({ ...prev, isDependentBooking: isDependent, dependentId: '', dependentName: '' }));
  }, []);
  
  const selectDependent = useCallback((dep: UserFamilyDependent) => {
    hapticMedium();
    setBeneficiaryState(prev => ({
      ...prev,
      isDependentBooking: true,
      dependentId: dep.id,
      dependentName: dep.full_name,
      hasChosenBeneficiary: true,
      isOpen: false,
    }));
  }, []);
  
  const startCreateDependent = useCallback(() => {
    setBeneficiaryState(prev => ({ ...prev, isCreatingDependentInline: true }));
  }, []);
  
  const cancelCreateDependent = useCallback(() => {
    setBeneficiaryState(prev => ({ ...prev, isCreatingDependentInline: false, newDepFullName: '', newDepBirthDate: '', newDepNotes: '' }));
  }, []);
  
  const saveInlineDependent = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiary.newDepFullName.trim()) return;
    setBeneficiaryState(prev => ({ ...prev, isSavingInlineDependent: true }));
    hapticLight();
    
    const newId = `dep-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const newDep: UserFamilyDependent = {
      id: newId,
      full_name: beneficiary.newDepFullName.trim(),
      relationship: beneficiary.newDepRelationship,
      birth_date: beneficiary.newDepBirthDate || undefined,
      notes: beneficiary.newDepNotes.trim() || undefined,
      is_unlinked: false,
      created_at: new Date().toISOString(),
    };
    
    const updated = [...registeredDependents, newDep];
    setRegisteredDependents(updated);
    localStorage.setItem(STORAGE_KEYS.USER_DEPENDENTS, JSON.stringify(updated));
    
    // Sync Supabase
    try {
      let parentClientId = localStorage.getItem(STORAGE_KEYS.CLIENT_SESSION);
      let clientId = '';
      if (parentClientId) {
        try { const parsed = JSON.parse(parentClientId); clientId = parsed.id || parsed.clientId || ''; } catch {}
      }
      if (!clientId) {
        const email = localStorage.getItem(STORAGE_KEYS.USER_EMAIL)?.trim().toLowerCase();
        if (email) {
          const { supabase } = await import('../lib/supabase');
          if (supabase) {
            const { data } = await supabase.from('clients').select('id').ilike('email', `%${email}%`).maybeSingle();
            if (data?.id) clientId = data.id;
          }
        }
      }
      if (clientId) await saveDependentToDatabase(clientId, newDep);
    } catch {}
    
    setBeneficiaryState(prev => ({
      ...prev,
      isDependentBooking: true,
      dependentId: newId,
      dependentName: newDep.full_name,
      hasChosenBeneficiary: true,
      isCreatingDependentInline: false,
      isSavingInlineDependent: false,
      isOpen: false,
      newDepFullName: '',
      newDepBirthDate: '',
      newDepNotes: '',
    }));
    
    if (skipDateStep) {
      setCurrentStep('professionals_and_time');
      setOriginState(prev => ({ ...prev, mode: 'choice', isOpen: true }));
    } else {
      setCurrentStep('date');
    }
    hapticSuccess();
  }, [beneficiary, registeredDependents, skipDateStep]);
  
  // ============================================================================
  // ORIGEM + TRANSPORTE MODAL
  // ============================================================================
  
  const [origin, setOriginState] = useState<OriginModalState>({
    isOpen: false,
    mode: 'choice',
    originType: 'home',
    customCepInput: '',
    hasCalculatedCustomCep: false,
  });
  
  const openOriginModal = useCallback(() => {
    setOriginState(prev => ({ ...prev, isOpen: true, mode: 'choice' }));
  }, []);
  
  const closeOriginModal = useCallback(() => {
    setOriginState(prev => ({ ...prev, isOpen: false }));
  }, []);
  
  const setOriginType = useCallback((type: 'home' | 'other') => {
    setOriginState(prev => ({ ...prev, originType: type }));
    if (type === 'home') {
      const savedHome = localStorage.getItem(STORAGE_KEYS.USER_CEP) || localStorage.getItem(STORAGE_KEYS.USER_ADDRESS) || '08235-770';
      transport.setOriginAddress(savedHome);
      transport.runRouteCalculation(savedHome, salonAddress || salonCep || '08285-010', transport.transportMode);
      setOriginState(prev => ({ ...prev, isOpen: false }));
    } else {
      setOriginState(prev => ({ ...prev, mode: 'custom_cep' }));
    }
  }, [transport]);
  
  const handleCustomCepChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    const formatted = digits.length > 5 ? `${digits.slice(0,5)}-${digits.slice(5)}` : digits;
    setOriginState(prev => ({
      ...prev,
      customCepInput: formatted,
      hasCalculatedCustomCep: digits.length === 8,
    }));
    if (digits.length === 8) {
      transport.setOriginAddress(formatted);
      transport.runRouteCalculation(formatted, salonAddress || salonCep || '08285-010', transport.transportMode).then(() => {
        setOriginState(prev => ({ ...prev, hasCalculatedCustomCep: true }));
      });
    }
  }, [transport]);
  
  const calculateCustomCep = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = origin.customCepInput.replace(/\D/g, '');
    if (clean.length !== 8) return;
    hapticLight();
    await transport.runRouteCalculation(clean, salonAddress || salonCep || '08285-010', transport.transportMode);
    setOriginState(prev => ({ ...prev, hasCalculatedCustomCep: true }));
  }, [origin.customCepInput, transport]);
  
  // ============================================================================
  // RESUMO + CONFIRMAÇÃO
  // ============================================================================
  
  const [summary, setSummaryState] = useState<SummaryModalState>({
    isOpen: false,
    draftSavedFeedback: null,
  });
  
  const openSummaryModal = useCallback(() => {
    if (!selectedService || !selectedTimeSlot) return;
    hapticMedium();
    setSummaryState(prev => ({ ...prev, isOpen: true }));
  }, [selectedService, selectedTimeSlot]);
  
  const closeSummaryModal = useCallback(() => {
    setSummaryState(prev => ({ ...prev, isOpen: false, draftSavedFeedback: null }));
  }, []);
  
  const saveAsDraft = useCallback(() => {
    if (!selectedService || !selectedTimeSlot) return;
    hapticMedium();
    
    const draft = createBookingDraftFromState({
      salonId,
      salonName,
      salonAddress,
      services: selectedServices,
      combinedServiceTitle: selectedService.title,
      totalPrice: selectedService.price,
      professional: selectedProfessional === 'any' ? (availableProfessionalsForDate[0]?.name || 'Equipe') : selectedProfessional,
      professionalAvatar: availableProfessionalsForDate[0]?.avatar,
      dateIso: selectedDateIso,
      dateFormatted: `${selectedDateIso.split('-')[2]}/${selectedDateIso.split('-')[1]}`,
      timeSlot: selectedTimeSlot,
      isDependentBooking: beneficiary.isDependentBooking,
      dependentId: beneficiary.dependentId,
      dependentName: beneficiary.dependentName,
      clientPhone: '', // será preenchido no resumo
      clientAddressQuery: transport.resolvedRoute?.formattedAddress,
      distanceKm: transport.resolvedRoute?.distanceKm,
      etaMinutes: transport.resolvedRoute?.etaMinutes,
      prepBufferMinutes: PREP_BUFFER_MINUTES,
      uiTransportMode: transport.transportMode,
    });
    
    saveBookingDraft(draft);
    onDraftSaved?.(draft);
    setSummaryState(prev => ({ ...prev, draftSavedFeedback: 'Pré-agendamento salvo! Retome em Minha Agenda.' }));
    setTimeout(() => { setSummaryState(prev => ({ ...prev, draftSavedFeedback: null, isOpen: false })); }, 1400);
  }, [salonId, salonName, salonAddress, selectedServices, selectedService, selectedProfessional, availableProfessionalsForDate, selectedDateIso, selectedTimeSlot, beneficiary, transport]);
  
  const handleConfirmFinal = useCallback(async (bypassAuth = false) => {
    setError('');
    if (!selectedService || !selectedTimeSlot) return;
    if (beneficiary.isDependentBooking && !beneficiary.dependentName.trim()) {
      setError('Selecione ou informe o dependente');
      return;
    }
    
    if (!bypassAuth) {
      const { checkIsClientAuthenticated } = await import('./useAuth');
      const isLogged = await checkIsClientAuthenticated();
      if (!isLogged) {
        hapticMedium();
        setAuthState(prev => ({ ...prev, isOpen: true, pendingAction: 'confirm_final' }));
        return;
      }
    }
    
    const cleanPhone = '' /* virá do input do resumo */;
    if (!cleanPhone) {
      setError('Informe WhatsApp de contato');
      return;
    }
    
    setIsLoading(true);
    try {
      const dbTransportMode = transport.transportMode === 'motorcycle' ? 'motorcycle' : transport.transportMode === 'transit' ? 'transit' : 'driving';
      
      const bookingData: BookingConfirmData = {
        service: selectedService,
        professional: selectedProfessional === 'any' ? `${availableProfessionalsForDate[0]?.name || 'Equipe'} (Designado)` : selectedProfessional,
        professionalAvatar: availableProfessionalsForDate[0]?.avatar,
        dateIso: selectedDateIso,
        dateFormatted: `${selectedDateIso.split('-')[2]}/${selectedDateIso.split('-')[1]}`,
        timeSlot: selectedTimeSlot,
        salonName,
        salonAddress,
        price: selectedService.price,
        isDependentBooking: beneficiary.isDependentBooking,
        dependentId: beneficiary.dependentId,
        dependentName: beneficiary.dependentName,
        clientPhone: cleanPhone,
        notes: beneficiary.isDependentBooking ? `Dependente: ${beneficiary.dependentName}` : undefined,
        distanceKm: transport.resolvedRoute?.distanceKm,
        etaMinutes: transport.resolvedRoute?.etaMinutes,
        prepBufferMinutes: PREP_BUFFER_MINUTES,
        transportMode: dbTransportMode,
        uiTransportMode: transport.transportMode,
        maxDepartureTime: transport.maxDepartureTime,
        originFormattedAddress: transport.resolvedRoute?.formattedAddress,
        originLat: transport.resolvedRoute?.originCoords.lat,
        originLng: transport.resolvedRoute?.originCoords.lng,
        salonLat: transport.resolvedRoute?.salonCoords.lat,
        salonLng: transport.resolvedRoute?.salonCoords.lng,
        selectedRouteSummary: `${transport.resolvedRoute?.formattedAddress} (${TRANSPORT_MODE_META[transport.transportMode].shortLabel} • ${transport.resolvedRoute?.distanceKm.toFixed(1).replace('.',',')} km • ~${transport.resolvedRoute?.etaMinutes} min c/ folga)`,
      };
      
      // Se tem callback customizado (para integração com Supabase do pai), usa ele
      if (onConfirmAppointment) {
        const result = await onConfirmAppointment(bookingData);
        if (result && !result.success) {
          setError(result.error || 'Falha ao agendar');
          setIsLoading(false);
          return;
        }
      } else {
        // Senão usa service direto
        const result = await confirmAppointmentInDatabase({ ...bookingData, salonId });
        if (!result.success) {
          setError(result.error || 'Falha ao agendar');
          setIsLoading(false);
          return;
        }
      }
      
      saveBookingDraft(null);
      onDraftSaved?.(null);
      setSummaryState(prev => ({ ...prev, isOpen: false }));
      hapticSuccess();
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao agendar');
    } finally {
      setIsLoading(false);
    }
  }, [selectedService, selectedTimeSlot, beneficiary, selectedProfessional, availableProfessionalsForDate, selectedDateIso, salonName, salonAddress, transport, onConfirmAppointment, onClose, onDraftSaved]);
  
  // ============================================================================
  // CONFIRMAÇÃO INICIAL (modal "Deseja agendar?")
  // ============================================================================
  
  const [confirmIntent, setConfirmIntentState] = useState<ConfirmIntentModalState>({
    isOpen: false,
    pendingService: null,
  });
  
  const openConfirmIntent = useCallback((srv: CatalogServiceItem) => {
    hapticMedium();
    setConfirmIntentState({ isOpen: true, pendingService: srv });
  }, []);
  
  const closeConfirmIntent = useCallback(() => {
    setConfirmIntentState({ isOpen: false, pendingService: null });
  }, []);
  
  const handleConfirmIntent = useCallback(async () => {
    const target = confirmIntent.pendingService || initialService || selectedService;
    setConfirmIntentState({ isOpen: false, pendingService: null });
    if (!target) return;
    
    const { checkIsClientAuthenticated } = await import('./useAuth');
    const isLogged = await checkIsClientAuthenticated();
    if (!isLogged) {
      hapticMedium();
      setAuthState({ isOpen: true, pendingAction: 'start_booking' });
      return;
    }
    
    hapticLight();
    setSelectedServices([target]);
    setIsAddingExtraServices(false);
    if (initialDateIso) setSelectedDateIso(initialDateIso);
    if (initialTimeSlot) {
      setSelectedTimeSlot(initialTimeSlot);
      setCurrentStep('professionals_and_time');
      setSummaryState(prev => ({ ...prev, isOpen: true }));
    } else {
      setSelectedTimeSlot(null);
      setCurrentStep(skipDateStep ? 'professionals_and_time' : 'date');
      setBeneficiaryState(prev => ({ ...prev, isOpen: true }));
    }
  }, [confirmIntent, initialService, selectedService, initialDateIso, initialTimeSlot, skipDateStep]);
  
  // ============================================================================
  // AUTENTICAÇÃO
  // ============================================================================
  
  const [auth, setAuthState] = useState<AuthModalState>({ isOpen: false, pendingAction: 'start_booking' });
  
  const checkAuth = useCallback(async () => {
    // Lógica simplificada - componente SalonClientAuthModal trata o resto
    return false;
  }, []);
  
  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================
  
  const clearError = useCallback(() => setError(null), []);
  
  const resetFlow = useCallback(() => {
    setCurrentStep('service');
    setSelectedServices([]);
    setSelectedDateIso(todayIso);
    setSelectedProfessional('any');
    setSelectedTimeSlot(null);
    setTimePeriodFilter('manha');
    setBeneficiaryState({ ...beneficiary, isOpen: false, isDependentBooking: false, dependentId: '', dependentName: '', hasChosenBeneficiary: false });
    setOriginState({ ...origin, isOpen: false });
    setSummaryState({ ...summary, isOpen: false });
    setConfirmIntentState({ isOpen: false, pendingService: null });
    setAuthState({ isOpen: false, pendingAction: 'start_booking' });
    setError(null);
    transport.reset();
  }, [transport]);
  
  // ============================================================================
  // AUTOMAÇÕES DE RASCUNHO / DEEP LINK
  // ============================================================================
  
  useEffect(() => {
    if (resumeDraft) {
      setSelectedServices(resumeDraft.services);
      setSelectedDateIso(resumeDraft.dateIso);
      setSelectedProfessional(resumeDraft.professional);
      setSelectedTimeSlot(resumeDraft.timeSlot);
      setBeneficiaryState(prev => ({
        ...prev,
        isDependentBooking: resumeDraft.isDependentBooking,
        dependentId: resumeDraft.dependentId || '',
        dependentName: resumeDraft.dependentName || '',
        hasChosenBeneficiary: true,
      }));
      if (resumeDraft.clientAddressQuery) transport.setOriginAddress(resumeDraft.clientAddressQuery);
      if (resumeDraft.distanceKm) { /* transport já calcula */ }
      setCurrentStep('professionals_and_time');
      setSummaryState(prev => ({ ...prev, isOpen: true }));
    }
  }, [resumeDraft]);
  
  useEffect(() => {
    if (!initialService) return;
    setSelectedServices([initialService]);
    setIsAddingExtraServices(false);
    if (initialDateIso) setSelectedDateIso(initialDateIso);
    if (initialTimeSlot) {
      setSelectedTimeSlot(initialTimeSlot);
      setCurrentStep('professionals_and_time');
      setSummaryState(prev => ({ ...prev, isOpen: true }));
    } else {
      setConfirmIntentState({ isOpen: true, pendingService: initialService });
    }
  }, [initialService]);
  
  // ============================================================================
  // DEEP LINKS DE TRANSPORTE (para botões do resumo)
  // ============================================================================
  
  const transportLinks = useMemo(() => {
    if (!transport.resolvedRoute) return null;
    return buildTransportDeepLinks({
      originAddress: transport.resolvedRoute.formattedAddress,
      originLat: transport.resolvedRoute.originCoords.lat,
      originLng: transport.resolvedRoute.originCoords.lng,
      salonName,
      salonAddress: salonAddress || salonCep,
      salonLat: transport.resolvedRoute.salonCoords.lat,
      salonLng: transport.resolvedRoute.salonCoords.lng,
      transportMode: transport.transportMode,
    });
  }, [transport.resolvedRoute, salonName, salonAddress, salonCep, transport.transportMode]);
  
  const maxDepartureTime = transport.maxDepartureTime || (selectedTimeSlot && transport.resolvedRoute ? formatMaxDepartureTime(selectedTimeSlot, transport.resolvedRoute.etaMinutes) : '--H--');
  
  // ============================================================================
  // RETORNO
  // ============================================================================
  
  return {
    // Estado
    currentStep,
    isLoading,
    error,
    
    // Serviços
    selectedServices,
    selectedService,
    isAddingExtraServices,
    groupedServices,
    toggleService,
    setAddingExtraServices,
    promptScheduleService: openConfirmIntent,
    
    // Data
    selectedDateIso,
    currentViewMonth,
    monthData,
    setSelectedDate: setSelectedDateIso,
    handlePrevMonth,
    handleNextMonth,
    
    // Profissionais + Horários
    selectedProfessional,
    selectedTimeSlot,
    timePeriodFilter,
    generatedSlots,
    slotsByPeriod,
    availableProfessionals: availableProfessionalsForDate,
    isLoadingBusySlots,
    isManhaPeriodDisabled,
    isTardePeriodDisabled,
    setSelectedProfessional,
    setSelectedTimeSlot,
    setTimePeriodFilter,
    
    // Beneficiário
    beneficiary,
    openBeneficiaryModal,
    closeBeneficiaryModal,
    setDependentBooking,
    selectDependent,
    startCreateDependent,
    cancelCreateDependent,
    saveInlineDependent,
    
    // Origem + Transporte
    origin,
    transport,
    openOriginModal,
    closeOriginModal,
    setOriginType,
    handleCustomCepChange,
    calculateCustomCep,
    
    // Resumo + Confirmação
    summary,
    openSummaryModal,
    closeSummaryModal,
    saveAsDraft,
    handleConfirmFinal,
    maxDepartureTime,
    transportLinks,
    
    // Confirmação Inicial
    confirmIntent,
    openConfirmIntent,
    closeConfirmIntent,
    handleConfirmIntent,
    
    // Auth
    auth,
    checkAuth,
    
    // Utils
    clearError,
    resetFlow,
  };
}

// Importações tardias para evitar ciclos
import { buildTransportDeepLinks } from '../services/transportService';