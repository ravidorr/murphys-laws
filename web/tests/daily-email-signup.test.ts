import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiPost = vi.fn();
const trackProductEvent = vi.fn();
vi.mock('../src/utils/request.ts', () => ({ apiPost: (...args: unknown[]) => apiPost(...args) }));
const push = {
  isPushSupported: vi.fn(),
  getPushSubscription: vi.fn(),
  enablePush: vi.fn(),
  disablePush: vi.fn(),
};
vi.mock('../src/utils/push-notifications.ts', () => ({
  isPushSupported: () => push.isPushSupported(),
  getPushSubscription: () => push.getPushSubscription(),
  enablePush: () => push.enablePush(),
  disablePush: () => push.disablePush(),
}));
vi.mock('../src/utils/metrics.ts', () => ({ trackProductEvent: (...args: unknown[]) => trackProductEvent(...args) }));

import { DailyEmailSignup } from '../src/components/daily-email-signup.ts';

describe('DailyEmailSignup', () => {
  let section: HTMLElement;
  let input: HTMLInputElement;
  let status: HTMLElement;
  const submit = async () => {
    section.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    push.isPushSupported.mockReturnValue(false);
    section = DailyEmailSignup();
    document.body.replaceChildren(section);
    input = section.querySelector('input')!;
    status = section.querySelector('[data-daily-email-status]')!;
  });

  it('renders a labelled form', () => {
    expect(section.getAttribute('data-home-zone')).toBe('daily-email');
    expect(section.querySelector('form')!.getAttribute('aria-label')).toBe('Subscribe to the daily law email');
    expect(input.type).toBe('email');
  });

  it('posts the trimmed address and tells the visitor to confirm', async () => {
    apiPost.mockResolvedValue({ status: 'check_your_email' });
    input.value = '  ann@example.com ';
    await submit();
    expect(apiPost).toHaveBeenCalledWith('/api/v1/subscriptions', { email: 'ann@example.com' });
    expect(status.textContent).toContain('confirm your address');
    expect(input.value).toBe('');
    expect(trackProductEvent).toHaveBeenCalledWith('subscribe.email', { surface: 'home', result: 'requested' });
    expect(section.querySelector('button')!.disabled).toBe(false);
  });

  it('shows an error and keeps the address when the request fails', async () => {
    apiPost.mockRejectedValue(new Error('boom'));
    input.value = 'ann@example.com';
    await submit();
    expect(status.textContent).toContain('could not be started');
    expect(input.value).toBe('ann@example.com');
    expect(trackProductEvent).toHaveBeenCalledWith('subscribe.email', { surface: 'home', result: 'error' });
    expect(section.querySelector('button')!.disabled).toBe(false);
  });

  it('ignores a blank submission', async () => {
    input.value = '   ';
    await submit();
    expect(apiPost).not.toHaveBeenCalled();
  });

  describe('browser notifications', () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const toggle = () => section.querySelector<HTMLButtonElement>('[data-daily-push-toggle]')!;
    const pushStatus = () => section.querySelector<HTMLElement>('[data-daily-push-status]')!;

    async function mount(subscribed: boolean | 'error') {
      push.isPushSupported.mockReturnValue(true);
      if (subscribed === 'error') push.getPushSubscription.mockRejectedValue(new Error('x'));
      else push.getPushSubscription.mockResolvedValue(subscribed ? { endpoint: 'e' } : null);
      section = DailyEmailSignup();
      document.body.replaceChildren(section);
      await flush();
    }

    it('stays hidden where web push is not supported', () => {
      expect(toggle().classList.contains('hidden')).toBe(true);
      expect(push.getPushSubscription).not.toHaveBeenCalled();
    });

    it('offers to subscribe when this browser is not subscribed', async () => {
      await mount(false);
      expect(toggle().classList.contains('hidden')).toBe(false);
      expect(toggle().textContent).toBe('Notify me in this browser');
    });

    it('offers to stop when already subscribed, and shows the on label if the check fails', async () => {
      await mount(true);
      expect(toggle().textContent).toBe('Stop browser notifications');
      await mount('error');
      expect(toggle().textContent).toBe('Notify me in this browser');
    });

    it('subscribes and flips the label', async () => {
      await mount(false);
      push.enablePush.mockResolvedValue('subscribed');
      toggle().click();
      await flush();
      expect(pushStatus().textContent).toContain('Law of the Day as a notification');
      expect(toggle().textContent).toBe('Stop browser notifications');
      expect(trackProductEvent).toHaveBeenCalledWith('subscribe.push', { surface: 'home', result: 'requested' });
      expect(toggle().disabled).toBe(false);
    });

    it('explains a blocked permission and an unavailable browser', async () => {
      await mount(false);
      push.enablePush.mockResolvedValueOnce('denied');
      toggle().click();
      await flush();
      expect(pushStatus().textContent).toContain('blocked');
      push.enablePush.mockResolvedValueOnce('unavailable');
      toggle().click();
      await flush();
      expect(pushStatus().textContent).toContain('not available');
      expect(toggle().textContent).toBe('Notify me in this browser');
    });

    it('unsubscribes and flips the label back', async () => {
      await mount(true);
      push.disablePush.mockResolvedValue(undefined);
      toggle().click();
      await flush();
      expect(push.disablePush).toHaveBeenCalled();
      expect(pushStatus().textContent).toContain('off');
      expect(toggle().textContent).toBe('Notify me in this browser');
    });

    it('shows an error when the change fails', async () => {
      await mount(false);
      push.enablePush.mockRejectedValue(new Error('boom'));
      toggle().click();
      await flush();
      expect(pushStatus().textContent).toContain('could not be changed');
      expect(trackProductEvent).toHaveBeenCalledWith('subscribe.push', { surface: 'home', result: 'error' });
      expect(toggle().disabled).toBe(false);
    });
  });
});
