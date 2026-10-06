/**
 * Captures the browser's IndexedDB (RxDB v16 databases) after opening a live
 * match, for 04c-rxdb-legacy.spec.ts. Runs only with CAPTURE_LEGACY_DB=1.
 * Output (git-ignored): playwright/.auth/rxdb-legacy-state.json
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const OUT = path.join(__dirname, '../../playwright/.auth/rxdb-legacy-state.json');

test('capture legacy RxDB IndexedDB state', async ({ page }) => {
  test.skip(!process.env.CAPTURE_LEGACY_DB, 'Set CAPTURE_LEGACY_DB=1 on RxDB 16 to capture');

  // Full URL incl. ?team=: the live page redirects to /matches without it.
  const { offlineMatchLiveUrl } = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  expect(offlineMatchLiveUrl, 'run 04-live-offline.spec.ts first').toBeTruthy();

  await page.goto(offlineMatchLiveUrl);
  await expect(
    page.getByTestId('point-btn-managed-point').first()
      .or(page.getByTestId('set-setup').first())
      .or(page.getByText('Match MVP Analysis').first())
      .or(page.getByRole('button', { name: 'Match Statistics' }).first())
  ).toBeVisible({ timeout: 30_000 });

  const names = await page.evaluate(async () =>
    (await indexedDB.databases()).map((d) => d.name ?? '')
  );
  expect(names.some((n) => n.includes('volleystats_db'))).toBe(true);

  await page.context().storageState({ path: OUT, indexedDB: true });
});
