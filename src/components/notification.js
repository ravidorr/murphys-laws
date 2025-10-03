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
 * Show a notification message
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

  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon material-symbols-outlined">${type === 'error' ? 'error' : 'check_circle'}</span>
      <span class="notification-message">${escapeHtml(message)}</span>
    </div>
    <button class="notification-close" aria-label="Dismiss notification">
      <span class="material-symbols-outlined">close</span>
    </button>
  `;

  const dismiss = () => {
    notification.classList.add('notification-exit');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300); // Match CSS animation duration
  };

  const closeBtn = notification.querySelector('.notification-close');
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
 * Clear all notifications
 */
export function clearAllNotifications() {
  if (notificationContainer) {
    notificationContainer.innerHTML = '';
  }
}

// HTML escape helper
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
