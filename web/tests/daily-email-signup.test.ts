import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiPost = vi.fn();
const trackProductEvent = vi.fn();
vi.mock('../src/utils/request.ts', () => ({ apiPost: (...args: unknown[]) => apiPost(...args) }));
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
});
