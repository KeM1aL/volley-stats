import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Load E2E test credentials — try .env.test first, then .env.test.local (Next.js convention),
// then fall back to .env.local / .env.
config({ path: '.env.test', quiet: true });
config({ path: '.env.test.local', quiet: true });
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const chrome = {
  ...devices['Desktop Chrome'],
  storageState: 'playwright/.auth/user.json',
  // Portrait tablet viewport — forces the portrait StatTracker layout and the desktop sidebar
  viewport: { width: 768, height: 1024 },
  headless: !!process.env.CI,
};
const TOOLS = ['**/04b-rxdb-capture.spec.ts', '**/04c-rxdb-legacy.spec.ts', '**/06z-screenshots.spec.ts'];
const LIVE = ['**/04-live-offline.spec.ts', '**/04d-*.spec.ts', '**/04e-*.spec.ts', '**/04f-*.spec.ts', '**/04g-*.spec.ts', '**/04h-*.spec.ts'];
const FINISHED = ['**/02-matches.spec.ts'];
const STATS = ['**/06-match-stats.spec.ts', '**/06b-*.spec.ts'];

export default defineConfig({
  testDir: './tests/e2e',
  // Deletes the teams, matches and championships the specs created (set E2E_KEEP_DATA=1 to keep them).
  globalTeardown: './tests/global-teardown.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Two workers by default (full suite 145 s -> 78 s, green 3 times); E2E_WORKERS=1 runs the specs one at a time.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 2,
  // Most tests finish in under 30 s; the full match and the two-device test set their own limit.
  timeout: 90_000,
  // Web-only specs are tagged @web and skipped for the static export.
  grepInvert: process.env.E2E_TARGET === 'mobile' ? /@web/ : undefined,
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
    { name: 'setup', testMatch: '**/auth.setup.ts' },
    { name: 'seed', testMatch: '**/seed.setup.ts', dependencies: ['setup'] },
    { name: 'core', use: chrome, dependencies: ['seed'], testIgnore: [...TOOLS, ...LIVE, ...FINISHED, ...STATS, '**/*.setup.ts'] },
    { name: 'live', use: chrome, dependencies: ['seed'], testMatch: LIVE },
    { name: 'finished-match', use: chrome, dependencies: ['seed'], testMatch: FINISHED },
    { name: 'stats', use: chrome, dependencies: ['finished-match'], testMatch: STATS },
    ...(process.env.E2E_TOOLS ? [{ name: 'tools', use: chrome, dependencies: ['finished-match'], testMatch: TOOLS }] : []),
  ],
});
