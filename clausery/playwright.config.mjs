import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:4173/clausery/', trace: 'retain-on-failure', acceptDownloads: true },
  webServer: { command: 'node tools/serve.mjs 4173', url: 'http://127.0.0.1:4173/clausery/', reuseExistingServer: !process.env.CI, timeout: 20000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
