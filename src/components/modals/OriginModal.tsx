/**
 * Modal de Origem + Seleção de Transporte
 * VagouApp Meu Negócio
 */

import React, { useMemo } from 'react';
import { Car, Bike, Bus, Smartphone, Home, MapPin, ArrowLeft, X, Navigation, Search, Loader2, Check } from 'lucide-react';
import type { TransportMode } from '../../types/booking';
import { TRANSPORT_MODE_META, formatEtaMinutes, formatDistanceKm, formatMaxDepartureTime } from '../../services/transportService';
import { hapticLight, hapticMedium } from '../../utils/haptics';

interface OriginModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedService: { title: string } | null;
  originAddress: string;
  setOriginAddress: (v: string) => void;
  originCoords: { lat: number; lng: number } | null;
  transportMode: TransportMode;
  setTransportMode: (v: TransportMode) => void;
  distanceKm: number;
  etaMinutes: number;
  resolvedAddressLabel: string;
  isCalculatingRoute: boolean;
  runRouteCalculation: (origin: string, dest: string, mode?: TransportMode) => Promise<void>;
  salonDestQuery: string;
  hasCalculatedCustomCep: boolean;
  customCepInput: string;
  setCustomCepInput: (v: string) => void;
  originModalMode: 'choice' | 'custom_cep';
  setOriginModalMode: (v: 'choice' | 'custom_cep') => void;
  originType: 'home' | 'other';
  setOriginType: (v: 'home' | 'other') => void;
  skipDateStep: boolean;
  setOriginModalMode: (v: 'choice' | 'custom_cep') => void;
  setIsOriginModalOpen: (v: boolean) => void;
}

const TRANSPORT_OPTIONS: Array<{ key: TransportMode; label: string; Icon: React.ElementType }> = [
  { key: 'car', label: 'Carro', Icon: Car },
  { key: 'motorcycle', label: 'Moto', Icon: Bike },
  { key: 'transit', label: 'Transporte Público', Icon: Bus },
  { key: 'rideshare', label: 'Uber / 99', Icon: Smartphone },
];

