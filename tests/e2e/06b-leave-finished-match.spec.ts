/**
 * Leaving a finished match through the app does not ask for confirmation (04g covers the live match).
 * Needs the match 02-matches finished, so it runs in the stats project.
 */
import { test, expect } from '@playwright/test';
import { readFixture } from '../helpers/fixture';

test('leaves a finished match without asking', async ({ page }) => {
  const { completedMatchId, teamId } = readFixture();
  expect(completedMatchId, 'the finished-match project (02-matches) writes completedMatchId').toBeTruthy();
  const statsButton = page.getByRole('button', { name: 'Match Statistics' });
  // This browser context has an empty local database: the live page first pulls the match from the server.
  // When that first pull is slow or fails, the page leaves for /matches with a load-failure toast; that is
  // not what is under test, so open the match again (tracked by then) until the summary shows.
  await expect(async () => {
    await page.goto(`/matches/${completedMatchId}/live?team=${teamId}`);
    await expect(statsButton).toBeVisible({ timeout: 15_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole('link', { name: 'Teams', exact: true }).first().click();
  await page.waitForURL(/\/teams$/, { timeout: 15_000 });
  await expect(page.getByTestId('leave-live-dialog')).toBeHidden();
});
