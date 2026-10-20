import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 45_000,
  reporter: 'line',
  outputDir: '.local/playwright',
  use: {
    baseURL: 'http://127.0.0.1:3131',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/preview-local.mjs',
    url: 'http://127.0.0.1:3131/admin',
    reuseExistingServer: true,
  },
});
