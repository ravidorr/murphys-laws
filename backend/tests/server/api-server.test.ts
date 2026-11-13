import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { Router } from '../../src/routes/router.ts';
import { OPENAPI_SPEC } from '../../src/openapi.ts';

const mockSentryInit = vi.fn();
vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => mockSentryInit(...args),
  captureException: vi.fn(),
}));

const mockListen = vi.fn();
const mockServerOn = vi.fn();
vi.mock('node:http', () => ({
  default: {
    createServer: vi.fn((handler: (req: unknown, res: unknown) => void) => ({
      listen: mockListen,
      on: mockServerOn,
      emit(event: string, req: unknown, res: unknown) {
        if (event === 'request') handler(req, res);
        return true;
      },
    })),
  },
}));

describe('api-server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
  });

  describe('initSentry', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDsn = process.env.SENTRY_DSN;
    const dsn = 'https://key@o1.ingest.sentry.io/1';

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalDsn === undefined) delete process.env.SENTRY_DSN;
      else process.env.SENTRY_DSN = originalDsn;
    });

    it('should not call Sentry.init when SENTRY_DSN is unset in production', async () => {
      process.env.NODE_ENV = 'production';
      const { initSentry } = await import('../../src/server/api-server.ts');
      delete process.env.SENTRY_DSN; // after the import, whose dotenv load may bring in a developer's production DSN
      initSentry();
      expect(mockSentryInit).not.toHaveBeenCalled();
    });

    it('should call Sentry.init with expected config in production when SENTRY_DSN is set', async () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = dsn;
      const { initSentry } = await import('../../src/server/api-server.ts');
      initSentry();
      expect(mockSentryInit).toHaveBeenCalledWith({
        dsn,
        environment: 'production',
        tracesSampleRate: 0.1,
      });
      expect(mockSentryInit.mock.calls.at(-1)?.[0].release).toBeUndefined();
    });

    it.each([
      [' 0123456789abcdef0123456789abcdef01234567\n', '0123456789abcdef0123456789abcdef01234567'],
      ['  ', undefined],
    ])('should pass SENTRY_RELEASE %j to Sentry as the release %j', async (configured, expected) => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = dsn;
      const saved = process.env.SENTRY_RELEASE;
      process.env.SENTRY_RELEASE = configured;
      try {
        const { initSentry } = await import('../../src/server/api-server.ts');
        initSentry();
        expect(mockSentryInit.mock.calls.at(-1)?.[0].release).toBe(expected);
      } finally {
        if (saved === undefined) delete process.env.SENTRY_RELEASE;
        else process.env.SENTRY_RELEASE = saved;
      }
    });

    it.each(['development', 'test', ''])(
      'should not call Sentry.init outside production (NODE_ENV=%j) even when SENTRY_DSN is set',
      async (nodeEnv) => {
        process.env.NODE_ENV = nodeEnv;
        process.env.SENTRY_DSN = dsn;
        const { initSentry } = await import('../../src/server/api-server.ts');
        initSentry();
        expect(mockSentryInit).not.toHaveBeenCalled();
      },
    );

    it('should not call Sentry.init when NODE_ENV is unset even when SENTRY_DSN is set', async () => {
      delete process.env.NODE_ENV;
      process.env.SENTRY_DSN = dsn;
      const { initSentry } = await import('../../src/server/api-server.ts');
      initSentry();
      expect(mockSentryInit).not.toHaveBeenCalled();
    });
  });

  describe('createApiServer', () => {
    it('should return host, port, and server when given dependency overrides', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      };
      const { createApiServer } = await import('../../src/server/api-server.ts');
      const result = createApiServer({ db: mockDb as any });
      expect(result).toHaveProperty('host');
      expect(result).toHaveProperty('port');
      expect(result).toHaveProperty('server');
      expect(typeof result.host).toBe('string');
      expect(typeof result.port).toBe('number');
      expect(typeof result.server).toBe('object');
    });

    it('should register exactly the public operations declared in OpenAPI', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      };
      const registerPublicRoute = vi.spyOn(Router.prototype, 'registerPublicRoute');
      const { createApiServer } = await import('../../src/server/api-server.ts');

      createApiServer({ db: mockDb as any });

      const expected = Object.entries(OPENAPI_SPEC.paths)
        .filter(([path]) => path.startsWith('/api'))
        .flatMap(([path, pathItem]) => (
          ['get', 'post', 'delete']
            .filter((method) => method in pathItem)
            .map((method) => `${method.toUpperCase()} ${path}`)
        ))
        .sort();
      const registered = registerPublicRoute.mock.calls
        .map(([method, _runtimePath, openApiPath]) => `${method} ${openApiPath}`)
        .sort();

      expect(registered).toEqual(expected);
      registerPublicRoute.mockRestore();
    });

    it('should respond to GET /api/health with 200 when db is mocked', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      };
      const { createApiServer } = await import('../../src/server/api-server.ts');
      const { server } = createApiServer({ db: mockDb as any });

      const req = {
        method: 'GET',
        url: '/api/health',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as IncomingMessage;

      const chunks: Buffer[] = [];
      const res = {
        writeHead: vi.fn(),
        end: vi.fn((chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }),
        setHeader: vi.fn(),
      } as unknown as ServerResponse;

      server.emit('request', req, res);

      await new Promise((r) => setImmediate(r));

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      expect(body.ok).toBe(true);
      expect(body).toHaveProperty('dbQueryTime');
    });

    it('should respond to GET /api/v1/openapi.json with the OpenAPI document', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      };
      const { createApiServer } = await import('../../src/server/api-server.ts');
      const { server } = createApiServer({ db: mockDb as any });
      const req = {
        method: 'GET',
        url: '/api/v1/openapi.json',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as IncomingMessage;
      const chunks: Buffer[] = [];
      const res = {
        writeHead: vi.fn(),
        end: vi.fn((chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }),
      } as unknown as ServerResponse;

      server.emit('request', req, res);

      await new Promise((r) => setImmediate(r));

      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      });
      expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toEqual(OPENAPI_SPEC);
    });

    it('should use default host and port from env when not set', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      };
      const { createApiServer } = await import('../../src/server/api-server.ts');
      const origPort = process.env.PORT;
      const origHost = process.env.HOST;
      delete process.env.PORT;
      delete process.env.HOST;
      const result = createApiServer({ db: mockDb as any });
      expect(result.port).toBe(8787);
      expect(result.host).toBe('127.0.0.1');
      if (origPort !== undefined) process.env.PORT = origPort;
      if (origHost !== undefined) process.env.HOST = origHost;
    });

    it('should invoke all route handlers when requests hit each route', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ get: vi.fn() }),
      };
      const mockLawService = {
        listLaws: vi.fn().mockResolvedValue({ data: [], total: 0 }),
        getLaw: vi.fn().mockResolvedValue({ id: 1, title: 'L', text: 'T', upvotes: 0, downvotes: 0 }),
        getLawOfTheDay: vi.fn().mockResolvedValue({ law: { id: 1, title: 'L' }, featured_date: '2025-01-01' }),
        getRandomLaw: vi.fn().mockResolvedValue({ id: 1, title: 'L', text: 'T' }),
        getRelatedLaws: vi.fn().mockResolvedValue([]),
        suggestions: vi.fn().mockResolvedValue([]),
        findDuplicateCandidates: vi.fn().mockResolvedValue([]),
        submitLaw: vi.fn().mockResolvedValue(1),
      };
      const mockVoteService = {
        vote: vi.fn().mockResolvedValue(undefined),
        removeVote: vi.fn().mockResolvedValue(undefined),
      };
      const mockCategoryService = {
        listCategories: vi.fn().mockResolvedValue([]),
        getCategory: vi.fn().mockResolvedValue({ id: 1, name: 'C', slug: 'c' }),
        getCategoryBySlug: vi.fn().mockResolvedValue(null),
        getRelatedCategories: vi.fn().mockResolvedValue([]),
      };
      const mockAttributionService = {
        listAttributions: vi.fn().mockResolvedValue([]),
        searchSubmitters: vi.fn().mockResolvedValue([]),
      };
      const mockFeedService = {
        generateRss: vi.fn().mockResolvedValue('<rss/>'),
        generateAtom: vi.fn().mockResolvedValue('<feed/>'),
      };
      const mockOgImageService = {
        generateLawImage: vi.fn().mockResolvedValue(Buffer.alloc(1)),
      };
      const mockEmailService = {
        sendNewLawEmail: vi.fn().mockResolvedValue(undefined),
        isConfigured: vi.fn().mockReturnValue(false),
      };

      const { createApiServer } = await import('../../src/server/api-server.ts');
      const { server } = createApiServer({
        db: mockDb as any,
        lawService: mockLawService as any,
        voteService: mockVoteService as any,
        categoryService: mockCategoryService as any,
        attributionService: mockAttributionService as any,
        feedService: mockFeedService as any,
        ogImageService: mockOgImageService as any,
        emailService: mockEmailService as any,
      });

      const emitRequest = (method: string, url: string, body?: object): Promise<{ writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }> => {
        return new Promise((resolve) => {
          const chunks: Buffer[] = [];
          const res = {
            writeHead: vi.fn(),
            end: vi.fn((chunk: Buffer | string) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              resolve(res as any);
            }),
            setHeader: vi.fn(),
          } as unknown as ServerResponse;
          let req: IncomingMessage;
          if (body !== undefined) {
            const stream = new Readable({ read() {} });
            stream.push(JSON.stringify(body));
            stream.push(null);
            req = Object.assign(stream, {
              method,
              url,
              headers: { 'content-type': 'application/json' },
              socket: { remoteAddress: '127.0.0.1' },
            }) as IncomingMessage;
          } else {
            req = {
              method,
              url,
              headers: {},
              socket: { remoteAddress: '127.0.0.1' },
              on: vi.fn(),
            } as unknown as IncomingMessage;
          }
          server.emit('request', req, res);
        });
      };

      await emitRequest('GET', '/api/health');
      await emitRequest('GET', '/api/v1/openapi.json');
      await emitRequest('GET', '/api/v1/laws');
      await emitRequest('GET', '/api/v1/laws/suggestions');
      await emitRequest('GET', '/api/v1/laws/duplicates?text=An%20existing%20law');
      const randomLawResponse = await emitRequest('GET', '/api/v1/laws/random');
      await emitRequest('GET', '/api/v1/laws/1');
      await emitRequest('GET', '/api/v1/laws/1/related');
      await emitRequest('GET', '/api/v1/law-of-day');
      await emitRequest('POST', '/api/v1/laws', { title: 'T', text: 't' });
      await emitRequest('GET', '/api/v1/categories');
      await emitRequest('GET', '/api/v1/categories/1');
      await emitRequest('GET', '/api/v1/categories/c/related');
      await emitRequest('GET', '/api/v1/attributions');
      await emitRequest('GET', '/api/v1/submitters?q=Alice');
      await emitRequest('GET', '/api/v1/feed.rss');
      await emitRequest('GET', '/api/v1/feed.atom');
      await emitRequest('GET', '/api/v1/og/law/1.png');
      await emitRequest('POST', '/api/v1/laws/1/vote', { vote_type: 'up' });
      await emitRequest('DELETE', '/api/v1/laws/1/vote');
      await emitRequest('GET', '/law/1');
      await emitRequest('GET', '/category/c');
      const embedResponse = await emitRequest('GET', '/embed/law/1');
      const dayEmbedResponse = await emitRequest('GET', '/embed/law-of-day');
      const oembedResponse = await emitRequest('GET', '/api/v1/oembed?url=https%3A%2F%2Fmurphys-laws.com%2Flaw%2F1');
      const subscribeResponse = await emitRequest('POST', '/api/v1/subscriptions', { email: 'a@example.com' });
      const confirmResponse = await emitRequest('GET', '/subscription/confirm?token=bad');
      const confirmPostResponse = await emitRequest('POST', '/subscription/confirm?token=bad', {});
      const unsubscribeResponse = await emitRequest('GET', '/subscription/unsubscribe?token=bad');
      const oneClickResponse = await emitRequest('POST', '/subscription/unsubscribe?token=bad', {});
      const pushKeyResponse = await emitRequest('GET', '/api/v1/push/public-key');
      const pushSubscribeResponse = await emitRequest('POST', '/api/v1/push/subscriptions', { endpoint: 'https://evil.example.com/x' });
      const pushUnsubscribeResponse = await emitRequest('DELETE', '/api/v1/push/subscriptions', { endpoint: 'nope' });
      // Admin routes are disabled (404) when ADMIN_API_TOKEN is unset
      await emitRequest('GET', '/api/v1/admin/laws');
      await emitRequest('POST', '/api/v1/admin/laws/1', { status: 'published' });
      await emitRequest('GET', '/admin');
      await emitRequest('GET', '/api/v1/admin/ui');
      await emitRequest('GET', '/api/v1/admin/ui/admin.css');

      expect(embedResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'text/html; charset=utf-8' }));
      expect(dayEmbedResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'text/html; charset=utf-8' }));
      expect(oembedResponse.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'Content-Type': 'application/json; charset=utf-8' }));
      expect(subscribeResponse.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
      expect(confirmResponse.writeHead).toHaveBeenCalledWith(404, expect.objectContaining({ 'Content-Type': 'text/html; charset=utf-8' }));
      expect(confirmPostResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
      expect(unsubscribeResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
      expect(oneClickResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
      expect(pushKeyResponse.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
      expect(pushSubscribeResponse.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
      expect(pushUnsubscribeResponse.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(mockLawService.listLaws).toHaveBeenCalled();
      expect(mockLawService.getLaw).toHaveBeenCalled();
      expect(mockFeedService.generateRss).toHaveBeenCalled();
      expect(mockFeedService.generateAtom).toHaveBeenCalled();
      expect(mockOgImageService.generateLawImage).toHaveBeenCalledWith(1);
      expect(randomLawResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(mockLawService.getRandomLaw).toHaveBeenCalled();
      expect(mockLawService.findDuplicateCandidates).toHaveBeenCalled();
      expect(mockCategoryService.getRelatedCategories).toHaveBeenCalled();
      expect(mockAttributionService.searchSubmitters).toHaveBeenCalledWith('Alice', 20);
    });
  });

  describe('startApiServer', () => {
    it('should call server.listen with port, host, and callback', async () => {
      mockListen.mockClear();
      const { startApiServer } = await import('../../src/server/api-server.ts');
      startApiServer();

      expect(mockListen).toHaveBeenCalled();
      const [port, host, callback] = mockListen.mock.calls[0];
      expect(typeof port).toBe('number');
      expect(typeof host).toBe('string');
      expect(typeof callback).toBe('function');
      expect(() => callback()).not.toThrow();
    });

    describe('listen errors', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      let exitSpy: ReturnType<typeof vi.spyOn>;
      let errorSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      });

      afterEach(() => {
        vi.restoreAllMocks();
        process.env.NODE_ENV = originalNodeEnv;
      });

      async function startAndGetErrorHandler(): Promise<{
        handler: (error: NodeJS.ErrnoException) => void;
        host: string;
        port: number;
      }> {
        const { createApiServer, startApiServer } = await import('../../src/server/api-server.ts');
        const { host, port } = createApiServer();
        startApiServer();
        const call = mockServerOn.mock.calls.find(([event]) => event === 'error');
        expect(call).toBeDefined();
        return { handler: call![1], host, port };
      }

      const addrInUse = () => Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });

      it('should explain a port in use and exit with code 1 outside production', async () => {
        process.env.NODE_ENV = 'development';
        const { handler, host, port } = await startAndGetErrorHandler();

        expect(() => handler(addrInUse())).not.toThrow();

        expect(errorSpy).toHaveBeenCalledWith(
          `Port ${port} on ${host} is already in use; stop the process that holds it or set PORT to another port`,
        );
        expect(exitSpy).toHaveBeenCalledWith(1);
      });

      it('should explain a port in use and rethrow it in production so Sentry sees it', async () => {
        process.env.NODE_ENV = 'production';
        const { handler, host, port } = await startAndGetErrorHandler();
        const error = addrInUse();

        let thrown: unknown;
        try {
          handler(error);
        } catch (caught) {
          thrown = caught;
        }

        expect(thrown).toBe(error);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(`Port ${port} on ${host} is already in use`));
        expect(exitSpy).not.toHaveBeenCalled();
      });

      it('should rethrow any other listen error and not exit', async () => {
        const { handler } = await startAndGetErrorHandler();
        const boom = Object.assign(new Error('listen EACCES'), { code: 'EACCES' });

        let thrown: unknown;
        try {
          handler(boom);
        } catch (caught) {
          thrown = caught;
        }

        expect(thrown).toBe(boom);
        expect(exitSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('isRunAsMain', () => {
    it('should return false when process.argv[1] does not resolve to module path', async () => {
      const { isRunAsMain } = await import('../../src/server/api-server.ts');
      expect(isRunAsMain()).toBe(false);
    });

    it('should call startApiServer when run as main (argv[1] resolves to module)', async () => {
      const path = await import('node:path');
      const url = await import('node:url');
      const testDir = path.dirname(url.fileURLToPath(import.meta.url));
      const apiServerPath = path.resolve(testDir, '../../src/server/api-server.ts');
      const origArgv1 = process.argv[1];
      process.argv[1] = apiServerPath;
      vi.resetModules();
      mockListen.mockClear();
      await import('../../src/server/api-server.ts');
      expect(mockListen).toHaveBeenCalled();
      process.argv[1] = origArgv1;
    });
  });

  describe('createRequestListener', () => {
    it('should return a function that delegates to router.handle', async () => {
      const { createRequestListener } = await import('../../src/server/api-server.ts');
      const router = new Router();
      const handler = vi.fn();
      router.get('/ping', handler);

      const listener = createRequestListener(router);
      const req = { method: 'GET', url: '/ping', headers: {}, socket: { remoteAddress: '127.0.0.1' } } as IncomingMessage;
      const res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;

      await Promise.resolve(listener(req, res));

      expect(handler).toHaveBeenCalledWith(req, res, expect.objectContaining({ pathname: '/ping' }));
    });
  });
});
