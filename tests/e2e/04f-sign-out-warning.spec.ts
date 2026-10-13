/**
 * Signing out with changes not uploaded yet asks first. On the live page that is the leave dialog, which shows the unsent count; staying keeps the session.
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

  // On the live page, leaving and the unsent changes are covered by one dialog
  await page.getByRole('button', { name: /sign out/i }).click();
  const leaveDialog = page.getByTestId('leave-live-dialog');
  await expect(leaveDialog).toContainText("2 changes haven't been uploaded yet");
  await expect(page.getByTestId('sign-out-warning')).toHaveCount(0);
  await leaveDialog.getByRole('button', { name: 'Stay' }).click();
  await expect(leaveDialog).toBeHidden();
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();

  await goOnline(page);
  await waitForAllSaved(page);
});
