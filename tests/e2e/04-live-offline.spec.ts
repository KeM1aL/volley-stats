/**
 * Live match — offline/reconnect scenarios
 *
 * Both start the same way: create the match, set up the first set, play 2 points online (a synced
 * baseline). The test format's sets end at 5 points, and the serve stat recorded offline is a point too.
 *
 * 1. Reload offline first (a cold start with no network), then record a stat and 2 points offline,
 *    reconnect, wait for "All saved", compare the server with the device, reload.
 * 2. Record a stat and 1 point offline (4-0, still inside set 1), reload while still offline, then
 *    reconnect. The reload comes after the last point is on screen, so it never interrupts a point's writes.
 */

import { test, expect, type Page } from '@playwright/test';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { scorePoints } from '../helpers/live';
import { goOffline, goOnline, waitForServiceWorker } from '../helpers/network';
import { acceptBeforeUnload, expectServerMatchesDevice, waitForAllSaved } from '../helpers/sync';

import { readFixture, updateFixture } from '../helpers/fixture';

/** Creates a match, sets up its first set and scores 2 points online. */
async function startMatchWithBaseline(page: Page): Promise<{ matchId: string; playerNames: string[] }> {
  const { teamId, teamName, playerNames } = readFixture();
  const { matchId } = await createAndStartMatch(page, { teamId, teamName });
  await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
  await scorePoints(page, 2);
  await waitForServiceWorker(page);
  return { matchId, playerNames };
}

/**
 * Reloads while offline — a cold start with no network: the service worker serves the app, AuthProvider
 * uses the profile saved on this device, and the match state comes from RxDB (2 points scored so far).
 */
async function reloadOffline(page: Page): Promise<void> {
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const liveOrSetup = page.getByTestId('point-btn-managed-point').first().or(page.getByTestId('set-setup').first());
  await expect(liveOrSetup).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Failed to Load Profile' })).toHaveCount(0);
  await expect(page.getByTestId('live-score')).toHaveAttribute('data-home', '2');
}

/** Records a serve stat (the managed team serves: selectServingTeam in the set setup); it scores a point. */
async function recordServeStat(page: Page, playerName: string): Promise<void> {
  await expect(page.getByRole('button', { name: new RegExp(playerName, 'i') }).first()).toBeVisible();
  await page.getByRole('button', { name: new RegExp(playerName, 'i') }).first().click();
  const serveCard = page.getByTestId('stat-card-serve').first();
  await expect(serveCard).toBeVisible();
  const successBtn = serveCard.locator('button.bg-green-500').first();
  await expect(successBtn).toBeEnabled();
  await successBtn.click();
  await expect(successBtn).toBeDisabled();
}

/** Records a serve stat and scores 2 points. */
async function recordStatAndPoints(page: Page, playerName: string): Promise<void> {
  await recordServeStat(page, playerName);
  await scorePoints(page, 2);
}

/** Reconnects without reloading the page, waits for "All saved" and compares the server with the device. */
async function reconnectAndExpectUploaded(page: Page, matchId: string): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker = true;
  });
  await goOnline(page);
  await waitForAllSaved(page);
  expect(
    await page.evaluate(() => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker === true),
    'page reloaded when the connection came back'
  ).toBe(true);
  await expectServerMatchesDevice(page, matchId);
}

test.describe('Live match — offline/reconnect', () => {
  test('reloads offline, then records offline and uploads on reconnect', async ({ page }) => {
    test.setTimeout(3 * 60_000);
    acceptBeforeUnload(page);
    const { matchId, playerNames } = await startMatchWithBaseline(page);

    await goOffline(page);
    await reloadOffline(page);
    await recordStatAndPoints(page, playerNames[0]);
    await reconnectAndExpectUploaded(page, matchId);

    // Reload and verify the live match state is restored from RxDB (offline-first)
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    const liveOrSetup = page
      .getByTestId('point-btn-managed-point').first()
      .or(page.getByTestId('set-setup').first())
      .or(page.getByText('Match MVP Analysis').first())
      .or(page.getByRole('button', { name: 'Match Statistics' }).first());
    await expect(liveOrSetup).toBeVisible({ timeout: 20_000 });

    updateFixture({ offlineMatchId: matchId });
  });

  test('records offline, reloads while still offline, then uploads on reconnect', async ({ page }) => {
    test.setTimeout(3 * 60_000);
    acceptBeforeUnload(page);
    const { matchId, playerNames } = await startMatchWithBaseline(page);

    await goOffline(page);
    await recordServeStat(page, playerNames[0]);
    // The stat's point shows only once its writes are done; scorePoints counts from the score shown.
    await expect(page.getByTestId('live-score')).toHaveAttribute('data-home', '3');
    await scorePoints(page, 1);
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('point-btn-managed-point').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Failed to Load Profile' })).toHaveCount(0);
    await reconnectAndExpectUploaded(page, matchId);
  });
});
