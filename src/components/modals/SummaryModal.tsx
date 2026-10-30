/**
 * Modal de Resumo + Confirmação Final
 * VagouApp Meu Negócio
 */

import React, { useMemo } from 'react';
import { Scissors, User, Users, Building2, Calendar, Clock, MapPin, Phone, CheckCircle2, AlertCircle, Check, X, RotateCcw, Bookmark, ExternalLink, Navigation, Car, Bike, Bus, Smartphone, Star } from 'lucide-react';
import type { CatalogServiceItem, TransportMode } from '../../types/booking';
import { TRANSPORT_MODE_META, formatDistanceKm, formatMaxDepartureTime, formatEtaMinutes, buildTransportDeepLinks } from '../../services/transportService';
import { hapticLight, hapticMedium, hapticSuccess } from '../../utils/haptics';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedService: CatalogServiceItem | null;
  selectedTimeSlot: string | null;
  selectedDateIso: string;
  shortDateFormatted: string;
  isDependentBooking: boolean;
  dependentName: string;
  dependentId: string;
  salonName: string;
  salonAddress: string;
  resolvedProfessionalName: string;
  selectedProfessional: string;
  transport: {
    resolvedRoute: {
      formattedAddress: string;
      distanceKm: number;
      etaMinutes: number;
      originCoords: { lat: number; lng: number };
      salonCoords: { lat: number; lng: number };
    } | null;
    transportMode: TransportMode;
    maxDepartureTime: string | null;
  };
  beneficiary: {
    isDependentBooking: boolean;
    dependentName: string;
    dependentId: string;
    openBeneficiaryModal: () => void;
  };
  origin: {
    isOpen: () => void;
  };
  clientPhoneInput: string;
  setClientPhoneInput: (v: string) => void;
  bookingErrorMessage: string;
  setBookingErrorMessage: (v: string) => void;
  draftSavedFeedback: string | null;
  setDraftSavedFeedback: (v: string | null) => void;
  isSubmittingBooking: boolean;
  onSaveAsDraft: () => void;
  onConfirmFinal: (bypassAuth?: boolean) => Promise<void>;
  onClose: () => void;
}

