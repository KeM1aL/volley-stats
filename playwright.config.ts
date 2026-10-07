import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Load E2E test credentials — try .env.test first, then .env.test.local (Next.js convention),
// then fall back to .env.local / .env.
config({ path: '.env.test', quiet: true });
config({ path: '.env.test.local', quiet: true });
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

export default defineConfig({
  testDir: './tests/e2e',
  // Deletes the teams, matches and championships the specs created (set E2E_KEEP_DATA=1 to keep them).
  globalTeardown: './tests/global-teardown.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // Increase global timeout: RxDB init ~20s + match play can take minutes
  timeout: 5 * 60_000,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Portrait tablet viewport — forces portrait StatTracker layout and desktop sidebar
    viewport: { width: 768, height: 1024 },
    headless: !!process.env.CI,
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'tests',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
        viewport: { width: 768, height: 1024 },
        headless: !!process.env.CI,
      },
      dependencies: ['setup'],
    },
  ],
});
