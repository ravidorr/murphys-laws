import { describe, it, expect } from 'vitest';
import { ApiError } from 'murphys-laws-sdk';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSearchLaws } from '../src/tools/search-laws.js';
import { registerGetRandomLaw } from '../src/tools/get-random-law.js';
import { registerGetLawOfTheDay } from '../src/tools/get-law-of-the-day.js';
import { registerGetLaw } from '../src/tools/get-law.js';
import { registerListCategories } from '../src/tools/list-categories.js';
import { registerGetLawsByCategory } from '../src/tools/get-laws-by-category.js';
import { registerSubmitLaw } from '../src/tools/submit-law.js';
import { createCapturingServer, createStubClient, type CapturedTool } from './helpers.js';

function extractTool(
  register: (server: McpServer, api: ReturnType<typeof createStubClient>) => void,
  stub: Parameters<typeof createStubClient>[0],
): CapturedTool {
  const captured = createCapturingServer();
  const client = createStubClient(stub);
  register(captured as unknown as McpServer, client);
  const tool = Array.from(captured.tools.values())[0];
  if (!tool) throw new Error('tool not registered');
  return tool;
}

describe('search_laws tool', () => {
  it('registers with correct metadata and schema', () => {
    const tool = extractTool(registerSearchLaws, { get: async () => ({ data: [], total: 0, limit: 5, offset: 0 }) });
    expect(tool.name).toBe('search_laws');
    expect(tool.description).toMatch(/Search Murphy's Laws/);
    expect(tool.schema).toHaveProperty('q');
    expect(tool.schema).toHaveProperty('category_slug');
    expect(tool.schema).toHaveProperty('limit');
  });

  it('passes query and forces score+desc sort, returns formatted list', async () => {
    let capturedPath: string | undefined;
    const tool = extractTool(registerSearchLaws, {
      get: async (path) => {
        capturedPath = path;
        return { data: [{ id: 1, text: 'hi', upvotes: 0, downvotes: 0 }], total: 1, limit: 5, offset: 0 };
      },
    });
    const result = await tool.handler({ q: 'debug', limit: 5 });
    const url = new URL(`https://api.test${capturedPath}`);
    expect(url.pathname).toBe('/api/v1/laws');
    expect(url.searchParams.get('q')).toBe('debug');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('sort')).toBe('score');
    expect(url.searchParams.get('order')).toBe('desc');
    expect(url.searchParams.get('category_slug')).toBeNull();
    expect(result.content[0]?.text).toContain("Murphy's Law #1");
  });

  it('forwards category_slug when provided', async () => {
    let capturedPath: string | undefined;
    const tool = extractTool(registerSearchLaws, {
      get: async (path) => {
        capturedPath = path;
        return { data: [], total: 0, limit: 5, offset: 0 };
      },
    });
    await tool.handler({ q: 'x', category_slug: 'computers', limit: 5 });
    const url = new URL(`https://api.test${capturedPath}`);
    expect(url.searchParams.get('category_slug')).toBe('computers');
  });
});

describe('get_random_law tool', () => {
  it('registers with correct metadata', () => {
    const tool = extractTool(registerGetRandomLaw, { get: async () => ({ id: 1, text: 'hi' }) });
    expect(tool.name).toBe('get_random_law');
    expect(tool.description).toMatch(/random/i);
  });

  it('returns a formatted law on success', async () => {
    const tool = extractTool(registerGetRandomLaw, {
      get: async (path) => {
        expect(path).toBe('/api/v1/laws/random');
        return { id: 42, text: 'something', upvotes: 3, downvotes: 1 };
      },
    });
    const result = await tool.handler({});
    expect(result.content[0]?.text).toContain("Murphy's Law #42");
    expect(result.isError).toBeUndefined();
  });

  it('returns friendly error on 404', async () => {
    const tool = extractTool(registerGetRandomLaw, {
      get: async () => {
        throw new ApiError(404, 'no laws');
      },
    });
    const result = await tool.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/no laws found/i);
  });

  it('rethrows non-404 ApiError', async () => {
    const tool = extractTool(registerGetRandomLaw, {
      get: async () => {
        throw new ApiError(500, 'boom');
      },
    });
    await expect(tool.handler({})).rejects.toMatchObject({ status: 500 });
  });

  it('rethrows non-ApiError errors', async () => {
    const tool = extractTool(registerGetRandomLaw, {
      get: async () => {
        throw new Error('network');
      },
    });
    await expect(tool.handler({})).rejects.toThrow('network');
  });
});

