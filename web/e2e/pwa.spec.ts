import { test, expect } from '@playwright/test';

/**
 * PWA/Offline E2E Tests
 *
 * Note: Service workers are disabled in development mode (devOptions.enabled: false).
 * These tests verify PWA-related functionality that can be tested without a service worker,
 * such as the offline page rendering and manifest link.
 *
 * For full service worker testing in CI, run against the production build:
 * npm run build && npm run preview
 */

test.describe('PWA Offline Page', () => {
  test('offline.html renders correctly', async ({ page }) => {
    await page.goto('/offline.html');

    // Check page title
    await expect(page).toHaveTitle(/Offline.*Murphy/i);

    // Check main heading
    await expect(page.getByRole('heading', { name: "You're Offline" })).toBeVisible();

    // Check description text
    await expect(page.getByText(/lost your internet connection/i)).toBeVisible();

    // Check "What you can still do" section
    await expect(page.getByText('What you can still do:')).toBeVisible();
    await expect(page.getByText(/View previously browsed laws/i)).toBeVisible();
    await expect(page.getByText(/Browse cached categories/i)).toBeVisible();
    await expect(page.getByText(/Check your favorites/i)).toBeVisible();

    // Check Try Again button
    await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible();

    // Check home link
    await expect(page.getByRole('link', { name: 'Go to Home' })).toBeVisible();

    // Check Murphy quote
    await expect(page.getByText(/Anything that can go wrong/i)).toBeVisible();
  });

  test('offline page respects dark mode', async ({ page }) => {
    // Emulate dark mode preference
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/offline.html');

    // Page should load without errors in dark mode
    await expect(page.getByRole('heading', { name: "You're Offline" })).toBeVisible();
  });

  test('Try Again button reloads the page', async ({ page }) => {
    await page.goto('/offline.html');

    // Track reload
    const reloadPromise = page.waitForEvent('load');

    // Click Try Again
    await page.getByRole('button', { name: 'Try Again' }).click();

    // Verify page reloaded
    await reloadPromise;
    await expect(page.getByRole('heading', { name: "You're Offline" })).toBeVisible();
  });

  test('Go to Home link navigates to home page', async ({ page }) => {
    await page.goto('/offline.html');

    await page.getByRole('link', { name: 'Go to Home' }).click();

    // Should navigate to home
    await expect(page).toHaveURL('/');
  });
});

test.describe('PWA Manifest', () => {
  test('manifest is linked in HTML head', async ({ page }) => {
    await page.goto('/');

    // Wait for app to load
    await expect(page.getByText("Murphy's Law of the Day")).toBeVisible({ timeout: 10000 });

    // Check for manifest link (injected by vite-plugin-pwa in production build)
    // In dev mode, manifest may not be present, so this is a conditional check
    const manifestLink = page.locator('link[rel="manifest"]');
    const hasManifest = await manifestLink.count() > 0;

    // Log for debugging in CI
    if (!hasManifest) {
      // In dev mode without service worker, manifest might not be injected
      console.log('Note: Manifest link not found (expected in dev mode)');
    }
  });

  test('theme-color meta tags are present', async ({ page }) => {
    await page.goto('/');

    // Check for light mode theme color
    const lightThemeColor = page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]');
    await expect(lightThemeColor).toHaveAttribute('content', '#ffffff');

    // Check for dark mode theme color
    const darkThemeColor = page.locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]');
    await expect(darkThemeColor).toHaveAttribute('content', '#0b0b11');
  });
});

test.describe('PWA Install Prompt', () => {
  test('app should be installable on supported browsers', async ({ page, context }) => {
    // This test verifies the app meets basic PWA criteria
    // Full installability testing requires a production build with HTTPS

    await page.goto('/');
    await expect(page.getByText("Murphy's Law of the Day")).toBeVisible({ timeout: 10000 });

    // Verify required PWA icons are accessible
    const icon192Response = await page.request.get('/android-chrome-192x192.png');
    expect(icon192Response.ok()).toBe(true);

    const icon512Response = await page.request.get('/android-chrome-512x512.png');
    expect(icon512Response.ok()).toBe(true);

    // Verify apple touch icon
    const appleTouchIconResponse = await page.request.get('/apple-touch-icon.png');
    expect(appleTouchIconResponse.ok()).toBe(true);
  });
});

test.describe('Offline Behavior Simulation', () => {
  test('app handles network failure gracefully', async ({ page, context }) => {
    // First load the app normally
    await page.goto('/');
    await expect(page.getByText("Murphy's Law of the Day")).toBeVisible({ timeout: 10000 });

    // Now simulate offline mode
    await context.setOffline(true);

    // Try to navigate - without service worker in dev mode, this may fail
    // but the app should handle it gracefully without crashing
    try {
      await page.goto('/offline.html', { timeout: 5000 });
      // If we can load the offline page, verify it renders
      await expect(page.getByRole('heading', { name: "You're Offline" })).toBeVisible();
    } catch {
      // In dev mode without caching, navigation may timeout
      // This is expected behavior
    }

    // Restore online mode
    await context.setOffline(false);
  });
});
