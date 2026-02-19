import { createIcon } from '@utils/icons.ts';
import { createButton } from '@utils/button.ts';

// Global notification/toast system

let notificationContainer: HTMLDivElement | null = null;
let notificationId = 0;

function ensureContainer() {
  if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.className = 'notification-container';
    notificationContainer.setAttribute('aria-live', 'polite');
    notificationContainer.setAttribute('aria-atomic', 'false');
    document.body.appendChild(notificationContainer);
  }
  return notificationContainer;
}

/**
 * Show a notification message - exported for testing
 * @param {string} message - The message to display
 * @param {string} type - 'success' or 'error'
 * @param {number} duration - Duration in ms (0 = no auto-dismiss)
 * @returns {Function} - Function to manually dismiss the notification
 */
export function showNotification(message: string, type = 'info', duration = 5000): () => void {
  const container = ensureContainer();
  const id = `notification-${notificationId++}`;

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.id = id;
  notification.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const content = document.createElement('div');
  content.className = 'notification-content';

  const iconName = type === 'error' ? 'error' : 'checkCircle';
  const iconEl = createIcon(iconName, { classNames: ['notification-icon'] });
  if (iconEl) {
    content.appendChild(iconEl);
  }

  const messageSpan = document.createElement('span');
  messageSpan.className = 'notification-message';
  messageSpan.textContent = message;
  content.appendChild(messageSpan);

  const closeBtn = createButton({
    variant: 'secondary',
    icon: 'close',
    iconOnly: true,
    className: 'notification-close',
    ariaLabel: 'Dismiss notification',
  });

  notification.appendChild(content);
  notification.appendChild(closeBtn);

  const dismiss = () => {
    notification.classList.add('notification-exit');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300); // Match CSS animation duration
  };

  closeBtn.addEventListener('click', dismiss);

  container.appendChild(notification);

  // Trigger enter animation
  requestAnimationFrame(() => {
    notification.classList.add('notification-enter');
  });

  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return dismiss;
}

/**
 * Show a success notification
 * @param {string} message - The message to display
 * @param {number} duration - Duration in ms
 */
export function showSuccess(message: string, duration = 5000): () => void {
  return showNotification(message, 'success', duration);
}

/**
 * Show an error notification
 * @param {string} message - The message to display
 * @param {number} duration - Duration in ms (0 = no auto-dismiss)
 */
export function showError(message: string, duration = 7000): () => void {
  return showNotification(message, 'error', duration);
}

/**
 * Clear all notifications - exported for testing
 */
export function clearAllNotifications(): void {
  if (notificationContainer) {
    notificationContainer.innerHTML = '';
  }
}
