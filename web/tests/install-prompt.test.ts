import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isRunningStandalone,
  isIOS,
  isSafari,
  initInstallPrompt,
  trackPageView,
  trackLawView,
  trackCalculatorUse,
  showInstallPrompt,
  showIOSInstallInstructions,
  hideInstallPrompt,
  manuallyShowInstallPrompt,
  canShowInstallPrompt,
  _resetForTesting,
  _setDeferredPromptForTesting,
  _getEngagementForTesting,
  _setEngagementForTesting,
  _setIsInstalledForTesting
} from '../src/components/install-prompt.js';

/** Test-only: cast mock to the deferred prompt type expected by _setDeferredPromptForTesting */
type DeferredPrompt = NonNullable<Parameters<typeof _setDeferredPromptForTesting>[0]>;

interface InstallPromptTestContext {
  originalUA?: string;
  originalPlatform?: string;
  originalMaxTouchPoints?: number;
  callCount?: number;
  addEventListenerSpy?: ReturnType<typeof vi.spyOn>;
  prompt?: Element | null;
  steps?: NodeListOf<Element>;
  dismissBtn?: HTMLElement | null;
  dismissed?: string | null;
  mockPromptEvent?: {
    preventDefault: ReturnType<typeof vi.fn>;
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  };
  installBtn?: Element | null;
  before?: { pageViews: number; lawsViewed: number; calculatorUsed: boolean };
  after?: { pageViews: number; lawsViewed: number; calculatorUsed: boolean };
}

