import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiRequest = vi.fn();
vi.mock('../src/utils/request.ts', () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiPost: (...args: unknown[]) => apiPost(...args),
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import {
  disablePush,
  enablePush,
  getPushSubscription,
  isPushSupported,
  urlBase64ToBytes,
} from '../src/utils/push-notifications.ts';

describe('push notifications', () => {
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/x',
    toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const pushManager = { getSubscription: vi.fn(), subscribe: vi.fn() };
  const registration = { pushManager };
  const getRegistration = vi.fn();
  const requestPermission = vi.fn();

  function support(enabled: boolean) {
    if (enabled) {
      Object.defineProperty(navigator, 'serviceWorker', { value: { getRegistration }, configurable: true });
      (window as unknown as Record<string, unknown>).PushManager = class {};
      (window as unknown as Record<string, unknown>).Notification = { requestPermission };
    } else {
      delete (window as unknown as Record<string, unknown>).PushManager;
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    getRegistration.mockResolvedValue(registration);
    pushManager.getSubscription.mockResolvedValue(subscription);
    pushManager.subscribe.mockResolvedValue(subscription);
    requestPermission.mockResolvedValue('granted');
    apiGet.mockResolvedValue({ publicKey: 'AQID' });
    apiPost.mockResolvedValue({});
    apiRequest.mockResolvedValue({});
    support(true);
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).PushManager;
    delete (window as unknown as Record<string, unknown>).Notification;
  });

  it('decodes a base64url key into bytes', () => {
    expect(Array.from(urlBase64ToBytes('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToBytes('-_8'))).toEqual([251, 255]);
  });

  it('reports support only when the service worker, push and notification APIs exist', () => {
    expect(isPushSupported()).toBe(true);
    support(false);
    expect(isPushSupported()).toBe(false);
  });

  describe('getPushSubscription', () => {
    it('returns the current subscription', async () => {
      expect(await getPushSubscription()).toBe(subscription);
    });

    it('returns null without support or without a registered service worker', async () => {
      getRegistration.mockResolvedValue(undefined);
      expect(await getPushSubscription()).toBeNull();
      support(false);
      expect(await getPushSubscription()).toBeNull();
    });
  });

  describe('enablePush', () => {
    it('asks permission, subscribes with the server key and stores the subscription', async () => {
      expect(await enablePush()).toBe('subscribed');
      expect(requestPermission).toHaveBeenCalled();
      expect(apiGet).toHaveBeenCalledWith('/api/v1/push/public-key');
      const options = pushManager.subscribe.mock.calls[0]![0];
      expect(options.userVisibleOnly).toBe(true);
      expect(Array.from(options.applicationServerKey as Uint8Array)).toEqual([1, 2, 3]);
      expect(apiPost).toHaveBeenCalledWith('/api/v1/push/subscriptions', subscription.toJSON());
    });

    it('stops at the permission prompt when it is not granted', async () => {
      requestPermission.mockResolvedValue('denied');
      expect(await enablePush()).toBe('denied');
      expect(apiGet).not.toHaveBeenCalled();
    });

    it('is unavailable without support or a registered service worker', async () => {
      getRegistration.mockResolvedValue(undefined);
      expect(await enablePush()).toBe('unavailable');
      support(false);
      expect(await enablePush()).toBe('unavailable');
    });
  });

  describe('disablePush', () => {
    it('removes the server record and then the browser subscription', async () => {
      await disablePush();
      expect(apiRequest).toHaveBeenCalledWith('/api/v1/push/subscriptions', { method: 'DELETE', body: { endpoint: subscription.endpoint } });
      expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    it('does nothing when there is no subscription', async () => {
      pushManager.getSubscription.mockResolvedValue(null);
      await disablePush();
      expect(apiRequest).not.toHaveBeenCalled();
    });
  });
});
