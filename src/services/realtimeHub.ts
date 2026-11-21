import { supabase } from '../lib/supabase';

export type VagouRealtimeTable =
  | 'salons'
  | 'salon_ui_settings'
  | 'services'
  | 'service_offers'
  | 'professionals'
  | 'appointments'
  | 'clients'
  | 'dependents'
  | 'media_assets'
  | 'financial_transactions'
  | 'salon_utilities_records'
  | 'notification_outbox'
  | 'admin_preferences';

export interface RealtimeChangeEvent {
  table: VagouRealtimeTable;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  newRecord: Record<string, any> | null;
  oldRecord: Record<string, any> | null;
  committedAt: string;
}

export interface UnifiedRealtimeSubscriptionOptions {
  salonId?: string | null;
  clientId?: string | null;
  tables?: VagouRealtimeTable[];
  onEvent: (event: RealtimeChangeEvent) => void;
}

const DEFAULT_V6_REALTIME_TABLES: VagouRealtimeTable[] = [
  'salons',
  'salon_ui_settings',
  'services',
  'service_offers',
  'professionals',
  'appointments',
  'clients',
  'dependents',
  'media_assets',
  'financial_transactions',
  'salon_utilities_records',
  'notification_outbox',
  'admin_preferences',
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(val?: string | null): boolean {
  return Boolean(val && UUID_REGEX.test(String(val).trim()));
}

export function subscribeToVagouRealtimeHub(
  options: UnifiedRealtimeSubscriptionOptions
): () => void {
  if (!supabase) return () => {};

  const tables = options.tables && options.tables.length > 0
    ? options.tables
    : DEFAULT_V6_REALTIME_TABLES;

  const validSalonId = isUuid(options.salonId) ? options.salonId!.trim() : null;
  const validClientId = isUuid(options.clientId) ? options.clientId!.trim() : null;
  const channelName = `vagou-v6-hub-${validSalonId || 'global'}-${validClientId || 'anon'}-${Date.now()}`;

  let channel = supabase.channel(channelName);

  for (const table of tables) {
    let filter: string | undefined;

    if (validSalonId) {
      if (table === 'salons') {
        filter = `id=eq.${validSalonId}`;
      } else if (
        table === 'salon_ui_settings' ||
        table === 'services' ||
        table === 'service_offers' ||
        table === 'professionals' ||
        table === 'appointments' ||
        table === 'media_assets' ||
        table === 'financial_transactions' ||
        table === 'salon_utilities_records'
      ) {
        filter = `salon_id=eq.${validSalonId}`;
      }
    } else if (validClientId) {
      if (table === 'clients') {
        filter = `id=eq.${validClientId}`;
      } else if (table === 'dependents') {
        filter = `parent_client_id=eq.${validClientId}`;
      } else if (table === 'appointments') {
        filter = `client_id=eq.${validClientId}`;
      }
    }

    const pgConfig: Record<string, any> = {
      event: '*',
      schema: 'public',
      table,
    };
    if (filter) {
      pgConfig.filter = filter;
    }

    channel = channel.on('postgres_changes' as any, pgConfig, (payload: any) => {
      options.onEvent({
        table,
        eventType: (payload?.eventType || '*') as RealtimeChangeEvent['eventType'],
        newRecord: payload?.new && Object.keys(payload.new).length > 0 ? payload.new : null,
        oldRecord: payload?.old && Object.keys(payload.old).length > 0 ? payload.old : null,
        committedAt: payload?.commit_timestamp || new Date().toISOString(),
      });
    });
  }

  channel.subscribe();

  return () => {
    try {
      supabase?.removeChannel(channel);
    } catch {}
  };
}