describe('get_law_of_the_day tool', () => {
  it('registers with correct metadata', () => {
    const tool = extractTool(registerGetLawOfTheDay, {
      get: async () => ({ law: { id: 1, text: 'x' }, featured_date: 'y' }),
    });
    expect(tool.name).toBe('get_law_of_the_day');
    expect(tool.description).toMatch(/today/i);
  });

  it('returns formatted law with date header', async () => {
    const tool = extractTool(registerGetLawOfTheDay, {
      get: async (path) => {
        expect(path).toBe('/api/v1/law-of-day');
        return { law: { id: 7, text: 'hi' }, featured_date: '2026-04-20' };
      },
    });
    const result = await tool.handler({});
    expect(result.content[0]?.text).toContain('Law of the Day (2026-04-20)');
    expect(result.content[0]?.text).toContain("Murphy's Law #7");
  });

  it('returns friendly error on 404', async () => {
    const tool = extractTool(registerGetLawOfTheDay, {
      get: async () => {
        throw new ApiError(404, 'nope');
      },
    });
    const result = await tool.handler({});
    expect(result.isError).toBe(true);
  });

  it('rethrows non-404 ApiError', async () => {
    const tool = extractTool(registerGetLawOfTheDay, {
      get: async () => {
        throw new ApiError(500, 'boom');
      },
    });
    await expect(tool.handler({})).rejects.toMatchObject({ status: 500 });
  });

  it('rethrows non-ApiError errors', async () => {
    const tool = extractTool(registerGetLawOfTheDay, {
      get: async () => {
        throw new Error('network');
      },
    });
    await expect(tool.handler({})).rejects.toThrow('network');
  });
});

