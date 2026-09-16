import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, Calendar, Clock, User, CheckCircle2, ChevronLeft, ChevronRight, 
  Sparkles, Star, Scissors, ArrowLeft, Building2, ChevronDown, AlertCircle,
  Check
} from 'lucide-react';
import { ServiceOffer } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getAvailableSlotsForDate } from '../utils/bookingSlots';
import { hapticLight, hapticMedium, hapticSuccess } from '../utils/haptics';

export interface CatalogServiceItem {
  id: string;
  title: string;
  duration: string;
  price: number;
  description: string;
  category: string;
  image?: string;
  aspectRatio?: string;
}

export interface SalonProfessionalItem {
  name: string;
  role: string;
  avatar: string;
  rating: number;
}

interface SalonBookingModalProps {
  isOpen?: boolean;
  inline?: boolean;
  onClose?: () => void;
  salonName: string;
  salonAddress?: string;
  services: CatalogServiceItem[];
  professionals: SalonProfessionalItem[];
  initialService?: CatalogServiceItem | null;
  baseOffer?: ServiceOffer;
  skipDateStep?: boolean;
  initialTimeSlot?: string | null;
  initialDateIso?: string;
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
  }) => void;
}

type Step = 'service' | 'date' | 'professionals_and_time' | 'confirmation';

