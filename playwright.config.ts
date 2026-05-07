import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Creator Outreach.
 *
 * Test target precedence:
 *   1. PLAYWRIGHT_BASE_URL env var (used for testing prod / preview)
 *   2. http://localhost:3000 (default — auto-starts `next dev`)
 *
 * Run modes:
 *   npm test          → headless, all tests, single browser (chromium)
 *   npm run test:ui   → interactive UI mode
 *   npm run test:headed → headed (visible browser) — useful for debug
 *
 * Auth-required tests are tagged @auth and skipped on every push for
 * now (v1 covers public-only flows: landing render, auth forms,
 * theme toggle). When we add a Supabase test user, drop the skip.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Auto-start the dev server only if we're testing localhost. If
  // PLAYWRIGHT_BASE_URL is set we assume the target is already up
  // (prod, preview, etc.).
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
