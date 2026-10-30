import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetErrorBannerForTesting, showErrorBanner } from '../src/utils/error-banner.ts';

describe('showErrorBanner', () => {
  beforeEach(() => {
    resetErrorBannerForTesting();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('shows an alert message with Refresh and Dismiss buttons', () => {
    showErrorBanner();
    const banner = document.querySelector('.error-boundary-banner');
    expect(banner).not.toBeNull();
    expect(banner!.querySelector('[role="alert"]')!.textContent).toContain('Something went wrong');
    const labels = Array.from(banner!.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toEqual(['Refresh', 'Dismiss']);
  });

  it('shows only one banner', () => {
    showErrorBanner();
    showErrorBanner();
    expect(document.querySelectorAll('.error-boundary-banner')).toHaveLength(1);
  });

  it('reloads the page when Refresh is clicked', () => {
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', { value: { reload }, writable: true });
    try {
      showErrorBanner();
      (document.querySelectorAll('.error-boundary-banner button')[0] as HTMLButtonElement).click();
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    }
  });

  it('removes the banner when Dismiss is clicked and lets a later error show it again', () => {
    showErrorBanner();
    (document.querySelectorAll('.error-boundary-banner button')[1] as HTMLButtonElement).click();
    expect(document.querySelector('.error-boundary-banner')).toBeNull();
    showErrorBanner();
    expect(document.querySelectorAll('.error-boundary-banner')).toHaveLength(1);
  });

  it('does nothing without a document body', () => {
    vi.spyOn(document, 'body', 'get').mockReturnValue(null as unknown as HTMLElement);
    showErrorBanner();
    vi.restoreAllMocks();
    expect(document.querySelector('.error-boundary-banner')).toBeNull();
  });
});
