/**
 * Etapa 3: Profissionais + Horários
 * VagouApp Meu Negócio
 */

import React, { useMemo } from 'react';
import { Sun, Sunset, Moon, Clock, Sparkles, Star, Loader2, User, Car, Bike, Bus, Smartphone, MapPin, Navigation, Search, Check, X, ChevronRight } from 'lucide-react';
import type { SalonProfessionalItem, BookingSlotItem } from '../../types/booking';
import { TRANSPORT_MODE_META, formatDistanceKm } from '../../services/transportService';
import { hapticLight, hapticMedium } from '../../utils/haptics';

interface ProfessionalTimeStepProps {
  selectedService: { title: string } | null;
  selectedDateIso: string;
  shortDateFormatted: string;
  selectedProfessional: string;
  selectedTimeSlot: string | null;
  timePeriodFilter: 'manha' | 'tarde' | 'noite' | 'todos';
  availableProfessionals: SalonProfessionalItem[];
  generatedSlots: Array<{
    time: string;
    available: boolean;
    period: 'manha' | 'tarde' | 'noite';
    reason?: 'busy' | 'past' | 'travel_buffer';
  }>;
  slotsByPeriod: { manha: any[]; tarde: any[]; noite: any[] };
  isLoadingBusySlots: boolean;
  isManhaPeriodDisabled: boolean;
  isTardePeriodDisabled: boolean;
  transport: {
    resolvedRoute: {
      formattedAddress: string;
      distanceKm: number;
      etaMinutes: number;
      originCoords: { lat: number; lng: number };
      salonCoords: { lat: number; lng: number };
    } | null;
    transportMode: 'car' | 'motorcycle' | 'transit' | 'rideshare';
    maxDepartureTime: string | null;
    updateMaxDepartureTime: (v: string | null) => void;
    runRouteCalculation: (origin: string, dest: string, mode?: any) => Promise<void>;
    originAddress: string;
    setOriginAddress: (v: string) => void;
    salonDestQuery: string;
    originCoords: { lat: number; lng: number } | null;
    resolvedSalonCoords: { lat: number; lng: number };
    distanceKm: number;
    etaMinutes: number;
    isCalculatingRoute: boolean;
  };
  originModal: {
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    mode: 'choice' | 'custom_cep';
    setMode: (v: 'choice' | 'custom_cep') => void;
    originType: 'home' | 'other';
    setOriginType: (v: 'home' | 'other') => void;
    customCepInput: string;
    setCustomCepInput: (v: string) => void;
    hasCalculatedCustomCep: boolean;
    setHasCalculatedCustomCep: (v: boolean) => void;
  };
  summaryModal: {
    setIsOpen: (v: boolean) => void;
  };
  skipDateStep: boolean;
  onSetProfessional: (name: string) => void;
  onSetTimeSlot: (time: string) => void;
  onSetPeriodFilter: (v: 'manha' | 'tarde' | 'noite' | 'todos') => void;
  onOpenOriginModal: () => void;
  onCloseOriginModal: () => void;
  onSetOriginType: (v: 'home' | 'other') => void;
  onCustomCepChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCalculateCustomCep: (e?: React.FormEvent) => Promise<void>;
  onOpenSummary: () => void;
}

