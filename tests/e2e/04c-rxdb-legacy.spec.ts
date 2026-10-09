/**
 * A browser that still holds RxDB v16 IndexedDB data must open the live match
 * on RxDB 17: legacy databases are deleted, a fresh local database is synced
 * from Supabase, and no RxDB error is thrown.
 * Needs playwright/.auth/rxdb-legacy-state.json from 04b-rxdb-capture.spec.ts.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { takeOverScoringIfAsked } from '../helpers/sync';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const LEGACY_STATE = path.join(__dirname, '../../playwright/.auth/rxdb-legacy-state.json');
const CURRENT_STATE = path.join(__dirname, '../../playwright/.auth/user.json');

test('live match opens on a device with RxDB v16 data', async ({ browser }) => {
  test.skip(!fs.existsSync(LEGACY_STATE), 'No legacy capture — run 04b with CAPTURE_LEGACY_DB=1 on RxDB 16');

  // Fresh session cookies from this run's auth setup + the captured v16 IndexedDB.
  const current = JSON.parse(fs.readFileSync(CURRENT_STATE, 'utf-8'));
  const legacy = JSON.parse(fs.readFileSync(LEGACY_STATE, 'utf-8'));
  const context = await browser.newContext({
    storageState: { cookies: current.cookies, origins: legacy.origins },
  });
  const page = await context.newPage();

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  // Read the restored databases from a non-app document on the same origin:
  // any app page would run getDatabase() and delete the legacy databases first.
  await page.goto('/manifest.webmanifest');
  const before = await page.evaluate(async () =>
    (await indexedDB.databases()).map((d) => d.name ?? '')
  );
  expect(
    before.some((n) => n.includes('volleystats_db') && !n.includes('volleystats_db_v17')),
    'captured state should contain v16 databases'
  ).toBe(true);

  // Full URL incl. ?team=: the live page redirects to /matches without it.
  const { offlineMatchLiveUrl } = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  await page.goto(offlineMatchLiveUrl);
  await takeOverScoringIfAsked(page);
  await expect(
    page.getByTestId('point-btn-managed-point').first()
      .or(page.getByTestId('set-setup').first())
      .or(page.getByText('Match MVP Analysis').first())
      .or(page.getByRole('button', { name: 'Match Statistics' }).first())
  ).toBeVisible({ timeout: 30_000 });

  const after = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name ?? ''));
  expect(after.filter((n) => n.includes('volleystats_db') && !n.includes('volleystats_db_v17'))).toEqual([]);
  expect(pageErrors.filter((m) => /RxError|RxDB/i.test(m))).toEqual([]);

  await context.close();
});
