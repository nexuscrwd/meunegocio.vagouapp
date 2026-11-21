import { supabase, getDbClient } from '../lib/supabase';
import { sanitizePersistedMediaUrl } from './mediaUploadService';

function generateUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim());
}

async function resolveSalonUuid(client: any, salonId: string): Promise<string | null> {
  if (isValidUuid(salonId)) return salonId.trim();
  try {
    const { data: sRow } = await (client.from('salons') as any)
      .select('id')
      .eq('slug', salonId)
      .maybeSingle();
    if (sRow?.id && isValidUuid(sRow.id)) return sRow.id;
  } catch {}
  const activeDbId = typeof window !== 'undefined' ? localStorage.getItem('vagou_salon_db_id') : null;
  return isValidUuid(activeDbId) ? activeDbId!.trim() : null;
}

export async function syncSalonMediaToDatabase(
  salonId: string,
  mediaItem: {
    id?: string;
    title: string;
    url: string;
    type: 'image' | 'video';
    media_group: 'fotos' | 'videos' | 'imagens';
    category: 'servicos' | 'profissionais' | 'espaco' | 'banner' | 'logotipo';
    duration_seconds?: number;
    is_cover?: boolean;
    bucket?: 'avatars' | 'branding' | 'services' | 'salon-media';
    storage_path?: string;
  }
) {
  const client = getDbClient();
  if (!client || !salonId) return { data: null, error: new Error('Cliente Supabase indisponível') };

  const safeUrl = sanitizePersistedMediaUrl(mediaItem.url);
  if (!safeUrl) {
    return { data: null, error: new Error('URL de mídia inválida ou Base64 bloqueado.') };
  }

  const resolvedSalonUuid = await resolveSalonUuid(client, salonId);
  if (!resolvedSalonUuid) {
    return { data: null, error: new Error('Salão não encontrado.') };
  }

  try {
    const mediaId = isValidUuid(mediaItem.id) ? String(mediaItem.id) : generateUuidV4();
    const ownerType =
      mediaItem.category === 'logotipo'
        ? 'salon_logo'
        : mediaItem.category === 'banner'
        ? 'salon_cover'
        : mediaItem.category === 'servicos'
        ? 'service_photo'
        : 'salon_gallery';

    const bucket =
      mediaItem.bucket ||
      (mediaItem.category === 'logotipo' || mediaItem.category === 'banner'
        ? 'branding'
        : mediaItem.category === 'servicos'
        ? 'services'
        : 'salon-media');

    const derivedPath =
      mediaItem.storage_path ||
      `${ownerType}/${resolvedSalonUuid}/${mediaId}`;

    const { data, error } = await (client.from('media_assets' as any) as any)
      .upsert(
        {
          id: mediaId,
          salon_id: resolvedSalonUuid,
          owner_type: ownerType,
          owner_id: resolvedSalonUuid,
          bucket,
          storage_path: derivedPath,
          public_url: safeUrl,
          mime_type: mediaItem.type === 'video' ? 'video/mp4' : 'image/webp',
          title: mediaItem.title || 'Mídia do Salão',
          is_cover: Boolean(mediaItem.is_cover || mediaItem.category === 'banner'),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .maybeSingle();

    if (mediaItem.is_cover || mediaItem.category === 'banner') {
      await (client.from('salons') as any)
        .update({ cover_image_url: safeUrl, cover_url: safeUrl, updated_at: new Date().toISOString() })
        .eq('id', resolvedSalonUuid);
    }
    if (mediaItem.category === 'logotipo') {
      await (client.from('salons') as any)
        .update({ logo_url: safeUrl, updated_at: new Date().toISOString() })
        .eq('id', resolvedSalonUuid);
    }
    return { data, error };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

export async function fetchSalonMediaFromDatabase(salonId: string) {
  const client = getDbClient() || supabase;
  if (!client || !salonId) return [];
  const resolvedSalonUuid = await resolveSalonUuid(client, salonId);
  if (!resolvedSalonUuid) return [];

  try {
    const { data, error } = await (client.from('media_assets' as any) as any)
      .select('*')
      .eq('salon_id', resolvedSalonUuid)
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map((row: any) => ({
      ...row,
      url: row.public_url,
      type: String(row.mime_type || '').startsWith('video/') ? 'video' : 'image',
    }));
  } catch {
    return [];
  }
}

export async function syncClientDependentToDatabase(
  parentClientId: string,
  dependent: {
    id?: string;
    fullName: string;
    relationship: string;
    birthDate?: string | null;
    notes?: string | null;
    isUnlinked?: boolean;
    avatarUrl?: string | null;
    avatarEmoji?: string | null;
    gender?: string | null;
    autonomyLevel?: string;
    phone?: string | null;
    email?: string | null;
  }
) {
  const client = getDbClient();
  if (!client || !parentClientId) return null;

  const depId = isValidUuid(dependent.id) ? String(dependent.id) : generateUuidV4();
  const validRel = ['son', 'daughter', 'child', 'spouse', 'parent', 'sibling', 'other'].includes(dependent.relationship)
    ? dependent.relationship
    : 'other';
  const cleanBirthDate = dependent.birthDate && String(dependent.birthDate).trim() !== '' ? dependent.birthDate : null;

  try {
    const { data } = await (client.from('dependents' as any) as any)
      .upsert(
        {
          id: depId,
          parent_client_id: parentClientId,
          full_name: dependent.fullName,
          name: dependent.fullName,
          relationship: validRel,
          birth_date: cleanBirthDate,
          gender: dependent.gender || null,
          phone: dependent.phone || null,
          email: dependent.email || null,
          avatar_url: sanitizePersistedMediaUrl(dependent.avatarUrl),
          avatar_emoji: dependent.avatarEmoji || null,
          autonomy_level: dependent.autonomyLevel || 'parent_controlled',
          notes: dependent.notes || null,
          is_unlinked: dependent.isUnlinked ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select()
      .maybeSingle();

    return data || { id: depId };
  } catch {
    return { id: depId };
  }
}

export async function refreshClientDependentsCount(parentClientId: string) {
  const client = getDbClient();
  if (!client || !parentClientId) return;
  try {
    const { data: deps } = await (client.from('dependents' as any) as any)
      .select('id')
      .eq('parent_client_id', parentClientId)
      .eq('is_unlinked', false);
    const count = Array.isArray(deps) ? deps.length : 0;
    await (client.from('clients') as any)
      .update({ dependents_count: count, updated_at: new Date().toISOString() })
      .eq('id', parentClientId);
  } catch {}
}

export interface SalonUtilitiesPayload {
  energy_meters?: unknown[];
  energy_readings?: unknown[];
  water_meters?: unknown[];
  water_readings?: unknown[];
  appliances?: unknown[];
  dre_records?: unknown[];
  supply_items?: unknown[];
}

export async function syncSalonUtilitiesToDatabase(
  salonId: string,
  utilitiesPayload: SalonUtilitiesPayload
) {
  const client = getDbClient();
  if (!client || !salonId) return null;

  const resolvedSalonUuid = await resolveSalonUuid(client, salonId);
  if (!resolvedSalonUuid) return null;

  try {
    return await (client.from('salon_utilities_records' as any) as any).upsert(
      {
        salon_id: resolvedSalonUuid,
        ...utilitiesPayload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'salon_id' }
    );
  } catch {
    return null;
  }
}

export async function syncAllLocalUtilitiesToDatabase(salonId?: string | null) {
  if (typeof window === 'undefined') return null;
  const targetSalonId =
    salonId ||
    localStorage.getItem('vagou_salon_db_id') ||
    localStorage.getItem('vagou_salon_slug') ||
    '';
  if (!targetSalonId) return null;

  const safeParse = (key: string, fallback: any = []) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const energyTariff = safeParse('vagou_energy_tariff_config', null);
  const energyMetersList = safeParse('vagou_energy_meters', []);
  const energyMeters =
    Array.isArray(energyMetersList) && energyMetersList.length > 0
      ? energyMetersList
      : energyTariff
      ? [energyTariff]
      : [];

  const energyReadings = safeParse(
    'vagou_energy_meter_readings',
    safeParse('vagou_energy_readings', [])
  );

  const waterTariff = safeParse('vagou_water_tariff_config', null);
  const waterMetersList = safeParse('vagou_water_meters', []);
  const waterMeters =
    Array.isArray(waterMetersList) && waterMetersList.length > 0
      ? waterMetersList
      : waterTariff
      ? [waterTariff]
      : [];

  const waterReadings = safeParse(
    'vagou_water_meter_readings',
    safeParse('vagou_water_readings', [])
  );

  const opEquipments = safeParse('vagou_operational_equipments', []);
  const infraEquipments = safeParse('vagou_infrastructure_equipments', []);
  const customAppliances = safeParse('vagou_appliances', []);
  const appliances =
    opEquipments.length > 0 || infraEquipments.length > 0
      ? [
          ...opEquipments.map((item: any) => ({ ...item, equipmentGroup: 'operational' })),
          ...infraEquipments.map((item: any) => ({ ...item, equipmentGroup: 'infrastructure' })),
        ]
      : customAppliances;

  const dreRecords = safeParse(
    'vagou_financial_expenses',
    safeParse('vagou_dre_records', [])
  );

  const supplyItems = safeParse(
    'vagou_salon_supplies',
    safeParse('vagou_supply_items', [])
  );

  return await syncSalonUtilitiesToDatabase(targetSalonId, {
    energy_meters: Array.isArray(energyMeters) ? energyMeters : [energyMeters],
    energy_readings: Array.isArray(energyReadings) ? energyReadings : [],
    water_meters: Array.isArray(waterMeters) ? waterMeters : [waterMeters],
    water_readings: Array.isArray(waterReadings) ? waterReadings : [],
    appliances: Array.isArray(appliances) ? appliances : [],
    dre_records: Array.isArray(dreRecords) ? dreRecords : [],
    supply_items: Array.isArray(supplyItems) ? supplyItems : [],
  });
}

export async function fetchSalonUtilitiesFromDatabase(salonId: string): Promise<SalonUtilitiesPayload | null> {
  const client = getDbClient() || supabase;
  if (!client || !salonId) return null;

  const resolvedSalonUuid = await resolveSalonUuid(client, salonId);
  if (!resolvedSalonUuid) return null;

  try {
    const { data: record } = await (client.from('salon_utilities_records' as any) as any)
      .select('*')
      .eq('salon_id', resolvedSalonUuid)
      .maybeSingle();

    if (!record) return null;
    return {
      energy_meters: record.energy_meters || [],
      energy_readings: record.energy_readings || [],
      water_meters: record.water_meters || [],
      water_readings: record.water_readings || [],
      appliances: record.appliances || [],
      dre_records: record.dre_records || [],
      supply_items: record.supply_items || [],
    };
  } catch {
    return null;
  }
}
