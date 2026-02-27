import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

// WCAG AA accessibility tests using axe-core
// These tests verify automated accessibility compliance across key pages

test.describe('Accessibility - WCAG AA Compliance', () => {
  test('home page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText("Murphy's Law of the Day")).toBeVisible({ timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Filter out minor issues and focus on serious/critical
    const seriousViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousViolations).toEqual([]);
  });

  test('browse page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.getByRole('heading', { level: 1, name: /Browse.*All.*Murphy's Laws/i })).toBeVisible({ timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const seriousViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousViolations).toEqual([]);
  });

  test('calculator page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/calculator/sods-law');
    await expect(page.getByRole('heading', { level: 1, name: "Sod's Law Calculator" })).toBeVisible({ timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const seriousViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousViolations).toEqual([]);
  });

  test('skip link is visible on focus', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.locator('.skip-link');
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveText('Skip to main content');
  });

  test('keyboard navigation works for law cards', async ({ page }) => {
    await page.goto('/browse');
    await expect(page.locator('.law-card-mini').first()).toBeVisible({ timeout: 10000 });

    const firstLawCard = page.locator('.law-card-mini').first();
    await firstLawCard.focus();
    await expect(firstLawCard).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/law\/\d+/);
  });

  test('focus moves to main content on route change', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText("Murphy's Law of the Day")).toBeVisible({ timeout: 10000 });

    await page.getByRole('link', { name: 'Browse All Laws' }).first().click();
    await expect(page).toHaveURL(/\/browse/);

    const mainContent = page.locator('main');
    await expect(mainContent).toHaveAttribute('tabindex', '-1');
  });
});
