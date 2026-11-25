import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const apiPost = vi.fn();
const apiGet = vi.fn();
const trackProductEvent = vi.fn();
vi.mock('../src/utils/request.ts', () => ({
  apiPost: (...args: unknown[]) => apiPost(...args),
  apiGet: (...args: unknown[]) => apiGet(...args),
}));
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
    apiGet.mockResolvedValue({ token: 'tok-1' });
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
    expect(apiGet).toHaveBeenCalledWith('/api/v1/subscriptions/token');
    expect(apiPost).toHaveBeenCalledWith('/api/v1/subscriptions', { email: 'ann@example.com', token: 'tok-1', website: '' });
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

  it('has a trap field that people and screen readers never reach', () => {
    const trap = section.querySelector<HTMLInputElement>('[data-daily-email-trap]')!;
    expect(trap.name).toBe('website');
    expect(trap.tabIndex).toBe(-1);
    expect(trap.autocomplete).toBe('off');
    const wrapper = trap.parentElement!;
    expect(wrapper.classList.contains('hidden')).toBe(true);
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    expect(wrapper.getAttribute('style')).toBeNull();
  });

  it('sends whatever is in the trap field, so the server can tell a bot', async () => {
    apiPost.mockResolvedValue({ status: 'check_your_email' });
    section.querySelector<HTMLInputElement>('[data-daily-email-trap]')!.value = 'http://spam.example';
    input.value = 'ann@example.com';
    await submit();
    expect(apiPost).toHaveBeenCalledWith('/api/v1/subscriptions', { email: 'ann@example.com', token: 'tok-1', website: 'http://spam.example' });
  });

  it('fetches a fresh token after a signup so the next one has its own', async () => {
    apiPost.mockResolvedValue({ status: 'check_your_email' });
    apiGet.mockResolvedValueOnce({ token: 'tok-1' }).mockResolvedValueOnce({ token: 'tok-2' });
    section = DailyEmailSignup();
    document.body.replaceChildren(section);
    input = section.querySelector('input')!;
    input.value = 'ann@example.com';
    await submit();
    input.value = 'bob@example.com';
    await submit();
    expect(apiPost).toHaveBeenNthCalledWith(1, '/api/v1/subscriptions', expect.objectContaining({ token: 'tok-1' }));
    expect(apiPost).toHaveBeenNthCalledWith(2, '/api/v1/subscriptions', expect.objectContaining({ token: 'tok-2' }));
  });

  it('sends a null token when none could be fetched, and still reports the server answer', async () => {
    apiGet.mockRejectedValue(new Error('offline'));
    section = DailyEmailSignup();
    document.body.replaceChildren(section);
    input = section.querySelector('input')!;
    status = section.querySelector('[data-daily-email-status]')!;
    apiPost.mockRejectedValue(new Error('Invalid request. Please check your input.'));
    input.value = 'ann@example.com';
    await submit();
    expect(apiPost).toHaveBeenCalledWith('/api/v1/subscriptions', { email: 'ann@example.com', token: null, website: '' });
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(status.textContent).toContain('could not be started');
  });

  it('treats a response without a token as no token', async () => {
    apiGet.mockResolvedValue({ token: 5 });
    section = DailyEmailSignup();
    document.body.replaceChildren(section);
    input = section.querySelector('input')!;
    apiPost.mockResolvedValue({});
    input.value = 'ann@example.com';
    await submit();
    expect(apiPost).toHaveBeenCalledWith('/api/v1/subscriptions', expect.objectContaining({ token: null }));
  });

  describe('when the server says the form expired', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('fetches another token, waits, and tries once more', async () => {
      apiGet.mockResolvedValueOnce({ token: 'old' }).mockResolvedValueOnce({ token: 'new' }).mockResolvedValue({ token: 'next' });
      section = DailyEmailSignup();
      document.body.replaceChildren(section);
      input = section.querySelector('input')!;
      status = section.querySelector('[data-daily-email-status]')!;
      apiPost.mockRejectedValueOnce(new Error('The sign-up form expired. Please try again.')).mockResolvedValueOnce({ status: 'check_your_email' });
      input.value = 'ann@example.com';
      section.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.advanceTimersByTimeAsync(0);
      expect(apiPost).toHaveBeenCalledTimes(1);
      // The server refuses a token younger than 3 seconds, so the retry must not go out earlier
      await vi.advanceTimersByTimeAsync(2999);
      expect(apiPost).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(500);
      expect(apiPost).toHaveBeenCalledTimes(2);
      expect(apiPost).toHaveBeenNthCalledWith(1, '/api/v1/subscriptions', expect.objectContaining({ token: 'old' }));
      expect(apiPost).toHaveBeenNthCalledWith(2, '/api/v1/subscriptions', expect.objectContaining({ token: 'new' }));
      expect(status.textContent).toContain('confirm your address');
    });

    it('gives up after one retry', async () => {
      section = DailyEmailSignup();
      document.body.replaceChildren(section);
      input = section.querySelector('input')!;
      status = section.querySelector('[data-daily-email-status]')!;
      apiPost.mockRejectedValue(new Error('The sign-up form expired. Please try again.'));
      input.value = 'ann@example.com';
      section.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.advanceTimersByTimeAsync(4000);
      expect(apiPost).toHaveBeenCalledTimes(2);
      expect(status.textContent).toContain('could not be started');
      expect(input.value).toBe('ann@example.com');
    });

    it('does not retry other errors, or errors that are not Errors', async () => {
      section = DailyEmailSignup();
      document.body.replaceChildren(section);
      input = section.querySelector('input')!;
      apiPost.mockRejectedValue('boom');
      input.value = 'ann@example.com';
      section.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.advanceTimersByTimeAsync(4000);
      expect(apiPost).toHaveBeenCalledTimes(1);
    });
  });

  it('retries on the exact text the backend sends for a refused token', () => {
    const source = readFileSync(resolve(import.meta.dirname, '../../backend/src/controllers/subscriptions.controller.ts'), 'utf8');
    expect(source).toContain("export const FORM_EXPIRED_MESSAGE = 'The sign-up form expired. Please try again.';");
  });

  it('uses a new token for the next try after any failure, since the server spent the old one', async () => {
    apiGet.mockResolvedValueOnce({ token: 'tok-1' }).mockResolvedValueOnce({ token: 'tok-2' });
    section = DailyEmailSignup();
    document.body.replaceChildren(section);
    input = section.querySelector('input')!;
    apiPost.mockRejectedValueOnce(new Error('A valid email address is required')).mockResolvedValueOnce({ status: 'check_your_email' });
    input.value = 'typo@example';
    await submit();
    input.value = 'ann@example.com';
    await submit();
    expect(apiPost).toHaveBeenCalledTimes(2);
    expect(apiPost).toHaveBeenNthCalledWith(1, '/api/v1/subscriptions', expect.objectContaining({ token: 'tok-1' }));
    expect(apiPost).toHaveBeenNthCalledWith(2, '/api/v1/subscriptions', expect.objectContaining({ token: 'tok-2' }));
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
