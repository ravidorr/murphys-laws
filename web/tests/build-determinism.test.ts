// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { afterEach, describe, expect, it, vi } from 'vitest';

// A full double build takes too long for the unit suite, so this guards the way the build went wrong: a clock, a
// random number or the machine leaking into the output, and a build that is not given the commit it is made for.
// vite.config.ts is loaded with the Sentry plugin replaced by a recorder, so the release the plugin is given and the
// release compiled into the bundle can be compared.
const repoRoot = resolve(__dirname, '..', '..');
const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8');
const SHA = 'c'.repeat(40);

// Everything in web/scripts decides what goes into dist/ and how it is named, plus the build entry point
const BUILD_FILES = [
  ...readdirSync(resolve(repoRoot, 'web/scripts'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => `web/scripts/${name}`),
  'web/vite.config.ts',
  'scripts/build-web-with-local-api.mjs',
];
const NON_DETERMINISTIC = new RegExp(
  [
    String.raw`\bDate\.now`,
    String.raw`\bDate\(\)`,
    String.raw`\bnew Date\(\s*\)`,
    String.raw`Math\.random`,
    String.raw`getRandomValues|randomUUID|randomBytes|randomInt`,
    String.raw`process\.(?:pid|hrtime|uptime)`,
    String.raw`performance\.now`,
    String.raw`os\.(?:hostname|userInfo)|\bhostname\(`,
    String.raw`\.mtime`,
  ].join('|'),
);
const withoutComments = (source: string): string => source.replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1').replace(/^\s*\/\/.*$/gm, '');

describe('deterministic web build', () => {
  it('checks the files that make the build', () => {
    expect(BUILD_FILES).toEqual(
      expect.arrayContaining(['web/scripts/ssg.ts', 'web/scripts/generate-service-worker.ts', 'web/vite.config.ts']),
    );
  });

  it.each(BUILD_FILES)('%s reads neither the clock, a random number nor the machine', (file) => {
    expect(withoutComments(read(file)).match(NON_DETERMINISTIC)?.[0]).toBeUndefined();
  });

  it('hands the runtime the release through the define, not a separate source', () => {
    expect(read('web/src/main.ts')).toMatch(/release:\s*import\.meta\.env\.VITE_APP_VERSION,/);
  });

  describe('vite.config.ts', () => {
    const recorded: { release?: { name?: string } }[] = [];

    const loadConfig = async (env: Record<string, string>) => {
      vi.resetModules();
      vi.doMock('@sentry/vite-plugin', () => ({
        sentryVitePlugin: (options: { release?: { name?: string } }) => {
          recorded.push(options);
          return { name: 'recorded-sentry-plugin' };
        },
      }));
      for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
      // The path is a variable so that TypeScript does not pull the config (which has its own typing) into the tests
      const configPath = '../vite.config.ts';
      return (await import(/* @vite-ignore */ configPath)).default as { define: Record<string, string> };
    };

    afterEach(() => {
      recorded.length = 0;
      vi.unstubAllEnvs();
      vi.doUnmock('@sentry/vite-plugin');
    });

    it('compiles the same release into the bundle that the Sentry plugin uploads the source maps to', async () => {
      const config = await loadConfig({
        VITE_APP_VERSION: SHA,
        SENTRY_UPLOAD: 'true',
        SENTRY_AUTH_TOKEN: 'token',
        SENTRY_ORG: 'org',
        SENTRY_PROJECT: 'project',
      });

      expect(recorded).toHaveLength(1);
      expect(recorded[0]?.release?.name).toBe(SHA);
      expect(config.define['import.meta.env.VITE_APP_VERSION']).toBe(JSON.stringify(SHA));
    });

    it('defines the release without the plugin too, so a build without an upload reports the commit', async () => {
      const config = await loadConfig({ VITE_APP_VERSION: SHA, SENTRY_UPLOAD: 'false' });

      expect(recorded).toHaveLength(0);
      expect(config.define['import.meta.env.VITE_APP_VERSION']).toBe(JSON.stringify(SHA));
    });

    it('stops a build that uploads source maps without knowing its commit or release', async () => {
      // An empty GIT_DIR makes git fail wherever the test runs
      await expect(
        loadConfig({
          VITE_APP_VERSION: '',
          GIT_DIR: '/nonexistent-git-directory-for-the-release-test',
          SENTRY_UPLOAD: 'true',
          SENTRY_AUTH_TOKEN: 'token',
          SENTRY_ORG: 'org',
          SENTRY_PROJECT: 'project',
        }),
      ).rejects.toThrow(/set VITE_APP_VERSION to the commit SHA/);
    });
  });

  describe.each(['.github/workflows/deploy.yml', '.github/workflows/web-ci.yml'])('%s', (file) => {
    interface Step {
      name?: string;
      run?: string;
      env?: Record<string, string>;
      'working-directory'?: string;
    }
    interface Job {
      env?: Record<string, string>;
      steps?: Step[];
    }
    interface Workflow {
      env?: Record<string, string>;
      jobs: Record<string, Job>;
    }
    const workflow = load(read(file)) as Workflow;
    const buildsWeb = (step: Step): boolean =>
      /build:web\b|--prefix web run build\b/.test(step.run ?? '') ||
      (step['working-directory'] === 'web' && /npm run build\b/.test(step.run ?? ''));
    const builds = Object.entries(workflow.jobs).flatMap(([jobName, job]) =>
      (job.steps ?? []).filter(buildsWeb).map((step) => ({ label: `${jobName}: ${step.name ?? step.run}`, job, step })),
    );

    it('builds the web app at least once', () => {
      expect(builds.length).toBeGreaterThan(0);
    });

    it.each(builds.map((build) => [build.label, build] as const))(
      '%s is given the commit it runs on',
      (_label, { job, step }) => {
        const release = step.env?.VITE_APP_VERSION ?? job.env?.VITE_APP_VERSION ?? workflow.env?.VITE_APP_VERSION;

        expect(release).toBe('${{ github.sha }}');
      },
    );
  });
});
