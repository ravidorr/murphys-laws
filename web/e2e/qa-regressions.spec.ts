import { createRequire } from 'node:module';
import type * as Playwright from '@playwright/test';

const require = createRequire(import.meta.url);
const { expect, test }: typeof Playwright = require('@playwright/test');

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

test.describe('QA regressions', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} header is stable and the menu accepts pointer input`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const menu = page.getByRole('button', { name: 'Open main menu' });
      const search = page.locator('.header-search');
      const brand = page.locator('.brand-wrapper');
      await expect(menu).toBeVisible();
      await expect(search).toBeVisible();

      const before = await menu.boundingBox();
      await page.waitForTimeout(700);
      const after = await menu.boundingBox();
      if (before === null || after === null) {
        throw new Error('The visible menu button did not produce a bounding box.');
      }
      expect(Math.abs(after.x - before.x)).toBeLessThan(1);
      expect(Math.abs(after.y - before.y)).toBeLessThan(1);
      expect(Math.abs(after.width - before.width)).toBeLessThan(1);
      expect(Math.abs(after.height - before.height)).toBeLessThan(1);

      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('navigation', { name: 'Menu navigation' })).toBeVisible();

      const searchBox = await search.boundingBox();
      const brandBox = await brand.boundingBox();
      if (searchBox === null || brandBox === null) {
        throw new Error('The visible header elements did not produce bounding boxes.');
      }
      if (viewport.width <= 640) {
        expect(searchBox.y).toBeGreaterThanOrEqual(brandBox.y + brandBox.height - 1);
      } else {
        expect(Math.abs((searchBox.y + searchBox.height / 2) - (brandBox.y + brandBox.height / 2))).toBeLessThan(12);
      }

      await expect(page.locator('main h1')).toHaveCount(1);
    });
  }

  for (const viewport of [
    { name: 'mobile', width: 320, height: 640, minFontSize: 24, fits: false },
    { name: 'tablet', width: 768, height: 1024, minFontSize: 36, fits: false },
    { name: 'laptop', width: 1024, height: 768, minFontSize: 24, fits: true },
    { name: 'desktop', width: 1440, height: 900, minFontSize: 24, fits: true },
  ]) {
    test(`buttered toast formula stays readable at ${viewport.name} width`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/calculator/buttered-toast');

      const formula = page.locator('#toast-formula-display');
      await expect(formula.locator('math')).toBeVisible();
      await expect(formula).toHaveAttribute('role', 'group');
      await expect(formula).toHaveAttribute('aria-label', 'Buttered toast probability formula');

      const fontSize = await formula.locator('math').evaluate(element => getComputedStyle(element).fontSize);
      expect(Number.parseFloat(fontSize)).toBeGreaterThanOrEqual(viewport.minFontSize);

      const overflows = await formula.evaluate(element => element.scrollWidth > element.clientWidth);
      if (viewport.fits) {
        expect(overflows).toBe(false);
      } else {
        // Too wide to fit at a readable size: the formula must scroll inside its own box.
        expect(overflows).toBe(true);
        expect(await formula.evaluate(element => getComputedStyle(element).overflowX)).toBe('auto');
        await formula.evaluate(element => {
          element.scrollLeft = 40;
        });
        expect(await formula.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('sods law score is pinned to the bottom of the screen on a phone while the sliders are in view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/calculator/sods-law');

    const result = page.locator('#result-display');
    await expect(result).toBeVisible();
    // The sliders start below the first screen of a 667px phone, so bring them into view first
    await page.locator('#urgency').scrollIntoViewIfNeeded();
    await expect(result).toHaveCSS('position', 'sticky');
    // The sample note stays out of the compact pinned bar
    await expect(page.locator('#score-sample-hint')).toBeHidden();
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const box = await result.boundingBox();
    if (box === null) throw new Error('The score did not produce a bounding box.');
    expect(Math.abs(box.y + box.height - viewportHeight)).toBeLessThan(1);

    // A slider that takes focus stays clear of the pinned score
    await page.locator('#frequency').focus();
    await expect.poll(async () => {
      const slider = await page.locator('#frequency').boundingBox();
      const bar = await result.boundingBox();
      return slider !== null && bar !== null && slider.y + slider.height <= bar.y;
    }).toBe(true);
  });

  test('sods law score stays in the page from 600px wide', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 667 });
    await page.goto('/calculator/sods-law');

    await expect(page.locator('#result-display')).toHaveCSS('position', 'static');
  });

  test('homepage search keeps the query in the URL, form, and results', async ({ page }) => {
    await page.goto('/');
    const homeSearch = page.locator('[data-home-zone="archive-search"] input[type="search"]');
    await homeSearch.fill('technology failure');
    await homeSearch.press('Enter');

    await expect(page).toHaveURL(/\/browse\?q=technology(?:\+|%20)failure$/);
    await expect(page.locator('#search-keyword')).toHaveValue('technology failure');
    await expect(page.locator('.search-info')).toContainText('technology failure');
    await expect(page.locator('#browse-laws-list .law-card-mini').first()).toBeVisible({ timeout: 10000 });
  });

  test('category slug loads without failed category API requests', async ({ page }) => {
    const failedRequests: string[] = [];
    const consoleErrors: string[] = [];
    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/category/murphys-computer-laws');
    await expect(page.locator('main h1')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.law-card-mini').first()).toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    expect(failedRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
    await expect(page.locator('main h1')).toHaveCount(1);
  });

  test('menu works from the keyboard with reduced motion enabled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Open main menu' });
    await menu.focus();
    await expect(menu).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation', { name: 'Menu navigation' }).getByRole('link', { name: 'Browse All Laws' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
  });

  test('a law page keeps its prerendered law when the law request fails with a server error', async ({ page }) => {
    // Serve the app shell for /law/7 with the law card the static build would have put in <main>
    await page.route(url => url.pathname === '/law/7', async route => {
      const shell = await route.fetch({ url: new URL('/', route.request().url()).toString() });
      // The base tag keeps the shell's relative script path working from /law/7
      const html = (await shell.text()).replace('<head>', '<head><base href="/">').replace(
        /<main\b[^>]*>[\s\S]*?<\/main>/,
        `<main id="main-content" class="flex-1 container page" aria-label="Main content">
          <div class="container page law-detail pt-0">
            <article class="card card--section law-detail-card">
              <header class="card-header"><h1 class="card-title">Prerendered E2E Law</h1></header>
              <div class="card-body"><blockquote class="law-text">Prerendered e2e law text</blockquote></div>
            </article>
          </div>
        </main>`,
      );
      await route.fulfill({ response: shell, body: html });
    });
    await page.route('**/api/v1/laws/7', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }));

    await page.goto('/law/7');

    await expect(page.getByText('Prerendered e2e law text')).toBeVisible();
    await expect(page.getByText("Some features of this page couldn't load")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();
    await expect(page.getByText('Law Not Found')).toHaveCount(0);
  });

  for (const route of [
    '/browse',
    '/category/murphys-computer-laws',
    '/law/2',
    '/submit',
    '/calculator/sods-law',
    '/calculator/buttered-toast',
  ]) {
    test(`${route} has one page-level heading`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('main h1')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('main h1')).toHaveCount(1);
    });
  }
});