describe('Install Prompt Component', () => {
  beforeEach(() => {
    // Reset module state
    _resetForTesting();

    // Clear any existing prompts
    document.querySelectorAll('.install-prompt').forEach(el => el.remove());

    // Clear localStorage
    localStorage.clear();

    // Mock matchMedia
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
  });

  afterEach(() => {
    document.querySelectorAll('.install-prompt').forEach(el => el.remove());
    vi.restoreAllMocks();
  });

  describe('isRunningStandalone', () => {
    it('returns false when not in standalone mode', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      expect(isRunningStandalone()).toBe(false);
    });

    it('returns true when in standalone mode', () => {
      const localThis: InstallPromptTestContext = { callCount: 0 };
      window.matchMedia = vi.fn().mockImplementation((query) => {
        localThis.callCount!++;
        return { matches: query.includes('standalone') };
      });
      expect(isRunningStandalone()).toBe(true);
    });

    it('returns true when navigator.standalone is true (iOS)', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      Object.defineProperty(window.navigator, 'standalone', {
        value: true,
        writable: true,
        configurable: true
      });
      expect(isRunningStandalone()).toBe(true);
      Object.defineProperty(window.navigator, 'standalone', {
        value: undefined,
        writable: true,
        configurable: true
      });
    });
  });

  describe('isIOS', () => {
    it('returns true for iPhone user agent', () => {
      const localThis: InstallPromptTestContext = {};
      localThis.originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        writable: true,
        configurable: true
      });
      expect(isIOS()).toBe(true);
      Object.defineProperty(navigator, 'userAgent', {
        value: localThis.originalUA,
        writable: true,
        configurable: true
      });
    });

    it('returns true for iPad user agent', () => {
      const localThis: InstallPromptTestContext = {};
      localThis.originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        writable: true,
        configurable: true
      });
      expect(isIOS()).toBe(true);
      Object.defineProperty(navigator, 'userAgent', {
        value: localThis.originalUA,
        writable: true,
        configurable: true
      });
    });

    it('returns false for Android user agent', () => {
      const localThis: InstallPromptTestContext = {};
      localThis.originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; Pixel 4)',
        writable: true,
        configurable: true
      });
      expect(isIOS()).toBe(false);
      Object.defineProperty(navigator, 'userAgent', {
        value: localThis.originalUA,
        writable: true,
        configurable: true
      });
    });
  });

  describe('isSafari', () => {
    it('returns true for Safari user agent', () => {
      const localThis: InstallPromptTestContext = {};
      localThis.originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
        writable: true,
        configurable: true
      });
      expect(isSafari()).toBe(true);
      Object.defineProperty(navigator, 'userAgent', {
        value: localThis.originalUA,
        writable: true,
        configurable: true
      });
    });

    it('returns false for Chrome user agent', () => {
      const localThis: InstallPromptTestContext = {};
      localThis.originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        writable: true,
        configurable: true
      });
      expect(isSafari()).toBe(false);
      Object.defineProperty(navigator, 'userAgent', {
        value: localThis.originalUA,
        writable: true,
        configurable: true
      });
    });
  });

  describe('initInstallPrompt', () => {
    it('does not throw when called', () => {
      expect(() => initInstallPrompt()).not.toThrow();
    });

    it('does not initialize if already in standalone mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('standalone')
      }));

      const localThis: InstallPromptTestContext = {};
      localThis.addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      initInstallPrompt();

      // Should not add beforeinstallprompt listener when already installed
      const beforeinstallpromptCalls = localThis.addEventListenerSpy.mock.calls.filter(
        call => call[0] === 'beforeinstallprompt'
      );
      expect(beforeinstallpromptCalls.length).toBe(0);
    });
  });

  describe('trackPageView', () => {
    it('is a function', () => {
      expect(typeof trackPageView).toBe('function');
    });

    it('does not throw when called', () => {
      expect(() => trackPageView()).not.toThrow();
    });
  });

  describe('trackLawView', () => {
    it('is a function', () => {
      expect(typeof trackLawView).toBe('function');
    });

    it('does not throw when called', () => {
      expect(() => trackLawView()).not.toThrow();
    });
  });

  describe('trackCalculatorUse', () => {
    it('is a function', () => {
      expect(typeof trackCalculatorUse).toBe('function');
    });

    it('does not throw when called', () => {
      expect(() => trackCalculatorUse()).not.toThrow();
    });
  });

  describe('showIOSInstallInstructions', () => {
    it('creates iOS install instructions dialog', () => {
      // Force not standalone
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();

      const localThis: InstallPromptTestContext = {};
      localThis.prompt = document.querySelector('.install-prompt');
      expect(localThis.prompt).toBeTruthy();
      expect(localThis.prompt.classList.contains('install-prompt-ios')).toBe(true);
    });

    it('shows step-by-step instructions', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();

      const localThis: InstallPromptTestContext = {};
      localThis.steps = document.querySelectorAll('.install-step');
      expect(localThis.steps.length).toBe(3);
    });

    it('has correct accessibility attributes', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();

      const localThis: InstallPromptTestContext = {};
      localThis.prompt = document.querySelector('.install-prompt');
      expect(localThis.prompt.getAttribute('role')).toBe('dialog');
      expect(localThis.prompt.getAttribute('aria-labelledby')).toBe('install-prompt-title');
    });

    it('removes prompt when dismiss is clicked', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();

      const localThis: InstallPromptTestContext = {};
      localThis.dismissBtn = document.querySelector('[data-action="dismiss"]') as HTMLElement | null;
      localThis.dismissBtn?.click();

      // Wait for transition
      return new Promise(resolve => setTimeout(resolve, 350)).then(() => {
        expect(document.querySelector('.install-prompt')).toBeFalsy();
      });
    });
  });

  describe('hideInstallPrompt', () => {
    it('removes the install prompt if present', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();
      expect(document.querySelector('.install-prompt')).toBeTruthy();

      hideInstallPrompt();

      // Wait for transition
      return new Promise(resolve => setTimeout(resolve, 350)).then(() => {
        expect(document.querySelector('.install-prompt')).toBeFalsy();
      });
    });

    it('does not throw if no prompt exists', () => {
      expect(() => hideInstallPrompt()).not.toThrow();
    });
  });

  describe('manuallyShowInstallPrompt', () => {
    it('returns false when in standalone mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('standalone')
      }));

      expect(manuallyShowInstallPrompt()).toBe(false);
    });

    it('shows iOS instructions for iOS Safari', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.originalUA = navigator.userAgent;

      // Set iOS Safari user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        writable: true,
        configurable: true
      });

      const result = manuallyShowInstallPrompt();
      expect(result).toBe(true);
      expect(document.querySelector('.install-prompt-ios')).toBeTruthy();

      Object.defineProperty(navigator, 'userAgent', {
        value: localThis.originalUA,
        writable: true,
        configurable: true
      });
    });
  });

  describe('canShowInstallPrompt', () => {
    it('returns false when in standalone mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('standalone')
      }));

      expect(canShowInstallPrompt()).toBe(false);
    });

    it('returns true for iOS Safari when not installed', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.originalUA = navigator.userAgent;

      // Set iOS Safari user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        writable: true,
        configurable: true
      });

      expect(canShowInstallPrompt()).toBe(true);

      Object.defineProperty(navigator, 'userAgent', {
        value: localThis.originalUA,
        writable: true,
        configurable: true
      });
    });
  });

  describe('showInstallPrompt', () => {
    it('does not show prompt without deferred event', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showInstallPrompt();

      // Should not create prompt without deferredPrompt
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });
  });

  describe('prompt element', () => {
    it('adds prompt element to DOM when showing', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();

      const prompt = document.getElementById('install-prompt');
      expect(prompt).toBeTruthy();
      expect(prompt?.tagName).toBe('DIV');
      expect(prompt?.className).toContain('install-prompt');
    });

    it('does not add duplicate prompt when showing after hide', async () => {
      vi.useFakeTimers();
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();
      hideInstallPrompt();
      // hideInstallPrompt removes the element asynchronously (transitionend or 300ms fallback)
      await vi.advanceTimersByTimeAsync(350);
      showIOSInstallInstructions();

      const prompts = document.querySelectorAll('#install-prompt');
      expect(prompts.length).toBe(1);
      vi.useRealTimers();
    });
  });

  describe('localStorage integration', () => {
    it('stores dismissal timestamp when dismissed', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();

      const localThis: InstallPromptTestContext = {};
      localThis.dismissBtn = document.querySelector('[data-action="dismiss"]') as HTMLElement | null;
      localThis.dismissBtn?.click();

      localThis.dismissed = localStorage.getItem('pwa_install_dismissed');
      expect(localThis.dismissed).toBeTruthy();
      expect(new Date(localThis.dismissed).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('showInstallPrompt with deferredPrompt', () => {
    it('creates install prompt UI when deferredPrompt exists', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      localThis.prompt = document.querySelector('.install-prompt');
      expect(localThis.prompt).toBeTruthy();
      expect(localThis.prompt.querySelector('[data-action="install"]')).toBeTruthy();
    });

    it('does not show prompt when already installed', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      _setIsInstalledForTesting(true);

      showInstallPrompt();

      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('calls deferredPrompt.prompt() when Install button is clicked', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      localThis.installBtn = document.querySelector('[data-action="install"]');
      (localThis.installBtn as HTMLElement | null)?.click();

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(localThis.mockPromptEvent.prompt).toHaveBeenCalled();
    });
  });

  describe('engagement tracking', () => {
    it('trackPageView increments page view counter', () => {
      const localThis: InstallPromptTestContext = {};
      localThis.before = _getEngagementForTesting();
      expect(localThis.before.pageViews).toBe(0);

      trackPageView();

      localThis.after = _getEngagementForTesting();
      expect(localThis.after.pageViews).toBe(1);
    });

    it('trackLawView increments law view counter', () => {
      const localThis: InstallPromptTestContext = {};
      localThis.before = _getEngagementForTesting();
      expect(localThis.before.lawsViewed).toBe(0);

      trackLawView();

      localThis.after = _getEngagementForTesting();
      expect(localThis.after.lawsViewed).toBe(1);
    });

    it('trackCalculatorUse sets calculator used flag', () => {
      const localThis: InstallPromptTestContext = {};
      localThis.before = _getEngagementForTesting();
      expect(localThis.before.calculatorUsed).toBe(false);

      trackCalculatorUse();

      localThis.after = _getEngagementForTesting();
      expect(localThis.after.calculatorUsed).toBe(true);
    });
  });

  describe('engagement thresholds', () => {
    it('shows prompt after meeting all engagement thresholds with deferredPrompt', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      // Set engagement to meet thresholds: 3+ page views, 2+ laws, 30+ seconds
      _setEngagementForTesting({
        pageViews: 3,
        lawsViewed: 2,
        timeOnSite: 31000,
        startTime: Date.now() - 31000
      });

      // Trigger check by tracking another page view
      trackPageView();

      expect(document.querySelector('.install-prompt')).toBeTruthy();
    });

    it('shows prompt immediately after calculator use (bonus)', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      // Only calculator use, no other engagement
      trackCalculatorUse();

      expect(document.querySelector('.install-prompt')).toBeTruthy();
    });

    it('respects 7-day cooldown after dismissal', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      // Set dismissal to 3 days ago (within 7 day cooldown)
      localStorage.setItem('pwa_install_dismissed',
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());

      // Meet all thresholds
      _setEngagementForTesting({
        pageViews: 10,
        lawsViewed: 10,
        timeOnSite: 60000,
        calculatorUsed: true
      });

      trackPageView();

      // Should NOT show prompt due to cooldown
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('shows prompt again after 7+ days since dismissal', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      // Set dismissal to 8 days ago (past 7 day cooldown)
      localStorage.setItem('pwa_install_dismissed',
        new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString());

      // Use calculator for immediate prompt
      trackCalculatorUse();

      // Should show prompt since cooldown expired
      expect(document.querySelector('.install-prompt')).toBeTruthy();
    });
  });

  describe('appinstalled event', () => {
    it('handles appinstalled event correctly', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      initInstallPrompt();

      // Show a prompt first
      showIOSInstallInstructions();
      expect(document.querySelector('.install-prompt')).toBeTruthy();

      // Fire appinstalled event
      window.dispatchEvent(new Event('appinstalled'));

      // Wait for removal
      return new Promise(resolve => setTimeout(resolve, 350)).then(() => {
        expect(document.querySelector('.install-prompt')).toBeFalsy();
        expect(canShowInstallPrompt()).toBe(false);
      });
    });
  });

  describe('iPad Pro detection', () => {
    it('returns true for iPad Pro (MacIntel with touch)', () => {
      const localThis: InstallPromptTestContext = {};
      localThis.originalUA = navigator.userAgent;
      localThis.originalPlatform = navigator.platform;
      localThis.originalMaxTouchPoints = navigator.maxTouchPoints;

      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        configurable: true
      });
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        configurable: true
      });

      expect(isIOS()).toBe(true);

      // Restore
      Object.defineProperty(navigator, 'userAgent', {
        value: localThis.originalUA,
        configurable: true
      });
      Object.defineProperty(navigator, 'platform', {
        value: localThis.originalPlatform,
        configurable: true
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: localThis.originalMaxTouchPoints,
        configurable: true
      });
    });
  });

  describe('manuallyShowInstallPrompt edge cases', () => {
    it('returns false when neither deferredPrompt nor iOS Safari available', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.originalUA = navigator.userAgent;

      // Set Android Chrome user agent (not iOS, not Safari)
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36',
        configurable: true
      });

      // No deferredPrompt set
      const result = manuallyShowInstallPrompt();
      expect(result).toBe(false);

      Object.defineProperty(navigator, 'userAgent', {
        value: localThis.originalUA,
        configurable: true
      });
    });

    it('returns true and shows prompt when deferredPrompt exists', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      const result = manuallyShowInstallPrompt();
      expect(result).toBe(true);
      expect(document.querySelector('.install-prompt')).toBeTruthy();
    });
  });

  describe('userChoice outcomes', () => {
    it('handles dismissed outcome from userChoice', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      localThis.installBtn = document.querySelector('[data-action="install"]');
      (localThis.installBtn as HTMLElement | null)?.click();

      // Wait for async handling and transition
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(localThis.mockPromptEvent.prompt).toHaveBeenCalled();
      // Prompt should be hidden after user choice (after transition completes)
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('clears deferredPrompt after use', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      localThis.installBtn = document.querySelector('[data-action="install"]');
      (localThis.installBtn as HTMLElement | null)?.click();

      // Wait for async handling and transition
      await new Promise(resolve => setTimeout(resolve, 400));

      // deferredPrompt should be cleared - canShowInstallPrompt should return false
      // (unless iOS Safari, so we need to check on non-iOS)
      const originalUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10; Pixel 4) Chrome/91.0',
        configurable: true
      });

      expect(canShowInstallPrompt()).toBe(false);

      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true
      });
    });
  });

  describe('engagement threshold edge cases', () => {
    it('does not show prompt when thresholds not met', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      // Only 1 page view (need 3)
      trackPageView();

      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('does not show prompt when only page views threshold met', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      // Meet page view threshold but not others
      _setEngagementForTesting({
        pageViews: 5,
        lawsViewed: 0,
        timeOnSite: 5000,
        startTime: Date.now() - 5000
      });

      trackPageView();

      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('does not show prompt when only time threshold met', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      // Meet time threshold but not others
      _setEngagementForTesting({
        pageViews: 1,
        lawsViewed: 0,
        timeOnSite: 60000,
        startTime: Date.now() - 60000
      });

      trackPageView();

      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });
  });

  describe('canShowInstallPrompt edge cases', () => {
    it('returns true when deferredPrompt exists', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      expect(canShowInstallPrompt()).toBe(true);
    });

    it('returns false when isInstalled is true', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      _setIsInstalledForTesting(true);

      expect(canShowInstallPrompt()).toBe(false);
    });
  });

  describe('prompt replacement', () => {
    it('removes existing prompt before showing new one', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      // Show iOS instructions first
      showIOSInstallInstructions();
      expect(document.querySelectorAll('.install-prompt').length).toBe(1);

      // Wait for transition timeout fallback
      await new Promise(resolve => setTimeout(resolve, 350));

      // Show again - should replace, not add
      showIOSInstallInstructions();

      // After removal timeout, should only have one prompt
      await new Promise(resolve => setTimeout(resolve, 350));
      expect(document.querySelectorAll('.install-prompt').length).toBe(1);
    });

    it('removes iOS prompt when showing standard prompt', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      // Show iOS instructions first
      showIOSInstallInstructions();
      expect(document.querySelector('.install-prompt-ios')).toBeTruthy();

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      // Wait for transition timeout fallback
      await new Promise(resolve => setTimeout(resolve, 350));

      // Show standard prompt - should replace iOS prompt
      showInstallPrompt();

      // After removal timeout, should only have one standard prompt
      await new Promise(resolve => setTimeout(resolve, 350));
      expect(document.querySelectorAll('.install-prompt').length).toBe(1);
      expect(document.querySelector('.install-prompt-ios')).toBeFalsy();
    });
  });

  describe('session dismissal flag', () => {
    it('does not show prompt again after dismissal in same session', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      // Show and dismiss
      showInstallPrompt();
      const dismissBtn = document.querySelector('[data-action="dismiss"]') as HTMLElement | null;
      dismissBtn?.click();

      // Wait for transition to complete and state to update
      await new Promise(resolve => setTimeout(resolve, 400));

      // Try to show again with calculator bonus (should trigger immediately)
      _setDeferredPromptForTesting({
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      } as unknown as DeferredPrompt);
      trackCalculatorUse();

      // Should NOT show because dismissed this session
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });
  });

  describe('showIOSInstallInstructions guards', () => {
    it('does not show when already installed', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      _setIsInstalledForTesting(true);

      showIOSInstallInstructions();

      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('does not show when in standalone mode', () => {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query.includes('standalone')
      }));

      showIOSInstallInstructions();

      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });
  });
});
