import { describe, it, expect, beforeEach } from 'vitest';
import { ApiError, type Law, type LawsPage, type LawOfDay, type Category } from 'murphys-laws-sdk';
import { runCli } from '../src/cli.js';
import { EXIT_NETWORK, EXIT_NOT_FOUND, EXIT_RATE_LIMITED, EXIT_SUCCESS, EXIT_USAGE } from '../src/exit-codes.js';
import { createStream, createStubClient, type TestStream, type StubClientBehavior } from './helpers.js';

const VERSION = '0.1.0-test';

describe('runCli', () => {
  let stdout: TestStream;
  let stderr: TestStream;

  beforeEach(() => {
    stdout = createStream();
    stderr = createStream();
  });

  function run(argv: string[], behavior: StubClientBehavior = {}): Promise<number> {
    return runCli(argv, {
      stdout,
      stderr,
      env: {},
      isStdoutTTY: false,
      version: VERSION,
      clientFactory: () => createStubClient(behavior),
    });
  }

  it('prints help with no command', async () => {
    const code = await run([]);
    expect(code).toBe(EXIT_USAGE);
    expect(stdout.output).toContain('Usage:');
  });

  it('prints help on --help', async () => {
    const code = await run(['--help']);
    expect(code).toBe(EXIT_SUCCESS);
    expect(stdout.output).toContain('Commands:');
  });

  it('prints help on `help` command', async () => {
    const code = await run(['help']);
    expect(code).toBe(EXIT_SUCCESS);
    expect(stdout.output).toContain('Options:');
  });

  it('prints version on --version', async () => {
    const code = await run(['--version']);
    expect(code).toBe(EXIT_SUCCESS);
    expect(stdout.output.trim()).toBe(VERSION);
  });

  it('rejects unknown command', async () => {
    const code = await run(['bogus']);
    expect(code).toBe(EXIT_USAGE);
    expect(stderr.output).toContain('Unknown command');
  });

  it('rejects unknown flag before running command', async () => {
    const code = await run(['--totally-fake']);
    expect(code).toBe(EXIT_USAGE);
    expect(stderr.output).toContain('Unknown flag');
    expect(stderr.output).toContain("'murphy --help'");
  });

  describe('search', () => {
    const page: LawsPage = {
      data: [{ id: 1, text: 'hi', upvotes: 1, downvotes: 0 }],
      total: 1,
      limit: 10,
      offset: 0,
    };

    it('searches with query and prints formatted list', async () => {
      let captured: unknown;
      const code = await run(['search', 'debug'], {
        searchLaws: async (params) => {
          captured = params;
          return page;
        },
      });
      expect(code).toBe(EXIT_SUCCESS);
      expect(captured).toMatchObject({ q: 'debug', limit: 10, sort: 'score', order: 'desc' });
      expect(stdout.output).toContain("Murphy's Law");
      expect(stdout.output).toContain('#1');
    });

    it('supports --json output', async () => {
      const code = await run(['--json', 'search', 'debug'], {
        searchLaws: async () => page,
      });
      expect(code).toBe(EXIT_SUCCESS);
      const json = JSON.parse(stdout.output);
      expect(json.data[0].id).toBe(1);
    });

    it('fails with usage error when query missing', async () => {
      const code = await run(['search']);
      expect(code).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('search requires a query');
    });

    it('forwards --limit and --category to client', async () => {
      let captured: unknown;
      const code = await run(['search', 'x', '--limit', '5', '--category', 'computers'], {
        searchLaws: async (params) => {
          captured = params;
          return page;
        },
      });
      expect(code).toBe(EXIT_SUCCESS);
      expect(captured).toMatchObject({ q: 'x', limit: 5, category_slug: 'computers' });
    });

    it('rejects invalid --limit', async () => {
      const code = await run(['search', 'x', '--limit', '0']);
      expect(code).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('Invalid value for --limit');
    });
  });

  describe('random', () => {
    const law: Law = { id: 42, text: 'anything', upvotes: 3, downvotes: 1 };

    it('prints formatted random law', async () => {
      const code = await run(['random'], { getRandomLaw: async () => law });
      expect(code).toBe(EXIT_SUCCESS);
      expect(stdout.output).toContain('#42');
    });

    it('supports --json', async () => {
      const code = await run(['random', '--json'], { getRandomLaw: async () => law });
      expect(code).toBe(EXIT_SUCCESS);
      expect(JSON.parse(stdout.output).id).toBe(42);
    });

    it('exits 1 on 404', async () => {
      const code = await run(['random'], {
        getRandomLaw: async () => {
          throw new ApiError(404, 'no laws');
        },
      });
      expect(code).toBe(EXIT_NOT_FOUND);
      expect(stderr.output).toContain('Not found');
    });
  });

  describe('today', () => {
    const lod: LawOfDay = {
      law: { id: 7, text: 'today' },
      featured_date: '2026-04-20',
    };

    it('prints law of the day', async () => {
      const code = await run(['today'], { getLawOfTheDay: async () => lod });
      expect(code).toBe(EXIT_SUCCESS);
      expect(stdout.output).toContain('Law of the Day');
      expect(stdout.output).toContain('2026-04-20');
      expect(stdout.output).toContain('#7');
    });

    it('supports --json', async () => {
      const code = await run(['today', '--json'], { getLawOfTheDay: async () => lod });
      expect(code).toBe(EXIT_SUCCESS);
      expect(JSON.parse(stdout.output).featured_date).toBe('2026-04-20');
    });
  });

  describe('get', () => {
    const law: Law = { id: 9, text: 'the text', upvotes: 0, downvotes: 0 };

    it('fetches by id', async () => {
      let captured: unknown;
      const code = await run(['get', '9'], {
        getLaw: async (id) => {
          captured = id;
          return law;
        },
      });
      expect(code).toBe(EXIT_SUCCESS);
      expect(captured).toBe(9);
      expect(stdout.output).toContain('#9');
    });

    it('prints the corollaries of the law', async () => {
      const code = await run(['get', '9'], {
        getLaw: async () => ({
          ...law,
          corollaries: [{ id: 11, title: 'The Ignition Corollary', text: 'Restart feels slow.', upvotes: 1, downvotes: 0 }],
        }),
      });
      expect(code).toBe(EXIT_SUCCESS);
      expect(stdout.output).toContain('Corollaries (1):');
      expect(stdout.output).toContain('#11 The Ignition Corollary');
    });

    it('supports --json', async () => {
      const code = await run(['get', '9', '--json'], { getLaw: async () => law });
      expect(JSON.parse(stdout.output).id).toBe(9);
      expect(code).toBe(EXIT_SUCCESS);
    });

    it('rejects missing id', async () => {
      const code = await run(['get']);
      expect(code).toBe(EXIT_USAGE);
    });

    it('rejects non-integer id', async () => {
      const code = await run(['get', 'abc']);
      expect(code).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('positive integer');
    });

    it('rejects zero id', async () => {
      const code = await run(['get', '0']);
      expect(code).toBe(EXIT_USAGE);
    });

    it('returns not-found on 404', async () => {
      const code = await run(['get', '999'], {
        getLaw: async () => {
          throw new ApiError(404, 'nope');
        },
      });
      expect(code).toBe(EXIT_NOT_FOUND);
    });
  });

  describe('categories', () => {
    const cats: Category[] = [
      { id: 1, slug: 'a', title: 'A', description: null, law_count: 1 },
    ];

    it('lists categories', async () => {
      const code = await run(['categories'], { listCategories: async () => cats });
      expect(code).toBe(EXIT_SUCCESS);
      expect(stdout.output).toContain('Categories');
    });

    it('supports --json', async () => {
      const code = await run(['categories', '--json'], { listCategories: async () => cats });
      expect(JSON.parse(stdout.output)[0].slug).toBe('a');
      expect(code).toBe(EXIT_SUCCESS);
    });
  });

  describe('category', () => {
    const page: LawsPage = {
      data: [{ id: 1, text: 'hi' }],
      total: 1,
      limit: 10,
      offset: 0,
    };

    it('fetches laws in category with slug', async () => {
      let capturedSlug: string | undefined;
      const code = await run(['category', 'computers', '--limit', '3'], {
        getLawsByCategory: async (slug) => {
          capturedSlug = slug;
          return page;
        },
      });
      expect(code).toBe(EXIT_SUCCESS);
      expect(capturedSlug).toBe('computers');
      expect(stdout.output).toContain('#1');
    });

    it('rejects missing slug', async () => {
      const code = await run(['category']);
      expect(code).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('slug argument');
    });

    it('supports --json', async () => {
      const code = await run(['category', 'computers', '--json'], {
        getLawsByCategory: async () => page,
      });
      expect(JSON.parse(stdout.output).total).toBe(1);
      expect(code).toBe(EXIT_SUCCESS);
    });
  });

  describe('submit', () => {
    it('submits successfully with positional text', async () => {
      const code = await run(
        ['submit', 'Long enough law text here', '--title', 'T', '--author', 'me'],
        {
          submitLaw: async () => ({
            kind: 'success',
            ok: true,
            status: 201,
            data: { id: 1, title: 'T', text: 'Long enough law text here', status: 'pending', corollaries: [], message: 'ok' },
          }),
        },
      );
      expect(code).toBe(EXIT_SUCCESS);
      expect(stdout.output).toContain('Submitted law #1');
    });

    it('sends each --corollary, prints the created ones, and omits the field when none are given', async () => {
      const captured: unknown[] = [];
      const behavior = {
        submitLaw: async (input: { corollaries?: unknown }) => {
          captured.push(input);
          return {
            kind: 'success' as const,
            ok: true as const,
            status: 201 as const,
            data: {
              id: 7,
              title: '',
              text: 'Long enough law text here',
              status: 'in_review',
              corollaries: input.corollaries ? [{ id: 8, title: null, text: 'first corollary text' }, { id: 9, title: null, text: 'second corollary text' }] : [],
              message: 'ok',
            },
          };
        },
      };
      const code = await run(['submit', 'Long enough law text here', '--corollary', 'first corollary text', '--corollary', 'second corollary text'], behavior);
      expect(code).toBe(EXIT_SUCCESS);
      expect(captured[0]).toMatchObject({ corollaries: [{ text: 'first corollary text' }, { text: 'second corollary text' }] });
      expect(stdout.output).toContain('Corollary 1: #8 first corollary text');
      expect(stdout.output).toContain('Corollary 2: #9 second corollary text');

      stdout.output = '';
      await run(['submit', 'Long enough law text here'], behavior);
      expect(captured[1]).not.toHaveProperty('corollaries');
      expect(stdout.output).not.toContain('Corollary 1');
    });

    it('trims each corollary before checking and sending it', async () => {
      let captured: { corollaries?: { text: string }[] } = {};
      const behavior = {
        submitLaw: async (input: { corollaries?: { text: string }[] }) => {
          captured = input;
          return { kind: 'success' as const, ok: true as const, status: 201 as const, data: { id: 7, title: null, text: 'Long enough law text here', status: 'in_review', corollaries: [], message: 'ok' } };
        },
      };
      expect(await run(['submit', 'Long enough law text here', '--corollary', '   padded corollary text   '], behavior)).toBe(EXIT_SUCCESS);
      expect(captured.corollaries).toEqual([{ text: 'padded corollary text' }]);

      expect(await run(['submit', 'Long enough law text here', '--corollary', '    short    '], behavior)).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('corollary 1 must be 10-1000 characters (got 5)');
    });

    it('rejects more than five corollaries and any outside 10-1000 characters before calling the API', async () => {
      let called = false;
      const behavior = { submitLaw: async () => { called = true; throw new Error('should not be called'); } };
      const six = Array.from({ length: 6 }, () => ['--corollary', 'a corollary long enough']).flat();
      expect(await run(['submit', 'Long enough law text here', ...six], behavior)).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('at most 5 corollaries');

      stderr.output = '';
      expect(await run(['submit', 'Long enough law text here', '--corollary', 'short'], behavior)).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('corollary 1 must be 10-1000 characters (got 5)');

      stderr.output = '';
      expect(await run(['submit', 'Long enough law text here', '--corollary', 'x'.repeat(1001)], behavior)).toBe(EXIT_USAGE);
      expect(called).toBe(false);
    });

    it('uses --text flag when provided', async () => {
      let captured: unknown;
      const code = await run(['submit', '--text', 'another long enough text'], {
        submitLaw: async (input) => {
          captured = input;
          return {
            kind: 'success',
            ok: true,
            status: 201,
            data: { id: 2, title: '', text: 'another long enough text', status: 'pending', corollaries: [], message: 'ok' },
          };
        },
      });
      expect(code).toBe(EXIT_SUCCESS);
      expect(captured).toMatchObject({ text: 'another long enough text' });
    });

    it('fails when text missing', async () => {
      const code = await run(['submit']);
      expect(code).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('submit requires law text');
    });

    it('rejects text too short', async () => {
      const code = await run(['submit', 'short']);
      expect(code).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('10-1000 characters');
    });

    it('surfaces rate limit response', async () => {
      const code = await run(['submit', 'a valid length law text'], {
        submitLaw: async () => ({
          kind: 'rate_limited',
          ok: false,
          status: 429,
          error: 'Too many',
          retryAfter: 30,
        }),
      });
      expect(code).toBe(EXIT_RATE_LIMITED);
      expect(stderr.output).toContain('30 seconds');
    });

    it('surfaces validation errors', async () => {
      const code = await run(['submit', 'a valid length law text'], {
        submitLaw: async () => ({
          kind: 'validation_error',
          ok: false,
          status: 400,
          error: 'invalid category',
        }),
      });
      expect(code).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('invalid category');
    });

    it('surfaces unexpected errors', async () => {
      const code = await run(['submit', 'a valid length law text'], {
        submitLaw: async () => ({
          kind: 'unexpected_error',
          ok: false,
          status: 500,
          error: 'boom',
        }),
      });
      expect(code).toBe(EXIT_USAGE);
      expect(stderr.output).toContain('boom');
    });

    it('emits JSON result with rate_limited exit code', async () => {
      const code = await run(['--json', 'submit', 'a valid length law text'], {
        submitLaw: async () => ({
          kind: 'rate_limited',
          ok: false,
          status: 429,
          error: 'Too many',
          retryAfter: 30,
        }),
      });
      expect(code).toBe(EXIT_RATE_LIMITED);
      const parsed = JSON.parse(stdout.output);
      expect(parsed.kind).toBe('rate_limited');
    });

    it('emits JSON for validation error with usage exit code', async () => {
      const code = await run(['--json', 'submit', 'a valid length law text'], {
        submitLaw: async () => ({
          kind: 'validation_error',
          ok: false,
          status: 400,
          error: 'bad',
        }),
      });
      expect(code).toBe(EXIT_USAGE);
      expect(JSON.parse(stdout.output).kind).toBe('validation_error');
    });

    it('emits JSON for unexpected error with usage exit code', async () => {
      const code = await run(['--json', 'submit', 'a valid length law text'], {
        submitLaw: async () => ({
          kind: 'unexpected_error',
          ok: false,
          status: 500,
          error: 'x',
        }),
      });
      expect(code).toBe(EXIT_USAGE);
      expect(JSON.parse(stdout.output).kind).toBe('unexpected_error');
    });

    it('emits JSON for success with success exit code', async () => {
      const code = await run(['--json', 'submit', 'a valid length law text'], {
        submitLaw: async () => ({
          kind: 'success',
          ok: true,
          status: 201,
          data: { id: 3, title: '', text: 'a valid length law text', status: 'pending', corollaries: [], message: 'ok' },
        }),
      });
      expect(code).toBe(EXIT_SUCCESS);
      expect(JSON.parse(stdout.output).kind).toBe('success');
    });
  });

  describe('error handling', () => {
    it('maps 429 from API to rate-limited exit', async () => {
      const code = await run(['random'], {
        getRandomLaw: async () => {
          throw new ApiError(429, 'too fast');
        },
      });
      expect(code).toBe(EXIT_RATE_LIMITED);
    });

    it('maps other ApiError statuses to network exit', async () => {
      const code = await run(['random'], {
        getRandomLaw: async () => {
          throw new ApiError(500, 'boom');
        },
      });
      expect(code).toBe(EXIT_NETWORK);
      expect(stderr.output).toContain('API error 500');
    });

    it('maps thrown Error to network exit', async () => {
      const code = await run(['random'], {
        getRandomLaw: async () => {
          throw new Error('network down');
        },
      });
      expect(code).toBe(EXIT_NETWORK);
      expect(stderr.output).toContain('network down');
    });

    it('maps thrown non-Error to network exit', async () => {
      const code = await run(['random'], {
        getRandomLaw: async () => {
          throw 'string-thrown';
        },
      });
      expect(code).toBe(EXIT_NETWORK);
      expect(stderr.output).toContain('string-thrown');
    });
  });

  describe('client factory defaults', () => {
    it('creates a real client via the default factory when none provided', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = ((): Promise<Response> =>
        Promise.resolve(
          new Response(JSON.stringify({ id: 1, text: 'hi' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )) as typeof fetch;
      try {
        const code = await runCli(['random', '--base-url', 'https://api.test'], {
          stdout,
          stderr,
          env: {},
          isStdoutTTY: false,
          version: VERSION,
        });
        expect(code).toBe(EXIT_SUCCESS);
        expect(stdout.output).toContain('#1');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('passes baseUrl and userAgent flags to the factory', async () => {
      let captured: { baseUrl?: string; userAgent?: string } | undefined;
      const code = await runCli(
        ['--base-url', 'https://override', '--user-agent', 'custom', 'random'],
        {
          stdout,
          stderr,
          env: {},
          isStdoutTTY: false,
          version: VERSION,
          clientFactory: (opts) => {
            captured = opts;
            return createStubClient({
              getRandomLaw: async () => ({ id: 1, text: 'hi' }),
            });
          },
        },
      );
      expect(code).toBe(EXIT_SUCCESS);
      expect(captured).toEqual({ baseUrl: 'https://override', userAgent: 'custom' });
    });

    it('defaults user-agent to version-tagged string', async () => {
      let captured: { baseUrl?: string; userAgent?: string } | undefined;
      await runCli(['random'], {
        stdout,
        stderr,
        env: {},
        isStdoutTTY: false,
        version: VERSION,
        clientFactory: (opts) => {
          captured = opts;
          return createStubClient({ getRandomLaw: async () => ({ id: 1, text: 'hi' }) });
        },
      });
      expect(captured?.userAgent).toBe(`murphys-laws-cli/${VERSION}`);
    });
  });
});
