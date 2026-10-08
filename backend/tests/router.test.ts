import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../src/routes/router.ts';
import { OPENAPI_SPEC } from '../src/openapi.ts';

const mockCaptureException = vi.fn();
vi.mock('@sentry/node', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

function mockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    method: 'GET',
    url: '/',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as IncomingMessage;
}

function mockRes(): { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> } & ServerResponse {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
  } as unknown as ServerResponse & { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
}

describe('Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOWED_ORIGINS;
  });

  afterEach(() => {
    delete process.env.ALLOWED_ORIGINS;
  });

  it('should match routes with literal dot segments', async () => {
    const router = new Router();
    const handler = vi.fn();
    const req = {
      method: 'GET',
      url: '/api/v1/og/law/123.png',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    router.get('/api/v1/og/law/:id.png', handler);
    await router.handle(req, res);

    expect(handler).toHaveBeenCalledWith(
      req,
      res,
      '123',
      expect.objectContaining({ pathname: '/api/v1/og/law/123.png' })
    );
    expect(res.writeHead).not.toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('should not match when the literal dot is missing', async () => {
    const router = new Router();
    const handler = vi.fn();
    const req = {
      method: 'GET',
      url: '/api/v1/og/law/123Apng',
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
    } as IncomingMessage;
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as ServerResponse;

    router.get('/api/v1/og/law/:id.png', handler);
    await router.handle(req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.objectContaining({
      'Content-Type': 'application/json; charset=utf-8',
    }));
  });

  it('should pass path param :id to handler for GET /api/v1/laws/42', async () => {
    const router = new Router();
    const handler = vi.fn();
    const req = mockReq({ method: 'GET', url: '/api/v1/laws/42' });
    const res = mockRes();

    router.get('/api/v1/laws/:id', handler);
    await router.handle(req, res);

    expect(handler).toHaveBeenCalledWith(req, res, '42', expect.objectContaining({ pathname: '/api/v1/laws/42' }));
  });

  it('should match RegExp path when using add with RegExp', async () => {
    const router = new Router();
    const handler = vi.fn();
    const req = mockReq({ method: 'GET', url: '/foo' });
    const res = mockRes();

    router.add('GET', /^\/foo$/, handler);
    await router.handle(req, res);

    expect(handler).toHaveBeenCalledWith(req, res, expect.objectContaining({ pathname: '/foo' }));
    expect(res.writeHead).not.toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('should call notFound when path does not match RegExp', async () => {
    const router = new Router();
    const handler = vi.fn();
    const req = mockReq({ method: 'GET', url: '/bar' });
    const res = mockRes();

    router.add('GET', /^\/foo$/, handler);
    await router.handle(req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('should support get, post, delete and call handler for matching method and path', async () => {
    const router = new Router();
    const getHandler = vi.fn();
    const postHandler = vi.fn();
    const deleteHandler = vi.fn();

    router.get('/get-path', getHandler);
    router.post('/post-path', postHandler);
    router.delete('/delete-path', deleteHandler);

    await router.handle(mockReq({ method: 'GET', url: '/get-path' }), mockRes());
    expect(getHandler).toHaveBeenCalled();

    await router.handle(mockReq({ method: 'POST', url: '/post-path' }), mockRes());
    expect(postHandler).toHaveBeenCalled();

    await router.handle(mockReq({ method: 'DELETE', url: '/delete-path' }), mockRes());
    expect(deleteHandler).toHaveBeenCalled();
  });

  it('should reject a public route without a matching OpenAPI operation', () => {
    const router = new Router();

    expect(() => router.registerPublicRoute(
      'GET',
      '/api/v1/missing',
      '/api/v1/missing',
      vi.fn(),
    )).toThrow('Missing OpenAPI operation: GET /api/v1/missing');
  });

  it('should reject an OpenAPI operation that has no registered public route', () => {
    const router = new Router();
    router.registerPublicRoute('GET', '/api/v1/laws', '/api/v1/laws', vi.fn());

    expect(() => router.assertPublicApiContract()).toThrow(
      'OpenAPI operation has no registered public route:',
    );
  });

  it('should ignore non-API OpenAPI paths when validating the public contract', () => {
    const paths = OPENAPI_SPEC.paths as Record<string, unknown>;
    const router = new Router();
    const methods = ['GET', 'POST', 'DELETE'] as const;

    for (const [path, pathItem] of Object.entries(OPENAPI_SPEC.paths)) {
      for (const method of methods) {
        if (method.toLowerCase() in pathItem) {
          const runtimePath = path.replace(/\{([a-zA-Z0-9_]+)\}/g, ':$1');
          router.registerPublicRoute(method, runtimePath, path, vi.fn());
        }
      }
    }

    expect(() => router.assertPublicApiContract()).not.toThrow();

    paths['/internal-test-route'] = { get: {} };

    expect(() => router.assertPublicApiContract()).not.toThrow();
    delete paths['/internal-test-route'];
  });

  it('should normalize route parameters when registering a documented public route', () => {
    const router = new Router();

    expect(() => router.registerPublicRoute(
      'GET',
      '/api/v1/laws/:id',
      '/api/v1/laws/{id}',
      vi.fn(),
    )).not.toThrow();
  });

  it('should reject a public route when its runtime and OpenAPI parameter names differ', () => {
    const router = new Router();

    expect(() => router.registerPublicRoute(
      'GET',
      '/api/v1/laws/:id',
      '/api/v1/laws/{lawId}',
      vi.fn(),
    )).toThrow('Runtime path /api/v1/laws/:id does not match OpenAPI path /api/v1/laws/{lawId}');
  });

  it('should reject a public route that was registered without an OpenAPI operation', () => {
    const router = new Router();
    router.get('/api/v1/missing', vi.fn());

    expect(() => router.assertPublicApiContract()).toThrow(
      'Public route has no OpenAPI operation: GET /api/v1/missing',
    );
  });

  it('should handle OPTIONS with handleOptions and return 204 with CORS headers', async () => {
    const router = new Router();
    const handler = vi.fn();
    const req = mockReq({ method: 'OPTIONS', url: '/any' });
    const res = mockRes();

    router.get('/any', handler);
    await router.handle(req, res);

    expect(handler).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(204, expect.objectContaining({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }));
    expect(res.end).toHaveBeenCalled();
  });

  it('should set Access-Control-Allow-Credentials when ALLOWED_ORIGINS is set and origin matches', async () => {
    process.env.ALLOWED_ORIGINS = 'http://example.com';
    const router = new Router();
    const req = mockReq({ method: 'OPTIONS', url: '/any', headers: { origin: 'http://example.com' } });
    const res = mockRes();

    await router.handle(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(204, expect.objectContaining({
      'Access-Control-Allow-Origin': 'http://example.com',
      'Access-Control-Allow-Credentials': 'true',
    }));
  });

  it('should call Sentry.captureException and return 500 when handler throws', async () => {
    const router = new Router();
    const handler = vi.fn().mockRejectedValue(new Error('Handler error'));
    const req = mockReq({ method: 'GET', url: '/fail' });
    const res = mockRes();

    router.get('/fail', handler);
    await router.handle(req, res);

    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));
    expect(res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Internal Server Error' }));
  });

  it('should call notFound when no route matches', async () => {
    const router = new Router();
    const req = mockReq({ method: 'GET', url: '/no-such-route' });
    const res = mockRes();

    router.get('/other', vi.fn());
    await router.handle(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Not Found' }));
  });

  it('should treat undefined req.url as empty pathname and call notFound', async () => {
    const router = new Router();
    const req = mockReq({ method: 'GET', url: undefined });
    const res = mockRes();

    router.get('/something', vi.fn());
    await router.handle(req, res);

    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('should pass multiple path params to handler', async () => {
    const router = new Router();
    const handler = vi.fn();
    const req = mockReq({ method: 'GET', url: '/api/v1/laws/5/related' });
    const res = mockRes();

    router.get('/api/v1/laws/:id/related', handler);
    await router.handle(req, res);

    expect(handler).toHaveBeenCalledWith(req, res, '5', expect.objectContaining({ pathname: '/api/v1/laws/5/related' }));
  });
});
