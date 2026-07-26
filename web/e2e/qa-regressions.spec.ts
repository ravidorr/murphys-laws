import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test');

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
      expect(before).not.toBeNull();
      expect(after).not.toBeNull();
      expect(Math.abs(after.x - before.x)).toBeLessThan(1);
      expect(Math.abs(after.y - before.y)).toBeLessThan(1);
      expect(Math.abs(after.width - before.width)).toBeLessThan(1);
      expect(Math.abs(after.height - before.height)).toBeLessThan(1);

      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('navigation', { name: 'Menu navigation' })).toBeVisible();

      const searchBox = await search.boundingBox();
      const brandBox = await brand.boundingBox();
      expect(searchBox).not.toBeNull();
      expect(brandBox).not.toBeNull();
      if (viewport.width <= 640) {
        expect(searchBox.y).toBeGreaterThanOrEqual(brandBox.y + brandBox.height - 1);
      } else {
        expect(Math.abs((searchBox.y + searchBox.height / 2) - (brandBox.y + brandBox.height / 2))).toBeLessThan(12);
      }

      await expect(page.locator('main h1')).toHaveCount(1);
    });
  }

  for (const viewport of [
    { name: 'mobile', width: 320, height: 640 },
    { name: 'desktop', width: 1440, height: 900 },
  ]) {
    test(`buttered toast formula fits at ${viewport.name} width`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/calculator/buttered-toast');

      const formula = page.locator('#toast-formula-display');
      await expect(formula.locator('math')).toBeVisible();
      await expect(formula).toHaveAttribute('aria-label', 'Buttered toast probability formula');

      expect(await formula.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

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
