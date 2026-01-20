import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// WCAG AA accessibility tests using axe-core
// These tests verify automated accessibility compliance across key pages

test.describe('Accessibility - WCAG AA Compliance', () => {
  test('home page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/index.html');
    // Wait for Law of the Day section to load
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
    await page.goto('/index.html#/browse');
    // Wait for content to load
    await expect(page.getByRole('heading', { level: 2, name: 'Browse All Laws' })).toBeVisible({ timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const seriousViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousViolations).toEqual([]);
  });

  test('calculator page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/index.html#/calculator');
    // Wait for calculator to load
    await expect(page.getByRole('heading', { name: /Sod's Law/i })).toBeVisible({ timeout: 10000 });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const seriousViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(seriousViolations).toEqual([]);
  });

  test('skip link is visible on focus', async ({ page }) => {
    await page.goto('/index.html');
    
    // Tab to skip link
    await page.keyboard.press('Tab');
    
    // Skip link should be visible when focused
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveText('Skip to main content');
  });

  test('keyboard navigation works for law cards', async ({ page }) => {
    await page.goto('/index.html#/browse');
    // Wait for laws to load
    await expect(page.locator('.law-card-mini').first()).toBeVisible({ timeout: 10000 });

    // Tab to first law card
    const firstLawCard = page.locator('.law-card-mini').first();
    await firstLawCard.focus();
    
    // Law card should be focusable
    await expect(firstLawCard).toBeFocused();
    
    // Pressing Enter should navigate to law detail
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/law:/);
  });

  test('focus moves to main content on route change', async ({ page }) => {
    await page.goto('/index.html');
    // Wait for initial content
    await expect(page.getByText("Murphy's Law of the Day")).toBeVisible({ timeout: 10000 });

    // Navigate to browse page
    await page.getByRole('navigation').getByRole('button', { name: 'Browse All Laws' }).click();
    await expect(page).toHaveURL(/#\/browse/);

    // Main content should receive focus after navigation
    const mainContent = page.locator('main');
    await expect(mainContent).toHaveAttribute('tabindex', '-1');
  });
});
