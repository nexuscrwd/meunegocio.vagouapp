/**
 * Serviço de Agendamento — VagouApp Meu Negócio
 * 
 * Centraliza toda a lógica de negócio para confirmação, rascunho e validação
 * de agendamentos. Isola chamadas Supabase, regras de negócio e transformação
 * de dados para uso em hooks/componentes.
 * 
 * Responsabilidades:
 * - Confirmação final no banco (com campos preditivos BOL-020)
 * - Rascunho local (localStorage) — não trava vaga
 * - Validação de dados antes de enviar
 * - Sincronização de dependentes (Conta Família)
 */

import type {
  BookingConfirmData,
  BookingConfirmResult,
  BookingDraftItem,
  CatalogServiceItem,
  SalonProfessionalItem,
  UserFamilyDependent,
  TransportMode,
  DbTransportMode,
} from '../types/booking';
import {
  BOOKING_DRAFT_STORAGE_KEY,
  STORAGE_KEYS,
  mapUiTransportModeToDb,
} from '../types/booking';

// Re-export para conveniência dos hooks
export type {
  BookingConfirmData,
  BookingConfirmResult,
  BookingDraftItem,
  CatalogServiceItem,
  SalonProfessionalItem,
  UserFamilyDependent,
  TransportMode,
  DbTransportMode,
  BusySlotRecord,
} from '../types/booking';

export {
  BOOKING_DRAFT_STORAGE_KEY,
  STORAGE_KEYS,
  mapUiTransportModeToDb,
} from '../types/booking';

// ============================================================================
// SUPABASE CLIENT (lazy import para evitar erro se não configurado)
// ============================================================================

let supabaseClient: any = null;
let isSupabaseReady = false;

async function getSupabase() {
  if (isSupabaseReady) return supabaseClient;
  
  try {
    const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
    if (isSupabaseConfigured && supabase) {
      supabaseClient = supabase;
      isSupabaseReady = true;
      return supabase;
    }
  } catch {}
  return null;
}

// ============================================================================
// VALIDAÇÃO DE DADOS
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBookingConfirmData(data: BookingConfirmData): ValidationResult {
  const errors: string[] = [];
  
  if (!data.service?.id) errors.push('Serviço é obrigatório');
  if (!data.professional) errors.push('Profissional é obrigatório');
  if (!data.dateIso) errors.push('Data é obrigatória');
  if (!data.timeSlot) errors.push('Horário é obrigatório');
  if (!data.salonName) errors.push('Salão é obrigatório');
  if (!data.clientPhone?.trim()) errors.push('Telefone de contato é obrigatório');
  if (data.isDependentBooking && !data.dependentName?.trim()) {
    errors.push('Nome do dependente é obrigatório');
  }
  if (data.price === undefined || data.price < 0) errors.push('Preço inválido');
  
  // Valida formato de telefone brasileiro
  if (data.clientPhone) {
    const cleanPhone = data.clientPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 11) {
      errors.push('Telefone deve ter 10 ou 11 dígitos (com DDD)');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export function validateDraftData(draft: Partial<BookingDraftItem>): ValidationResult {
  const errors: string[] = [];
  
  if (!draft.salonName) errors.push('Salão é obrigatório');
  if (!draft.services?.length) errors.push('Pelo menos 1 serviço é obrigatório');
  if (!draft.dateIso) errors.push('Data é obrigatória');
  if (!draft.timeSlot) errors.push('Horário é obrigatório');
  if (!draft.professional) errors.push('Profissional é obrigatório');
  
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// RASCUNHO LOCAL (localStorage)
// ============================================================================

export function getSavedBookingDraft(): BookingDraftItem | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.combinedServiceTitle && parsed.dateIso && parsed.timeSlot) {
      return parsed as BookingDraftItem;
    }
  } catch {}
  return null;
}

export function saveBookingDraft(draft: BookingDraftItem | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!draft) {
      localStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
    } else {
      localStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }
    // Dispara evento para outros componentes (ex: banner flutuante)
    window.dispatchEvent(new CustomEvent('vagou:booking-draft-updated', { detail: draft }));
  } catch {}
}