export const OriginModal: React.FC<OriginModalProps> = ({
  isOpen,
  onClose,
  selectedService,
  originAddress,
  setOriginAddress,
  originCoords,
  transportMode,
  setTransportMode,
  distanceKm,
  etaMinutes,
  resolvedAddressLabel,
  isCalculatingRoute,
  runRouteCalculation,
  salonDestQuery,
  hasCalculatedCustomCep,
  customCepInput,
  setCustomCepInput,
  originModalMode,
  setOriginModalMode,
  originType,
  setOriginType,
  skipDateStep,
  setOriginModalMode: _setOriginModalMode,
  setIsOriginModalOpen,
}) => {
  if (!isOpen || !selectedService) return null;

  const originHours = Math.floor(etaMinutes / 60);
  const originRemainderMinutes = etaMinutes % 60;
  const formattedEta = `${originHours} ${originHours === 1 ? 'hora' : 'horas'} e ${String(originRemainderMinutes).padStart(2, '0')} min`;
  const formattedDistance = formatDistanceKm(distanceKm);

  const maxDepartureTime = useMemo(() => {
    // Será preenchido pelo parent quando timeSlot existir
    return '--H--';
  }, []);

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

  const formatEtaHoursAndMinutes = useMemo(() => {
    const h = Math.floor(etaMinutes / 60);
    const m = etaMinutes % 60;
    return `${h} ${h === 1 ? 'hora' : 'horas'} e ${String(m).padStart(2, '0')} min`;
  }, [etaMinutes]);

  const formattedDistanceComma = useMemo(() => formatDistanceKm(distanceKm), [distanceKm]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-md my-auto border rounded-[4px] p-4 sm:p-5 shadow-2xl space-y-4 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
        <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {originModalMode === 'custom_cep' ? (
              <button
                type="button"
                onClick={() => { hapticLight(); setOriginModalMode('choice'); }}
                className="w-7 h-7 rounded-[4px] flex items-center justify-center transition cursor-pointer shrink-0 mt-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-500" />
              </button>
            ) : (
              <Navigation className="w-4 h-4 text-emerald-500 shrink-0 mt-1" />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold font-['Poppins'] leading-snug">
                {originModalMode === 'choice' ? 'De onde você vai sair?' : 'Saindo de Outro Local'}
              </h3>
              <p className="text-[11px] leading-snug mt-0.5 text-slate-500 dark:text-slate-400">
                {originModalMode === 'choice'
                  ? 'Ajustamos os horários conforme seu deslocamento.'
                  : 'Informe o CEP para calcularmos seu tempo de chegada.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-[4px] flex items-center justify-center transition cursor-pointer shrink-0 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {renderTransportGrid()}

        {originModalMode === 'choice' ? (
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider block leading-snug text-slate-600 dark:text-slate-300">
              Local de partida
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  setOriginType('home');
                  const savedHome = localStorage.getItem('vagou_user_cep') || localStorage.getItem('vagou_user_address') || '08235-770';
                  setOriginAddress(savedHome);
                  runRouteCalculation(savedHome, salonDestQuery, transportMode);
                  setIsOriginModalOpen(false);
                }}
                className={`p-3.5 rounded-[4px] border font-bold text-xs flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer ${
                  originType === 'home'
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:border-emerald-500/50'
                }`}
              >
                <Home className={`w-5 h-5 shrink-0 ${originType === 'home' ? 'text-white' : 'text-emerald-500'}`} />
                <span className={`leading-tight ${originType === 'home' ? 'text-white' : ''}`}>Saindo de Casa</span>
              </button>

              <button
                type="button"
                onClick={() => { hapticLight(); setOriginType('other'); setOriginModalMode('custom_cep'); }}
                className={`p-3.5 rounded-[4px] border font-bold text-xs flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer ${
                  originType === 'other'
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:border-emerald-500/50'
                }`}
              >
                <MapPin className={`w-5 h-5 shrink-0 ${originType === 'other' ? 'text-white' : 'text-emerald-500'}`} />
                <span className={`leading-tight ${originType === 'other' ? 'text-white' : ''}`}>Outro Local</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 animate-in fade-in duration-150">
            <form onSubmit={handleCalculateCustomCep} className="flex items-center gap-2">
              <div className="relative flex-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={customCepInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
                    setCustomCepInput(formatted);
                    if (digits.length === 8) {
                      setOriginAddress(formatted);
                      runRouteCalculation(formatted, salonDestQuery, transportMode).then(() => {
                        setHasCalculatedCustomCep(true);
                      });
                    } else {
                      setHasCalculatedCustomCep(false);
                    }
                  }}
                  placeholder="00000-000"
                  className="w-full pl-8 pr-3 py-2.5 text-xs rounded-[4px] border outline-hidden transition-colors bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isCalculatingRoute || customCepInput.replace(/\D/g, '').length < 8}
                className="py-2.5 px-3.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
              >
                {isCalculatingRoute ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white shrink-0" />
                ) : (
                  <Search className="w-3.5 h-3.5 text-white shrink-0" />
                )}
                <span className="text-white">Calcular</span>
              </button>
            </form>

            <p className={`text-xs leading-relaxed font-bold break-words ${
              hasCalculatedCustomCep && !isCalculatingRoute
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}>
              {isCalculatingRoute
                ? 'Localizando CEP...'
                : hasCalculatedCustomCep && resolvedAddressLabel
                ? resolvedAddressLabel
                : 'Digite o CEP de origem acima.'}
            </p>

            {hasCalculatedCustomCep && !isCalculatingRoute && (
              <div className="p-3 rounded-[4px] space-y-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Distância de {formattedDistanceComma} km</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {transportMode === 'motorcycle' ? <Bike className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> :
                   transportMode === 'transit' ? <Bus className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> :
                   transportMode === 'rideshare' ? <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> :
                   <Car className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  <span>Trajeto de {formatEtaHoursAndMinutes}</span>
                </div>
              </div>
            )}

            <div className="pt-1 sticky bottom-0 z-20">
              <button
                type="button"
                disabled={isCalculatingRoute || !hasCalculatedCustomCep}
                onClick={() => { hapticMedium(); setIsOriginModalOpen(false); }}
                className="w-full py-3 px-4 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Check className="w-4 h-4 text-white shrink-0" />
                <span className="text-white">Ver Horários Disponíveis</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function handleCalculateCustomCep(e: React.FormEvent) {
  e.preventDefault();
}