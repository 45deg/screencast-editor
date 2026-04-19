import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4174';
const disableWebServer = process.env.PLAYWRIGHT_DISABLE_WEBSERVER === '1';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts/,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: disableWebServer
    ? undefined
    : {
        command: 'pnpm exec vite --host 127.0.0.1 --port 4174 --mode test',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
