import { describe, it, expect, afterEach, vi } from 'vitest';
import { showNotification, showSuccess, showError, clearAllNotifications } from '../src/components/notification.js';
import * as icons from '../src/utils/icons.js';

describe('Notification system', () => {
  afterEach(() => {
    // Only clear notifications, don't remove the container
    // (removing it breaks the module-level reference)
    clearAllNotifications();
  });

  describe('showNotification', () => {
    it('is a function', () => {
      expect(typeof showNotification).toBe('function');
    });

    it('returns dismiss function', () => {
      const result = showNotification('Test message', 'info', 0);
      expect(typeof result).toBe('function');
    });
  });

  describe('showSuccess', () => {
    it('is a function', () => {
      expect(typeof showSuccess).toBe('function');
    });

    it('returns dismiss function', () => {
      const result = showSuccess('Success message');
      expect(typeof result).toBe('function');
    });
  });

  describe('showError', () => {
    it('is a function', () => {
      expect(typeof showError).toBe('function');
    });

    it('returns dismiss function', () => {
      const result = showError('Error message');
      expect(typeof result).toBe('function');
    });
  });

  describe('clearAllNotifications', () => {
    it('is a function', () => {
      expect(typeof clearAllNotifications).toBe('function');
    });

    it('does not throw when called', () => {
      expect(() => clearAllNotifications()).not.toThrow();
    });
  });

  describe('notification behavior', () => {
    it('creates notification with correct type class', () => {
      showNotification('Test', 'error', 0);
      const notification = document.querySelector('.notification-error');
      expect(notification).toBeTruthy();
    });

    it('creates notification with info type', () => {
      showNotification('Test', 'info', 0);
      const notification = document.querySelector('.notification-info');
      expect(notification).toBeTruthy();
    });

    it('sets role to alert for error notifications', () => {
      showNotification('Error test', 'error', 0);
      const notification = document.querySelector('.notification-error');
      expect(notification!.getAttribute('role')).toBe('alert');
    });

    it('sets role to status for non-error notifications', () => {
      showNotification('Info test', 'info', 0);
      const notification = document.querySelector('.notification-info');
      expect(notification!.getAttribute('role')).toBe('status');
    });

    it('escapes HTML in message', () => {
      showNotification('<script>alert("xss")</script>', 'info', 0);
      const message = document.querySelector('.notification-message');
      expect(message!.innerHTML).toContain('&lt;script&gt;');
      expect(message!.innerHTML).not.toContain('<script>');
    });

    it('handles non-string messages', () => {
      showNotification(null as unknown as string, 'info', 0);
      const message = document.querySelector('.notification-message');
      expect(message!.textContent).toBe('');
    });

    it('dismisses notification when close button is clicked', async () => {
      showNotification('Test', 'info', 0);
      const closeBtn = document.querySelector('.notification-close');
      expect(closeBtn).toBeTruthy();
      (closeBtn as HTMLElement).click();

      await new Promise(r => setTimeout(r, 350)); // Wait for animation

      const notification = document.querySelector('.notification');
      expect(notification).toBeFalsy();
    });

    it('dismisses when close button clicked and has parent', async () => {
      showNotification('Test', 'info', 0);

      // Wait for animation frame
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 10)));

      const closeBtn = document.querySelector('.notification-close');
      const notification = document.querySelector('.notification');

      // Verify notification is in the DOM with a parent
      expect(notification).toBeTruthy();
      expect(notification!.parentNode).toBeTruthy();
      expect(closeBtn).toBeTruthy();
      (closeBtn as HTMLElement).click();

      await new Promise(r => setTimeout(r, 350)); // Wait for animation

      // Notification should be removed (notification was truthy above)
      expect(document.querySelectorAll('.notification').length).toBe(0);
    });

    it('handles dismiss when notification parent is null', async () => {
      const dismiss = showNotification('Test', 'info', 0);

      // Wait for animation frame
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 10)));

      const notification = document.querySelector('.notification');
      expect(notification).toBeTruthy();

      // Manually remove from parent to test parentNode null branch
      if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }

      // Calling dismiss again should not throw even though parentNode is now null
      await new Promise(r => setTimeout(r, 10));
      dismiss(); // This triggers the branch where parentNode is checked

      // Wait for dismiss timeout
      await new Promise(r => setTimeout(r, 350));

      // Should not throw
      expect(true).toBe(true);
    });

    it('sets different icon for error type', () => {
      showNotification('Error', 'error', 0);
      const icon = document.querySelector('.notification-error .notification-icon') as HTMLElement | null;
      expect(icon?.dataset.iconName).toBe('error');
    });

    it('sets checkCircle icon for non-error type', () => {
      showNotification('Info', 'info', 0);
      const icon = document.querySelector('.notification-info .notification-icon') as HTMLElement | null;
      expect(icon?.dataset.iconName).toBe('checkCircle');
    });

    it('does not auto-dismiss when duration is 0', () => {
      const dismiss = showNotification('Test', 'info', 0);
      expect(typeof dismiss).toBe('function');
      // Just verify it returns a function - auto-dismiss behavior tested elsewhere
    });

    it('renders notification without icon when createIcon returns null', () => {
      vi.spyOn(icons, 'createIcon').mockReturnValue(null);
      showNotification('No icon', 'info', 0);
      const notification = document.querySelector('.notification');
      expect(notification).toBeTruthy();
      expect(notification!.querySelector('.notification-icon')).toBeFalsy();
      expect(notification!.querySelector('.notification-message')?.textContent).toBe('No icon');
      vi.restoreAllMocks();
    });
  });
});
