import { describe, expect, it, vi } from 'vitest';
import {
  isProductionServiceWorkerHost,
  registerServiceWorker,
  SERVICE_WORKER_PRODUCTION_HOST,
} from '../src/utils/service-worker-registration.ts';
import type { ServiceWorkerRuntime } from '../src/utils/service-worker-registration.ts';

type Listener = () => void;

interface ServiceWorkerFakes {
  containerListeners: Map<string, Listener>;
  registrationListeners: Map<string, Listener>;
  workerListeners: Map<string, Listener>;
  postMessage: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  registration: ServiceWorkerRegistration;
  reload: ReturnType<typeof vi.fn>;
  runtime: ServiceWorkerRuntime;
  unregister: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  worker: ServiceWorker;
}

function createFakes(hostname = SERVICE_WORKER_PRODUCTION_HOST): ServiceWorkerFakes {
  const containerListeners = new Map<string, Listener>();
  const registrationListeners = new Map<string, Listener>();
  const workerListeners = new Map<string, Listener>();
  const postMessage = vi.fn();
  const unregister = vi.fn().mockResolvedValue(true);
  const update = vi.fn().mockResolvedValue(undefined);
  const reload = vi.fn();

  const worker = {
    state: 'installing',
    postMessage,
    addEventListener: vi.fn((event: string, listener: Listener) => {
      workerListeners.set(event, listener);
    }),
  } as unknown as ServiceWorker;

  const registration = {
    installing: worker,
    waiting: worker,
    update,
    unregister,
    addEventListener: vi.fn((event: string, listener: Listener) => {
      registrationListeners.set(event, listener);
    }),
  } as unknown as ServiceWorkerRegistration;

  const register = vi.fn().mockResolvedValue(registration);
  const serviceWorker = {
    controller: worker,
    ready: Promise.resolve(registration),
    register,
    getRegistrations: vi.fn().mockResolvedValue([registration]),
    addEventListener: vi.fn((event: string, listener: Listener) => {
      containerListeners.set(event, listener);
    }),
  } as unknown as ServiceWorkerContainer;

  return {
    containerListeners,
    registrationListeners,
    workerListeners,
    postMessage,
    register,
    registration,
    reload,
    runtime: { hostname, reload, serviceWorker },
    unregister,
    update,
    worker,
  };
}

describe('service worker registration', () => {
  it('limits persistent PWA caching to the canonical production host', () => {
    expect(isProductionServiceWorkerHost(SERVICE_WORKER_PRODUCTION_HOST)).toBe(
      true,
    );
    expect(isProductionServiceWorkerHost('127.0.0.1')).toBe(false);
    expect(isProductionServiceWorkerHost('localhost')).toBe(false);
    expect(isProductionServiceWorkerHost('www.murphys-laws.com')).toBe(false);
  });

  it('returns an inert updater outside the production browser runtime', async () => {
    const update = registerServiceWorker({}, undefined);
    await expect(update(true)).resolves.toBeUndefined();
  });

  it('removes persistent registrations from non-production hosts', async () => {
    const fakes = createFakes('localhost');

    registerServiceWorker({}, fakes.runtime);

    await vi.waitFor(() => expect(fakes.unregister).toHaveBeenCalledOnce());
    expect(fakes.register).not.toHaveBeenCalled();
  });

  it('ignores cleanup failures on non-production hosts', async () => {
    const fakes = createFakes('preview.example');
    vi.mocked(fakes.runtime.serviceWorker.getRegistrations).mockRejectedValue(
      new Error('cleanup failed'),
    );

    expect(() => registerServiceWorker({}, fakes.runtime)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fakes.register).not.toHaveBeenCalled();
  });

  it('registers, reports readiness, refreshes, and reloads once', async () => {
    const fakes = createFakes();
    const onNeedRefresh = vi.fn();
    const onOfflineReady = vi.fn();
    const onRegisteredSW = vi.fn();

    const updateServiceWorker = registerServiceWorker(
      { onNeedRefresh, onOfflineReady, onRegisteredSW },
      fakes.runtime,
    );

    await vi.waitFor(() => expect(onOfflineReady).toHaveBeenCalledOnce());
    expect(fakes.register).toHaveBeenCalledWith('/sw.js');
    expect(onRegisteredSW).toHaveBeenCalledWith('/sw.js', fakes.registration);
    expect(onNeedRefresh).toHaveBeenCalledOnce();

    fakes.registrationListeners.get('updatefound')?.();
    Object.defineProperty(fakes.worker, 'state', { value: 'installed' });
    fakes.workerListeners.get('statechange')?.();
    expect(onNeedRefresh).toHaveBeenCalledTimes(2);

    fakes.containerListeners.get('controllerchange')?.();
    expect(fakes.reload).not.toHaveBeenCalled();

    await updateServiceWorker(true);
    expect(fakes.update).toHaveBeenCalledOnce();
    expect(fakes.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });

    fakes.containerListeners.get('controllerchange')?.();
    fakes.containerListeners.get('controllerchange')?.();
    expect(fakes.reload).toHaveBeenCalledOnce();
  });

  it('handles an update with no installing or waiting worker', async () => {
    const fakes = createFakes();
    Object.defineProperty(fakes.registration, 'installing', { value: null });
    Object.defineProperty(fakes.registration, 'waiting', { value: null });
    Object.defineProperty(fakes.runtime.serviceWorker, 'controller', {
      value: null,
    });
    const onNeedRefresh = vi.fn();

    const updateServiceWorker = registerServiceWorker(
      { onNeedRefresh },
      fakes.runtime,
    );

    await vi.waitFor(() => expect(fakes.register).toHaveBeenCalledOnce());
    fakes.registrationListeners.get('updatefound')?.();
    await updateServiceWorker();

    expect(onNeedRefresh).not.toHaveBeenCalled();
    expect(fakes.update).toHaveBeenCalledOnce();
    expect(fakes.postMessage).not.toHaveBeenCalled();
  });

  it('does not announce an installing worker before it is installed', async () => {
    const fakes = createFakes();
    Object.defineProperty(fakes.registration, 'waiting', { value: null });
    const onNeedRefresh = vi.fn();

    registerServiceWorker({ onNeedRefresh }, fakes.runtime);

    await vi.waitFor(() => expect(fakes.register).toHaveBeenCalledOnce());
    fakes.registrationListeners.get('updatefound')?.();
    fakes.workerListeners.get('statechange')?.();
    expect(onNeedRefresh).not.toHaveBeenCalled();
  });

  it('normalizes registration failures before reporting them', async () => {
    const errorFakes = createFakes();
    const expectedError = new Error('registration failed');
    errorFakes.register.mockRejectedValue(expectedError);
    const onError = vi.fn();

    registerServiceWorker({ onRegisterError: onError }, errorFakes.runtime);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expectedError));

    const stringFakes = createFakes();
    stringFakes.register.mockRejectedValue('offline');
    const onStringError = vi.fn();
    registerServiceWorker(
      { onRegisterError: onStringError },
      stringFakes.runtime,
    );
    await vi.waitFor(() =>
      expect(onStringError).toHaveBeenCalledWith(new Error('offline')),
    );
  });
});
