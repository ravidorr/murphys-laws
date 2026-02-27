import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test');

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
