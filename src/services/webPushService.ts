import { supabase } from '../lib/supabase';

export type WebPushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface WebPushContext {
  userId?: string | null;
  clientId?: string | null;
  salonId?: string | null;
  role?: 'client' | 'salon_owner' | 'salon_staff' | 'super_admin';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getBearerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers.Authorization = `Bearer ${data.session.access_token}`;
      }
    }
  } catch {}
  return headers;
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function ensureServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) {
      return await navigator.serviceWorker.ready;
    }
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) return null;
    const data = await res.json();
    return data?.enabled && data?.publicKey ? String(data.publicKey) : null;
  } catch {
    return null;
  }
}

export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  const reg = await ensureServiceWorkerReady();
  if (!reg) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeToWebPush(context: WebPushContext = {}): Promise<{
  success: boolean;
  subscribed: boolean;
  permission: WebPushPermissionStatus;
  error?: string;
}> {
  if (!isWebPushSupported()) {
    return {
      success: false,
      subscribed: false,
      permission: 'unsupported',
      error: 'Push nativo indisponível neste navegador.',
    };
  }

  let permission: NotificationPermission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return {
      success: false,
      subscribed: false,
      permission: permission as WebPushPermissionStatus,
      error: 'Permissão de notificações não concedida.',
    };
  }

  const registration = await ensureServiceWorkerReady();
  if (!registration) {
    return {
      success: false,
      subscribed: false,
      permission: 'granted',
      error: 'Service Worker não pôde ser ativado.',
    };
  }

  const vapidPublicKey = await fetchVapidPublicKey();
  if (!vapidPublicKey) {
    return {
      success: true,
      subscribed: false,
      permission: 'granted',
      error: 'Chaves VAPID ainda não configuradas no servidor.',
    };
  }

  try {
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    const headers = await getBearerHeaders();

    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        subscription: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        },
        userId: context.userId || null,
        clientId: context.clientId || null,
        salonId: context.salonId || null,
        role: context.role || 'client',
        deviceLabel: navigator.userAgent.slice(0, 120),
        userAgent: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        subscribed: false,
        permission: 'granted',
        error: errData?.error || 'Falha ao salvar assinatura Push.',
      };
    }

    return {
      success: true,
      subscribed: true,
      permission: 'granted',
    };
  } catch (err: any) {
    return {
      success: false,
      subscribed: false,
      permission: 'granted',
      error: err?.message || 'Erro ao assinar notificações Push.',
    };
  }
}

export async function unsubscribeFromWebPush(): Promise<boolean> {
  try {
    const subscription = await getActivePushSubscription();
    if (!subscription) return true;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    const headers = await getBearerHeaders();
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers,
      body: JSON.stringify({ endpoint }),
    }).catch(() => {});

    return true;
  } catch {
    return false;
  }
}

export async function triggerPushOutboxDispatch(): Promise<void> {
  try {
    const headers = await getBearerHeaders();
    await fetch('/api/push/dispatch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 25 }),
    });
  } catch {

  }
}
