import { test, expect } from '@playwright/test';

test('home -> browse via header', async ({ page }) => {
  await page.goto('/index.html');
  // Wait for Law of the Day section to load (it's an h3, not in banner)
  await expect(page.getByText("Murphy's Law of the Day")).toBeVisible({ timeout: 10000 });

  await page.getByRole('navigation').getByRole('button', { name: 'Browse All Laws' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Browse All Laws' })).toBeVisible();
  await expect(page).toHaveURL(/#\/browse/);
});

test('search in header routes to browse and shows query', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('textbox', { name: 'Search' }).fill('gravity');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/browse/);
  await expect(page.getByText('Search query: gravity')).toBeVisible({ timeout: 10000 });
});

test('home law click -> law detail and back via button', async ({ page }) => {
  await page.goto('/index.html');
  // Wait for law content to load from API, then click first law block
  const firstLaw = page.locator('[data-law-id]').first();
  await firstLaw.waitFor({ state: 'visible', timeout: 10000 });
  await firstLaw.click();
  await expect(page).toHaveURL(/#\/law:/);
  await expect(page.getByRole('button', { name: 'Upvote' })).toBeVisible();

  // Navigate to browse from law detail
  await page.getByRole('main').getByRole('button', { name: 'Browse All Laws' }).click();
  await expect(page).toHaveURL(/#\/browse/);
});
