import { apiGet, apiPost, apiRequest } from './request.ts';

const PUSH_API = '/api/v1/push/subscriptions';

export type EnablePushResult = 'subscribed' | 'denied' | 'unavailable';

/** True when this browser can show web push notifications at all. */
export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/** The VAPID public key as the bytes pushManager.subscribe expects. */
export function urlBase64ToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration();
}

/** This browser's current push subscription, or null (also null when push or the service worker is missing). */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/**
 * Asks for permission and subscribes this browser to the daily notification. Call it from a click: browsers
 * only show the permission prompt for a user gesture, so it is requested before any network call.
 */
export async function enablePush(): Promise<EnablePushResult> {
  if (!isPushSupported()) return 'unavailable';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const registration = await getRegistration();
  if (!registration) return 'unavailable';

  const { publicKey } = await apiGet('/api/v1/push/public-key') as { publicKey: string };
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBytes(publicKey) as BufferSource,
  });
  await apiPost(PUSH_API, subscription.toJSON() as Record<string, unknown>);
  return 'subscribed';
}

/** Stops the notifications for this browser: removes the server record, then the browser subscription. */
export async function disablePush(): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) return;
  await apiRequest(PUSH_API, { method: 'DELETE', body: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}
