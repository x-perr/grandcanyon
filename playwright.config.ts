import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run serially to avoid overwhelming the server
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1, // Single worker due to large dataset causing slow loads
  reporter: [['html'], ['list']],
  timeout: 120000, // 2 minutes per test
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 30000, // 30 seconds for actions
    navigationTimeout: 90000, // 90 seconds for navigation (large dataset)
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
