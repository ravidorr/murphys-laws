import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Step = { name?: string; id?: string; run?: string; uses?: string; if?: string; with?: Record<string, unknown> };
type Workflow = {
  concurrency?: { group?: string; 'cancel-in-progress'?: unknown };
  jobs?: Record<string, { 'timeout-minutes'?: number; steps?: Step[] }>;
};

const workflow = load(readFileSync(path.join(rootDirectory, '.github/workflows/web-ci.yml'), 'utf8')) as Workflow;
const e2e = workflow.jobs?.['e2e-tests'];
const steps = e2e?.steps ?? [];
const step = (name: string): Step => {
  const found = steps.find((candidate) => candidate.name === name);
  assert.ok(found, `the e2e job has a step named "${name}"`);
  return found;
};

test('the e2e job cannot hold a runner for the 6-hour default', () => {
  const minutes = e2e?.['timeout-minutes'];
  assert.equal(typeof minutes, 'number');
  assert.ok((minutes as number) <= 30, `timeout-minutes is ${minutes}`);
});

test('a newer push to a pull request cancels the older run, and runs on main always finish', () => {
  assert.match(String(workflow.concurrency?.group), /^web-ci-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}$/);
  assert.equal(workflow.concurrency?.['cancel-in-progress'], "${{ github.event_name == 'pull_request' }}");
});

test('the e2e job installs only chromium and retries the installs that depend on the network', () => {
  const dependencies = step('Install Playwright system dependencies').run ?? '';
  const browser = step('Install Playwright chromium').run ?? '';
  assert.match(dependencies, /npx playwright install-deps chromium/);
  assert.match(browser, /npx playwright install chromium/);
  for (const script of [dependencies, browser]) {
    assert.match(script, /for attempt in 1 2 3; do/);
    assert.match(script, /timeout 120 /);
    assert.doesNotMatch(script, /--with-deps/);
  }
  assert.ok(
    !steps.some((candidate) => /npx playwright install(?! chromium\b)(?!-deps chromium\b)/.test(candidate.run ?? '')),
    'no step installs every browser',
  );
});

test('the browser download is cached by Playwright version and skipped on a cache hit', () => {
  const version = step('Get Playwright version');
  assert.equal(version.id, 'playwright-version');
  assert.match(version.run ?? '', /@playwright\/test\/package\.json/);

  const cache = step('Cache Playwright browsers');
  assert.match(String(cache.uses), /^actions\/cache@v4$/);
  assert.equal(cache.id, 'playwright-cache');
  assert.equal(cache.with?.path, '~/.cache/ms-playwright');
  assert.match(String(cache.with?.key), /steps\.playwright-version\.outputs\.version/);

  assert.equal(step('Install Playwright chromium').if, "steps.playwright-cache.outputs.cache-hit != 'true'");
  // System packages are not part of the cache, so they are installed on every run
  assert.equal(step('Install Playwright system dependencies').if, undefined);
});

test('the install steps run before the tests, and failures upload what the tests wrote', () => {
  const index = (name: string): number => steps.findIndex((candidate) => candidate.name === name);
  assert.ok(index('Cache Playwright browsers') < index('Install Playwright chromium'));
  assert.ok(index('Install Playwright system dependencies') < index('Run E2E tests'));
  assert.ok(index('Install Playwright chromium') < index('Run E2E tests'));

  const upload = step('Upload Playwright results');
  assert.equal(upload.if, 'always()');
  assert.match(String(upload.with?.path), /web\/test-results\//);
});
