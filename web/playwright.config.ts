import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Start both API (8787) and preview (5175) for E2E
  webServer: [
    {
      command: 'npm start',
      url: 'http://127.0.0.1:8787/api/health',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
      cwd: '../backend',
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5175',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
