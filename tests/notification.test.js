import { showNotification, showSuccess, showError, clearAllNotifications } from '../src/components/notification.js';
import { afterEach } from 'vitest';

describe('Notification system', () => {
  afterEach(() => {
    try {
      clearAllNotifications();
      document.querySelectorAll('.notification-container').forEach(el => el.remove());
    } catch {
      // Ignore cleanup errors
    }
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
});
