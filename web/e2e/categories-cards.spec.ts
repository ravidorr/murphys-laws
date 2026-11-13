import { createRequire } from 'node:module';
import type * as Playwright from '@playwright/test';

const require = createRequire(import.meta.url);
const { expect, test }: typeof Playwright = require('@playwright/test');

const CARD = '.category-cluster .category-card';
const FEATURED_CARD = '#featured-categories .category-card';

test.describe('category cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/categories');
    await expect(page.locator(CARD).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator(FEATURED_CARD).first()).toBeVisible();
  });

  for (const [name, selector] of [['grouped', CARD], ['featured', FEATURED_CARD]] as const) {
    test(`${name} cards: nothing is underlined at rest; hover underlines the title only`, async ({ page }) => {
      const card = page.locator(selector).first();
      const title = card.locator('.category-card-title');
      const description = card.locator('.category-card-description');
      const count = card.locator('.category-card-count');
      const parts = name === 'featured' ? [card, title, count] : [card, title, description, count];

      await page.mouse.move(0, 0);
      for (const part of parts) {
        await expect(part).toHaveCSS('text-decoration-line', 'none');
      }

      await card.hover();
      await expect(title).toHaveCSS('text-decoration-line', 'underline');
      for (const part of parts.filter((part) => part !== title)) {
        await expect(part).toHaveCSS('text-decoration-line', 'none');
      }
    });
  }

  test('the arrow is visible at rest, so touch visitors can tell the card opens', async ({ page }) => {
    await page.mouse.move(0, 0);
    const arrow = page.locator(CARD).first().locator('.category-card-arrow');

    await expect(arrow).toHaveCSS('opacity', '1');
    const glyph = await arrow.evaluate((element) => getComputedStyle(element, '::after').content);
    expect(glyph).toContain('→');
  });

  test('keyboard focus shows an outline, the title underline and the link colour on the count', async ({ page }) => {
    const card = page.locator(CARD).first();
    const count = card.locator('.category-card-count');
    const restColor = await count.evaluate((element) => getComputedStyle(element).color);

    await card.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');

    await expect(card).toBeFocused();
    await expect(card).toHaveCSS('outline-style', 'solid');
    await expect(card).toHaveCSS('text-decoration-line', 'none');
    await expect(card.locator('.category-card-title')).toHaveCSS('text-decoration-line', 'underline');
    await expect(card.locator('.category-card-description')).toHaveCSS('text-decoration-line', 'none');
    await expect(count).toHaveCSS('text-decoration-line', 'none');
    expect(await count.evaluate((element) => getComputedStyle(element).color)).not.toBe(restColor);
  });

  test('clusters stack full width and the counts line up along the bottom of each row', async ({ page }) => {
    const clusters = page.locator('.category-cluster');
    const first = await clusters.nth(0).boundingBox();
    const second = await clusters.nth(1).boundingBox();

    expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
    expect(Math.abs(second!.width - first!.width)).toBeLessThan(1);

    // Group the first cluster's cards by row; in each row the footers must share one top edge
    const rows = await clusters.nth(0).locator('.category-card').evaluateAll((cards) => {
      const byTop = new Map<number, number[]>();
      cards.forEach((card) => {
        const top = Math.round(card.getBoundingClientRect().top);
        const footerTop = Math.round(card.querySelector('.category-card-footer')!.getBoundingClientRect().top);
        byTop.set(top, [...(byTop.get(top) ?? []), footerTop]);
      });
      return [...byTop.values()];
    });

    expect(rows.some((row) => row.length > 1)).toBe(true);
    for (const row of rows) expect(new Set(row).size).toBe(1);
  });

  test('on a phone the clusters are one column of cards with no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    const cards = page.locator(CARD);
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    expect(Math.abs(first!.x - second!.x)).toBeLessThan(1);
    expect(second!.y).toBeGreaterThan(first!.y);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });
});
