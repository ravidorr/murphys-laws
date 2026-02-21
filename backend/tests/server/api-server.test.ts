import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { Router } from '../../src/routes/router.ts';

const mockSentryInit = vi.fn();
vi.mock('@sentry/node', () => ({
  init: (...args: unknown[]) => mockSentryInit(...args),
  captureException: vi.fn(),
}));

const mockListen = vi.fn();
vi.mock('node:http', () => ({
  default: {
    createServer: vi.fn((handler: (req: unknown, res: unknown) => void) => ({
      listen: mockListen,
      on: vi.fn(),
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
    it('should not call Sentry.init when SENTRY_DSN is unset', async () => {
      const { initSentry } = await import('../../src/server/api-server.ts');
      const saved = process.env.SENTRY_DSN;
      delete process.env.SENTRY_DSN;
      mockSentryInit.mockClear();
      initSentry();
      expect(mockSentryInit).not.toHaveBeenCalled();
      if (saved !== undefined) process.env.SENTRY_DSN = saved;
    });

    it('should call Sentry.init with expected config when SENTRY_DSN is set', async () => {
      process.env.SENTRY_DSN = 'https://key@o1.ingest.sentry.io/1';
      const { initSentry } = await import('../../src/server/api-server.ts');
      initSentry();
      expect(mockSentryInit).toHaveBeenCalledWith({
        dsn: 'https://key@o1.ingest.sentry.io/1',
        environment: 'test',
        tracesSampleRate: 0.1,
      });
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
        getRelatedLaws: vi.fn().mockResolvedValue([]),
        suggestions: vi.fn().mockResolvedValue([]),
        submitLaw: vi.fn().mockResolvedValue(1),
      };
      const mockVoteService = {
        vote: vi.fn().mockResolvedValue(undefined),
        removeVote: vi.fn().mockResolvedValue(undefined),
      };
      const mockCategoryService = {
        listCategories: vi.fn().mockResolvedValue([]),
        getCategory: vi.fn().mockResolvedValue({ id: 1, name: 'C', slug: 'c' }),
      };
      const mockAttributionService = {
        listAttributions: vi.fn().mockResolvedValue([]),
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
      await emitRequest('GET', '/api/v1/laws');
      await emitRequest('GET', '/api/v1/laws/suggestions');
      await emitRequest('GET', '/api/v1/laws/1');
      await emitRequest('GET', '/api/v1/laws/1/related');
      await emitRequest('GET', '/api/v1/law-of-day');
      await emitRequest('POST', '/api/v1/laws', { title: 'T', text: 't' });
      await emitRequest('GET', '/api/v1/categories');
      await emitRequest('GET', '/api/v1/categories/1');
      await emitRequest('GET', '/api/v1/attributions');
      await emitRequest('GET', '/api/v1/feed.rss');
      await emitRequest('GET', '/api/v1/feed.atom');
      await emitRequest('GET', '/api/v1/og/law/1.png');
      await emitRequest('POST', '/api/v1/laws/1/vote', { vote_type: 'up' });
      await emitRequest('DELETE', '/api/v1/laws/1/vote');

      expect(mockLawService.listLaws).toHaveBeenCalled();
      expect(mockLawService.getLaw).toHaveBeenCalled();
      expect(mockFeedService.generateRss).toHaveBeenCalled();
      expect(mockFeedService.generateAtom).toHaveBeenCalled();
      expect(mockOgImageService.generateLawImage).toHaveBeenCalledWith(1);
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
  });

  describe('isRunAsMain', () => {
    it('should return false when process.argv[1] does not resolve to module path', async () => {
      const { isRunAsMain } = await import('../../src/server/api-server.ts');
      expect(isRunAsMain()).toBe(false);
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
