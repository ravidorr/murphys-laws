/**
 * PWA Update Notification Component
 *
 * Shows a notification when a new version of the app is available
 * or when the app is ready for offline use.
 */
import { hydrateIcons } from '@utils/icons.ts';

// Matches the normal-motion .pwa-notification--exiting animation duration in update-notification.css.
const EXIT_ANIMATION_MS = 300;

/**
 * Play the exit animation, then remove the notification.
 * Like hideInstallPrompt(), a timer removes it even if animationend never fires.
 * @param {HTMLElement} notification - The notification element to dismiss
 */
function dismissNotification(notification: HTMLElement) {
  if (!notification.isConnected || notification.classList.contains('pwa-notification--exiting')) return;

  notification.classList.add('pwa-notification--exiting');
  const remove = () => notification.remove();
  notification.addEventListener('animationend', remove, { once: true });
  // Fallback removal if animationend doesn't fire
  setTimeout(remove, EXIT_ANIMATION_MS + 100);
}

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
    if (!(target instanceof Element)) return;

    // Use closest() so clicks on wrapped labels (e.g. <font> added by page translation) still work
    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (!actionEl || !notification.contains(actionEl)) return;

    const action = actionEl.dataset.action;
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
    setTimeout(() => dismissNotification(notification), 5000);
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
