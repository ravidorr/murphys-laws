import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isRunningStandalone,
  isIOS,
  isSafari,
  initInstallPrompt,
  trackPageView,
  trackLawView,
  trackCalculatorUse,
  recordQualifyingUserAction,
  showInstallPrompt,
  showIOSInstallInstructions,
  hideInstallPrompt,
  manuallyShowInstallPrompt,
  canShowInstallPrompt,
  _resetForTesting,
  _setDeferredPromptForTesting,
  _getEngagementForTesting,
  _setEngagementForTesting,
  _setIsInstalledForTesting,
  _setQualifyingUserActionForTesting
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
        (call: [string, EventListener]) => call[0] === 'beforeinstallprompt'
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
      expect(localThis.prompt!.classList.contains('install-prompt-ios')).toBe(true);
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
      expect(localThis.prompt).toBeTruthy();
      expect(localThis.prompt!.getAttribute('role')).toBe('dialog');
      expect(localThis.prompt!.getAttribute('aria-labelledby')).toBe('install-prompt-title');
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

    it('does not show when isInstalled is true', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      _setIsInstalledForTesting(true);

      showIOSInstallInstructions();

      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('does not show when running standalone', () => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('standalone'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      showIOSInstallInstructions();

      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('does not show when promptDismissedThisSession is true', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' })
      };
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();
      const dismissBtn = document.querySelector('.install-prompt [data-action="dismiss"]') as HTMLElement | null;
      dismissBtn?.click();
      await new Promise(r => setTimeout(r, 350));

      showIOSInstallInstructions();

      expect(document.querySelector('.install-prompt-ios')).toBeFalsy();
    });

    it('clicking iOS prompt outside dismiss button does not remove prompt', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();

      const title = document.querySelector('#install-prompt-title') as HTMLElement | null;
      expect(title).toBeTruthy();
      title!.click();

      expect(document.querySelector('.install-prompt')).toBeTruthy();
    });

    it('L359 B0 L378 B0: iOS prompt click on HTMLElement without data-action dismiss does not call dismissPrompt', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      showIOSInstallInstructions();
      const content = document.querySelector('.install-prompt-text') as HTMLElement | null;
      expect(content).toBeTruthy();
      content!.click();
      expect(document.querySelector('.install-prompt')).toBeTruthy();
    });

    it('clicking iOS prompt dismiss button calls dismissPrompt (L277 L283)', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();

      const dismissBtn = document.querySelector('.install-prompt [data-action="dismiss"]') as HTMLElement | null;
      expect(dismissBtn).toBeTruthy();
      dismissBtn!.click();

      await new Promise(r => setTimeout(r, 350));
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });
  });

  describe('showInstallPrompt click branches', () => {
    it('dismiss click on standard prompt calls dismissPrompt (L226 L228)', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' })
      };
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      localThis.dismissBtn = document.querySelector('.install-prompt [data-action="dismiss"]') as HTMLElement | null;
      expect(localThis.dismissBtn).toBeTruthy();
      localThis.dismissBtn!.click();

      await new Promise(r => setTimeout(r, 350));
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('clicking standard prompt outside buttons does not install or dismiss (L226 B0)', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' })
      };
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      const content = document.querySelector('.install-prompt-content') as HTMLElement | null;
      expect(content).toBeTruthy();
      content!.click();

      expect(document.querySelector('.install-prompt')).toBeTruthy();
      expect(localThis.mockPromptEvent!.prompt).not.toHaveBeenCalled();
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

    it('does not show prompt when promptDismissedThisSession is true', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      const dismissBtn = document.querySelector('[data-action="dismiss"]') as HTMLElement | null;
      dismissBtn?.click();
      await new Promise(r => setTimeout(r, 350));

      showInstallPrompt();
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('calls hideInstallPrompt before showing when existing prompt is present', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const stale = document.createElement('div');
      stale.className = 'install-prompt';
      stale.id = 'install-prompt';
      document.body.appendChild(stale);

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      await new Promise(r => setTimeout(r, 350));
      const prompts = document.querySelectorAll('#install-prompt');
      expect(prompts.length).toBe(1);
      expect(prompts[0]?.querySelector('[data-action="install"]')).toBeTruthy();
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
      try {
        vi.useFakeTimers();
        window.matchMedia = vi.fn().mockReturnValue({ matches: false });

        showIOSInstallInstructions();
        hideInstallPrompt();
        await vi.advanceTimersByTimeAsync(350);
        showIOSInstallInstructions();

        const prompts = document.querySelectorAll('#install-prompt');
        expect(prompts.length).toBe(0);
      } finally {
        vi.useRealTimers();
      }
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
      expect(new Date(localThis.dismissed!).getTime()).toBeLessThanOrEqual(Date.now());
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
      expect(localThis.prompt!.querySelector('[data-action="install"]')).toBeTruthy();
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

    it('L281 B0: click on Install button does not enter dismiss branch', async () => {
      const mockPrompt = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };
      _setDeferredPromptForTesting(mockPrompt as unknown as DeferredPrompt);
      showInstallPrompt();
      const installBtn = document.querySelector('.install-prompt [data-action="install"]') as HTMLElement | null;
      installBtn!.click();
      await new Promise(r => setTimeout(r, 10));
      expect(mockPrompt.prompt).toHaveBeenCalled();
    });

    it('dismisses prompt when Not now button is clicked', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      const dismissBtn = document.querySelector('.install-prompt [data-action="dismiss"]') as HTMLElement | null;
      expect(dismissBtn).toBeTruthy();
      dismissBtn!.click();

      await new Promise(r => setTimeout(r, 350));
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('adds install-prompt-visible class after requestAnimationFrame', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      await new Promise<void>(r => requestAnimationFrame(() => r()));
      const prompt = document.querySelector('.install-prompt');
      expect(prompt).toBeTruthy();
      expect(prompt!.classList.contains('install-prompt-visible')).toBe(true);
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

      _setEngagementForTesting({
        pageViews: 3,
        lawsViewed: 2,
        timeOnSite: 31000,
        startTime: Date.now() - 31000
      });

      recordQualifyingUserAction();

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

    it('L230 B0: shouldShow true but no deferredPrompt skips showInstallPrompt', () => {
      _setDeferredPromptForTesting(null);
      _setEngagementForTesting({
        pageViews: 0,
        lawsViewed: 0,
        timeOnSite: 0,
        calculatorUsed: true,
        startTime: Date.now()
      });
      trackCalculatorUse();
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('L232 B1: shouldShow true and iOS Safari shows iOS install instructions', () => {
      const origUA = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        configurable: true
      });
      _setDeferredPromptForTesting(null);
      _setEngagementForTesting({
        pageViews: 0,
        lawsViewed: 0,
        timeOnSite: 0,
        calculatorUsed: true,
        startTime: Date.now()
      });
      try {
        trackCalculatorUse();
        expect(document.querySelector('.install-prompt.install-prompt-ios')).toBeTruthy();
      } finally {
        Object.defineProperty(navigator, 'userAgent', { value: origUA, configurable: true });
      }
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

      localStorage.setItem('pwa_install_dismissed',
        new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());

      _setEngagementForTesting({
        pageViews: 10,
        lawsViewed: 10,
        timeOnSite: 60000,
        calculatorUsed: true
      });

      recordQualifyingUserAction();

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

  describe('insecure context (localStorage throws)', () => {
    it('does not throw when localStorage.getItem throws (e.g. SecurityError)', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('The operation is insecure.');
      });

      expect(() => trackPageView()).not.toThrow();

      getItemSpy.mockRestore();
    });

    it('shows prompt when thresholds are met even if localStorage.getItem throws', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      _setEngagementForTesting({
        pageViews: 3,
        lawsViewed: 2,
        timeOnSite: 31000,
        startTime: Date.now() - 31000
      });

      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
        if (key === 'pwa_install_never_show') return null;
        if (key === 'pwa_install_dismissed') throw new Error('The operation is insecure.');
        return null;
      });

      recordQualifyingUserAction();

      expect(document.querySelector('.install-prompt')).toBeTruthy();
      getItemSpy.mockRestore();
    });

    it('dismiss does not throw when localStorage.setItem throws and prompt is hidden', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();
      expect(document.querySelector('.install-prompt')).toBeTruthy();

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('The operation is insecure.');
      });

      const dismissBtn = document.querySelector('.install-prompt [data-action="dismiss"]') as HTMLElement | null;
      expect(dismissBtn).toBeTruthy();
      expect(() => dismissBtn!.click()).not.toThrow();

      return new Promise<void>(r => setTimeout(r, 350)).then(() => {
        expect(document.querySelector('.install-prompt')).toBeFalsy();
        setItemSpy.mockRestore();
      });
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
    it('triggerInstall logs when userChoice outcome is accepted (L374)', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      localThis.installBtn = document.querySelector('[data-action="install"]');
      (localThis.installBtn as HTMLElement | null)?.click();

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(logSpy).toHaveBeenCalledWith('User accepted the install prompt');
      logSpy.mockRestore();
    });

    it('triggerInstall logs when userChoice outcome is dismissed (L355 else)', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      localThis.installBtn = document.querySelector('[data-action="install"]');
      (localThis.installBtn as HTMLElement | null)?.click();

      await new Promise(resolve => setTimeout(resolve, 50));
      expect(logSpy).toHaveBeenCalledWith('User dismissed the install prompt');
      logSpy.mockRestore();
    });

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

    it('does not replace iOS prompt with standard when already shown this session', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();
      expect(document.querySelector('.install-prompt-ios')).toBeTruthy();

      const localThis: InstallPromptTestContext = {};
      localThis.mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };

      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      await new Promise(resolve => setTimeout(resolve, 350));

      showInstallPrompt();

      await new Promise(resolve => setTimeout(resolve, 350));
      expect(document.querySelectorAll('.install-prompt').length).toBe(1);
      expect(document.querySelector('.install-prompt-ios')).toBeTruthy();
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

  describe('focus trap', () => {
    interface FocusTrapContext {
      mockPromptEvent?: {
        preventDefault: ReturnType<typeof vi.fn>;
        prompt: ReturnType<typeof vi.fn>;
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
      };
      trigger?: HTMLButtonElement;
      installBtn?: HTMLElement | null;
      neverBtn?: HTMLElement | null;
      dismissBtn?: HTMLElement | null;
      gotItBtn?: HTMLElement | null;
    }

    function newMockPromptEvent() {
      return {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' })
      };
    }

    it('has aria-modal="true" on the generic variant', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      showInstallPrompt();
      expect(
        document.querySelector('.install-prompt')!.getAttribute('aria-modal')
      ).toBe('true');
    });

    it('has aria-modal="true" on the iOS variant', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();
      expect(
        document.querySelector('.install-prompt.install-prompt-ios')!
          .getAttribute('aria-modal')
      ).toBe('true');
    });

    it('moves focus to the primary Install button after rAF on generic variant', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      localThis.installBtn = document.querySelector('[data-action="install"]') as HTMLElement | null;
      expect(localThis.installBtn).toBeTruthy();
      expect(document.activeElement).toBe(localThis.installBtn);
    });

    it('moves focus to the primary Got it button after rAF on iOS variant', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      const localThis: FocusTrapContext = {};
      localThis.gotItBtn = document.querySelector('.install-prompt-ios [data-action="dismiss"]') as HTMLElement | null;
      expect(localThis.gotItBtn).toBeTruthy();
      expect(document.activeElement).toBe(localThis.gotItBtn);
    });

    it('Tab from last focusable wraps to first', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      localThis.installBtn = document.querySelector('[data-action="install"]') as HTMLElement | null;
      localThis.neverBtn = document.querySelector('[data-action="never"]') as HTMLElement | null;
      expect(localThis.installBtn).toBeTruthy();
      expect(localThis.neverBtn).toBeTruthy();

      localThis.neverBtn!.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.dispatchEvent(tabEvent);

      expect(tabEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(localThis.installBtn);
    });

    it('Shift+Tab from first focusable wraps to last', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      localThis.installBtn = document.querySelector('[data-action="install"]') as HTMLElement | null;
      localThis.neverBtn = document.querySelector('[data-action="never"]') as HTMLElement | null;
      expect(localThis.installBtn).toBeTruthy();
      expect(localThis.neverBtn).toBeTruthy();

      localThis.installBtn!.focus();
      const shiftTabEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(shiftTabEvent);

      expect(shiftTabEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(localThis.neverBtn);
    });

    it('Tab in the middle of the focusable list is not intercepted', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      localThis.dismissBtn = document.querySelector('[data-action="dismiss"]') as HTMLElement | null;
      localThis.dismissBtn!.focus();

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.dispatchEvent(tabEvent);

      expect(tabEvent.defaultPrevented).toBe(false);
    });

    it('Tab when focus has escaped the prompt yanks focus back to first focusable', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      const outside = document.createElement('button');
      outside.textContent = 'Outside';
      document.body.appendChild(outside);

      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      outside.focus();
      expect(document.activeElement).toBe(outside);

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.dispatchEvent(tabEvent);

      localThis.installBtn = document.querySelector('[data-action="install"]') as HTMLElement | null;
      expect(tabEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(localThis.installBtn);

      outside.remove();
    });

    it('Escape key dismisses the generic prompt via the dismiss action', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.dispatchEvent(escEvent);

      expect(escEvent.defaultPrevented).toBe(true);
      await new Promise(r => setTimeout(r, 350));
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('Escape key dismisses the iOS prompt via the dismiss action (Got it)', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.dispatchEvent(escEvent);

      expect(escEvent.defaultPrevented).toBe(true);
      await new Promise(r => setTimeout(r, 350));
      expect(document.querySelector('.install-prompt')).toBeFalsy();
    });

    it('restores focus to the previously-focused element on hide', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};

      localThis.trigger = document.createElement('button');
      localThis.trigger.textContent = 'Open';
      document.body.appendChild(localThis.trigger);
      localThis.trigger.focus();
      expect(document.activeElement).toBe(localThis.trigger);

      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      expect(document.activeElement).not.toBe(localThis.trigger);

      hideInstallPrompt();
      await new Promise(r => setTimeout(r, 10));

      expect(document.activeElement).toBe(localThis.trigger);
      localThis.trigger.remove();
    });

    it('does not throw when the previously-focused element was removed from the DOM', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.trigger = document.createElement('button');
      document.body.appendChild(localThis.trigger);
      localThis.trigger.focus();

      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);
      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      localThis.trigger.remove();

      expect(() => hideInstallPrompt()).not.toThrow();
    });

    it('removes the document keydown listener after hide so next keypress is not trapped', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      hideInstallPrompt();
      await new Promise(r => setTimeout(r, 350));

      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      document.dispatchEvent(tabEvent);

      expect(tabEvent.defaultPrevented).toBe(false);
    });

    it('ignores keys other than Tab and Escape', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      const aEvent = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
      document.dispatchEvent(aEvent);

      expect(aEvent.defaultPrevented).toBe(false);
      expect(document.querySelector('.install-prompt')).toBeTruthy();
    });

    it('keydown is a no-op when the prompt has been removed from the DOM already', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const localThis: FocusTrapContext = {};
      localThis.mockPromptEvent = newMockPromptEvent();
      _setDeferredPromptForTesting(localThis.mockPromptEvent as unknown as DeferredPrompt);

      showInstallPrompt();
      await new Promise<void>(r => requestAnimationFrame(() => r()));

      // Force-remove the prompt element without going through hideInstallPrompt
      // (simulates a race where the element is gone but the listener is still
      // attached). The handler should early-return.
      const prompt = document.querySelector('.install-prompt')!;
      prompt.remove();

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.dispatchEvent(escEvent);

      expect(escEvent.defaultPrevented).toBe(false);
    });
  });

  describe('never-show-again action', () => {
    it('clicking Never show again on the generic prompt persists the flag and dismisses', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      const mockPromptEvent = {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' })
      };
      _setDeferredPromptForTesting(mockPromptEvent as unknown as DeferredPrompt);

      showInstallPrompt();
      const neverBtn = document.querySelector('.install-prompt [data-action="never"]') as HTMLElement | null;
      expect(neverBtn).toBeTruthy();
      neverBtn!.click();
      await new Promise(r => setTimeout(r, 350));

      expect(document.querySelector('.install-prompt')).toBeFalsy();
      expect(localStorage.getItem('pwa_install_never_show')).toBe('1');
    });

    it('clicking Never show again on the iOS prompt persists the flag and dismisses', async () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      showIOSInstallInstructions();
      const neverBtn = document.querySelector('.install-prompt-ios [data-action="never"]') as HTMLElement | null;
      expect(neverBtn).toBeTruthy();
      neverBtn!.click();
      await new Promise(r => setTimeout(r, 350));

      expect(document.querySelector('.install-prompt')).toBeFalsy();
      expect(localStorage.getItem('pwa_install_never_show')).toBe('1');
    });
  });
});
