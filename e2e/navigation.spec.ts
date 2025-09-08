import { test, expect } from '@playwright/test';

test('home → browse via header', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.getByRole('banner').getByText("Murphy's Law Archive", { exact: true })).toBeVisible();

  await page.getByRole('navigation').getByRole('button', { name: 'Browse All Laws' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Browse All Laws' })).toBeVisible();
  await expect(page).toHaveURL(/#\/browse/);
});

test('search in header routes to browse and shows query', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('textbox', { name: 'Search' }).fill('gravity');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/browse/);
  await expect(page.getByText('Search query: gravity')).toBeVisible();
});

test('home law click → law detail and back via button', async ({ page }) => {
  await page.goto('/index.html');
  // Click first law block (uses data-law-id)
  const firstLaw = page.locator('[data-law-id]').first();
  await firstLaw.click();
  await expect(page).toHaveURL(/#\/law:/);
  await expect(page.getByRole('button', { name: 'Upvote' })).toBeVisible();

  // Navigate to browse from law detail
  await page.getByRole('main').getByRole('button', { name: 'Browse All Laws' }).click();
  await expect(page).toHaveURL(/#\/browse/);
});
