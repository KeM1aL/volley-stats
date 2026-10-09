/**
 * Signing out with changes not uploaded yet asks first. Cancelling keeps the session.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { goOffline, goOnline, waitForServiceWorker } from '../helpers/network';
import { acceptBeforeUnload, waitForAllSaved } from '../helpers/sync';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

test('warns before signing out with unsent changes', async ({ page }) => {
  test.setTimeout(5 * 60_000);
  acceptBeforeUnload(page);
  const { teamName, playerNames } = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  await createAndStartMatch(page, { teamName, playerNames });
  await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
  const pointButton = page.getByTestId('point-btn-managed-point').first();
  await pointButton.waitFor({ state: 'visible', timeout: 10_000 });
  await waitForServiceWorker(page);

  await goOffline(page);
  await pointButton.click();
  await expect(page.getByTestId('sync-badge').first()).toHaveAttribute('data-state', 'waiting', { timeout: 10_000 });

  await page.getByRole('button', { name: /sign out/i }).click();
  const warning = page.getByTestId('sign-out-warning');
  await expect(warning).toBeVisible();
  await warning.getByRole('button', { name: /cancel/i }).click();
  await expect(warning).toBeHidden();
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();

  await goOnline(page);
  await waitForAllSaved(page);
});
