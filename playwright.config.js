import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 120000,
  use: { baseURL: 'http://127.0.0.1:5178', viewport: { width: 1440, height: 1100 }, launchOptions: { args: [] } },
  webServer: { command: 'npm run dev -- --port 5178 --strictPort', url: 'http://127.0.0.1:5178', reuseExistingServer: false },
});