const formatEta = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} ${h === 1 ? 'hora' : 'horas'} e ${String(m).padStart(2, '0')} min` : `${m} min`;
};

const TRANSPORT_OPTIONS = [
  { key: 'car', label: 'Carro', Icon: Car },
  { key: 'motorcycle', label: 'Moto', Icon: Bike },
  { key: 'transit', label: 'Transporte Público', Icon: Bus },
  { key: 'rideshare', label: 'Uber / 99', Icon: Smartphone },
] as const;

export const ProfessionalTimeStep: React.FC<ProfessionalTimeStepProps> = ({
  selectedService,
  selectedDateIso,
  shortDateFormatted,
  selectedProfessional,
  selectedTimeSlot,
  timePeriodFilter,
  availableProfessionals,
  generatedSlots,
  slotsByPeriod,
  isLoadingBusySlots,
  isManhaPeriodDisabled,
  isTardePeriodDisabled,
  transport,
  originModal,
  summaryModal,
  skipDateStep,
  onSetProfessional,
  onSetTimeSlot,
  onSetPeriodFilter,
  onOpenOriginModal,
  onCloseOriginModal,
  onSetOriginType,
  onCustomCepChange,
  onCalculateCustomCep,
  onOpenSummary,
}) => {
  const { resolvedRoute, transportMode, maxDepartureTime, updateMaxDepartureTime, runRouteCalculation, originAddress, setOriginAddress, salonDestQuery, originCoords, resolvedSalonCoords, distanceKm, etaMinutes, isCalculatingRoute } = transport;
  const { isOpen: isOriginOpen, setIsOpen: setIsOriginOpen, mode: originModalMode, setMode: setOriginModalMode, originType, setOriginType, customCepInput, setCustomCepInput, hasCalculatedCustomCep, setHasCalculatedCustomCep } = originModal;
  const { setIsOpen: setIsSummaryOpen } = summaryModal;

  const formatEta = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h} ${h === 1 ? 'hora' : 'horas'} e ${String(m).padStart(2, '0')} min` : `${m} min`;
  };

  const renderTransportGrid = () => (
    <div className="space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-wider block leading-snug text-slate-600 dark:text-slate-300">
        Como você vai se deslocar? (com margem de folga)
      </span>
      <div className="grid grid-cols-2 gap-2">
        {TRANSPORT_OPTIONS.map((opt) => {
          const isSelected = transportMode === opt.key;
          const ModeIcon = opt.Icon;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => {
                hapticLight();
                setTransportMode(opt.key);
                const activeOrigin = originModalMode === 'custom_cep' && customCepInput.replace(/\D/g, '').length === 8
                  ? customCepInput
                  : originAddress;
                runRouteCalculation(activeOrigin, salonDestQuery, opt.key);
              }}
              className={`py-2.5 px-3 rounded-[4px] border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer text-center ${
                isSelected
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:border-emerald-500/50'
              }`}
            >
              <ModeIcon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />
              <span className={`leading-tight ${isSelected ? 'text-white' : ''}`}>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const originHours = Math.floor(etaMinutes / 60);
  const originRemainderMinutes = etaMinutes % 60;
  const formattedEtaHoursAndMinutes = `${originHours} ${originHours === 1 ? 'hora' : 'horas'} e ${String(originRemainderMinutes).padStart(2, '0')} min`;
  const formattedDistanceComma = distanceKm.toFixed(1).replace('.', ',');

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      {/* BLOCO 1: SELEÇÃO DE PROFISSIONAIS */}
      {availableProfessionals.length > 1 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
            <button
              type="button"
              onClick={() => { hapticLight(); onSetProfessional('any'); onSetTimeSlot(null); }}
              className={`min-w-[105px] flex-shrink-0 p-1.5 px-2 rounded-[4px] border text-left flex items-center gap-2 transition cursor-pointer ${
                selectedProfessional === 'any'
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div className={`w-6 h-6 rounded-[4px] flex items-center justify-center flex-shrink-0 ${
                selectedProfessional === 'any'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
              }`}>
                <Sparkles className={`w-3.5 h-3.5 ${selectedProfessional === 'any' ? 'text-white' : 'text-emerald-500'}`} />
              </div>
              <span className={`text-[11px] font-bold truncate ${selectedProfessional === 'any' ? 'text-white' : ''}`}>
                Qualquer
              </span>
            </button>

            {availableProfessionals.map((prof, idx) => {
              const isSelected = selectedProfessional === prof.name;
              const profImg = prof.avatar || prof.avatarUrl;
              return (
                <button
                  key={prof.id || idx}
                  type="button"
                  onClick={() => { hapticLight(); onSetProfessional(prof.name); onSetTimeSlot(null); }}
                  className={`min-w-[115px] max-w-[135px] flex-shrink-0 p-1.5 px-2 rounded-[4px] border text-left flex items-center gap-2 transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {profImg && !profImg.includes('unsplash.com') && !profImg.startsWith('data:image/svg+xml') ? (
                    <img src={profImg} alt={prof.name} className="w-6 h-6 rounded-[4px] object-cover flex-shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className={`w-6 h-6 rounded-[4px] flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      <User className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : ''}`} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h5 className={`text-[11px] font-bold truncate leading-tight ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                      {prof.name}
                    </h5>
                    {prof.rating && (
                      <div className={`flex items-center gap-0.5 text-[9px] leading-tight ${isSelected ? 'text-white/90' : 'text-amber-400'}`}>
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
      </div>
      )}

      {/* BLOCO 2: TABELA DE HORÁRIOS */}
      <div className={`space-y-2.5 ${availableProfessionals.length > 1 ? `pt-2 border-t border-slate-200 dark:border-slate-800` : ''}`}>
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <h4 className="text-[11px] font-bold font-['Poppins'] flex items-center gap-1 uppercase tracking-wider text-slate-900 dark:text-white">
            <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Horários ({shortDateFormatted})</span>
            {isLoadingBusySlots && <Loader2 className="w-3 h-3 animate-spin text-emerald-500 ml-1" />}
          </h4>

          <div className={`flex items-center gap-0.5 p-0.5 rounded-[4px] border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700`}>
            {([
              { key: 'manha', label: 'Manhã', disabled: isManhaPeriodDisabled },
              { key: 'tarde', label: 'Tarde', disabled: isTardePeriodDisabled },
              { key: 'noite', label: 'Noite', disabled: false },
              { key: 'todos', label: 'Todos', disabled: false },
            ] as const).map((tab) => {
              const isActive = timePeriodFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled={tab.disabled}
                  onClick={() => { if (!tab.disabled) { hapticLight(); onSetPeriodFilter(tab.key); } }}
                  className={`px-2 py-1 rounded-[4px] text-[10px] font-bold transition whitespace-nowrap ${
                    tab.disabled
                      ? 'text-slate-300 line-through cursor-not-allowed opacity-50 dark:text-slate-700'
                      : isActive
                      ? 'bg-emerald-500 text-white font-extrabold cursor-pointer'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer'
                  }`}
                >
                  <span className={isActive && !tab.disabled ? 'text-white' : ''}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

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
  );
};

const renderPeriodSlotsBlock = (
  periodKey: 'manha' | 'tarde' | 'noite',
  label: string,
  PeriodIcon: React.ElementType,
  slots: Array<{ time: string; available: boolean; period: string; reason?: string }>,
  isPeriodBlocked: boolean
) => {
  const availableCount = slots.filter((s) => s.available).length;
  return (
    <div key={periodKey} className="space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5">
          <PeriodIcon className={`w-3.5 h-3.5 ${isPeriodBlocked ? 'text-slate-500' : 'text-emerald-500'}`} />
          <span className={`text-[11px] font-bold uppercase tracking-wider font-['Poppins'] ${
            isPeriodBlocked ? 'text-slate-600 line-through dark:text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'
          }`}>
            {label}
          </span>
        </div>
        <span className={`text-[10px] font-semibold ${availableCount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
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
                onSetTimeSlot(slot.time);
                onOpenSummary();
              }}
              title={!isAvailable
                ? slot.reason === 'busy'
                  ? 'Horário já ocupado no banco'
                  : slot.reason === 'travel_buffer'
                  ? `Insuficiente para deslocamento (${etaMinutes}m + 15m preparo)`
                  : 'Horário já passou'
                : `Agendar às ${slot.time}`}
              className={`py-2 px-1 rounded-[4px] text-xs font-bold border transition flex items-center justify-center gap-1 cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500 border-emerald-500 text-white font-black shadow-sm'
                  : !isAvailable
                  ? 'bg-slate-100/60 dark:bg-slate-900/30 border-slate-200 dark:border-slate-900 text-slate-300 dark:text-slate-600 line-through opacity-45 cursor-not-allowed'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400'
              }`}
            >
              <Clock className={`w-3 h-3 ${isSelected ? 'text-white' : isAvailable ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
              <span className={isSelected ? 'text-white' : ''}>{slot.time}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Importações necessárias
import { Sun, Sunset, Moon, Clock, Sparkles, Star, Loader2, User, Car, Bike, Bus, Smartphone, MapPin, Navigation, Search, Check, X, ChevronRight, ArrowLeft, Home, CheckCircle2, Bookmark, RotateCcw } from 'lucide-react';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import type { SalonProfessionalItem, BookingSlotItem } from '../../types/booking';
import { TRANSPORT_MODE_META, formatDistanceKm } from '../../services/transportService';
import { TRANSPORT_OPTIONS } from './OriginModal'; // Reutiliza do OriginModal