/**
 * Leaving a live match through the app asks first. Offline, a screen that can't load shows the
 * app's offline page instead of the browser's error page (Task 8 adds those steps).
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { goOffline, goOnline, waitForServiceWorker } from '../helpers/network';
import { acceptBeforeUnload, readLiveScore, waitForAllSaved } from '../helpers/sync';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const loadFixture = () => JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
const headerLink = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).first();

test('asks before leaving a live match', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  acceptBeforeUnload(page);
  // Our dialog is the only prompt after Leave: the browser's own "changes may not be saved" must not follow.
  // Counts the dialogs Playwright sees, and the page's beforeunload handlers asking for one (Chrome doesn't
  // show it for a navigation the page starts itself, so the dialog count alone would miss a regression).
  let beforeUnloadDialogs = 0;
  page.on('dialog', (d) => {
    if (d.type() === 'beforeunload') beforeUnloadDialogs++;
  });
  const { teamName, playerNames } = loadFixture();
  await createAndStartMatch(page, { teamName, playerNames });
  await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
  const pointButton = page.getByTestId('point-btn-managed-point').first();
  await pointButton.waitFor({ state: 'visible', timeout: 10_000 });
  await waitForServiceWorker(page);
  const liveUrl = page.url();
  const dialog = page.getByTestId('leave-live-dialog');

  // Stay: still on the match, and scoring still works
  await headerLink(page, 'Teams').click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Stay' }).click();
  await expect(dialog).toBeHidden();
  expect(page.url()).toBe(liveUrl);
  const before = await readLiveScore(page);
  await pointButton.click();
  await expect
    .poll(async () => {
      const now = await readLiveScore(page);
      return now.home + now.away;
    })
    .toBe(before.home + before.away + 1);

  // Leave: the matches page; afterwards other screens navigate without asking
  await headerLink(page, 'Matches').click();
  await dialog.getByRole('button', { name: 'Leave' }).click();
  await page.waitForURL(/\/matches$/, { timeout: 15_000 });
  await headerLink(page, 'Teams').click();
  await page.waitForURL(/\/teams$/, { timeout: 15_000 });
  await expect(dialog).toBeHidden();

  // Offline with an unsent point (a score_points row and the set's score update): the dialog says so
  await page.goto(liveUrl);
  await pointButton.waitFor({ state: 'visible', timeout: 30_000 });
  await goOffline(page);
  await pointButton.click();
  await headerLink(page, 'Teams').click();
  await expect(dialog).toContainText("2 changes haven't been uploaded yet");
  await dialog.getByRole('button', { name: 'Stay' }).click();
  await expect(dialog).toBeHidden();

  // The dying page can't report to Playwright: it leaves a mark in localStorage (sessionStorage doesn't
  // survive this navigation)
  await page.evaluate(() => {
    localStorage.removeItem('e2e:beforeunload-prevented');
    const preventDefault = Event.prototype.preventDefault;
    Event.prototype.preventDefault = function (this: Event) {
      if (this.type === 'beforeunload') localStorage.setItem('e2e:beforeunload-prevented', '1');
      return preventDefault.call(this);
    };
  });
  beforeUnloadDialogs = 0;
  // Leave anyway, for a screen this session never opened (so the worker has no copy of it): the
  // app's offline page, not the browser's error page
  await headerLink(page, 'Championships').click();
  await dialog.getByRole('button', { name: 'Leave' }).click();
  await expect(page.getByTestId('offline-page')).toBeVisible({ timeout: 15_000 });
  expect(page.url()).not.toContain('chrome-error');
  expect(await page.evaluate(() => localStorage.getItem('e2e:beforeunload-prevented'))).toBeNull();
  await page.evaluate(() => localStorage.removeItem('e2e:beforeunload-prevented'));
  expect(beforeUnloadDialogs).toBe(0);

  // Back to the live match, served from the cache
  await page.getByRole('button', { name: 'Back to the live match' }).click();
  await page.waitForURL((url) => url.href === liveUrl, { timeout: 15_000 });
  await pointButton.waitFor({ state: 'visible', timeout: 30_000 });

  // Without a saved live match the offline page goes back in history (never to /matches)
  await page.evaluate(() => sessionStorage.removeItem('volleystats:last-live-match'));
  await page.goto('/championships');
  await expect(page.getByTestId('offline-page')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to the live match' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Go back' }).click();
  await page.waitForURL((url) => url.href === liveUrl, { timeout: 15_000 });
  await pointButton.waitFor({ state: 'visible', timeout: 30_000 });

  await goOnline(page);
  await waitForAllSaved(page);
});

test('leaves a finished match without asking', async ({ page }) => {
  const { completedMatchStatsUrl } = loadFixture() as { completedMatchStatsUrl?: string };
  test.skip(!completedMatchStatsUrl, 'run 02-matches.spec.ts first');
  const statsButton = page.getByRole('button', { name: 'Match Statistics' });
  // This browser context has an empty local database: the live page first pulls the match from the server, and
  // when that fails (a slow or failed first pull) it leaves for /matches with a load-failure toast. That is
  // not what is under test, so open it once more, with the match tracked, before judging.
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(completedMatchStatsUrl!.replace('/stats', '/live'));
    await expect
      .poll(async () => ((await statsButton.isVisible()) ? 'live' : /\/matches$/.test(page.url()) ? 'matches' : 'loading'), {
        timeout: 30_000,
      })
      .not.toBe('loading');
    if (await statsButton.isVisible()) break;
  }
  await expect(statsButton).toBeVisible();
  await headerLink(page, 'Teams').click();
  await page.waitForURL(/\/teams$/, { timeout: 15_000 });
  await expect(page.getByTestId('leave-live-dialog')).toBeHidden();
});
