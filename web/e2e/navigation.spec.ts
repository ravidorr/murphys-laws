import { createRequire } from 'node:module';
import type * as Playwright from '@playwright/test';

const require = createRequire(import.meta.url);
const { expect, test }: typeof Playwright = require('@playwright/test');

test('home -> browse via header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText("Murphy's Law of the Day")).toBeVisible({ timeout: 10000 });

  await page.getByRole('link', { name: 'Browse All Laws' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: /Browse.*All.*Murphy's Laws/i })).toBeVisible();
  await expect(page).toHaveURL(/\/browse/);
});

test('search in header routes to browse and shows query', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Search' }).fill('gravity');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/browse/);
  await expect(page.getByText(/Search results for:/)).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.search-info').getByText('gravity')).toBeVisible();
});

test('header search scrolls to the results with the title focused below the header', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Search' }).fill('gravity');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/browse\?q=gravity/);

  const title = page.locator('#browse-results-title');
  await expect(title).toHaveText('Search Results');
  await expect(title).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const headerBottom = await page.locator('header.sticky').evaluate((header) => header.getBoundingClientRect().bottom);
  const cardTop = await page.locator('#browse-all-laws-card').evaluate((card) => card.getBoundingClientRect().top);
  expect(cardTop).toBeGreaterThanOrEqual(headerBottom - 1);
});

test('home law click -> law detail and back via button', async ({ page }) => {
  await page.goto('/');
  const firstLaw = page.locator('[data-law-id]').first();
  await firstLaw.waitFor({ state: 'visible', timeout: 10000 });
  await firstLaw.click();
  await expect(page).toHaveURL(/\/law\/\d+/);
  await expect(page.getByRole('button', { name: 'Upvote this law' }).first()).toBeVisible();

  await page.getByRole('main').getByRole('button', { name: 'Browse All Laws' }).click();
  await expect(page).toHaveURL(/\/browse/);
});

test('back to top button appears after scrolling and returns to the top', async ({ page }) => {
  await page.goto('/browse');
  await page.addStyleTag({ content: '.back-to-top-e2e-tall { min-height: 4000px; }' });
  const button = page.getByRole('button', { name: 'Back to top' });
  await expect(button).toBeHidden();

  await page.evaluate(() => {
    document.body.classList.add('back-to-top-e2e-tall');
    window.scrollTo(0, 1500);
  });
  await expect(button).toBeVisible();

  await button.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(button).toBeHidden();
});
