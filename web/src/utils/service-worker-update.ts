/**
 * Schedules a periodic check for service worker updates.
 * Handles both sync throws and async rejections from registration.update()
 * (e.g. InvalidStateError in Firefox when the registration is stale).
 */
export function scheduleServiceWorkerUpdateCheck(
  registration: ServiceWorkerRegistration
): void {
  void setInterval(() => {
    try {
      registration.update().catch(() => {
        // Silently ignore - SW will recover on next page load
      });
    } catch {
      // Silently ignore - SW will recover on next page load
    }
  }, 60 * 60 * 1000);
}
