import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCount = vi.fn();
const mockGauge = vi.fn();
const mockDistribution = vi.fn();

vi.mock('@sentry/browser', () => ({
  metrics: {
    count: (...args: unknown[]) => mockCount(...args),
    gauge: (...args: unknown[]) => mockGauge(...args),
    distribution: (...args: unknown[]) => mockDistribution(...args)
  }
}));

describe('metrics', () => {
  const localThis: {
    originalDsn: string | undefined;
    originalProd: boolean;
  } = {
    originalDsn: undefined,
    originalProd: false
  };

  beforeEach(() => {
    localThis.originalDsn = import.meta.env.VITE_SENTRY_DSN;
    localThis.originalProd = import.meta.env.PROD;
    vi.clearAllMocks();
  });

  afterEach(() => {
    import.meta.env.VITE_SENTRY_DSN = localThis.originalDsn;
    import.meta.env.PROD = localThis.originalProd;
    vi.resetModules();
  });

  it('count does not throw when metrics are disabled', async () => {
    const { count } = await import('../src/utils/metrics.ts');
    expect(() => count('test_event', 1)).not.toThrow();
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('gauge does not throw when metrics are disabled', async () => {
    const { gauge } = await import('../src/utils/metrics.ts');
    expect(() => gauge('test_gauge', 42)).not.toThrow();
    expect(mockGauge).not.toHaveBeenCalled();
  });

  it('distribution does not throw when metrics are disabled', async () => {
    const { distribution } = await import('../src/utils/metrics.ts');
    expect(() => distribution('test_dist', 100)).not.toThrow();
    expect(mockDistribution).not.toHaveBeenCalled();
  });

  it('calls Sentry.metrics when DSN and PROD are set', async () => {
    import.meta.env.VITE_SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1';
    import.meta.env.PROD = true;
    vi.resetModules();

    const { count, gauge, distribution } = await import('../src/utils/metrics.ts');

    count('button_click', 1);
    expect(mockCount).toHaveBeenCalledWith('button_click', 1);

    gauge('page_load_time', 150);
    expect(mockGauge).toHaveBeenCalledWith('page_load_time', 150, undefined);

    distribution('response_time', 200, { unit: 'millisecond' });
    expect(mockDistribution).toHaveBeenCalledWith('response_time', 200, { unit: 'millisecond' });
  });

  it('count defaults to 1 when value omitted', async () => {
    import.meta.env.VITE_SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1';
    import.meta.env.PROD = true;
    vi.resetModules();

    const { count } = await import('../src/utils/metrics.ts');
    count('event');
    expect(mockCount).toHaveBeenCalledWith('event', 1);
  });
});
