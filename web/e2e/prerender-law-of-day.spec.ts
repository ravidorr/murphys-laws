// Playwright's local runner loads this package through CommonJS despite this package being ESM.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type * as Playwright from '@playwright/test';

const require = createRequire(import.meta.url);
const { expect, test }: typeof Playwright = require('@playwright/test');

/**
 * Layout guard for the prerendered Law of the Day.
 *
 * The home page paints the daily law from an inline script in index.html, into the prerendered page, long before
 * the app bundle runs. The app then replaces the whole page. Chrome only reports a new largest contentful paint
 * for an element that is LARGER than the current one, so the app's later quote must be no larger than the early
 * one, or LCP jumps back to the moment the bundle renders (the regression this spec exists to catch). The quote
 * must therefore have the same x, width and height in both renderings and sit at the same position or higher.
 *
 * This reads the production build (web/dist), so it needs `npm run build:web` first. Without a build it is skipped
 * locally and fails in CI, where a missing build is a mistake.
 */

const DIST = path.resolve(process.cwd(), 'dist');
const hasBuild = fs.existsSync(path.join(DIST, 'index.html'));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const LONG_TEXT = Array.from({ length: 9 }, (_, i) =>
  `Sentence ${i + 1} of a very long law whose wording keeps going so that it wraps over many lines on a phone.`
).join(' ');

const LAWS = {
  short: { id: 1354, title: null, text: 'Anything that can go wrong will.', attributions: [{ name: 'Anonymous' }] },
  medium: {
    id: 1355,
    title: null,
    text: 'Whenever you set out to take something apart and put it back together, the number of parts left over is directly proportional to how recently you promised it would only take a minute.',
    attributions: [{ name: 'Anonymous' }],
  },
  long: { id: 1356, title: null, text: LONG_TEXT, attributions: [] },
  titled: {
    id: 1357,
    title: "Cheops' Law",
    text: 'Nothing ever gets built on schedule or within budget, and it always takes longer than the plan said.',
    attributions: [{ name: 'Edward A. Murphy Jr.', note: 'Edwards Air Force Base, 1949' }, { name: 'Second Sender' }, { name: 'Third Sender', note: 'ignored' }],
  },
} as const;

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 412, height: 823 },
  { width: 1350, height: 900 },
];

function serveDist(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]!);
    // Like the service worker's navigation fallback, answer a route without a page of its own with the home page
    const requested = urlPath === '/' || urlPath.startsWith('/fallback/') ? '/index.html' : urlPath;
    const file = path.join(DIST, path.normalize(requested));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

interface Box { x: number; y: number; width: number; height: number }

/** Every request the page makes to the daily law endpoint, wherever it points */
function trackLawOfDayRequests(page: Playwright.Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('law-of-day')) urls.push(request.url());
  });
  return urls;
}

function visibleArea(box: Box, viewportHeight: number): number {
  const visibleHeight = Math.max(0, Math.min(box.y + box.height, viewportHeight) - Math.max(box.y, 0));
  return box.width * visibleHeight;
}

