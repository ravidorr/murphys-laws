import { createRequire } from 'node:module';
import type * as Playwright from '@playwright/test';

const require = createRequire(import.meta.url);
const { expect, test }: typeof Playwright = require('@playwright/test');

test('law card links are not underlined at rest, and hover and keyboard focus underline them', async ({ page }) => {
  await page.goto('/browse');
  const link = page.locator('.law-card-link').first();
  await expect(link).toBeVisible({ timeout: 10000 });

  await page.mouse.move(0, 0);
  await expect(link).not.toBeFocused();
  await expect(link).toHaveCSS('text-decoration-line', 'none');

  await link.hover();
  await expect(link).toHaveCSS('text-decoration-line', 'underline');

  await page.mouse.move(0, 0);
  await link.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS('text-decoration-line', 'underline');
});
