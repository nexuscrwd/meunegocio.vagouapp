/**
 * Novo SalonBookingModal — Orquestrador Modular
 * VagouApp Meu Negócio
 * 
 * Substitui o arquivo monolítico de 2766 linhas por um orquestrador leve (~300 linhas)
 * que usa componentes separados: steps, modals, hooks, services.
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronRight, X, Scissors, Calendar, Clock, Sparkles, Star, Plus, Check, RotateCcw, Bookmark, CheckCircle2, AlertCircle, Phone, Users, User, Loader2 } from 'lucide-react';
import type { CatalogServiceItem, SalonProfessionalItem, BookingDraftItem, BookingSlotItem, TransportMode } from '../../types/booking';
import { useTheme } from '../../context/ThemeContext';
import { hapticLight, hapticMedium, hapticSuccess } from '../../utils/haptics';
import { formatMaxDepartureTime, formatDistanceKm, formatEtaMinutes } from '../../services/transportService';
import { PREP_BUFFER_MINUTES, STORAGE_KEYS } from '../../types/booking';

import { useBookingFlow } from '../../hooks/useBookingFlow';
import { ServiceSelectionStep } from '../steps/ServiceSelectionStep';
import { DateSelectionStep } from '../steps/DateSelectionStep';
import { ProfessionalTimeStep } from '../steps/ProfessionalTimeStep';
import { BeneficiaryModal } from '../modals/BeneficiaryModal';
import { OriginModal } from '../modals/OriginModal';
import { SummaryModal } from '../modals/SummaryModal';
import { ConfirmIntentModal } from '../modals/ConfirmIntentModal';
import { SalonClientAuthModal } from './SalonClientAuthModal';

interface SalonBookingModalProps {
  isOpen?: boolean;
  inline?: boolean;
  onClose?: () => void;
  salonId?: string;
  salonName: string;
  salonAddress?: string;
  salonCep?: string;
  salonSlug?: string;
  salonLogo?: string;
  salonLogoLight?: string;
  salonLogoDark?: string;
  salonCoords?: { lat: number; lng: number };
  primaryColor?: string;
  services: CatalogServiceItem[];
  professionals: SalonProfessionalItem[];
  initialService?: CatalogServiceItem | null;
  bookingTrigger?: number;
  resumeDraft?: BookingDraftItem | null;
  baseOffer?: { id: string };
  skipDateStep?: boolean;
  initialTimeSlot?: string | null;
  initialDateIso?: string;
  preSelectedProfessionalName?: string;
  onDraftSaved?: (draft: BookingDraftItem | null) => void;
  onBeneficiaryState?: (state: {
    isDependentBooking: boolean;
    dependentName: string;
    selectedService: CatalogServiceItem | null;
    openBeneficiaryModal: () => void;
  }) => void;
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
    uiTransportMode?: TransportMode;
    maxDepartureTime?: string;
    originFormattedAddress?: string;
    originLat?: number;
    originLng?: number;
    salonLat?: number;
    salonLng?: number;
    selectedRouteSummary?: string;
  }) => Promise<{ success: boolean; error?: string } | void> | void;
}

type Step = 'service' | 'date' | 'professionals_and_time';

const TODAY_ISO = new Date().toISOString().split('T')[0];

export const SalonBookingModal: React.FC<SalonBookingModalProps> = ({
  isOpen = true,
  inline = false,
  onClose,
  salonId = '',
  salonName,
  salonAddress = '',
  salonCep = '',
  salonSlug = '',
  salonLogo,
  salonLogoLight,
  salonLogoDark,
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
  onBeneficiaryState,
  onConfirmAppointment,
}) => {
  const { isDark } = useTheme();

  // ============================================================================
  // HOOK DE FLUXO DE AGENDAMENTO (estado + ações)
  // ============================================================================
  const {
    currentStep,
    setCurrentStep,
    isLoading,
    error,
    clearError,
    resetFlow,
    
    // Serviços
    selectedServices,
    selectedService,
    isAddingExtraServices,
    groupedServices,
    toggleService,
    setAddingExtraServices,
    promptScheduleService,
    
    // Data
    selectedDateIso,
    setSelectedDateIso,
    currentViewMonth,
    monthData,
    handlePrevMonth,
    handleNextMonth,
    todayIso,
    
    // Profissionais + Horários
    selectedProfessional,
    setSelectedProfessional,
    selectedTimeSlot,
    setSelectedTimeSlot,
    timePeriodFilter,
    setTimePeriodFilter,
    generatedSlots,
    slotsByPeriod,
    availableProfessionals,
    isLoadingBusySlots,
    isManhaPeriodDisabled,
    isTardePeriodDisabled,
    
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
    resetFlow: resetFlowHook,
  } = useBookingFlow({
    salonId,
    salonName,
    salonAddress,
    salonCep,
    salonSlug,
    salonCoords,
    primaryColor,
    services,
    professionals,
    initialService,
    initialDateIso,
    initialTimeSlot,
    preSelectedProfessionalName,
    resumeDraft,
    skipDateStep,
    onDraftSaved,
    onConfirmAppointment,
    onClose,
    onBeneficiaryState,
  });

  // ============================================================================
  // EFEITOS DE ENTRADA (deep link, rascunho, etc.)
  // ============================================================================
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
          openSummaryModal();
        } else {
          setConfirmIntentState({ isOpen: true, pendingService: initialService });
        }
      }
    }
  }, [bookingTrigger, initialService, skipDateStep, initialTimeSlot, initialDateIso]);

  // ============================================================================
  // ESTADO LOCAL DE MODAIS (que o hook não gerencia)
  // ============================================================================
  const [confirmIntentState, setConfirmIntentState] = useState<{ isOpen: boolean; pendingService: CatalogServiceItem | null }>({
    isOpen: false,
    pendingService: null,
  });

  const setConfirmIntentState = useCallback((updater: any) => {
    setConfirmIntentState(prev => typeof updater === 'function' ? updater(prev) : updater);
  }, []);

  // ============================================================================
  // RENDER CONDICIONAL POR STEP
  // ============================================================================
  const stepContent = currentStep === 'service' ? (
    <ServiceSelectionStep
      services={services}
      selectedServices={selectedServices}
      isAddingExtraServices={isAddingExtraServices}
      groupedServices={groupedServices}
      onToggleService={toggleService}
      onAddExtraServices={() => setAddingExtraServices(false)}
      onPromptSchedule={promptScheduleService}
    />
  ) : currentStep === 'date' ? (
    <DateSelectionStep
      selectedService={selectedService}
      selectedDateIso={selectedDateIso}
      currentViewMonth={currentViewMonth}
      monthData={monthData}
      todayIso={todayIso}
      onPrevMonth={handlePrevMonth}
      onNextMonth={handleNextMonth}
      onSelectDate={setSelectedDateIso}
      skipDateStep={skipDateStep}
      onOpenOriginModal={openOriginModal}
    />
  ) : (
    <ProfessionalTimeStep
      selectedService={selectedService}
      selectedDateIso={selectedDateIso}
      shortDateFormatted={`${selectedDateIso.split('-')[2]}/${selectedDateIso.split('-')[1]}`}
      selectedProfessional={selectedProfessional}
      selectedTimeSlot={selectedTimeSlot}
      timePeriodFilter={timePeriodFilter}
      availableProfessionals={availableProfessionals}
      generatedSlots={generatedSlots}
      slotsByPeriod={slotsByPeriod}
      isLoadingBusySlots={isLoadingBusySlots}
      isManhaPeriodDisabled={isManhaPeriodDisabled}
      isTardePeriodDisabled={isTardePeriodDisabled}
      transport={transport}
      originModal={origin}
      summaryModal={{ setIsOpen: openSummaryModal }}
      skipDateStep={skipDateStep}
      onSetProfessional={setSelectedProfessional}
      onSetTimeSlot={setSelectedTimeSlot}
      onSetPeriodFilter={setTimePeriodFilter}
      onOpenOriginModal={openOriginModal}
      onCloseOriginModal={closeOriginModal}
      onSetOriginType={setOriginType}
      onCustomCepChange={handleCustomCepChange}
      onCalculateCustomCep={calculateCustomCep}
      onOpenSummary={openSummaryModal}
    />
  );

  // ============================================================================
  // HEADER COM STEPPER
  // ============================================================================
  const header = (
    <div className={`px-3 py-2 border-b sticky top-0 z-10 transition-colors space-y-2 ${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-100/95 border-slate-200'}`}>
      <div className="flex items-center justify-between gap-2 min-h-7">
        <div className="flex items-center gap-2 min-w-0">
          {currentStep !== 'service' && (
            <button
              type="button"
              onClick={() => { hapticMedium(); if (currentStep === 'date') { setAddingExtraServices(true); setCurrentStep('service'); } else { setCurrentStep('date'); } }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-bold transition cursor-pointer shrink-0 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-800 hover:text-slate-950'}`}
              title="Voltar etapa"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Voltar</span>
            </button>
          )}

          {!inline && selectedService && (
            <button
              type="button"
              onClick={openBeneficiaryModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] font-bold text-xs transition cursor-pointer shrink-0 whitespace-nowrap ${
                beneficiary.isDependentBooking ? 'bg-emerald-500 text-white' : isDark ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
              }`}
              title="Alterar para quem é o agendamento"
            >
              {beneficiary.isDependentBooking ? <Users className="w-3.5 h-3.5 text-white shrink-0" /> : <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              <span className={beneficiary.isDependentBooking ? 'text-white' : ''}>
                {beneficiary.isDependentBooking && beneficiary.dependentName ? beneficiary.dependentName : 'Para Você'}
              </span>
            </button>
          )}

          <div className="flex items-center justify-end gap-1.5 ml-auto">
            {!inline && onClose && (
              <button
                type="button"
                onClick={onClose}
                className={`w-7 h-7 rounded-[4px] flex items-center justify-center transition cursor-pointer shrink-0 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 hover:text-slate-950'}`}
                aria-label="Fechar modal"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {(() => {
            const getAbbreviatedServiceLabel = (): string => {
              if (!selectedServices.length) return 'Serviço';
              const rawTitle = selectedServices[0].title.trim();
              const words = rawTitle.split(/\s+/);
              const connectors = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'no', 'na', 'com']);
              let shortTitle = rawTitle;
              if (words.length > 2) {
                const secondWord = words[1].toLowerCase();
                shortTitle = connectors.has(secondWord) ? words.slice(0, 3).join(' ') : words.slice(0, 2).join(' ');
              }
              return selectedServices.length > 1 ? `${shortTitle} +${selectedServices.length - 1}` : shortTitle;
            };

            const dateStepLabel = currentStep !== 'service' && selectedDateIso ? `${selectedDateIso.split('-')[2]}/${selectedDateIso.split('-')[1]}` : 'Data';
            const timeStepLabel = selectedTimeSlot ? selectedTimeSlot : 'Horário';

            const dynamicSteps: Array<{ key: Step; label: string; hasValue: boolean; Icon: React.ElementType }> = [
              { key: 'service', label: getAbbreviatedServiceLabel(), hasValue: selectedServices.length > 0, Icon: Scissors },
              { key: 'date', label: dateStepLabel, hasValue: currentStep !== 'service' && Boolean(selectedDateIso), Icon: Calendar },
              { key: 'professionals_and_time', label: timeStepLabel, hasValue: Boolean(selectedTimeSlot), Icon: Clock },
            ];

            const stepOrder: Record<Step, number> = { service: 1, date: 2, professionals_and_time: 3 };
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
                  onClick={() => { if (isPassed) { hapticLight(); if (st.key === 'service') setAddingExtraServices(true); setCurrentStep(st.key); } }}
                  title={st.label}
                  className={`flex flex-col gap-1 min-w-0 ${isPassed ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-[4px] min-w-0 w-full transition-colors ${
                    isCurrent ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : isPassed || st.hasValue ? (isDark ? 'text-slate-100' : 'text-slate-800') : (isDark ? 'text-slate-500' : 'text-slate-400')
                  }`}>
                    <StepIcon className={`w-3 h-3 shrink-0 ${isCurrent || isPassed || st.hasValue ? 'text-emerald-500' : (isDark ? 'text-slate-600' : 'text-slate-400')}`} />
                    <span className="text-[11px] sm:text-xs font-extrabold truncate">{st.label}</span>
                  </div>
                  <div className={`h-1.5 w-full rounded-[4px] transition-all duration-300 ${
                    isCurrent ? 'bg-emerald-500' : isPassed ? 'bg-emerald-600' : (isDark ? 'bg-slate-800' : 'bg-slate-200')
                  }`} />
                </button>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RODAPÉ FIXO
  // ============================================================================
  const footer = (currentStep === 'service' || (currentStep === 'professionals_and_time' && Boolean(selectedTimeSlot))) && (
    <div className={`px-3.5 py-2 border-t shrink-0 sticky bottom-0 z-20 transition-colors ${isDark ? 'bg-[#151A1E]/95 border-slate-800 backdrop-blur-md' : 'bg-white/95 border-slate-200 backdrop-blur-md'}`}>
      {currentStep === 'service' && (
        <button
          id="btn-avancar-data"
          type="button"
          disabled={selectedServices.length === 0}
          onClick={() => { if (selectedServices.length > 0) { hapticMedium(); setIsAddingExtraServices(false); setCurrentStep('date'); if (!beneficiary.hasChosenBeneficiary) openBeneficiaryModal(); } }}
          className={`w-full py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-[4px] transition flex items-center justify-center gap-1.5 ${
            selectedServices.length > 0 ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer active:scale-98' : isDark ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'
          }`}
        >
          <span className={selectedServices.length > 0 ? 'text-white' : ''}>
            {selectedServices.length > 1 ? `Concluir Serviços (${selectedServices.length} itens • R$ ${selectedServices.reduce((acc, s) => acc + s.price, 0)})` : selectedServices.length === 1 ? `Avançar para Data (${selectedServices[0].title} • R$ ${selectedServices[0].price})` : 'Selecione ao menos 1 serviço'}
          </span>
          <ChevronRight className={`w-3.5 h-3.5 ${selectedServices.length > 0 ? 'text-white' : ''}`} />
        </button>
      )}

      {currentStep === 'professionals_and_time' && selectedTimeSlot && (
        <button
          id="btn-avancar-confirmacao"
          type="button"
          onClick={() => { hapticMedium(); openSummaryModal(); }}
          className="w-full py-2 px-4 font-black text-xs uppercase tracking-wider rounded-[4px] transition flex items-center justify-center gap-1.5 font-['Poppins'] bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer active:scale-98"
        >
          <span className="text-white">Revisar & Confirmar ({selectedTimeSlot})</span>
          <ChevronRight className="w-3.5 h-3.5 text-white" />
        </button>
      )}
    </div>
  );

  // ============================================================================
  // RENDER PRINCIPAL
  // ============================================================================
  if (!isOpen) return null;

  const bookingContent = (
    <div className={`w-full flex flex-col overflow-hidden transition-colors ${inline ? 'h-full border-0 rounded-none' : 'max-w-lg border rounded-[4px] max-h-[92vh] shadow-2xl'} ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`} role={inline ? undefined : 'dialog'} aria-modal={inline ? undefined : 'true'}>
      {header}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 no-scrollbar">
        {stepContent}
      </div>
      {footer}
    </div>
  );

  // ============================================================================
  // MODAIS
  // ============================================================================
  const modals = (
    <>
      {confirmIntentModalNode}
      <BeneficiaryModal
        isOpen={beneficiary.isOpen}
        onClose={closeBeneficiaryModal}
        selectedService={selectedService}
        isDependentBooking={beneficiary.isDependentBooking}
        dependentId={beneficiary.dependentId}
        dependentName={beneficiary.dependentName}
        hasChosenBeneficiary={beneficiary.hasChosenBeneficiary}
        registeredDependents={[]} // TODO: passar do hook
        skipDateStep={skipDateStep}
        onSetDependentBooking={setDependentBooking}
        onSelectDependent={selectDependent}
        onStartCreateDependent={startCreateDependent}
        onCancelCreateDependent={cancelCreateDependent}
        onSaveInlineDependent={saveInlineDependent}
        isSavingInlineDependent={beneficiary.isSavingInlineDependent}
        newDepFullName={beneficiary.newDepFullName}
        setNewDepFullName={setNewDepFullName}
        newDepRelationship={beneficiary.newDepRelationship}
        setNewDepRelationship={setNewDepRelationship}
        newDepBirthDate={beneficiary.newDepBirthDate}
        setNewDepBirthDate={setNewDepBirthDate}
        newDepNotes={beneficiary.newDepNotes}
        setNewDepNotes={setNewDepNotes}
        isCreatingDependentInline={beneficiary.isCreatingDependentInline}
        onSetIsCreatingDependentInline={setIsCreatingDependentInline}
      />
      <OriginModal
        isOpen={origin.isOpen}
        onClose={closeOriginModal}
        selectedService={selectedService}
        originAddress={transport.originAddress}
        setOriginAddress={transport.setOriginAddress}
        originCoords={transport.originCoords}
        transportMode={transport.transportMode}
        setTransportMode={transport.setTransportMode}
        distanceKm={transport.resolvedRoute?.distanceKm || 0}
        etaMinutes={transport.resolvedRoute?.etaMinutes || 0}
        resolvedAddressLabel={transport.resolvedRoute?.formattedAddress || ''}
        isCalculatingRoute={transport.isCalculatingRoute}
        runRouteCalculation={transport.runRouteCalculation}
        salonDestQuery={salonCep || salonAddress || '08285-010'}
        hasCalculatedCustomCep={origin.hasCalculatedCustomCep}
        customCepInput={origin.customCepInput}
        setCustomCepInput={setCustomCepInput}
        originModalMode={origin.mode}
        setOriginModalMode={setOriginModalMode}
        originType={origin.originType}
        setOriginType={setOriginType}
        skipDateStep={skipDateStep}
        setIsOriginModalOpen={setIsOriginOpen}
      />
      <SummaryModal
        isOpen={summary.isOpen}
        onClose={closeSummaryModal}
        selectedService={selectedService}
        selectedTimeSlot={selectedTimeSlot}
        selectedDateIso={selectedDateIso}
        shortDateFormatted={`${selectedDateIso.split('-')[2]}/${selectedDateIso.split('-')[1]}`}
        isDependentBooking={beneficiary.isDependentBooking}
        dependentName={beneficiary.dependentName}
        dependentId={beneficiary.dependentId}
        salonName={salonName}
        salonAddress={salonAddress}
        resolvedProfessionalName={availableProfessionals[0]?.name || 'Equipe do Salão'}
        selectedProfessional={selectedProfessional}
        transport={{
          resolvedRoute: transport.resolvedRoute,
          transportMode: transport.transportMode,
          maxDepartureTime: transport.maxDepartureTime,
        }}
        beneficiary={{
          isDependentBooking: beneficiary.isDependentBooking,
          dependentName: beneficiary.dependentName,
          dependentId: beneficiary.dependentId,
          openBeneficiaryModal,
        }}
        origin={{ isOpen: openOriginModal }}
        clientPhoneInput=""
        setClientPhoneInput={() => {}}
        bookingErrorMessage={error || ''}
        setBookingErrorMessage={setError}
        draftSavedFeedback={summary.draftSavedFeedback}
        setDraftSavedFeedback={setDraftSavedFeedback}
        isSubmittingBooking={isLoading}
        onSaveAsDraft={saveAsDraft}
        onConfirmFinal={handleConfirmFinal}
        onClose={onClose}
      />
      <ConfirmIntentModal
        isOpen={confirmIntentState.isOpen}
        onClose={() => setConfirmIntentState({ isOpen: false, pendingService: null })}
        pendingService={confirmIntentState.pendingService}
        salonName={salonName}
        salonLogo={salonLogo}
        salonLogoLight={salonLogoLight}
        salonLogoDark={salonLogoDark}
        primaryColor={primaryColor}
        onConfirm={handleConfirmIntent}
      />
      <SalonClientAuthModal
        isOpen={auth.isOpen}
        onClose={() => setAuthState({ isOpen: false, pendingAction: 'start_booking' })}
        salonName={salonName}
        salonSlug={salonSlug}
        salonLogo={salonLogo}
        salonLogoLight={salonLogoLight}
        salonLogoDark={salonLogoDark}
        primaryColor={primaryColor}
        onAuthenticated={() => {
          setAuthState({ isOpen: false, pendingAction: 'start_booking' });
          if (auth.pendingAction === 'confirm_final') {
            handleConfirmFinal(true);
          } else {
            const targetSrv = confirmIntentState.pendingService || initialService || selectedService;
            if (targetSrv) promptScheduleService(targetSrv);
          }
        }}
      />
    </>
  );

  if (inline) {
    return <>{bookingContent}{modals}</>;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
        {bookingContent}
      </div>
      {modals}
    </>
  );
};

// ============================================================================
// ESTADOS DE MODAIS LOCAIS (necessários para o orquestrador)
// ============================================================================
const [confirmIntentState, setConfirmIntentState] = useState<{ isOpen: boolean; pendingService: CatalogServiceItem | null }>({
  isOpen: false,
  pendingService: null,
});

const [authState, setAuthState] = useState<{ isOpen: boolean; pendingAction: 'start_booking' | 'confirm_final' }>({
  isOpen: false,
  pendingAction: 'start_booking',
});

// Handlers locais que precisam acessar estado do hook
const handleConfirmIntent = useCallback(async () => {
  const target = confirmIntentState.pendingService || initialService || selectedService;
  setConfirmIntentState({ isOpen: false, pendingService: null });
  if (!target) return;

  const isLogged = await checkAuth();
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
    openSummaryModal();
  } else {
    setSelectedTimeSlot(null);
    setCurrentStep(skipDateStep ? 'professionals_and_time' : 'date');
    openBeneficiaryModal();
  }
}, [confirmIntentState, initialService, selectedService, initialDateIso, initialTimeSlot, skipDateStep]);

const confirmIntentModalNode = confirmIntentState.isOpen && confirmIntentState.pendingService && (
  <ConfirmIntentModal
    isOpen={confirmIntentState.isOpen}
    onClose={() => setConfirmIntentState({ isOpen: false, pendingService: null })}
    pendingService={confirmIntentState.pendingService}
    salonName={salonName}
    salonLogo={salonLogo}
    salonLogoLight={salonLogoLight}
    salonLogoDark={salonLogoDark}
    primaryColor={primaryColor}
    onConfirm={handleConfirmIntent}
  />
);