export function createBookingDraftFromState(params: {
  salonId?: string;
  salonName: string;
  salonAddress: string;
  services: CatalogServiceItem[];
  combinedServiceTitle: string;
  totalPrice: number;
  professional: string;
  professionalAvatar?: string;
  dateIso: string;
  dateFormatted: string;
  timeSlot: string;
  isDependentBooking: boolean;
  dependentId?: string;
  dependentName?: string;
  clientPhone?: string;
  clientAddressQuery?: string;
  distanceKm?: number;
  etaMinutes?: number;
  prepBufferMinutes: number;
  uiTransportMode?: TransportMode;
}): BookingDraftItem {
  const selectedServices = params.services;
  return {
    id: `draft-${Date.now()}`,
    salonId: params.salonId,
    salonName: params.salonName,
    salonAddress: params.salonAddress,
    services: selectedServices.map(s => ({
      id: s.id,
      title: s.title,
      price: s.price,
      duration: s.duration,
      category: s.category,
    })),
    combinedServiceTitle: params.combinedServiceTitle,
    totalPrice: params.totalPrice,
    professional: params.professional,
    professionalAvatar: params.professionalAvatar,
    dateIso: params.dateIso,
    dateFormatted: params.dateFormatted,
    timeSlot: params.timeSlot,
    isDependentBooking: params.isDependentBooking,
    dependentId: params.dependentId,
    dependentName: params.dependentName,
    clientPhone: params.clientPhone,
    clientAddressQuery: params.clientAddressQuery,
    distanceKm: params.distanceKm,
    etaMinutes: params.etaMinutes,
    prepBufferMinutes: params.prepBufferMinutes,
    savedAt: new Date().toISOString(),
  };
}

// ============================================================================
// CONFIRMAÇÃO FINAL NO BANCO
// ============================================================================

interface ConfirmAppointmentParams extends BookingConfirmData {
  // Parâmetros extras para supabase
  salonId?: string;
  userId?: string;
  clientId?: string;
}

export async function confirmAppointmentInDatabase(params: ConfirmAppointmentParams): Promise<BookingConfirmResult> {
  const validation = validateBookingConfirmData(params);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join('; ') };
  }
  
  const supabase = await getSupabase();
  if (!supabase) {
    return { success: false, error: 'Banco de dados não configurado' };
  }
  
  try {
    // Resolve salon_id se não vier
    let salonId = params.salonId;
    if (!salonId) {
      const stored = localStorage.getItem(STORAGE_KEYS.SALON_DB_ID) || localStorage.getItem(STORAGE_KEYS.SALON_SLUG);
      if (stored) salonId = stored;
    }
    
    // Resolve client_id (usuário logado)
    let clientId = params.clientId;
    if (!clientId) {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.CLIENT_SESSION);
        if (raw) {
          const parsed = JSON.parse(raw);
          clientId = parsed.id || parsed.clientId;
        }
      } catch {}
      
      // Fallback: busca por email
      if (!clientId) {
        const email = localStorage.getItem(STORAGE_KEYS.USER_EMAIL)?.trim().toLowerCase();
        if (email) {
          const { data: cRow } = await supabase.from('clients').select('id').ilike('email', `%${email}%`).maybeSingle();
          if (cRow?.id) {
            clientId = cRow.id;
            localStorage.setItem(STORAGE_KEYS.CLIENT_SESSION, JSON.stringify({ id: cRow.id, email }));
          }
        }
      }
    }
    
    // Mapeia transportMode UI -> DB
    const dbTransportMode = params.uiTransportMode ? mapUiTransportModeToDb(params.uiTransportMode) : params.transportMode;
    
    // Monta payload para inserção
    const appointmentPayload = {
      salon_id: salonId,
      client_id: clientId,
      service_title: params.service.title,
      service_category: params.service.category,
      service_duration: params.service.duration,
      service_price: params.service.price,
      professional_name: params.professional,
      professional_avatar: params.professionalAvatar,
      date_str: params.dateIso,
      start_time: params.timeSlot,
      end_time: calculateEndTime(params.timeSlot, params.service.duration),
      status: 'CONFIRMADO',
      notes: params.notes,
      is_dependent_booking: params.isDependentBooking || false,
      dependent_id: params.dependentId,
      dependent_name: params.dependentName,
      client_phone: params.clientPhone,
      // Campos preditivos BOL-020
      distance_km: params.distanceKm,
      eta_minutes: params.etaMinutes,
      prep_buffer_minutes: params.prepBufferMinutes,
      transport_mode: dbTransportMode,
      ui_transport_mode: params.uiTransportMode,
      max_departure_time: params.maxDepartureTime,
      origin_formatted_address: params.originFormattedAddress,
      origin_lat: params.originLat,
      origin_lng: params.originLng,
      salon_lat: params.salonLat,
      salon_lng: params.salonLng,
      selected_route_summary: params.selectedRouteSummary,
      offer_id: params.offerId,
      created_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('appointments')
      .insert([appointmentPayload])
      .select()
      .single();
    
    if (error) {
      console.error('[bookingService] Erro ao inserir agendamento:', error);
      return { success: false, error: `Falha ao salvar: ${error.message}` };
    }
    
    // Limpa rascunho após confirmação
    saveBookingDraft(null);
    
    return { success: true, appointmentId: data?.id };
    
  } catch (error) {
    console.error('[bookingService] Erro inesperado:', error);
    return { success: false, error: 'Erro interno ao confirmar agendamento' };
  }
}

