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
    const tool = extractTool(registerSearchLaws, {
      searchLaws: async () => ({ data: [], total: 0, limit: 5, offset: 0 }),
    });
    expect(tool.name).toBe('search_laws');
    expect(tool.description).toMatch(/Search Murphy's Laws/);
    expect(tool.schema).toHaveProperty('q');
    expect(tool.schema).toHaveProperty('category_slug');
    expect(tool.schema).toHaveProperty('limit');
  });

  it('passes query, forces score+desc sort, and returns formatted list', async () => {
    let captured: unknown;
    const tool = extractTool(registerSearchLaws, {
      searchLaws: async (params) => {
        captured = params;
        return { data: [{ id: 1, text: 'hi', upvotes: 0, downvotes: 0 }], total: 1, limit: 5, offset: 0 };
      },
    });
    const result = await tool.handler({ q: 'debug', limit: 5 });
    expect(captured).toEqual({ q: 'debug', category_slug: undefined, limit: 5, sort: 'score', order: 'desc' });
    expect(result.content[0]?.text).toContain("Murphy's Law #1");
  });

  it('forwards category_slug when provided', async () => {
    let captured: unknown;
    const tool = extractTool(registerSearchLaws, {
      searchLaws: async (params) => {
        captured = params;
        return { data: [], total: 0, limit: 5, offset: 0 };
      },
    });
    await tool.handler({ q: 'x', category_slug: 'computers', limit: 5 });
    expect(captured).toMatchObject({ category_slug: 'computers' });
  });
});

describe('get_random_law tool', () => {
  it('registers with correct metadata', () => {
    const tool = extractTool(registerGetRandomLaw, { getRandomLaw: async () => ({ id: 1, text: 'x' }) });
    expect(tool.name).toBe('get_random_law');
    expect(tool.description).toMatch(/random/i);
  });

  it('returns a formatted law on success', async () => {
    const tool = extractTool(registerGetRandomLaw, {
      getRandomLaw: async () => ({ id: 42, text: 'something', upvotes: 3, downvotes: 1 }),
    });
    const result = await tool.handler({});
    expect(result.content[0]?.text).toContain("Murphy's Law #42");
    expect(result.isError).toBeUndefined();
  });

  it('returns friendly error on 404', async () => {
    const tool = extractTool(registerGetRandomLaw, {
      getRandomLaw: async () => {
        throw new ApiError(404, 'no laws');
      },
    });
    const result = await tool.handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/no laws found/i);
  });

  it('rethrows non-404 ApiError', async () => {
    const tool = extractTool(registerGetRandomLaw, {
      getRandomLaw: async () => {
        throw new ApiError(500, 'boom');
      },
    });
    await expect(tool.handler({})).rejects.toMatchObject({ status: 500 });
  });

  it('rethrows non-ApiError errors', async () => {
    const tool = extractTool(registerGetRandomLaw, {
      getRandomLaw: async () => {
        throw new Error('network');
      },
    });
    await expect(tool.handler({})).rejects.toThrow('network');
  });
});

describe('get_law_of_the_day tool', () => {
  it('registers with correct metadata', () => {
    const tool = extractTool(registerGetLawOfTheDay, {
      getLawOfTheDay: async () => ({ law: { id: 1, text: 'x' }, featured_date: 'y' }),
    });
    expect(tool.name).toBe('get_law_of_the_day');
    expect(tool.description).toMatch(/today/i);
  });

  it('returns formatted law with date header', async () => {
    const tool = extractTool(registerGetLawOfTheDay, {
      getLawOfTheDay: async () => ({ law: { id: 7, text: 'hi' }, featured_date: '2026-04-20' }),
    });
    const result = await tool.handler({});
    expect(result.content[0]?.text).toContain('Law of the Day (2026-04-20)');
    expect(result.content[0]?.text).toContain("Murphy's Law #7");
  });

  it('returns friendly error on 404', async () => {
    const tool = extractTool(registerGetLawOfTheDay, {
      getLawOfTheDay: async () => {
        throw new ApiError(404, 'nope');
      },
    });
    const result = await tool.handler({});
    expect(result.isError).toBe(true);
  });

  it('rethrows non-404 ApiError', async () => {
    const tool = extractTool(registerGetLawOfTheDay, {
      getLawOfTheDay: async () => {
        throw new ApiError(500, 'boom');
      },
    });
    await expect(tool.handler({})).rejects.toMatchObject({ status: 500 });
  });

  it('rethrows non-ApiError errors', async () => {
    const tool = extractTool(registerGetLawOfTheDay, {
      getLawOfTheDay: async () => {
        throw new Error('network');
      },
    });
    await expect(tool.handler({})).rejects.toThrow('network');
  });
});

