import { defineConfig } from '@playwright/test';
const port = Number(process.env.PLAYWRIGHT_PORT || 5220);

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1100 },
    launchOptions: { args: [] },
  },
  webServer: {
    command: `npx vite --port ${port} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
