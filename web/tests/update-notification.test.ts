import fs from 'node:fs';
import path from 'node:path';
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

      // Notification should start animating out (still in DOM, with the exit class applied)
      localThis.notification = document.querySelector('.pwa-notification') as HTMLElement | null;
      if (localThis.notification) {
        expect(localThis.notification.classList.contains('pwa-notification--exiting')).toBe(true);
      }
    });

    it('setTimeout callback sets animation when notification has parentNode (L77)', () => {
      const notification = showUpdateNotification({ type: 'offline' });
      expect(notification.parentNode).toBe(document.body);
      vi.advanceTimersByTime(5000);
      expect(notification.classList.contains('pwa-notification--exiting')).toBe(true);
    });

    it('setTimeout callback does nothing when notification already removed (L77 false branch)', () => {
      const notification = showUpdateNotification({ type: 'offline' });
      notification.remove();
      expect(notification.parentNode).toBeNull();
      vi.advanceTimersByTime(5000);
      expect(notification.classList.contains('pwa-notification--exiting')).toBe(false);
    });

    it('does not schedule another removal when the notification is already exiting', () => {
      const notification = showUpdateNotification({ type: 'offline' });
      notification.classList.add('pwa-notification--exiting');

      vi.advanceTimersByTime(5000);

      expect(vi.getTimerCount()).toBe(0);
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

    it('removes offline notification after auto-dismiss even when animationend never fires', () => {
      showUpdateNotification({ type: 'offline' });

      // Browsers can skip animationend (and jsdom never fires it), so the fallback timer must remove it
      vi.advanceTimersByTime(5000 + 400);

      expect(document.querySelector('.pwa-notification')).toBeNull();
    });

    it('removes offline notification when the exit animation ends, then ignores the fallback timer', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.notification = showUpdateNotification({ type: 'offline' });

      vi.advanceTimersByTime(5000);
      expect(localThis.notification.classList.contains('pwa-notification--exiting')).toBe(true);

      localThis.notification.dispatchEvent(new Event('animationend'));
      expect(document.querySelector('.pwa-notification')).toBeNull();

      expect(() => vi.advanceTimersByTime(400)).not.toThrow();
      expect(document.querySelector('.pwa-notification')).toBeNull();
    });

    it('dismisses when Got it is clicked through a translated label', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.onDismiss = vi.fn<() => void>() as Mock<() => void>;
      showUpdateNotification({ type: 'offline', onDismiss: localThis.onDismiss });

      // Page translation wraps button text in <font> elements, so the click lands on the inner <font>
      localThis.dismissBtn = document.querySelector('[data-action="dismiss"]');
      localThis.dismissBtn!.innerHTML = '<font><font>Got it</font></font>';
      localThis.dismissBtn!.querySelector<HTMLElement>('font font')!.click();

      expect(document.querySelector('.pwa-notification')).toBeNull();
      expect(localThis.onDismiss).toHaveBeenCalledTimes(1);
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

    it('keeps the notification when Refresh is clicked without an onUpdate callback', () => {
      showUpdateNotification({ type: 'update' });

      document.querySelector<HTMLElement>('[data-action="update"]')!.click();

      expect(document.querySelector('.pwa-notification')).toBeTruthy();
    });

    it('ignores data-action on elements outside the notification', () => {
      const localThis: UpdateNotificationTestContext = {};
      localThis.onDismiss = vi.fn<() => void>() as Mock<() => void>;
      showUpdateNotification({ type: 'update', onDismiss: localThis.onDismiss });
      document.body.dataset.action = 'dismiss';

      try {
        document.querySelector<HTMLElement>('.pwa-notification-title')!.click();

        expect(document.querySelector('.pwa-notification')).toBeTruthy();
        expect(localThis.onDismiss).not.toHaveBeenCalled();
      } finally {
        delete document.body.dataset.action;
      }
    });
  });

  describe('exit animation CSS', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../styles/partials/update-notification.css'), 'utf8');
    const keyframeNames = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((match) => match[1]);

    // Name of the @keyframes animation set by the top-level rule for `selector`
    function animationNameFor(selector: string): string | undefined {
      const rule = css.split(`\n${selector} {`)[1]?.split('}')[0] ?? '';
      const values = /animation(?:-name)?\s*:([^;]+);/.exec(rule)?.[1]?.trim().split(/\s+/) ?? [];
      return values.find((value) => keyframeNames.includes(value));
    }

    it('gives the exit its own keyframes so browsers start a new animation and fire animationend', () => {
      // Reusing the entrance keyframes (e.g. in reverse) updates the finished entrance animation in place,
      // so animationend never fires in real browsers
      const entrance = animationNameFor('.pwa-notification');
      const exit = animationNameFor('.pwa-notification--exiting');

      expect(entrance).toBeTruthy();
      expect(exit).toBeTruthy();
      expect(exit).not.toBe(entrance);
    });
  });
});
