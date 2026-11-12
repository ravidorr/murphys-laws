import { createRequire } from 'node:module';
import type * as Playwright from '@playwright/test';

const require = createRequire(import.meta.url);
const { expect, test }: typeof Playwright = require('@playwright/test');

test('law card links are underlined at rest so touch visitors can tell they open', async ({ page }) => {
  await page.goto('/browse');
  const link = page.locator('.law-card-link').first();
  await expect(link).toBeVisible({ timeout: 10000 });

  // No hover or focus: the cue must already be there
  await page.mouse.move(0, 0);
  await expect(link).not.toBeFocused();
  await expect(link).toHaveCSS('text-decoration-line', 'underline');
  await expect(link).toHaveCSS('text-decoration-thickness', '1px');
});
