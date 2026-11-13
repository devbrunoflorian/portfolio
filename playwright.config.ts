import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4176', viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, trace: 'retain-on-failure' },
  webServer: { command: 'npx astro preview --host 127.0.0.1 --port 4176 --ignore-lock', url: 'http://127.0.0.1:4176/en/labs/', reuseExistingServer: !process.env.CI },
});