describe('get_law tool', () => {
  it('registers with correct metadata', () => {
    const tool = extractTool(registerGetLaw, { getLaw: async () => ({ id: 1, text: 'x' }) });
    expect(tool.name).toBe('get_law');
    expect(tool.schema).toHaveProperty('law_id');
  });

  it('passes the id and returns formatted law', async () => {
    let capturedId: number | string | undefined;
    const tool = extractTool(registerGetLaw, {
      getLaw: async (id) => {
        capturedId = id;
        return { id: 9, text: 'the text' };
      },
    });
    const result = await tool.handler({ law_id: 9 });
    expect(capturedId).toBe(9);
    expect(result.content[0]?.text).toContain("Murphy's Law #9");
  });

  it('returns friendly 404 error', async () => {
    const tool = extractTool(registerGetLaw, {
      getLaw: async () => {
        throw new ApiError(404, 'nope');
      },
    });
    const result = await tool.handler({ law_id: 999 });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Law #999 not found');
  });

  it('rethrows non-404 ApiError', async () => {
    const tool = extractTool(registerGetLaw, {
      getLaw: async () => {
        throw new ApiError(500, 'boom');
      },
    });
    await expect(tool.handler({ law_id: 1 })).rejects.toMatchObject({ status: 500 });
  });

  it('rethrows non-ApiError errors', async () => {
    const tool = extractTool(registerGetLaw, {
      getLaw: async () => {
        throw new Error('network');
      },
    });
    await expect(tool.handler({ law_id: 1 })).rejects.toThrow('network');
  });
});

describe('list_categories tool', () => {
  it('registers with correct metadata', () => {
    const tool = extractTool(registerListCategories, { listCategories: async () => [] });
    expect(tool.name).toBe('list_categories');
  });

  it('fetches categories and renders description when present', async () => {
    const tool = extractTool(registerListCategories, {
      listCategories: async () => [
        { id: 1, slug: 'a', title: 'Alpha', description: 'the first', law_count: 2 },
        { id: 2, slug: 'b', title: 'Beta', description: null, law_count: 5 },
      ],
    });
    const result = await tool.handler({});
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
      getLawsByCategory: async () => ({ data: [], total: 0, limit: 10, offset: 0 }),
    });
    expect(tool.name).toBe('get_laws_by_category');
    expect(tool.schema).toHaveProperty('category_slug');
    expect(tool.schema).toHaveProperty('limit');
  });

  it('passes slug and merges sort/order params', async () => {
    let capturedSlug: string | undefined;
    let capturedParams: unknown;
    const tool = extractTool(registerGetLawsByCategory, {
      getLawsByCategory: async (slug, params) => {
        capturedSlug = slug;
        capturedParams = params;
        return { data: [{ id: 1, text: 'hi' }], total: 1, limit: 10, offset: 0 };
      },
    });
    const result = await tool.handler({ category_slug: 'computers', limit: 10 });
    expect(capturedSlug).toBe('computers');
    expect(capturedParams).toEqual({ limit: 10, sort: 'score', order: 'desc' });
    expect(result.content[0]?.text).toContain("Murphy's Law #1");
  });
});

describe('submit_law tool', () => {
  const validText = 'A long enough law text to pass validation';

  it('registers with correct metadata', () => {
    const tool = extractTool(registerSubmitLaw, {
      submitLaw: async () => ({
        kind: 'success',
        ok: true,
        status: 201,
        data: { id: 1, title: '', text: validText, status: 'in_review', message: 'ok' },
      }),
    });
    expect(tool.name).toBe('submit_law');
    expect(tool.schema).toHaveProperty('text');
  });

  it('passes args to submitLaw and renders success message', async () => {
    let captured: unknown;
    const tool = extractTool(registerSubmitLaw, {
      submitLaw: async (input) => {
        captured = input;
        return {
          kind: 'success',
          ok: true,
          status: 201,
          data: { id: 100, title: 'T', text: validText, status: 'in_review', message: 'ok' },
        };
      },
    });
    const result = await tool.handler({
      text: validText,
      title: 'T',
      author: 'me',
      category_slug: 'computers',
    });
    expect(captured).toEqual({
      text: validText,
      title: 'T',
      author: 'me',
      category_slug: 'computers',
    });
    const text = result.content[0]?.text ?? '';
    expect(text).toContain('Law submitted successfully');
    expect(text).toContain('ID: 100');
    expect(text).toContain('Category: computers');
    expect(text).toContain('Author: me');
    expect(text).toContain('Status: in_review');
  });

  it('falls back to Anonymous when author missing', async () => {
    const tool = extractTool(registerSubmitLaw, {
      submitLaw: async () => ({
        kind: 'success',
        ok: true,
        status: 201,
        data: { id: 1, title: '', text: validText, status: 'in_review', message: 'ok' },
      }),
    });
    const result = await tool.handler({ text: validText });
    expect(result.content[0]?.text).toContain('Author: Anonymous');
    expect(result.content[0]?.text).toContain('Category: (none)');
    expect(result.content[0]?.text).toContain('Title: (none)');
  });

  it('surfaces rate_limited with retryAfter', async () => {
    const tool = extractTool(registerSubmitLaw, {
      submitLaw: async () => ({
        kind: 'rate_limited',
        ok: false,
        status: 429,
        error: 'Too many',
        retryAfter: 30,
      }),
    });
    const result = await tool.handler({ text: validText });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('30 seconds');
  });

  it('surfaces validation_error from SDK', async () => {
    const tool = extractTool(registerSubmitLaw, {
      submitLaw: async () => ({
        kind: 'validation_error',
        ok: false,
        status: 400,
        error: 'text too short',
      }),
    });
    const result = await tool.handler({ text: validText });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('text too short');
  });

  it('surfaces unexpected_error with status', async () => {
    const tool = extractTool(registerSubmitLaw, {
      submitLaw: async () => ({
        kind: 'unexpected_error',
        ok: false,
        status: 503,
        error: 'boom',
      }),
    });
    const result = await tool.handler({ text: validText });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('status 503');
  });
});
