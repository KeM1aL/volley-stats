/**
 * Scoring device — a second device takes over a match.
 * The first device's later point never reaches the server and its page becomes read-only;
 * it then takes scoring back, shows the server's match and scores again.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { acceptBeforeUnload, expectServerMatchesDevice, expectServerStaysAt, readLiveScore, waitForAllSaved } from '../helpers/sync';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const AUTH_STATE_PATH = path.join(__dirname, '../../playwright/.auth/user.json');

test('a second device takes over scoring, the first becomes read-only, then takes scoring back', async ({ page, browser }) => {
  test.setTimeout(6 * 60_000);
  acceptBeforeUnload(page);
  const { teamName, playerNames } = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));

  const { matchId } = await createAndStartMatch(page, { teamName, playerNames });
  await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
  const pointA = page.getByTestId('point-btn-managed-point').first();
  await pointA.waitFor({ state: 'visible', timeout: 10_000 });
  await pointA.click();
  await page.waitForTimeout(200);
  await pointA.click();
  // The badge may still say "saved" from before the click: wait for the page to show both points first.
  await expect(page.getByTestId('live-score')).toHaveAttribute('data-home', '2');
  await waitForAllSaved(page);
  await expectServerMatchesDevice(page, matchId);

  // Device B: same account, another browser context. The saved storage state carries this device's id
  // (and its unsent-changes hint), so strip them: B must be a different device.
  const signedIn = JSON.parse(fs.readFileSync(AUTH_STATE_PATH, 'utf-8'));
  for (const origin of signedIn.origins ?? []) {
    origin.localStorage = origin.localStorage.filter(
      (item: { name: string }) => item.name !== 'volleystats:device-id' && item.name !== 'volleystats:unsent-changes'
    );
  }
  const contextB = await browser.newContext({
    storageState: signedIn,
    viewport: { width: 768, height: 1024 },
  });
  const pageB = await contextB.newPage();
  acceptBeforeUnload(pageB);
  await pageB.goto(page.url());
  const dialog = pageB.getByTestId('scorer-claim-dialog');
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await dialog.getByRole('button', { name: /take over scoring/i }).click();
  await expect(dialog).toBeHidden();
  const pointB = pageB.getByTestId('point-btn-managed-point').first();
  await pointB.waitFor({ state: 'visible', timeout: 20_000 });
  await pointB.click();
  await expect(pageB.getByTestId('live-score')).toHaveAttribute('data-home', '3');
  await waitForAllSaved(pageB);
  const scoreB = await readLiveScore(pageB);
  await expectServerMatchesDevice(pageB, matchId);

  // Device A scores again: the server refuses it and A becomes read-only, without an error state.
  await pointA.click();
  await expect(page.getByTestId('taken-over-banner').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('sync-badge').first()).not.toHaveAttribute('data-state', 'problem');
  // A's refused point never lands on the server, not even a moment later.
  await expectServerStaysAt(matchId, scoreB);
  await expectServerMatchesDevice(scoreB, matchId);
  await contextB.close();

  // Device A takes scoring back: its refused point is discarded, it shows the server's match, and its next point uploads.
  await page.getByTestId('take-back-scoring').first().click();
  const confirm = page.getByTestId('take-back-dialog');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: /take scoring back/i }).click();
  await expect(page.getByTestId('taken-over-banner')).toHaveCount(0, { timeout: 60_000 });
  await pointA.waitFor({ state: 'visible', timeout: 60_000 });
  await expect(page.getByTestId('live-score')).toHaveAttribute('data-home', String(scoreB.home));
  await pointA.click();
  await expect(page.getByTestId('live-score')).toHaveAttribute('data-home', String(scoreB.home + 1));
  await waitForAllSaved(page);
  await expectServerMatchesDevice(page, matchId);
});
