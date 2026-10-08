import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_QUERY_KEYS,
  CANONICAL_HOSTNAME,
  LOCATION_TRANSFORMS,
  stripHashRouteQuery,
  getTelemetryRuntime,
  initializeNovusAgent,
  isCanonicalRuntime,
  type NovusAgent,
  type TelemetryRuntime,
} from '../src/utils/novus-agent.ts';

const production: TelemetryRuntime = { isProd: true, mode: 'production', hostname: CANONICAL_HOSTNAME };

function createAgent() {
  const initialize = vi.fn<NonNullable<NovusAgent['initialize']>>();
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
    expect(initialize).toHaveBeenCalledWith({
      visitor: { id: '' },
      location: { transforms: LOCATION_TRANSFORMS },
    });
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

  it('skips safely when the agent has no initialize method', () => {
    expect(initializeNovusAgent(production, {})).toBe(false);
  });
});

describe('location transforms (URL privacy)', () => {
  it('allowlists only app-controlled query keys, so free-text search never reaches analytics', () => {
    const search = LOCATION_TRANSFORMS.find((transform) => transform.attr === 'search');

    expect(search?.action).toBe('AllowOnlyKeys');
    expect(search?.data).toEqual(['category_id', 'sort', 'order', 'page']);
    expect(ALLOWED_QUERY_KEYS).not.toContain('q');
    expect(ALLOWED_QUERY_KEYS).not.toContain('attribution');
  });

  it('never uses the deprecated URL options that would disable the Location API', () => {
    const [firstCall] = (() => {
      const { agent, initialize } = createAgent();
      initializeNovusAgent(production, agent);
      return initialize.mock.calls;
    })();
    const options = firstCall?.[0] as Record<string, unknown>;

    ['annotateUrl', 'sanitizeUrl', 'ignoreHashRouting', 'queryStringWhitelist', 'xhrWhitelist'].forEach((key) => {
      expect(options).not.toHaveProperty(key);
    });
  });

  it('rewrites the hash instead of clearing it, keeping legacy hash routes distinct', () => {
    const hash = LOCATION_TRANSFORMS.find((transform) => transform.attr === 'hash');

    expect(hash?.action).toBe('Replace');
    expect(typeof hash?.data).toBe('function');
  });
});

describe('stripHashRouteQuery', () => {
  it.each([
    ['#/browse?q=my%20secret&attribution=jane', '#/browse'],
    ['#/law/123?ref=x', '#/law/123'],
    ['#/browse', '#/browse'],
    ['#section-anchor', '#section-anchor'],
    ['#tab?x=1', '#tab?x=1'],
    ['', ''],
  ])('%s -> %s', (input, expected) => {
    expect(stripHashRouteQuery(input)).toBe(expected);
  });

  it('does not throw on unexpected input', () => {
    expect(stripHashRouteQuery(undefined as unknown as string)).toBe('');
    expect(stripHashRouteQuery(null as unknown as string)).toBe('');
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

  it('reports an undefined hostname and skips the implicit agent outside a browser', () => {
    const localThis: { originalWindow: Window | undefined } = { originalWindow: globalThis.window };
    (globalThis as unknown as { window: Window | undefined }).window = undefined;

    try {
      expect(getTelemetryRuntime().hostname).toBeUndefined();
      expect(initializeNovusAgent(production)).toBe(false);
    } finally {
      (globalThis as unknown as { window: Window | undefined }).window = localThis.originalWindow;
    }
  });
});
