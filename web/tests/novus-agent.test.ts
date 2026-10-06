import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CANONICAL_HOSTNAME,
  getTelemetryRuntime,
  initializeNovusAgent,
  isCanonicalRuntime,
  type NovusAgent,
  type TelemetryRuntime,
} from '../src/utils/novus-agent.ts';

const production: TelemetryRuntime = { isProd: true, mode: 'production', hostname: CANONICAL_HOSTNAME };

function createAgent() {
  const initialize = vi.fn<NovusAgent['initialize']>();
  const agent: NovusAgent = { initialize };
  return { agent, initialize };
}

describe('isCanonicalRuntime', () => {
  it('is true for a production build on the canonical host', () => {
    expect(isCanonicalRuntime(production)).toBe(true);
  });

  it('is true for the production-mode test build on any host', () => {
    expect(isCanonicalRuntime({ isProd: true, mode: 'test', hostname: 'localhost' })).toBe(true);
  });

  it.each([
    ['localhost'],
    ['127.0.0.1'],
    ['preview-123.murphys-laws.pages.dev'],
    ['www.murphys-laws.com'],
    ['murphys-laws.com.evil.example'],
    [undefined],
  ])('is false for a production build on %s', (hostname) => {
    expect(isCanonicalRuntime({ isProd: true, mode: 'production', hostname })).toBe(false);
  });

  it('is false for a development build, even on the canonical host', () => {
    expect(isCanonicalRuntime({ isProd: false, mode: 'development', hostname: CANONICAL_HOSTNAME })).toBe(false);
    expect(isCanonicalRuntime({ isProd: false, mode: 'test', hostname: CANONICAL_HOSTNAME })).toBe(false);
  });
});

describe('initializeNovusAgent', () => {
  it('initializes once as an anonymous visitor on the canonical production host', () => {
    const { agent, initialize } = createAgent();

    expect(initializeNovusAgent(production, agent)).toBe(true);

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledWith({ visitor: { id: '' } });
  });

  it.each([
    ['local dev server', { isProd: false, mode: 'development', hostname: 'localhost' }],
    ['production build served locally (Playwright/Lighthouse)', { isProd: true, mode: 'production', hostname: 'localhost' }],
    ['preview deploy', { isProd: true, mode: 'production', hostname: 'preview-123.murphys-laws.pages.dev' }],
    ['non-browser runtime', { isProd: true, mode: 'production', hostname: undefined }],
  ])('does not initialize on a %s', (_label, runtime) => {
    const { agent, initialize } = createAgent();

    expect(initializeNovusAgent(runtime, agent)).toBe(false);

    expect(initialize).not.toHaveBeenCalled();
  });

  it('skips safely when the agent stub is absent on the canonical host', () => {
    expect(initializeNovusAgent(production, undefined)).toBe(false);
  });
});

describe('default runtime detection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the real environment and does not initialize under vitest', () => {
    const { agent, initialize } = createAgent();
    vi.stubGlobal('pendo', agent);

    expect(getTelemetryRuntime().hostname).toBe(window.location.hostname);
    expect(initializeNovusAgent()).toBe(false);
    expect(initialize).not.toHaveBeenCalled();
  });
});
