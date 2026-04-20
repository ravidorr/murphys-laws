import { describe, it, expect, beforeEach } from 'vitest';
import {
  ApiError,
  DEFAULT_BASE_URL,
  DEFAULT_USER_AGENT,
  MurphysLawsClient,
  type FetchLike,
} from '../src/index.js';

interface MockCall {
  url: string;
  init: RequestInit | undefined;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

describe('MurphysLawsClient', () => {
  let calls: MockCall[];
  let responses: Response[];
  let fetchMock: FetchLike;

  function queue(...items: Response[]): void {
    responses.push(...items);
  }

  function clientWith(opts: { baseUrl?: string; userAgent?: string } = {}): MurphysLawsClient {
    return new MurphysLawsClient({
      baseUrl: opts.baseUrl ?? 'https://api.test',
      userAgent: opts.userAgent,
      fetch: fetchMock,
    });
  }

  beforeEach(() => {
    calls = [];
    responses = [];
    fetchMock = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input);
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) {
        throw new Error(`Unexpected fetch call to ${url}`);
      }
      return Promise.resolve(next);
    }) as FetchLike;
  });

  it('uses documented defaults', () => {
    expect(DEFAULT_BASE_URL).toBe('https://murphys-laws.com');
    expect(DEFAULT_USER_AGENT).toBe('murphys-laws-sdk');
  });

  it('applies defaults and strips trailing slash', () => {
    const client = new MurphysLawsClient({ baseUrl: 'https://example.com/', fetch: fetchMock });
    expect(client.baseUrl).toBe('https://example.com');
    expect(client.userAgent).toBe(DEFAULT_USER_AGENT);
  });

  it('allows overriding user agent', () => {
    const client = clientWith({ userAgent: 'custom/1.2.3' });
    expect(client.userAgent).toBe('custom/1.2.3');
  });

  it('falls back to global fetch when none provided', () => {
    const client = new MurphysLawsClient();
    expect(client.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(client.userAgent).toBe(DEFAULT_USER_AGENT);
  });

  it('get throws ApiError on non-2xx responses', async () => {
    queue(textResponse(500, 'boom'));
    const client = clientWith();
    await expect(client.get('/api/v1/laws/random')).rejects.toMatchObject({
      status: 500,
      body: 'boom',
      name: 'ApiError',
    });
  });

  it('get sends User-Agent header', async () => {
    queue(jsonResponse(200, { hello: 'world' }));
    const client = clientWith({ userAgent: 'ua/1' });
    const data = await client.get<{ hello: string }>('/ping');
    expect(data.hello).toBe('world');
    expect(calls[0]?.url).toBe('https://api.test/ping');
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers['User-Agent']).toBe('ua/1');
    expect(headers.Accept).toBe('application/json');
  });

  it('searchLaws builds query string from all params', async () => {
    queue(jsonResponse(200, { data: [], total: 0, limit: 10, offset: 0 }));
    const client = clientWith();
    await client.searchLaws({
      q: 'debug',
      category_slug: 'computers',
      limit: 10,
      offset: 20,
      sort: 'score',
      order: 'desc',
    });
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/api/v1/laws');
    expect(url.searchParams.get('q')).toBe('debug');
    expect(url.searchParams.get('category_slug')).toBe('computers');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('offset')).toBe('20');
    expect(url.searchParams.get('sort')).toBe('score');
    expect(url.searchParams.get('order')).toBe('desc');
  });

  it('searchLaws omits undefined params entirely', async () => {
    queue(jsonResponse(200, { data: [], total: 0, limit: 5, offset: 0 }));
    const client = clientWith();
    await client.searchLaws({});
    expect(calls[0]!.url).toBe('https://api.test/api/v1/laws');
  });

  it('getRandomLaw calls /api/v1/laws/random', async () => {
    queue(jsonResponse(200, { id: 1, text: 'hi' }));
    const client = clientWith();
    const law = await client.getRandomLaw();
    expect(law.id).toBe(1);
    expect(calls[0]!.url).toBe('https://api.test/api/v1/laws/random');
  });

  it('getLawOfTheDay calls /api/v1/law-of-day', async () => {
    queue(jsonResponse(200, { law: { id: 2, text: 'hi' }, featured_date: '2026-04-20' }));
    const client = clientWith();
    const result = await client.getLawOfTheDay();
    expect(result.law.id).toBe(2);
    expect(result.featured_date).toBe('2026-04-20');
    expect(calls[0]!.url).toBe('https://api.test/api/v1/law-of-day');
  });

  it('getLaw encodes id', async () => {
    queue(jsonResponse(200, { id: 42, text: 'hi' }));
    const client = clientWith();
    await client.getLaw('a/b');
    expect(calls[0]!.url).toBe('https://api.test/api/v1/laws/a%2Fb');
  });

  it('listCategories returns the data array', async () => {
    const payload = [
      { id: 1, slug: 'x', title: 'X', description: null, law_count: 2 },
      { id: 2, slug: 'y', title: 'Y', description: 'yyy', law_count: 5 },
    ];
    queue(jsonResponse(200, { data: payload }));
    const client = clientWith();
    const categories = await client.listCategories();
    expect(categories).toEqual(payload);
    expect(calls[0]!.url).toBe('https://api.test/api/v1/categories');
  });

  it('getLawsByCategory merges params and forces category_slug', async () => {
    queue(jsonResponse(200, { data: [], total: 0, limit: 10, offset: 0 }));
    const client = clientWith();
    await client.getLawsByCategory('computers', { limit: 10, sort: 'score', order: 'desc' });
    const url = new URL(calls[0]!.url);
    expect(url.searchParams.get('category_slug')).toBe('computers');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('submitLaw sends success body with resolved category id', async () => {
    queue(
      jsonResponse(200, {
        data: [
          { id: 9, slug: 'computers', title: 'Computers', description: null, law_count: 0 },
        ],
      }),
      jsonResponse(201, {
        id: 100,
        title: 'T',
        text: 'body text here',
        status: 'pending',
        message: 'ok',
      }),
    );
    const client = clientWith();
    const result = await client.submitLaw({
      text: 'body text here',
      title: 'T',
      author: 'me',
      category_slug: 'computers',
    });
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.status).toBe(201);
      expect(result.data.id).toBe(100);
    }
    const submitCall = calls[1]!;
    const body = JSON.parse(String(submitCall.init?.body));
    expect(body).toEqual({
      text: 'body text here',
      title: 'T',
      author: 'me',
      category_id: 9,
    });
    const headers = submitCall.init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['User-Agent']).toBe(DEFAULT_USER_AGENT);
  });

  it('submitLaw returns validation error when category slug not found', async () => {
    queue(jsonResponse(200, { data: [] }));
    const client = clientWith();
    const result = await client.submitLaw({
      text: 'some law text',
      category_slug: 'nope',
    });
    expect(result.kind).toBe('validation_error');
    if (result.kind === 'validation_error') {
      expect(result.status).toBe(400);
      expect(result.error).toContain('nope');
    }
    expect(calls).toHaveLength(1);
  });

  it('submitLaw skips category lookup when id provided', async () => {
    queue(
      jsonResponse(201, { id: 1, title: '', text: 'law text here', status: 'pending', message: 'ok' }),
    );
    const client = clientWith();
    const result = await client.submitLaw({ text: 'law text here', category_id: 7 });
    expect(result.kind).toBe('success');
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0]!.init?.body));
    expect(body).toEqual({ text: 'law text here', category_id: 7 });
  });

  it('submitLaw surfaces rate limit responses', async () => {
    queue(jsonResponse(429, { error: 'Too many', retryAfter: 42 }));
    const client = clientWith();
    const result = await client.submitLaw({ text: 'law text' });
    expect(result.kind).toBe('rate_limited');
    if (result.kind === 'rate_limited') {
      expect(result.retryAfter).toBe(42);
      expect(result.error).toBe('Too many');
      expect(result.status).toBe(429);
    }
  });

  it('submitLaw defaults retryAfter when missing', async () => {
    queue(jsonResponse(429, {}));
    const client = clientWith();
    const result = await client.submitLaw({ text: 'law text' });
    expect(result.kind).toBe('rate_limited');
    if (result.kind === 'rate_limited') {
      expect(result.retryAfter).toBe(60);
      expect(result.error).toBe('Rate limit exceeded.');
    }
  });

  it('submitLaw surfaces validation errors', async () => {
    queue(jsonResponse(400, { error: 'text too short' }));
    const client = clientWith();
    const result = await client.submitLaw({ text: 'law text' });
    expect(result.kind).toBe('validation_error');
    if (result.kind === 'validation_error') {
      expect(result.error).toBe('text too short');
      expect(result.status).toBe(400);
    }
  });

  it('submitLaw uses default message for 400 without error field', async () => {
    queue(jsonResponse(400, {}));
    const client = clientWith();
    const result = await client.submitLaw({ text: 'law text' });
    expect(result.kind).toBe('validation_error');
    if (result.kind === 'validation_error') {
      expect(result.error).toBe('Validation error.');
    }
  });

  it('submitLaw surfaces unexpected responses', async () => {
    queue(jsonResponse(500, { error: 'boom' }));
    const client = clientWith();
    const result = await client.submitLaw({ text: 'law text' });
    expect(result.kind).toBe('unexpected_error');
    if (result.kind === 'unexpected_error') {
      expect(result.status).toBe(500);
      expect(result.error).toBe('boom');
    }
  });

  it('submitLaw uses generic message for unexpected responses without error', async () => {
    queue(jsonResponse(503, {}));
    const client = clientWith();
    const result = await client.submitLaw({ text: 'law text' });
    expect(result.kind).toBe('unexpected_error');
    if (result.kind === 'unexpected_error') {
      expect(result.status).toBe(503);
      expect(result.error).toContain('Unexpected response (status 503)');
    }
  });

  it('post returns raw status and data', async () => {
    queue(jsonResponse(418, { error: 'teapot' }));
    const client = clientWith();
    const { status, data } = await client.post<{ error: string }>('/x', { a: 1 });
    expect(status).toBe(418);
    expect(data.error).toBe('teapot');
  });

  it('ApiError is exported for instanceof checks', () => {
    expect(new ApiError(400, 'body')).toBeInstanceOf(Error);
  });
});
