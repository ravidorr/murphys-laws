// User-visible error boundary banner for unhandled errors (hydration failures, etc.).

let errorBannerShown = false;

export function showErrorBanner(): void {
  if (errorBannerShown || !document.body) return;
  errorBannerShown = true;

  const banner = document.createElement('div');
  banner.className = 'error-boundary-banner';

  const message = document.createElement('p');
  message.className = 'error-boundary-text';
  message.setAttribute('role', 'alert');
  message.textContent = 'Something went wrong. Try refreshing the page.';

  // A link to the current URL is a no-op on some browsers (Kindle), so reload explicitly.
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'btn outline btn-sm';
  refreshButton.textContent = 'Refresh';
  refreshButton.addEventListener('click', () => location.reload());

  const dismissButton = document.createElement('button');
  dismissButton.type = 'button';
  dismissButton.className = 'btn outline btn-sm';
  dismissButton.textContent = 'Dismiss';
  dismissButton.addEventListener('click', () => {
    banner.remove();
    // Let a later, different failure show the banner again.
    errorBannerShown = false;
  });

  banner.append(message, refreshButton, dismissButton);
  document.body.appendChild(banner);
}

/** ONLY FOR TESTING PURPOSES. */
export function resetErrorBannerForTesting(): void {
  errorBannerShown = false;
}
