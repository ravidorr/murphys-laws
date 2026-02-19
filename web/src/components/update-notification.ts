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

  // Add styles if not already present
  if (!document.getElementById('pwa-notification-styles')) {
    const styles = document.createElement('style');
    styles.id = 'pwa-notification-styles';
    styles.textContent = `
      .pwa-notification {
        position: fixed;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        background: var(--card-bg, #fff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 0.75rem;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        padding: 1rem 1.25rem;
        max-width: calc(100vw - 2rem);
        width: 400px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        animation: pwa-slide-up 0.3s ease-out;
      }

      @keyframes pwa-slide-up {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(1rem);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }

      .pwa-notification-content {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .pwa-notification-icon {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        color: var(--btn-primary-bg, #1173d4);
      }

      .pwa-notification-text {
        flex: 1;
        min-width: 0;
      }

      .pwa-notification-title {
        display: block;
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--fg, #111827);
        margin-bottom: 0.125rem;
      }

      .pwa-notification-message {
        font-size: 0.875rem;
        color: var(--muted-fg, #6b7280);
        margin: 0;
        line-height: 1.4;
      }

      .pwa-notification-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }

      .pwa-notification-btn {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        border-radius: 0.375rem;
        border: none;
        cursor: pointer;
        transition: background-color 0.15s, transform 0.1s;
      }

      .pwa-notification-btn:active {
        transform: scale(0.98);
      }

      .pwa-notification-btn-primary {
        background: var(--btn-primary-bg, #1173d4);
        color: var(--btn-primary-fg, #fff);
      }

      .pwa-notification-btn-primary:hover {
        filter: brightness(1.1);
      }

      .pwa-notification-btn-secondary {
        background: transparent;
        color: var(--muted-fg, #6b7280);
      }

      .pwa-notification-btn-secondary:hover {
        background: var(--border, #e5e7eb);
        color: var(--fg, #111827);
      }

      @media (max-width: 480px) {
        .pwa-notification {
          bottom: 0.5rem;
          width: calc(100vw - 1rem);
        }
      }
    `;
    document.head.appendChild(styles);
  }

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
