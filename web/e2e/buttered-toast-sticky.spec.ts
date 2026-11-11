import { createRequire } from 'node:module';
import type * as Playwright from '@playwright/test';

const require = createRequire(import.meta.url);
const { expect, test }: typeof Playwright = require('@playwright/test');

const RESULT = '#toast-result-display';

test.describe('Buttered Toast sticky result bar', () => {
  test('phones: the result is pinned inside the first screen and scrolls away once passed', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/calculator/buttered-toast');
    const result = page.locator(RESULT);
    await expect(result).toBeVisible();

    // At the top of the page the natural position is far below the fold, yet the bar sits at the bottom edge
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(result).toHaveCSS('position', 'sticky');
    const pinned = await result.boundingBox();
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(pinned!.y).toBeGreaterThanOrEqual(0);
    expect(pinned!.y + pinned!.height).toBeLessThanOrEqual(viewportHeight);

    // It has an accessible name taken from the heading above it
    await expect(page.getByRole('group', { name: /Probability of Butter-Side Down Landing/ })).toBeVisible();

    // Past the end of its section the bar returns to normal flow instead of following the visitor down
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const passed = await result.boundingBox();
    expect(passed!.y + passed!.height).toBeLessThan(0);
  });

  test('desktop: the result stays in normal flow', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/calculator/buttered-toast');
    const result = page.locator(RESULT);
    await expect(result).toBeVisible();
    await expect(result).toHaveCSS('position', 'static');
  });
});