test.describe('prerendered Law of the Day geometry', () => {
  test.skip(!hasBuild && !process.env.CI, 'needs the production build: run npm run build:web');

  let server: http.Server;
  let origin: string;

  test.beforeAll(async () => {
    expect(hasBuild, 'web/dist/index.html is missing: run npm run build:web before the e2e suite').toBe(true);
    server = await serveDist();
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  test.afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  for (const viewport of VIEWPORTS) {
    for (const [name, law] of Object.entries(LAWS)) {
      test(`early quote is never smaller than the app's quote: ${name} law at ${viewport.width}x${viewport.height}`, async ({ browser }) => {
        const body = JSON.stringify({ law: { ...law, upvotes: 12, downvotes: 1 }, featured_date: '2026-11-12' });
        const mockApi = async (page: Playwright.Page) => {
          await page.route('**/api/**', (route) => {
            const isLaw = route.request().url().includes('/api/v1/law-of-day');
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: isLaw ? body : JSON.stringify({ data: [], total: 0 }),
            });
          });
        };

        // The prerendered page with the early paint, and no app bundle to replace it
        const staticContext = await browser.newContext({ viewport });
        const staticPage = await staticContext.newPage();
        const staticRequests = trackLawOfDayRequests(staticPage);
        await mockApi(staticPage);
        await staticPage.route('**/assets/index-*.js', (route) => route.abort());
        await staticPage.goto(origin, { waitUntil: 'load' });
        await expect(staticPage.locator('[data-home-zone="law-of-day"][data-prerendered] .lod-link')).toBeVisible();
        // The bundle really was blocked: the app never took over, so this is the early paint and not the app's own render
        await expect(staticPage.locator('[data-daily-law-state]')).toHaveCount(0);
        const early: Box = await staticPage.locator('.lod-quote-large').evaluate((el) => el.getBoundingClientRect().toJSON());
        await staticContext.close();
        // The route mock above answers any /api/ URL, so only the URL itself proves that the build wired the API base
        // into the inline script (a missing early-api-base plugin would request /__API_BASE_URL__/api/v1/law-of-day)
        expect(staticRequests, 'the inline script requests the daily law from this origin, once').toEqual([`${origin}/api/v1/law-of-day`]);

        // The real page: the app bundle arrives after the early paint and replaces the page
        const appContext = await browser.newContext({ viewport });
        const appPage = await appContext.newPage();
        const appRequests = trackLawOfDayRequests(appPage);
        await mockApi(appPage);
        await appPage.route('**/assets/index-*.js', async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 800));
          await route.continue();
        });
        await appPage.addInitScript(() => {
          const w = window as unknown as { __lcp: Array<{ time: number; size: number }>; __appAt: number };
          w.__lcp = [];
          w.__appAt = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) w.__lcp.push({ time: entry.startTime, size: (entry as unknown as { size: number }).size });
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          // The app replaces the page and gives the Law of the Day zone a state attribute; the prerendered zone has none
          new MutationObserver(() => {
            if (!w.__appAt && document.querySelector('[data-daily-law-state]')) w.__appAt = performance.now();
          }).observe(document, { childList: true, subtree: true });
        });
        await appPage.goto(origin, { waitUntil: 'load' });
        await expect(appPage.locator('[data-home-zone="law-of-day"][data-daily-law-state="ready"] .lod-quote-large')).toBeVisible();
        await appPage.waitForTimeout(500);
        const app: Box = await appPage.locator('.lod-quote-large').evaluate((el) => el.getBoundingClientRect().toJSON());
        const { lcp, appAt } = await appPage.evaluate(() => {
          const w = window as unknown as { __lcp: Array<{ time: number; size: number }>; __appAt: number };
          return { lcp: w.__lcp, appAt: w.__appAt };
        });
        await appContext.close();
        expect(appRequests, 'the app adopted the early request instead of making its own').toEqual([`${origin}/api/v1/law-of-day`]);

        // Same box, at the same position or higher: the early quote's visible area can only be as large or larger
        expect(app.x, 'quote x').toBeCloseTo(early.x, 1);
        expect(app.width, 'quote width').toBeCloseTo(early.width, 1);
        expect(app.height, 'quote height').toBeCloseTo(early.height, 1);
        expect(early.y, 'the early quote must not sit lower than the app quote').toBeLessThanOrEqual(app.y + 0.01);
        expect(visibleArea(early, viewport.height)).toBeGreaterThanOrEqual(visibleArea(app, viewport.height) - 0.01);

        // And in the browser's own words: the largest contentful paint is the early one, not the app's render
        expect(appAt, 'the app took over the page').toBeGreaterThan(0);
        expect(lcp.length).toBeGreaterThan(0);
        const lastLcp = lcp[lcp.length - 1]!;
        expect(lastLcp.time, 'the last LCP entry must come from the early paint, before the app rendered').toBeLessThan(appAt);
      });
    }
  }
});

/**
 * The app bundle waits for the Law of the Day answer (index.html, "App bundle start"), so the 0.6 KB answer is not
 * queued behind the app bundle. It must never wait for long: a failed, hung or slow API, and every route that
 * does not make the early request, load the app on time.
 */
