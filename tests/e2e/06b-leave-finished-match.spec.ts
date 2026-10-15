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
  // This browser context has an empty local database: the live page first pulls the match from the server, and
  // when that fails (a slow or failed first pull) it leaves for /matches with a load-failure toast. That is
  // not what is under test, so open it once more, with the match tracked, before judging.
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`/matches/${completedMatchId}/live?team=${teamId}`);
    await expect
      .poll(async () => ((await statsButton.isVisible()) ? 'live' : /\/matches$/.test(page.url()) ? 'matches' : 'loading'), {
        timeout: 30_000,
      })
      .not.toBe('loading');
    if (await statsButton.isVisible()) break;
  }
  await expect(statsButton).toBeVisible();
  await page.getByRole('link', { name: 'Teams', exact: true }).first().click();
  await page.waitForURL(/\/teams$/, { timeout: 15_000 });
  await expect(page.getByTestId('leave-live-dialog')).toBeHidden();
});
