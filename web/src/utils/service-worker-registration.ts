export interface ServiceWorkerRegistrationOptions {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (
    swScriptUrl: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void;
  onRegisterError?: (error: Error) => void;
}

export type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

export const SERVICE_WORKER_PRODUCTION_HOST = 'murphys-laws.com';

export interface ServiceWorkerRuntime {
  hostname: string;
  reload: () => void;
  serviceWorker: ServiceWorkerContainer;
}

export function isProductionServiceWorkerHost(hostname: string): boolean {
  return hostname === SERVICE_WORKER_PRODUCTION_HOST;
}

function browserServiceWorkerRuntime(): ServiceWorkerRuntime | undefined {
  /* v8 ignore start -- browser environment bridge is exercised by Playwright */
  if (
    !import.meta.env.PROD ||
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return undefined;
  }

  return {
    hostname: window.location.hostname,
    reload: () => window.location.reload(),
    serviceWorker: navigator.serviceWorker,
  };
  /* v8 ignore stop */
}

export function registerServiceWorker(
  options: ServiceWorkerRegistrationOptions = {},
  runtime: ServiceWorkerRuntime | undefined = browserServiceWorkerRuntime(),
): UpdateServiceWorker {
  let registration: ServiceWorkerRegistration | undefined;
  let reloadAfterActivation = false;
  let hasReloaded = false;

  const updateServiceWorker: UpdateServiceWorker = async (
    reloadPage = false,
  ) => {
    reloadAfterActivation = reloadPage;
    await registration?.update();
    const waitingWorker = registration?.waiting;
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else if (reloadPage && !hasReloaded) {
      hasReloaded = true;
      runtime?.reload();
    }
  };

  if (!runtime) {
    return updateServiceWorker;
  }

  if (!isProductionServiceWorkerHost(runtime.hostname)) {
    void runtime.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registered) => registered.unregister())),
      )
      .catch(() => undefined);
    return updateServiceWorker;
  }

  runtime.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadAfterActivation && !hasReloaded) {
      hasReloaded = true;
      runtime.reload();
    }
  });

  const hadController = Boolean(runtime.serviceWorker.controller);

  void runtime.serviceWorker
    .register('/sw.js')
    .then((registered) => {
      registration = registered;
      options.onRegisteredSW?.('/sw.js', registered);

      if (registered.waiting && runtime.serviceWorker.controller) {
        options.onNeedRefresh?.();
      }

      registered.addEventListener('updatefound', () => {
        const worker = registered.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (
            worker.state === 'installed' &&
            runtime.serviceWorker.controller
          ) {
            options.onNeedRefresh?.();
          }
        });
      });

      return runtime.serviceWorker.ready;
    })
    .then(() => {
      if (!hadController) {
        options.onOfflineReady?.();
      }
    })
    .catch((error: unknown) => {
      options.onRegisterError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    });

  return updateServiceWorker;
}
