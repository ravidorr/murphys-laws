import { createRequire } from 'node:module';
import type * as Playwright from '@playwright/test';

const require = createRequire(import.meta.url);
const { expect, test }: typeof Playwright = require('@playwright/test');

const parent = {
  id: 901,
  title: 'The Start-Stop Synchronicity',
  text: 'A red traffic light will turn green one second after the engine switches itself off.',
  upvotes: 3,
  downvotes: 0,
  category_slug: 'cars',
  category_name: 'Cars',
  attributions: [],
  corollaries: [
    { id: 902, title: 'The Ignition Corollary', text: 'The restart always feels twice as long with a horn behind you.', upvotes: 4, downvotes: 1 },
    { id: 903, title: 'Corollary', text: 'The light stays green just long enough to miss it.', upvotes: 0, downvotes: 0 }
  ],
  corollary_of: null
};

const child = {
  id: 902,
  title: 'The Ignition Corollary',
  text: 'The restart always feels twice as long with a horn behind you.',
  upvotes: 4,
  downvotes: 1,
  category_slug: 'cars',
  category_name: 'Cars',
  attributions: [],
  corollaries: [],
  corollary_of: { id: 901, title: parent.title, text: parent.text }
};

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/v1\/laws\/(901|902)(\?.*)?$/, async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    await route.fulfill({ json: id === '901' ? parent : child });
  });
  await page.route(/\/api\/v1\/laws\/\d+\/related/, (route) => route.fulfill({ json: { data: [], law_id: 0 } }));
});

test('a law page lists its corollaries above related laws and opens one', async ({ page }) => {
  await page.goto('/law/901');

  const section = page.locator('section.corollary-list');
  await expect(section.getByRole('heading', { level: 2, name: 'Corollaries' })).toBeVisible();
  await expect(section.getByText('2 consequences of this law')).toBeVisible();
  await expect(section.getByRole('link', { name: 'The Ignition Corollary' })).toBeVisible();
  // "Corollary" alone says nothing, so the card is named from its text
  await expect(section.getByRole('link', { name: 'The light stays green just long enough to miss it' })).toBeVisible();

  await section.getByRole('link', { name: 'The Ignition Corollary' }).click();
  await expect(page).toHaveURL(/\/law\/902$/);
  const banner = page.getByRole('link', { name: /Corollary of The Start-Stop Synchronicity/ });
  await expect(banner).toBeVisible();
  await expect(page.locator('section.corollary-list')).toHaveCount(0);
  await expect(page.locator('#law-breadcrumb').getByRole('link', { name: 'The Start-Stop Synchronicity' })).toBeVisible();

  await banner.click();
  await expect(page).toHaveURL(/\/law\/901$/);
  await expect(page.locator('section.corollary-list')).toBeVisible();
});

test('a corollary vote counts on the card and leaves the parent alone', async ({ page }) => {
  await page.route(/\/api\/v1\/laws\/902\/vote/, (route) => route.fulfill({ json: { upvotes: 5, downvotes: 1 } }));
  await page.goto('/law/901');

  await page.getByRole('button', { name: 'Upvote corollary: The Ignition Corollary' }).click();
  await expect(page.locator('.corollary-card[data-law-id="902"] [data-vote="up"] .count-num')).toHaveText('5');
  await expect(page.locator('[data-law-card-root] [data-upvote-count]')).toHaveText('3');
});

test('the corollaries list fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/law/901');

  await expect(page.locator('section.corollary-list')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
