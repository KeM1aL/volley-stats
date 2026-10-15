/**
 * Captures the browser's IndexedDB (RxDB v16 databases) after opening a live
 * match, for 04c-rxdb-legacy.spec.ts. Runs only with CAPTURE_LEGACY_DB=1.
 * Output (git-ignored): playwright/.auth/rxdb-legacy-state.json
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { readFixture } from '../helpers/fixture';

const OUT = path.join(__dirname, '../../playwright/.auth/rxdb-legacy-state.json');

test('capture legacy RxDB IndexedDB state', async ({ page }) => {
  test.skip(!process.env.CAPTURE_LEGACY_DB, 'Set CAPTURE_LEGACY_DB=1 on RxDB 16 to capture');

  // Full URL incl. ?team=: the live page redirects to /matches without it.
  const { offlineMatchId, teamId } = readFixture();
  expect(offlineMatchId, 'run 04-live-offline.spec.ts first').toBeTruthy();

  await page.goto(`/matches/${offlineMatchId}/live?team=${teamId}`);
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
