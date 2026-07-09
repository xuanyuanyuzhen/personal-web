import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

type LocalBrowserChannel = 'chrome' | 'msedge';

const localBrowserChannel = process.env.CI ? undefined : findLocalBrowserChannel();

export default defineConfig({
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: localBrowserChannel,
      },
    },
  ],
  reporter: [['list']],
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : [
    {
      command: 'pnpm --dir apps/web exec vite --host 0.0.0.0 --port 5173',
      gracefulShutdown: { signal: 'SIGINT', timeout: 1000 },
      reuseExistingServer: true,
      timeout: 120000,
      url: 'http://localhost:5173',
    },
    {
      command: 'pnpm --dir apps/admin exec vite --host 0.0.0.0 --port 5174',
      gracefulShutdown: { signal: 'SIGINT', timeout: 1000 },
      reuseExistingServer: true,
      timeout: 120000,
      url: 'http://localhost:5174',
    },
  ],
});

function findLocalBrowserChannel(): LocalBrowserChannel | undefined {
  if (process.env.E2E_BROWSER_CHANNEL === 'chrome' || process.env.E2E_BROWSER_CHANNEL === 'msedge') {
    return process.env.E2E_BROWSER_CHANNEL;
  }

  if (process.platform === 'win32') {
    if (existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
      return 'chrome';
    }

    if (existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')) {
      return 'msedge';
    }
  }

  if (process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app')) {
    return 'chrome';
  }

  if (process.platform === 'linux') {
    if (existsSync('/usr/bin/google-chrome') || existsSync('/usr/bin/google-chrome-stable')) {
      return 'chrome';
    }

    if (existsSync('/usr/bin/microsoft-edge') || existsSync('/usr/bin/microsoft-edge-stable')) {
      return 'msedge';
    }
  }

  return undefined;
}
