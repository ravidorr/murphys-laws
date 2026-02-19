/**
 * PWA Update Notification Component
 *
 * Shows a notification when a new version of the app is available
 * or when the app is ready for offline use.
 */

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

  const icon = isUpdate
    ? `<svg class="pwa-notification-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>`
    : `<svg class="pwa-notification-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>`;

  const title = isUpdate ? 'Update Available' : 'Ready for Offline';
  const message = isUpdate
    ? 'A new version is available. Refresh to update.'
    : 'App is now available offline.';

  notification.innerHTML = `
    <div class="pwa-notification-content">
      ${icon}
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
        notification.style.animation = 'pwa-slide-up 0.3s ease-out reverse';
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
