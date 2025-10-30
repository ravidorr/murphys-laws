import { createIcon } from '@utils/icons.js';

// Global notification/toast system

let notificationContainer = null;
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
export function showNotification(message, type = 'info', duration = 5000) {
  const container = ensureContainer();
  const id = `notification-${notificationId++}`;

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.id = id;
  notification.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const content = document.createElement('div');
  content.className = 'notification-content';

  const iconName = type === 'error' ? 'error' : 'check_circle';
  const iconEl = createIcon(iconName, { classNames: ['notification-icon'] });
  if (iconEl) {
    content.appendChild(iconEl);
  }

  const messageSpan = document.createElement('span');
  messageSpan.className = 'notification-message';
  messageSpan.textContent = message;
  content.appendChild(messageSpan);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'notification-close';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');

  const closeIcon = createIcon('close');
  if (closeIcon) {
    closeBtn.appendChild(closeIcon);
  }

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
export function showSuccess(message, duration = 5000) {
  return showNotification(message, 'success', duration);
}

/**
 * Show an error notification
 * @param {string} message - The message to display
 * @param {number} duration - Duration in ms (0 = no auto-dismiss)
 */
export function showError(message, duration = 7000) {
  return showNotification(message, 'error', duration);
}

/**
 * Clear all notifications - exported for testing
 */
export function clearAllNotifications() {
  if (notificationContainer) {
    notificationContainer.innerHTML = '';
  }
}