const formatEta = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} ${h === 1 ? 'hora' : 'horas'} e ${String(m).padStart(2, '0')} min` : `${m} min`;
};

export const SummaryModal: React.FC<SummaryModalProps> = ({
  isOpen,
  onClose,
  selectedService,
  selectedTimeSlot,
  selectedDateIso,
  shortDateFormatted,
  isDependentBooking,
  dependentName,
  dependentId,
  salonName,
  salonAddress,
  resolvedProfessionalName,
  selectedProfessional,
  transport,
  beneficiary,
  origin,
  clientPhoneInput,
  setClientPhoneInput,
  bookingErrorMessage,
  setBookingErrorMessage,
  draftSavedFeedback,
  setDraftSavedFeedback,
  isSubmittingBooking,
  onSaveAsDraft,
  onConfirmFinal,
}) => {
  if (!isOpen || !selectedService || !selectedTimeSlot) return null;

  const transportLinks = useMemo(() => {
    if (!transport.resolvedRoute) return null;
    return buildTransportDeepLinks({
      originAddress: transport.resolvedRoute.formattedAddress,
      originLat: transport.resolvedRoute.originCoords.lat,
      originLng: transport.resolvedRoute.originCoords.lng,
      salonName,
      salonAddress,
      salonLat: transport.resolvedRoute.salonCoords.lat,
      salonLng: transport.resolvedRoute.salonCoords.lng,
      transportMode: transport.transportMode,
    });
  }, [transport.resolvedRoute, salonName, salonAddress, transport.transportMode]);

  const maxDepartureTime = transport.maxDepartureTime || (transport.resolvedRoute ? formatMaxDepartureTime(selectedTimeSlot, transport.resolvedRoute.etaMinutes) : '--H--');
  const formattedDistance = transport.resolvedRoute ? formatDistanceKm(transport.resolvedRoute.distanceKm) : '--';
  const formattedEta = transport.resolvedRoute ? formatEta(transport.resolvedRoute.etaMinutes) : '--';

  const formatEta = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h} ${h === 1 ? 'hora' : 'horas'} e ${String(m).padStart(2, '0')} min` : `${m} min`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="w-full max-w-md my-auto border rounded-[4px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <h3 className="text-sm font-extrabold font-['Poppins'] leading-snug">Resumo do Agendamento</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-[4px] flex items-center justify-center transition cursor-pointer shrink-0 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto no-scrollbar text-xs">
          <div className="space-y-2">
            <div className="flex justify-between items-start gap-2">
              <span className="flex items-center gap-1.5 text-slate-500 shrink-0">
                <Scissors className="w-3.5 h-3.5 text-emerald-500" /> Serviço:
              </span>
              <span className="font-bold text-right break-words">{selectedService.title}</span>
            </div>

            <div className="flex justify-between items-start gap-2">
              <span className="flex items-center gap-1.5 text-slate-500 shrink-0">
                {isDependentBooking ? <Users className="w-3.5 h-3.5 text-emerald-500" /> : <User className="w-3.5 h-3.5 text-emerald-500" />}
                Beneficiário:
              </span>
              <button
                type="button"
                onClick={() => { onClose(); beneficiary.openBeneficiaryModal(); }}
                className="font-bold text-emerald-500 hover:underline cursor-pointer text-right break-words"
              >
                {isDependentBooking && dependentName ? `${dependentName} (Dependente)` : 'Para Você (Titular)'}
              </button>
            </div>

            <div className="flex justify-between items-start gap-2">
              <span className="flex items-center gap-1.5 text-slate-500 shrink-0">
                <Building2 className="w-3.5 h-3.5 text-emerald-500" /> Estabelecimento:
              </span>
              <span className="font-bold text-right break-words">{salonName}</span>
            </div>

            <div className="flex justify-between items-start gap-2">
              <span className="flex items-center gap-1.5 text-slate-500 shrink-0">
                <User className="w-3.5 h-3.5 text-emerald-500" /> Profissional:
              </span>
              <span className="font-bold text-right break-words">
                {selectedProfessional === 'any' ? resolvedProfessionalName : selectedProfessional}
              </span>
            </div>

            <div className="flex justify-between items-center gap-2">
              <span className="flex items-center gap-1.5 text-slate-500 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Data e Horário:
              </span>
              <span className="font-extrabold text-emerald-500 text-right">
                {shortDateFormatted} às {selectedTimeSlot}
              </span>
            </div>

            {transport.resolvedRoute && (
              <div className="p-3 rounded-[4px] space-y-2.5 mt-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-emerald-500 leading-snug break-words flex-1">
                    {transport.resolvedRoute.formattedAddress}
                  </span>
                  <button
                    type="button"
                    onClick={() => { onClose(); origin.isOpen(); }}
                    className="text-[10px] font-bold text-emerald-500 hover:underline shrink-0 cursor-pointer"
                  >
                    Alterar origem
                  </button>
                </div>

                <div className="space-y-1 font-bold text-xs">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Distância de {transport.resolvedRoute.distanceKm.toFixed(1).replace('.', ',')} km</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {transport.transportMode === 'motorcycle' ? <Bike className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> :
                     transport.transportMode === 'transit' ? <Bus className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> :
                     transport.transportMode === 'rideshare' ? <Smartphone className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> :
                     <Car className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    <span>
                      Trajeto de {formatEta(transport.resolvedRoute.etaMinutes)} ({TRANSPORT_MODE_META[transport.transportMode].shortLabel})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>
                      Horário Máx. de saída <strong className="text-emerald-500">{maxDepartureTime}</strong>
                    </span>
                  </div>
                </div>

                {transportLinks && (
                  <div className="pt-1 space-y-1.5">
                    {transport.transportMode === 'transit' && transportLinks && (
                      <a
                        href={transportLinks.googleMapsTransitUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-3 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer text-center"
                      >
                        <Bus className="w-3.5 h-3.5 text-white shrink-0" />
                        <span className="text-white">Ver Linhas e Baldeações no Maps</span>
                        <ExternalLink className="w-3 h-3 text-white shrink-0" />
                      </a>
                    )}

                    {(transport.transportMode === 'car' || transport.transportMode === 'motorcycle') && transportLinks && (
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={transportLinks.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-2.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer text-center"
                        >
                          <MapPin className="w-3.5 h-3.5 text-white shrink-0" />
                          <span className="text-white">Maps ({transport.transportMode === 'motorcycle' ? 'Moto' : 'Carro'})</span>
                          <ExternalLink className="w-3 h-3 text-white shrink-0" />
                        </a>
                        <a
                          href={transportLinks.wazeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-2.5 rounded-[4px] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer text-center bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                          <Navigation className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Abrir no Waze</span>
                          <ExternalLink className="w-3 h-3 text-emerald-500 shrink-0" />
                        </a>
                      </div>
                    )}

                    {transport.transportMode === 'rideshare' && transportLinks && (
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={transportLinks.uberUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-2.5 rounded-[4px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer text-center"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-white shrink-0" />
                          <span className="text-white">Chamar Uber</span>
                          <ExternalLink className="w-3 h-3 text-white shrink-0" />
                        </a>
                        <a
                          href={transportLinks.app99Url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-2.5 rounded-[4px] font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer text-center bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-800"
                        >
                          <Car className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Chamar 99</span>
                          <ExternalLink className="w-3 h-3 text-amber-500 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-500">Total a pagar no local:</span>
              <span className="font-black text-base text-emerald-500">
                R$ {selectedService.price.toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          {bookingErrorMessage && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-[4px] text-rose-500 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{bookingErrorMessage}</span>
            </div>
          )}

          {draftSavedFeedback && (
            <div className="p-2.5 bg-emerald-500 text-white rounded-[4px] text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-white shrink-0" />
              <span className="text-white">{draftSavedFeedback}</span>
            </div>
          )}
        </div>

        <div className="p-3.5 border-t sticky bottom-0 z-20 space-y-2 bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 backdrop-blur-md">
          <button
            id="btn-confirmar-agendamento-final"
            type="button"
            disabled={isSubmittingBooking}
            onClick={() => onConfirmFinal(false)}
            className={`w-full py-3 px-4 font-black text-xs uppercase tracking-wider rounded-[4px] transition flex items-center justify-center gap-2 font-['Poppins'] ${
              isSubmittingBooking
                ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-wait'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer active:scale-98'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span className="text-white">{isSubmittingBooking ? 'Confirmando...' : 'Confirmar Agendamento'}</span>
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onSaveAsDraft}
              className="py-2.5 px-2 rounded-[4px] border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer bg-amber-50 dark:bg-amber-900 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800"
              title="Salva o rascunho para concluir depois (não trava a vaga)"
            >
              <Bookmark className="w-3.5 h-3.5 shrink-0" />
              <span>Pré-Salvar</span>
            </button>

            <button
              type="button"
              onClick={() => { hapticLight(); onClose(); }}
              className="py-2.5 px-2 rounded-[4px] border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span>Revisar</span>
            </button>

            <button
              type="button"
              onClick={() => { hapticLight(); onClose(); setBookingErrorMessage(''); setSelectedTimeSlot(null); }}
              className="py-2.5 px-2 rounded-[4px] border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer bg-rose-50 dark:bg-rose-900 border-rose-200 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-800"
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              <span>Cancelar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};