export const SalonBookingModal: React.FC<SalonBookingModalProps> = ({
  isOpen = true,
  inline = false,
  onClose,
  salonName,
  salonAddress = 'Rua das Flores, 1420 - Centro, Curitiba, PR',
  services,
  professionals,
  initialService,
  baseOffer,
  skipDateStep = false,
  initialTimeSlot,
  initialDateIso,
  onConfirmAppointment,
}) => {
  const { isDark } = useTheme();

  // 1. Selected Services State (Suporta a seleção de 1 ou mais serviços com toggle)
  const [selectedServices, setSelectedServices] = useState<CatalogServiceItem[]>(() => {
    if (initialService) return [initialService];
    return [];
  });

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

  // Objeto resumido consolidado para compatibilidade com os passos de data, horário e confirmação
  const selectedService = useMemo(() => {
    if (selectedServices.length === 0) return null;
    if (selectedServices.length === 1) return selectedServices[0];

    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const combinedTitle = selectedServices.map((s) => s.title).join(' + ');

    let totalMinutes = 0;
    let canParseMinutes = true;
    for (const s of selectedServices) {
      const match = s.duration.match(/(\d+)/);
      if (match) {
        totalMinutes += parseInt(match[1], 10);
      } else {
        canParseMinutes = false;
        break;
      }
    }
    const combinedDuration = canParseMinutes ? `${totalMinutes} min` : selectedServices.map((s) => s.duration).join(' + ');

    return {
      id: selectedServices.map((s) => s.id).join('+'),
      title: combinedTitle,
      price: totalPrice,
      duration: combinedDuration,
      category: 'Combo',
    } as CatalogServiceItem;
  }, [selectedServices]);

  // Step state: 'service' (Phase 1: Table of services) -> 'date' (Phase 2: Monthly Calendar) -> 'professionals_and_time' (Phase 3: Professionals + Time Table) -> 'confirmation' (Phase 4: Summary)
  const [currentStep, setCurrentStep] = useState<Step>(() => {
    if (initialTimeSlot) return 'confirmation';
    if (initialService) return skipDateStep ? 'professionals_and_time' : 'date';
    return 'service';
  });

  // 2. Date Selection State (Monthly Calendar)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [currentViewMonth, setCurrentViewMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [selectedDateIso, setSelectedDateIso] = useState<string>(() => {
    const d = new Date();
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Skip Sunday if today is Sunday
    return d.toISOString().split('T')[0];
  });

  // 3. Professional Selection State ('any' or professional name)
  const [selectedProfessional, setSelectedProfessional] = useState<string>('any');

  // 4. Time Slot Selection
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(initialTimeSlot || null);
  const [timePeriodFilter, setTimePeriodFilter] = useState<'todos' | 'manha' | 'tarde' | 'noite'>('todos');

  // Rastrear estado anterior de abertura para inicializar APENAS na transição de fechado -> aberto
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (initialDateIso) {
        setSelectedDateIso(initialDateIso);
      }
      if (initialTimeSlot) {
        setSelectedTimeSlot(initialTimeSlot);
        setCurrentStep('confirmation');
      } else {
        if (initialService) {
          setCurrentStep(skipDateStep ? 'professionals_and_time' : 'date');
        } else {
          setCurrentStep('service');
        }
        setSelectedTimeSlot(null);
      }
      setSelectedProfessional('any');
      if (initialService) {
        setSelectedServices([initialService]);
      } else {
        setSelectedServices([]);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, skipDateStep, initialTimeSlot, initialDateIso, initialService, baseOffer, services]);

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

    // Empty padding slots before 1st day of month
    for (let i = 0; i < firstDayIndex; i++) {
      daysGrid.push({ dayNumber: null, isoString: null, isToday: false, isDisabled: true, isClosed: false });
    }

    // Days of the month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      dateObj.setHours(0, 0, 0, 0);

      const iso = dateObj.toISOString().split('T')[0];
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

  // Navigate month
  const handlePrevMonth = () => {
    const prev = new Date(currentViewMonth);
    prev.setMonth(prev.getMonth() - 1);
    if (prev.getFullYear() < today.getFullYear() || (prev.getFullYear() === today.getFullYear() && prev.getMonth() < today.getMonth())) {
      return;
    }
    setCurrentViewMonth(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentViewMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentViewMonth(next);
  };

  // Generate time slots for chosen date + pro
  const generatedSlots = useMemo(() => {
    return getAvailableSlotsForDate(selectedDateIso, selectedProfessional);
  }, [selectedDateIso, selectedProfessional]);

  const filteredSlots = useMemo(() => {
    if (timePeriodFilter === 'todos') return generatedSlots;
    return generatedSlots.filter((s) => s.period === timePeriodFilter);
  }, [generatedSlots, timePeriodFilter]);

  if (!isOpen) return null;

  // Selected date formatted (DD/MM)
  const [, selMonth, selDay] = selectedDateIso.split('-');
  const shortDateFormatted = `${selDay}/${selMonth}`;

  const activeProfObj = professionals.find((p) => p.name === selectedProfessional);
  const resolvedProfessionalName = activeProfObj?.name || (professionals[0]?.name ?? 'Equipe do Salão');
  const resolvedProfessionalAvatar = activeProfObj?.avatar || professionals[0]?.avatar;

  const handleConfirmFinal = () => {
    if (!selectedTimeSlot) return;

    hapticSuccess();

    onConfirmAppointment({
      service: selectedService,
      professional: selectedProfessional === 'any' ? `${resolvedProfessionalName} (Designado)` : selectedProfessional,
      professionalAvatar: resolvedProfessionalAvatar,
      dateIso: selectedDateIso,
      dateFormatted: shortDateFormatted,
      timeSlot: selectedTimeSlot,
      salonName,
      salonAddress,
      price: selectedService.price,
    });
    onClose?.();
  };

  const bookingContent = (
    <div 
      className={`w-full flex flex-col overflow-hidden transition-colors ${
        inline ? 'h-full border-0 rounded-none' : 'max-w-lg border rounded max-h-[92vh] shadow-2xl'
      } ${
        isDark
          ? 'bg-slate-950 border-slate-800'
          : 'bg-white border-slate-200'
      }`}
      role={inline ? undefined : "dialog"}
      aria-modal={inline ? undefined : "true"}
    >
      {/* Header do Agendamento com Progresso das Etapas */}
      <div className={`px-3.5 py-2.5 border-b sticky top-0 z-10 transition-colors ${
        isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-100/95 border-slate-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 h-7">
            {currentStep !== 'service' ? (
              <button
                onClick={() => {
                  hapticMedium();
                  if (currentStep === 'date') setCurrentStep('service');
                  else if (currentStep === 'professionals_and_time') setCurrentStep('date');
                  else if (currentStep === 'confirmation') setCurrentStep('professionals_and_time');
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded transition cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900'
                }`}
                aria-label="Voltar etapa anterior"
              >
                <ArrowLeft className="w-4 h-4 text-[#20C933]" />
                <span className="text-xs font-bold">Voltar</span>
              </button>
            ) : !inline && onClose ? (
              <button
                onClick={onClose}
                className={`flex items-center gap-1 px-2 py-1 rounded transition cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-900'
                }`}
                aria-label="Voltar e fechar"
                title="Voltar / Fechar"
              >
                <ArrowLeft className="w-4 h-4 text-[#20C933]" />
                <span className="text-xs font-bold">Voltar</span>
              </button>
            ) : null}
            <h2 className={`text-xs sm:text-sm font-bold font-['Poppins'] ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              {currentStep === 'service' && '1. Escolha o Serviço'}
              {currentStep === 'date' && '2. Selecione a Data'}
              {currentStep === 'professionals_and_time' && '3. Escolha Profissional & Horário'}
              {currentStep === 'confirmation' && '4. Confirmar Agendamento'}
            </h2>
          </div>

          {!inline && onClose && (
            <button
              onClick={onClose}
              className={`w-7 h-7 rounded flex items-center justify-center transition cursor-pointer ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-slate-900'
              }`}
              aria-label="Fechar modal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

          {/* Stepper Indicator Compacto - 4 Etapas */}
          <div className="grid grid-cols-4 gap-1">
            {[
              { key: 'service', label: '1. Serviço' },
              { key: 'date', label: '2. Data' },
              { key: 'professionals_and_time', label: '3. Horário' },
              { key: 'confirmation', label: '4. Confirmar' },
            ].map((st, idx) => {
              const stepOrder: Record<Step, number> = { service: 1, date: 2, professionals_and_time: 3, confirmation: 4 };
              const currentOrder = stepOrder[currentStep];
              const thisOrder = idx + 1;
              const isPassed = thisOrder < currentOrder;
              const isCurrent = thisOrder === currentOrder;

              return (
                <div key={st.key} className="flex flex-col gap-0.5">
                  <span className={`text-[8px] sm:text-[9.5px] font-bold uppercase tracking-wider text-center whitespace-nowrap ${
                    isCurrent
                      ? isDark ? 'text-emerald-400' : 'text-[#087A2A]'
                      : isPassed
                      ? isDark ? 'text-slate-300' : 'text-slate-600'
                      : isDark ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    {st.label}
                  </span>
                  <div
                    className={`h-1.5 rounded transition-all duration-300 ${
                      isCurrent
                        ? 'bg-[#20C933] shadow-sm shadow-emerald-500/50'
                        : isPassed
                        ? 'bg-emerald-600'
                        : isDark
                        ? 'bg-slate-800'
                        : 'bg-slate-200'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {/* ============================================================ */}
          {/* ETAPA 1: SELEÇÃO DE SERVIÇO (CARDS MODERNOS & ACOLHEDORES) */}
          {/* ============================================================ */}
          {currentStep === 'service' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Lista Moderna de Serviços (Cards Independentes & Acolhedores) */}
              <div className="space-y-2">
                {services.map((srv) => {
                  const isSelected = selectedServices.some((s) => s.id === srv.id);
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => {
                        toggleServiceSelection(srv);
                      }}
                      className={`w-full p-3 rounded transition-all flex items-center justify-between gap-3 text-left cursor-pointer border ${
                        isSelected
                          ? isDark
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-white shadow-xs'
                            : 'bg-emerald-50/80 border-emerald-500/50 text-slate-900 shadow-xs'
                          : isDark
                          ? 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 text-slate-200'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-xs'
                      }`}
                    >
                      {/* Lado Esquerdo: Checkbox suave + Informações do Serviço */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all border ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : isDark
                            ? 'border-slate-700 bg-slate-950'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-white" />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className={`text-xs font-bold leading-snug truncate ${
                            isSelected 
                              ? isDark ? 'text-emerald-400' : 'text-emerald-800'
                              : isDark ? 'text-white' : 'text-slate-900'
                          }`}>
                            {srv.title}
                          </h4>

                          <div className="flex items-center gap-2 mt-1 text-[10px]">
                            {srv.category && (
                              <span className={`font-medium truncate ${
                                isDark ? 'text-slate-400' : 'text-slate-500'
                              }`}>
                                {srv.category}
                              </span>
                            )}
                            {srv.category && (
                              <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>•</span>
                            )}
                            <span className={`inline-flex items-center gap-1 font-medium ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              <Clock className="w-3 h-3 text-emerald-400" />
                              <span>{srv.duration}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Lado Direito: Valor em Destaque */}
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
          )}

          {/* ============================================================ */}
          {/* ETAPA 2: SOMENTE A AGENDA / CALENDÁRIO MENSAL */}
          {/* ============================================================ */}
          {currentStep === 'date' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Conteúdo do Calendário (Totalmente bloqueado se selectedService for null) */}
              <div className={`space-y-3 transition-all ${
                !selectedService ? 'pointer-events-none opacity-40 select-none grayscale-[50%]' : ''
              }`}>
                {/* Header do Mês com Controles (sem caixa/borda) */}
                <div className="flex items-center justify-between px-1 py-1">
                  <button
                    disabled={!selectedService}
                    onClick={handlePrevMonth}
                    className={`p-2 rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
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
                    disabled={!selectedService}
                    onClick={handleNextMonth}
                    className={`p-2 rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Grid dos Dias da Semana */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                    <div key={day} className={`text-[10px] font-bold py-1 uppercase ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      {day}
                    </div>
                  ))}

                  {/* Dias do Mês em Grade */}
                  {monthData.daysGrid.map((item, index) => {
                    if (item.dayNumber === null) {
                      return <div key={`empty-${index}`} className="h-10" />;
                    }

                    const isSelected = selectedService && selectedDateIso === item.isoString;
                    const isDayDisabled = !selectedService || item.isDisabled;

                    return (
                      <button
                        key={item.isoString || index}
                        disabled={isDayDisabled}
                        onClick={() => {
                          if (item.isoString && selectedService) {
                            hapticLight();
                            setSelectedDateIso(item.isoString);
                            setSelectedTimeSlot(null);
                          }
                        }}
                        className={`h-11 rounded font-bold text-xs transition-all relative flex flex-col items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#20C933] text-white font-black drop-shadow-xs shadow-lg shadow-emerald-500/30 scale-105 z-10'
                            : isDayDisabled
                            ? isDark
                              ? 'bg-slate-950/40 text-slate-700 cursor-not-allowed border border-slate-900/50 opacity-40'
                              : 'bg-slate-100/50 text-slate-300 cursor-not-allowed border border-slate-200/40 opacity-40'
                            : isDark
                            ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-emerald-500/40'
                            : 'bg-slate-50 hover:bg-emerald-50/50 text-slate-800 border border-slate-200 hover:border-emerald-500/40'
                        }`}
                      >
                        <span>{item.dayNumber}</span>
                        {item.isToday && !isSelected && (
                          <span className={`text-[8px] font-black uppercase ${
                            isDark ? 'text-emerald-400' : 'text-[#087A2A]'
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
          {/* FASE 3: OS PROFISSIONAIS E ABAIXO A TABELA DE HORÁRIOS */}
          {/* ============================================================ */}
          {currentStep === 'professionals_and_time' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* BLOCO 1 DA FASE 3: SELEÇÃO DE PROFISSIONAIS */}
              <div className="space-y-1.5">
                {/* Opções de Profissionais em Carrossel Horizontal Enxuto */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
                  {/* Card Qualquer Profissional */}
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setSelectedProfessional('any');
                      setSelectedTimeSlot(null);
                    }}
                    className={`min-w-[110px] max-w-[120px] flex-shrink-0 p-1.5 px-2 rounded border text-left flex items-center gap-2 transition cursor-pointer ${
                      selectedProfessional === 'any'
                        ? isDark
                          ? 'bg-emerald-950/90 border-[#20C933] text-white shadow-sm shadow-emerald-500/20'
                          : 'bg-emerald-50 border-[#20C933] text-slate-900 shadow-sm shadow-emerald-500/10'
                        : isDark
                        ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${
                      selectedProfessional === 'any'
                        ? 'bg-[#20C933] text-white font-bold drop-shadow-xs'
                        : isDark
                        ? 'bg-emerald-600/30 text-[#20C933]'
                        : 'bg-emerald-100 text-[#087A2A]'
                    }`}>
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-bold truncate">Qualquer</span>
                  </button>

                  {/* Cards Individuais da Equipe */}
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
                        className={`min-w-[110px] max-w-[125px] flex-shrink-0 p-1.5 px-2 rounded border text-left flex items-center gap-2 transition cursor-pointer ${
                          isSelected
                            ? isDark
                              ? 'bg-emerald-950/90 border-[#20C933] text-white shadow-sm shadow-emerald-500/20'
                              : 'bg-emerald-50 border-[#20C933] text-slate-900 shadow-sm shadow-emerald-500/10'
                            : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={prof.avatar}
                          alt={prof.name}
                          className="w-6 h-6 rounded object-cover ring-1 ring-emerald-500/30 flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <h5 className={`text-[11px] font-bold truncate leading-tight ${
                            isSelected
                              ? isDark ? 'text-white' : 'text-slate-900'
                              : isDark ? 'text-slate-200' : 'text-slate-800'
                          }`}>
                            {prof.name}
                          </h5>
                          <div className="flex items-center gap-0.5 text-[9px] text-amber-500 leading-tight">
                            <Star className="w-2.5 h-2.5 fill-amber-500" />
                            <span>{prof.rating.toFixed(1)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BLOCO 2 DA FASE 2: TABELA DE HORÁRIOS (ULTRA COMPACTA) */}
              <div className={`pt-2 border-t space-y-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-1">
                  <h4 className={`text-[11px] font-bold font-['Poppins'] flex items-center gap-1 uppercase tracking-wider truncate ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    <Clock className="w-3.5 h-3.5 text-[#20C933] flex-shrink-0" />
                    <span>Horários</span>
                  </h4>
                  
                  {/* Filtro de Turnos */}
                  <div className={`flex items-center gap-0.5 p-0.5 rounded border flex-shrink-0 ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
                  }`}>
                    {(['todos', 'manha', 'tarde', 'noite'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setTimePeriodFilter(period)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold capitalize transition ${
                          timePeriodFilter === period
                            ? 'bg-[#20C933] text-white font-bold drop-shadow-xs'
                            : isDark
                            ? 'text-slate-400 hover:text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grade da Tabela de Horários - 4 Colunas Ultra Enxutas */}
                <div className="grid grid-cols-4 gap-1.5">
                  {filteredSlots.map((slot) => {
                    const isSelected = selectedTimeSlot === slot.time;
                    const isAvailable = slot.available;

                    return (
                      <button
                        key={slot.time}
                        disabled={!isAvailable}
                        onClick={() => {
                          hapticLight();
                          setSelectedTimeSlot((prev) => (prev === slot.time ? null : slot.time));
                        }}
                        className={`py-1.5 px-1 rounded text-xs font-bold border transition flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-[#20C933] border-[#20C933] text-white font-black drop-shadow-xs shadow-sm shadow-emerald-500/30'
                            : !isAvailable
                            ? isDark
                              ? 'bg-slate-900/30 border-slate-900 text-slate-600 line-through opacity-40 cursor-not-allowed'
                              : 'bg-slate-100/50 border-slate-200 text-slate-300 line-through opacity-40 cursor-not-allowed'
                            : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-200 hover:border-emerald-500 hover:text-white'
                            : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500 hover:text-emerald-700 shadow-2xs'
                        }`}
                      >
                        <Clock className={`w-3 h-3 ${isSelected ? 'text-white' : isAvailable ? 'text-[#20C933]' : isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                        <span>{slot.time}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* FASE 4: CONFIRMAÇÃO DO AGENDAMENTO (CARD ÚNICO E OBJETIVO) */}
          {/* ============================================================ */}
          {currentStep === 'confirmation' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              {/* Card Único e Limpo de Resumo do Atendimento */}
              <div className={`p-4 border rounded space-y-3 shadow-sm transition-colors ${
                isDark ? 'bg-slate-900 border-emerald-500/40' : 'bg-slate-50 border-emerald-500/30'
              }`}>
                <div className={`flex items-center justify-between pb-2.5 border-b ${
                  isDark ? 'border-slate-800' : 'border-slate-200'
                }`}>
                  <span className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isDark ? 'text-emerald-400' : 'text-[#087A2A]'
                  }`}>
                    <CheckCircle2 className="w-4 h-4 text-[#20C933]" />
                    <span>Resumo do Agendamento</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    isDark ? 'text-slate-300 bg-slate-800' : 'text-slate-700 bg-slate-200'
                  }`}>
                    Pagamento no Local
                  </span>
                </div>

                <div className="text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Scissors className="w-3.5 h-3.5 text-[#20C933]" /> Serviço:
                    </span>
                    <span className={`font-bold text-right ${isDark ? 'text-white' : 'text-slate-900'}`}>{selectedService?.title || 'Serviço Selecionado'}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Building2 className="w-3.5 h-3.5 text-[#20C933]" /> Estabelecimento:
                    </span>
                    <span className={`font-bold text-right ${isDark ? 'text-white' : 'text-slate-900'}`}>{salonName}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      <User className="w-3.5 h-3.5 text-[#20C933]" /> Profissional:
                    </span>
                    <span className={`font-bold text-right ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {selectedProfessional === 'any' ? resolvedProfessionalName : selectedProfessional}
                    </span>
                  </div>

                  <div className={`flex justify-between items-center pt-2.5 border-t ${
                    isDark ? 'border-slate-800' : 'border-slate-200'
                  }`}>
                    <span className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Total a pagar:</span>
                    <span className={`font-black text-lg ${isDark ? 'text-emerald-400' : 'text-[#087A2A]'}`}>R$ {selectedService?.price ? selectedService.price.toFixed(0) : '0'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ============================================================ */}
        {/* RODAPÉ FIXO: BOTÃO DE AÇÃO / CONFIRMAÇÃO SEMPRE VISÍVEL */}
        {/* ============================================================ */}
        <div className={`px-3.5 py-2.5 border-t shrink-0 sticky bottom-0 z-20 transition-colors ${
          isDark
            ? 'bg-[#151A1E]/95 border-slate-800 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.4)]'
            : 'bg-white/95 border-slate-200 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.05)]'
        }`}>
          {currentStep === 'service' && (
            <button
              id="btn-avancar-data"
              disabled={selectedServices.length === 0}
              onClick={() => {
                if (selectedServices.length > 0) {
                  hapticMedium();
                  setCurrentStep('date');
                }
              }}
              className={`w-full py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded transition flex items-center justify-center gap-1.5 shadow-sm ${
                selectedServices.length > 0
                  ? 'bg-[#20C933] hover:bg-[#1bb32d] text-white cursor-pointer shadow-emerald-500/20 active:scale-98'
                  : isDark
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              <span>
                {selectedServices.length > 1
                  ? `Avançar para Data (${selectedServices.length} serviços • R$ ${selectedServices.reduce((acc, s) => acc + s.price, 0)})`
                  : selectedServices.length === 1
                  ? `Avançar para Data (1 serviço • R$ ${selectedServices[0].price})`
                  : 'Selecione ao menos 1 serviço'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            </button>
          )}

          {currentStep === 'date' && (
            <button
              id="btn-avancar-horarios"
              disabled={!selectedService || !selectedDateIso}
              onClick={() => {
                if (selectedService && selectedDateIso) {
                  hapticMedium();
                  setCurrentStep('professionals_and_time');
                }
              }}
              className={`w-full py-2.5 px-4 font-black text-xs uppercase tracking-wider rounded transition flex items-center justify-center gap-1.5 font-['Poppins'] shadow-md drop-shadow-xs ${
                selectedService && selectedDateIso
                  ? 'bg-[#20C933] hover:bg-[#1bb32d] text-white cursor-pointer shadow-emerald-500/20 active:scale-98'
                  : isDark
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              <span>Avançar para Horários ({shortDateFormatted})</span>
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            </button>
          )}

          {currentStep === 'professionals_and_time' && (
            <button
              id="btn-avancar-confirmacao"
              disabled={!selectedTimeSlot}
              onClick={() => {
                if (selectedTimeSlot) {
                  hapticMedium();
                  setCurrentStep('confirmation');
                }
              }}
              className={`w-full py-2.5 px-4 font-black text-xs uppercase tracking-wider rounded transition flex items-center justify-center gap-1.5 font-['Poppins'] shadow-md drop-shadow-xs ${
                selectedTimeSlot
                  ? 'bg-[#20C933] hover:bg-[#1bb32d] text-white cursor-pointer shadow-emerald-500/20 active:scale-98'
                  : isDark
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              <span>
                {selectedTimeSlot
                  ? `Avançar para Confirmação (${selectedTimeSlot})`
                  : 'Selecione um horário disponível'}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-white" />
            </button>
          )}

          {currentStep === 'confirmation' && (
            <button
              id="btn-confirmar-agendamento-final"
              onClick={handleConfirmFinal}
              className="w-full py-2.5 px-4 bg-[#20C933] hover:bg-[#1bb32d] active:scale-98 text-white drop-shadow-xs font-black text-xs uppercase tracking-wider rounded transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer font-['Poppins']"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Confirmar Agendamento</span>
            </button>
          )}
        </div>
    </div>
  );

  if (inline) {
    return bookingContent;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      {bookingContent}
    </div>
  );
};

