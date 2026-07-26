/**
 * PWA Update Notification Component
 *
 * Shows a notification when a new version of the app is available
 * or when the app is ready for offline use.
 */
import { hydrateIcons } from '@utils/icons.ts';

/**
 * Create and show the update notification
 * @param {Object} options
 * @param {'update' | 'offline'} options.type - Type of notification
 * @param {Function} [options.onUpdate] - Callback when user clicks update
 * @param {Function} [options.onDismiss] - Callback when user dismisses
 * @returns {HTMLElement} The notification element
 */
export function showUpdateNotification({ type, onUpdate, onDismiss }: { type: 'update' | 'offline'; onUpdate?: () => void; onDismiss?: () => void }) {
  // Remove any existing notification
  const existing = document.querySelector('.pwa-notification');
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = 'pwa-notification';
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'polite');

  const isUpdate = type === 'update';

  const icon = isUpdate ? 'refresh' : 'checkCircle';

  const title = isUpdate ? 'Update Available' : 'Ready for Offline';
  const message = isUpdate
    ? 'A new version is available. Refresh to update.'
    : 'App is now available offline.';

  notification.innerHTML = `
    <div class="pwa-notification-content">
      <span class="icon pwa-notification-icon" data-icon="${icon}" aria-hidden="true"></span>
      <div class="pwa-notification-text">
        <strong class="pwa-notification-title">${title}</strong>
        <p class="pwa-notification-message">${message}</p>
      </div>
    </div>
    <div class="pwa-notification-actions">
      ${isUpdate ? '<button class="pwa-notification-btn pwa-notification-btn-primary" data-action="update">Refresh</button>' : ''}
      <button class="pwa-notification-btn pwa-notification-btn-secondary" data-action="dismiss">${isUpdate ? 'Later' : 'Got it'}</button>
    </div>
  `;
  hydrateIcons(notification);

  // Event handlers
  notification.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute('data-action');
    if (action === 'update' && onUpdate) {
      onUpdate();
      notification.remove();
    } else if (action === 'dismiss') {
      notification.remove();
      if (onDismiss) onDismiss();
    }
  });

  document.body.appendChild(notification);

  // Auto-dismiss offline notification after 5 seconds
  if (!isUpdate) {
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('pwa-notification--exiting');
        notification.addEventListener('animationend', () => notification.remove());
      }
    }, 5000);
  }

  return notification;
}

/**
 * Show update available notification
 * @param {Function} updateSW - Function to call to update the service worker
 */
export function showUpdateAvailable(updateSW: (reloadPage?: boolean) => void) {
  showUpdateNotification({
    type: 'update',
    onUpdate: () => {
      updateSW(true);
    }
  });
}

/**
 * Show offline ready notification
 */
export function showOfflineReady() {
  showUpdateNotification({
    type: 'offline'
  });
}