describe('get_law tool', () => {
  it('registers with correct metadata', () => {
    const tool = extractTool(registerGetLaw, { get: async () => ({ id: 1, text: 'x' }) });
    expect(tool.name).toBe('get_law');
    expect(tool.schema).toHaveProperty('law_id');
  });

  it('passes the id and returns formatted law', async () => {
    let capturedPath: string | undefined;
    const tool = extractTool(registerGetLaw, {
      get: async (path) => {
        capturedPath = path;
        return { id: 9, text: 'the text' };
      },
    });
    const result = await tool.handler({ law_id: 9 });
    expect(capturedPath).toBe('/api/v1/laws/9');
    expect(result.content[0]?.text).toContain("Murphy's Law #9");
  });

  it('returns friendly 404 error', async () => {
    const tool = extractTool(registerGetLaw, {
      get: async () => {
        throw new ApiError(404, 'nope');
      },
    });
    const result = await tool.handler({ law_id: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Law #999 not found');
  });

  it('rethrows non-404 ApiError', async () => {
    const tool = extractTool(registerGetLaw, {
      get: async () => {
        throw new ApiError(500, 'boom');
      },
    });
    await expect(tool.handler({ law_id: 1 })).rejects.toMatchObject({ status: 500 });
  });

  it('rethrows non-ApiError errors', async () => {
    const tool = extractTool(registerGetLaw, {
      get: async () => {
        throw new Error('network');
      },
    });
    await expect(tool.handler({ law_id: 1 })).rejects.toThrow('network');
  });
});

describe('list_categories tool', () => {
  it('registers with correct metadata', () => {
    const tool = extractTool(registerListCategories, { get: async () => ({ data: [] }) });
    expect(tool.name).toBe('list_categories');
  });

  it('fetches categories and renders description when present', async () => {
    let capturedPath: string | undefined;
    const tool = extractTool(registerListCategories, {
      get: async (path) => {
        capturedPath = path;
        return {
          data: [
            { id: 1, slug: 'a', title: 'Alpha', description: 'the first', law_count: 2 },
            { id: 2, slug: 'b', title: 'Beta', description: null, law_count: 5 },
          ],
        };
      },
    });
    const result = await tool.handler({});
    expect(capturedPath).toBe('/api/v1/categories');
    const text = result.content[0]?.text ?? '';
    expect(text).toContain("Murphy's Law Categories (2 total)");
    expect(text).toContain('Alpha (slug: "a", 2 laws)');
    expect(text).toContain('the first');
    expect(text).toContain('Beta (slug: "b", 5 laws)');
  });
});

describe('get_laws_by_category tool', () => {
  it('registers with correct metadata', () => {
    const tool = extractTool(registerGetLawsByCategory, {
      get: async () => ({ data: [], total: 0, limit: 10, offset: 0 }),
    });
    expect(tool.name).toBe('get_laws_by_category');
    expect(tool.schema).toHaveProperty('category_slug');
    expect(tool.schema).toHaveProperty('limit');
  });

  it('hits /api/v1/laws with category filter and returns formatted list', async () => {
    let capturedPath: string | undefined;
    const tool = extractTool(registerGetLawsByCategory, {
      get: async (path) => {
        capturedPath = path;
        return { data: [{ id: 1, text: 'hi' }], total: 1, limit: 10, offset: 0 };
      },
    });
    const result = await tool.handler({ category_slug: 'computers', limit: 10 });
    const url = new URL(`https://api.test${capturedPath}`);
    expect(url.pathname).toBe('/api/v1/laws');
    expect(url.searchParams.get('category_slug')).toBe('computers');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('sort')).toBe('score');
    expect(url.searchParams.get('order')).toBe('desc');
    expect(result.content[0]?.text).toContain("Murphy's Law #1");
  });
});

describe('submit_law tool', () => {
  const validInput = {
    text: 'A long enough law text to pass validation',
    title: 'T',
    author: 'me',
    category_slug: 'computers',
  };

  it('registers with correct metadata', () => {
    const tool = extractTool(registerSubmitLaw, {});
    expect(tool.name).toBe('submit_law');
    expect(tool.schema).toHaveProperty('text');
  });

  it('resolves category_slug to id and returns 201 success message', async () => {
    let postBody: unknown;
    const tool = extractTool(registerSubmitLaw, {
      get: async (path) => {
        expect(path).toBe('/api/v1/categories');
        return {
          data: [
            { id: 9, slug: 'computers', title: 'Computers', description: null, law_count: 0 },
          ],
        };
      },
      post: async (path, body) => {
        expect(path).toBe('/api/v1/laws');
        postBody = body;
        return {
          status: 201,
          data: {
            id: 100,
            title: 'T',
            text: validInput.text,
            status: 'in_review',
            message: 'ok',
          },
        };
      },
    });
    const result = await tool.handler(validInput);
    expect(postBody).toEqual({
      text: validInput.text,
      title: 'T',
      author: 'me',
      category_id: 9,
    });
    const text = result.content[0]?.text ?? '';
    expect(text).toContain('Law submitted successfully');
    expect(text).toContain('ID: 100');
    expect(text).toContain('Category: computers');
    expect(text).toContain('Author: me');
  });

  it('returns error when category_slug not found', async () => {
    const tool = extractTool(registerSubmitLaw, {
      get: async () => ({ data: [] }),
    });
    const result = await tool.handler({ ...validInput, category_slug: 'nope' });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('"nope" not found');
  });

  it('omits category lookup when no slug provided', async () => {
    let postBody: unknown;
    const tool = extractTool(registerSubmitLaw, {
      post: async (_path, body) => {
        postBody = body;
        return {
          status: 201,
          data: { id: 1, title: '', text: validInput.text, status: 'in_review', message: 'ok' },
        };
      },
    });
    await tool.handler({ text: validInput.text });
    expect(postBody).toEqual({ text: validInput.text });
  });

  it('surfaces 429 with retryAfter', async () => {
    const tool = extractTool(registerSubmitLaw, {
      post: async () => ({ status: 429, data: { error: 'Too many', retryAfter: 30 } }),
    });
    const result = await tool.handler({ text: validInput.text });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('30 seconds');
  });

  it('defaults retryAfter to 60 when missing', async () => {
    const tool = extractTool(registerSubmitLaw, {
      post: async () => ({ status: 429, data: {} }),
    });
    const result = await tool.handler({ text: validInput.text });
    expect(result.content[0]?.text).toContain('60 seconds');
  });

  it('surfaces 400 validation errors', async () => {
    const tool = extractTool(registerSubmitLaw, {
      post: async () => ({ status: 400, data: { error: 'text too short' } }),
    });
    const result = await tool.handler({ text: validInput.text });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('text too short');
  });

  it('surfaces unexpected status codes', async () => {
    const tool = extractTool(registerSubmitLaw, {
      post: async () => ({ status: 503, data: {} }),
    });
    const result = await tool.handler({ text: validInput.text });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('status 503');
  });

  it('falls back to Anonymous when author missing', async () => {
    const tool = extractTool(registerSubmitLaw, {
      post: async () => ({
        status: 201,
        data: { id: 1, title: '', text: validInput.text, status: 'in_review', message: 'ok' },
      }),
    });
    const result = await tool.handler({ text: validInput.text });
    expect(result.content[0]?.text).toContain('Author: Anonymous');
    expect(result.content[0]?.text).toContain('Category: (none)');
  });

  it('shows (none) when title empty in 201 response', async () => {
    const tool = extractTool(registerSubmitLaw, {
      post: async () => ({
        status: 201,
        data: { id: 1, title: '', text: validInput.text, status: 'in_review', message: 'ok' },
      }),
    });
    const result = await tool.handler({ text: validInput.text });
    expect(result.content[0]?.text).toContain('Title: (none)');
  });
});