test.describe('app bundle start', () => {
  test.skip(!hasBuild && !process.env.CI, 'needs the production build: run npm run build:web');

  const LAW_BODY = JSON.stringify({ law: { ...LAWS.short, upvotes: 1, downvotes: 0 }, featured_date: '2026-11-12' });
  const HOLD_MS = 1000;

  let server: http.Server;
  let origin: string;

  test.beforeAll(async () => {
    server = await serveDist();
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  test.afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  interface Timeline { bundleAt: number | null; lawRequestedAt: number | null; lawAnsweredAt: number | null; started: number }

  /** Loads a path with the given behaviour of the Law of the Day API and records when each request was made */
  async function load(
    browser: Playwright.Browser,
    pathname: string,
    api: (route: Playwright.Route, timeline: Timeline) => Promise<void> | void,
  ): Promise<{ page: Playwright.Page; timeline: Timeline; close: () => Promise<void> }> {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const timeline: Timeline = { bundleAt: null, lawRequestedAt: null, lawAnsweredAt: null, started: Date.now() };
    page.on('request', (request) => {
      if (/\/assets\/index-[^/]+\.js$/.test(request.url())) timeline.bundleAt = Date.now() - timeline.started;
    });
    await page.route('**/api/**', (route) => {
      if (route.request().url().includes('/api/v1/law-of-day')) {
        timeline.lawRequestedAt = Date.now() - timeline.started;
        return api(route, timeline);
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], total: 0 }) });
    });
    timeline.started = Date.now();
    await page.goto(`${origin}${pathname}`, { waitUntil: 'commit' });
    return { page, timeline, close: () => context.close() };
  }

  const appStarted = (page: Playwright.Page) => expect(page.locator('[data-daily-law-state]')).not.toHaveCount(0, { timeout: 15_000 });

  test('requests the bundle only after the daily law answer, and the app adopts that answer', async ({ browser }) => {
    const { page, timeline, close } = await load(browser, '/', async (route, t) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      // Recorded just before the answer leaves, so no request that follows it can be earlier
      t.lawAnsweredAt = Date.now() - t.started;
      await route.fulfill({ status: 200, contentType: 'application/json', body: LAW_BODY });
    });

    await appStarted(page);
    await expect(page.locator('[data-daily-law-state="ready"] .lod-quote-large')).toContainText('Anything that can go wrong will.');
    expect(timeline.lawAnsweredAt, 'the law was answered').not.toBeNull();
    expect(timeline.bundleAt, 'the bundle was requested after the answer').toBeGreaterThanOrEqual(timeline.lawAnsweredAt!);
    // The app took over the early answer instead of asking again
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/v1/law-of-day')).length)).toBe(1);
    await close();
  });

  for (const [name, answer] of [
    ['a failed request', (route: Playwright.Route) => route.abort()],
    ['a 503', (route: Playwright.Route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' })],
  ] as const) {
    test(`does not wait for the cap after ${name}`, async ({ browser }) => {
      const { page, timeline, close } = await load(browser, '/', answer);

      await appStarted(page);
      expect(timeline.bundleAt, 'the bundle was requested').not.toBeNull();
      expect(timeline.bundleAt!, 'well before the cap').toBeLessThan(HOLD_MS);
      await close();
    });
  }

  test('starts the bundle at the cap when the API never answers', async ({ browser }) => {
    const { page, timeline, close } = await load(browser, '/', () => new Promise<void>(() => undefined));

    await appStarted(page);
    expect(timeline.bundleAt, 'not before the cap').toBeGreaterThanOrEqual(HOLD_MS - 100);
    expect(timeline.bundleAt, 'and not long after it').toBeLessThan(HOLD_MS + 1500);
    await close();
  });

  test('starts the bundle at the cap when the API answers slower than that, and still shows the law', async ({ browser }) => {
    const { page, timeline, close } = await load(browser, '/', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.fulfill({ status: 200, contentType: 'application/json', body: LAW_BODY });
    });

    await appStarted(page);
    expect(timeline.bundleAt, 'not before the cap').toBeGreaterThanOrEqual(HOLD_MS - 100);
    expect(timeline.bundleAt, 'and before the slow answer').toBeLessThan(2500);
    await expect(page.locator('[data-daily-law-state="ready"] .lod-quote-large')).toContainText('Anything that can go wrong will.', { timeout: 10_000 });
    await close();
  });

  test('starts the bundle at once on a route that has no page of its own, and makes no early request', async ({ browser }) => {
    const { page, timeline, close } = await load(browser, '/fallback/some-route', () => new Promise<void>(() => undefined));

    await expect.poll(() => timeline.bundleAt, { timeout: 5000 }).not.toBeNull();
    expect(timeline.bundleAt!, 'no hold').toBeLessThan(HOLD_MS - 100);
    expect(timeline.lawRequestedAt).toBeNull();
    await expect(page.locator('script#app-entry')).toHaveCount(1);
    await close();
  });

  test('leaves every other prerendered page with its ordinary module script', async ({ browser }) => {
    const { page, timeline, close } = await load(browser, '/browse/index.html', () => new Promise<void>(() => undefined));

    await expect.poll(() => timeline.bundleAt, { timeout: 5000 }).not.toBeNull();
    expect(timeline.bundleAt!, 'no hold').toBeLessThan(HOLD_MS - 100);
    await expect(page.locator('script#app-entry')).toHaveCount(0);
    await expect(page.locator('head > script[type="module"][src*="/assets/index-"]')).toHaveCount(1);
    await close();
  });
});
