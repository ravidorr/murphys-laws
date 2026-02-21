import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { showUpdateNotification, showUpdateAvailable, showOfflineReady } from '../src/components/update-notification.js';

interface UpdateNotificationTestContext {
  notification?: HTMLElement | null;
  title?: Element | null;
  updateBtn?: Element | null;
  dismissBtn?: Element | null;
  notifications?: NodeListOf<Element>;
  onUpdate?: (() => void) | Mock<() => void>;
  onDismiss?: (() => void) | Mock<() => void>;
  updateSW?: ((reloadPage?: boolean) => void) | Mock<(reloadPage?: boolean) => void>;
}

describe('Update Notification Component', () => {
  beforeEach(() => {
    // Clear any existing notifications
    document.querySelectorAll('.pwa-notification').forEach(el => el.remove());
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.querySelectorAll('.pwa-notification').forEach(el => el.remove());
    vi.useRealTimers();
  });

  describe('showUpdateNotification', () => {
    it('creates a notification element with update type', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.notification = showUpdateNotification({ type: 'update' });

      expect(localThis.notification).toBeTruthy();
      expect(localThis.notification.classList.contains('pwa-notification')).toBe(true);
      expect(document.querySelector('.pwa-notification')).toBeTruthy();
    });

    it('creates a notification element with offline type', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.notification = showUpdateNotification({ type: 'offline' });

      expect(localThis.notification).toBeTruthy();
      expect(localThis.notification.classList.contains('pwa-notification')).toBe(true);
    });

    it('shows "Update Available" title for update type', () => {
      showUpdateNotification({ type: 'update' });

      const localThis: UpdateNotificationTestContext = {};
      localThis.title = document.querySelector('.pwa-notification-title');
      expect(localThis.title!).toBeTruthy();
      expect(localThis.title!.textContent).toBe('Update Available');
    });

    it('shows "Ready for Offline" title for offline type', () => {
      showUpdateNotification({ type: 'offline' });

      const localThis: UpdateNotificationTestContext = {};
      localThis.title = document.querySelector('.pwa-notification-title');
      expect(localThis.title!).toBeTruthy();
      expect(localThis.title!.textContent).toBe('Ready for Offline');
    });

    it('shows Refresh button for update type', () => {
      showUpdateNotification({ type: 'update' });

      const localThis: UpdateNotificationTestContext = {};
      localThis.updateBtn = document.querySelector('[data-action="update"]');
      expect(localThis.updateBtn).toBeTruthy();
      expect(localThis.updateBtn!.textContent).toBe('Refresh');
    });

    it('does not show Refresh button for offline type', () => {
      showUpdateNotification({ type: 'offline' });

      const localThis: UpdateNotificationTestContext = {};
      localThis.updateBtn = document.querySelector('[data-action="update"]');
      expect(localThis.updateBtn).toBeFalsy();
    });

    it('has correct accessibility attributes', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.notification = showUpdateNotification({ type: 'update' });

      expect(localThis.notification!).toBeTruthy();
      expect(localThis.notification!.getAttribute('role')).toBe('alert');
      expect(localThis.notification!.getAttribute('aria-live')).toBe('polite');
    });

    it('removes existing notification before showing new one', () => {
      showUpdateNotification({ type: 'update' });
      showUpdateNotification({ type: 'offline' });

      const localThis: UpdateNotificationTestContext = {};
      localThis.notifications = document.querySelectorAll('.pwa-notification');
      expect(localThis.notifications.length).toBe(1);
    });

    it('does not schedule auto-dismiss for update type', () => {
      showUpdateNotification({ type: 'update' });
      vi.advanceTimersByTime(6000);
      const notification = document.querySelector('.pwa-notification');
      expect(notification).toBeTruthy();
    });

    it('calls onUpdate callback when Refresh button is clicked', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.onUpdate = vi.fn<() => void>() as Mock<() => void>;
      showUpdateNotification({ type: 'update', onUpdate: localThis.onUpdate });

      const updateBtn = document.querySelector<HTMLElement>('[data-action="update"]');
      updateBtn?.click();

      expect(localThis.onUpdate).toHaveBeenCalledTimes(1);
    });

    it('removes notification when Refresh button is clicked', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.onUpdate = vi.fn<() => void>() as Mock<() => void>;
      showUpdateNotification({ type: 'update', onUpdate: localThis.onUpdate });

      const updateBtn = document.querySelector<HTMLElement>('[data-action="update"]');
      updateBtn?.click();

      expect(document.querySelector('.pwa-notification')).toBeFalsy();
    });

    it('removes notification when dismiss button is clicked', () => {
      showUpdateNotification({ type: 'update' });

      const dismissBtn = document.querySelector<HTMLElement>('[data-action="dismiss"]');
      dismissBtn?.click();

      expect(document.querySelector('.pwa-notification')).toBeFalsy();
    });

    it('calls onDismiss callback when dismiss button is clicked', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.onDismiss = vi.fn<() => void>() as Mock<() => void>;
      showUpdateNotification({ type: 'update', onDismiss: localThis.onDismiss });

      const dismissBtn = document.querySelector<HTMLElement>('[data-action="dismiss"]');
      dismissBtn?.click();

      expect(localThis.onDismiss).toHaveBeenCalledTimes(1);
    });

    it('adds notification element to DOM', () => {
      showUpdateNotification({ type: 'update' });

      const notification = document.querySelector('.pwa-notification');
      expect(notification).toBeTruthy();
      expect(notification?.tagName).toBe('DIV');
    });

    it('does not add duplicate notification when showing twice', () => {
      showUpdateNotification({ type: 'update' });
      showUpdateNotification({ type: 'offline' });

      const notifications = document.querySelectorAll('.pwa-notification');
      expect(notifications.length).toBe(1);
    });

    it('shows "Later" dismiss button text for update type', () => {
      showUpdateNotification({ type: 'update' });

      const localThis: UpdateNotificationTestContext = {};
      localThis.dismissBtn = document.querySelector('[data-action="dismiss"]');
      expect(localThis.dismissBtn).toBeTruthy();
      expect(localThis.dismissBtn!.textContent).toBe('Later');
    });

    it('shows "Got it" dismiss button text for offline type', () => {
      showUpdateNotification({ type: 'offline' });

      const localThis: UpdateNotificationTestContext = {};
      localThis.dismissBtn = document.querySelector('[data-action="dismiss"]');
      expect(localThis.dismissBtn).toBeTruthy();
      expect(localThis.dismissBtn!.textContent).toBe('Got it');
    });

    it('auto-dismisses offline notification after 5 seconds', () => {
      showUpdateNotification({ type: 'offline' });

      const localThis: UpdateNotificationTestContext = {};
      localThis.notification = document.querySelector('.pwa-notification') as HTMLElement | null;
      expect(localThis.notification).toBeTruthy();

      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);

      // Notification should start animating out (still in DOM but with reverse animation)
      localThis.notification = document.querySelector('.pwa-notification') as HTMLElement | null;
      if (localThis.notification) {
        expect(localThis.notification.style.animation).toContain('reverse');
      }
    });

    it('setTimeout callback sets animation when notification has parentNode (L77)', () => {
      const notification = showUpdateNotification({ type: 'offline' });
      expect(notification.parentNode).toBe(document.body);
      vi.advanceTimersByTime(5000);
      expect(notification.style.animation).toContain('reverse');
    });

    it('does not auto-dismiss update notification', () => {
      showUpdateNotification({ type: 'update' });

      const localThis: UpdateNotificationTestContext = {};
      localThis.notification = document.querySelector('.pwa-notification') as HTMLElement | null;
      expect(localThis.notification).toBeTruthy();

      // Fast-forward 10 seconds
      vi.advanceTimersByTime(10000);

      localThis.notification = document.querySelector('.pwa-notification') as HTMLElement | null;
      expect(localThis.notification).toBeTruthy();
    });

    it('removes element after auto-dismiss animation completes for offline type', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.notification = showUpdateNotification({ type: 'offline' });

      // Fast-forward to trigger auto-dismiss
      vi.advanceTimersByTime(5000);

      // Simulate animation end
      localThis.notification!.dispatchEvent(new Event('animationend'));

      expect(document.querySelector('.pwa-notification')).toBeFalsy();
    });
  });

  describe('showUpdateAvailable', () => {
    it('shows update notification with correct type', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.updateSW = vi.fn<(reloadPage?: boolean) => void>() as Mock<(reloadPage?: boolean) => void>;
      showUpdateAvailable(localThis.updateSW);

      const title = document.querySelector('.pwa-notification-title');
      expect(title).toBeTruthy();
      expect(title!.textContent).toBe('Update Available');
    });

    it('calls updateSW with true when Refresh is clicked', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.updateSW = vi.fn<(reloadPage?: boolean) => void>() as Mock<(reloadPage?: boolean) => void>;
      showUpdateAvailable(localThis.updateSW);

      const updateBtn = document.querySelector<HTMLElement>('[data-action="update"]');
      updateBtn?.click();

      expect(localThis.updateSW).toHaveBeenCalledWith(true);
    });
  });

  describe('showOfflineReady', () => {
    it('shows offline notification with correct type', () => {
      showOfflineReady();

      const localThis: UpdateNotificationTestContext = {};
      localThis.title = document.querySelector('.pwa-notification-title');
      expect(localThis.title).toBeTruthy();
      expect(localThis.title!.textContent).toBe('Ready for Offline');
    });

    it('does not have update button', () => {
      showOfflineReady();

      const localThis: UpdateNotificationTestContext = {};
      localThis.updateBtn = document.querySelector('[data-action="update"]');
      expect(localThis.updateBtn).toBeFalsy();
    });
  });

  describe('edge cases', () => {
    it('handles click on non-HTMLElement target', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.notification = showUpdateNotification({ type: 'update' });

      // Create a synthetic event with a non-HTMLElement target
      const event = new Event('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: null });

      expect(() => localThis.notification!.dispatchEvent(event)).not.toThrow();
    });

    it('handles click on element without data-action', () => {
      showUpdateNotification({ type: 'update' });

      const localThis: UpdateNotificationTestContext = {};
      localThis.notification = document.querySelector('.pwa-notification') as HTMLElement | null;
      expect(localThis.notification).toBeTruthy();
      localThis.notification!.click();

      // Notification should still be there
      expect(document.querySelector('.pwa-notification')).toBeTruthy();
    });
  });
});