function calculateEndTime(startTime: string, duration: string): string {
  const [h, m] = startTime.split(':').map(Number);
  const durationMatch = duration.match(/(\d+)/);
  const durationMinutes = durationMatch ? parseInt(durationMatch[1], 10) : 30;
  const totalMinutes = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// ============================================================================
// DEPENDENTES (CONTA FAMÍLIA)
// ============================================================================

export async function loadClientDependents(): Promise<UserFamilyDependent[]> {
  // 1. Tenta localStorage primeiro (rápido)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USER_DEPENDENTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  
  // 2. Busca no Supabase
  const supabase = await getSupabase();
  if (!supabase) return [];
  
  try {
    let parentClientId = localStorage.getItem(STORAGE_KEYS.CLIENT_SESSION);
    let clientId = '';
    
    if (parentClientId) {
      try {
        const parsed = JSON.parse(parentClientId);
        clientId = parsed.id || parsed.clientId || '';
      } catch {}
    }
    
    if (!clientId) {
      const email = localStorage.getItem(STORAGE_KEYS.USER_EMAIL)?.trim().toLowerCase();
      if (email) {
        const { data: cRow } = await supabase.from('clients').select('id').ilike('email', `%${email}%`).maybeSingle();
        if (cRow?.id) clientId = cRow.id;
      }
    }
    
    if (!clientId) return [];
    
    const { data, error } = await supabase
      .from('dependents')
      .select('*')
      .eq('parent_client_id', clientId)
      .eq('is_unlinked', false);
    
    if (error) throw error;
    
    const normalized: UserFamilyDependent[] = (data || []).map((d: any) => ({
      id: d.id,
      parent_client_id: d.parent_client_id,
      full_name: d.full_name,
      relationship: d.relationship,
      birth_date: d.birth_date,
      notes: d.notes,
      is_unlinked: d.is_unlinked,
      created_at: d.created_at,
    }));
    
    // Cache local
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.USER_DEPENDENTS, JSON.stringify(normalized));
    }
    
    return normalized;
  } catch {
    return [];
  }
}

export async function saveDependentToDatabase(
  parentClientId: string,
  dependent: Omit<UserFamilyDependent, 'id' | 'created_at' | 'parent_client_id'>
): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await getSupabase();
  if (!supabase) return { success: false, error: 'Banco não configurado' };
  
  try {
    const newId = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      id: newId,
      parent_client_id: parentClientId,
      full_name: dependent.full_name,
      relationship: dependent.relationship,
      birth_date: dependent.birth_date || null,
      notes: dependent.notes || null,
      is_unlinked: false,
      created_at: new Date().toISOString(),
    };
    
    const { error } = await supabase.from('dependents').insert([payload]);
    if (error) throw error;
    
    // Invalida cache local
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.USER_DEPENDENTS);
    }
    
    return { success: true, id: newId };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// PROFISSIONAIS DISPONÍVEIS (re-export do bookingSlots para centralizar)
// ============================================================================

export {
  fetchBusySlotsDirectly,
  fetchAvailableProfessionalsForDate,
  getAvailableSlotsForDate,
  type BusySlotRecord,
  type SlotGenerationOptions,
} from '../utils/bookingSlots';