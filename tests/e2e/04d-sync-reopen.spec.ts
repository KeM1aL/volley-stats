/**
 * Sync — data recorded offline reaches the server
 *
 * 1. Score offline, close the page, reopen the app on the home page online:
 *    the points upload without opening the match again.
 * 2. Score in a live page that is not the leading tab: the leader uploads it.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { goOffline, waitForServiceWorker } from '../helpers/network';
import { acceptBeforeUnload, expectServerMatchesLiveScore, readLiveScore, waitForAllSaved } from '../helpers/sync';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

function loadFixture(): { teamName: string; playerNames: string[] } {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

test.describe('Sync — data recorded offline reaches the server', () => {
  test('uploads after the app is closed offline and reopened on the home page', async ({ page, context }) => {
    test.setTimeout(6 * 60_000);
    acceptBeforeUnload(page);
    const { teamName, playerNames } = loadFixture();
    expect(teamName, 'Team fixture not found — run 01-teams.spec.ts first').toBeTruthy();

    const { matchId } = await createAndStartMatch(page, { teamName, playerNames });
    await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
    const pointButton = page.getByTestId('point-btn-managed-point').first();
    await pointButton.waitFor({ state: 'visible', timeout: 10_000 });
    await waitForServiceWorker(page);

    await goOffline(page);
    for (let i = 0; i < 3; i++) {
      await pointButton.click();
      await page.waitForTimeout(200);
    }
    await expect(page.getByTestId('live-score')).toHaveAttribute('data-home', '3');
    const score = await readLiveScore(page);
    await page.close(); // closing does not run beforeunload

    await context.setOffline(false);
    const home = await context.newPage();
    await home.goto('/');
    await waitForAllSaved(home);
    await expectServerMatchesLiveScore(matchId, score);
  });

  test('uploads from a live page that is not the leading tab', async ({ context }) => {
    test.setTimeout(6 * 60_000);
    const homeTab = await context.newPage(); // opened first: this tab becomes the RxDB leader
    await homeTab.goto('/');
    await expect(homeTab.getByTestId('sync-badge').first()).toBeVisible({ timeout: 30_000 });

    const page = await context.newPage();
    acceptBeforeUnload(page);
    const { teamName, playerNames } = loadFixture();
    const { matchId } = await createAndStartMatch(page, { teamName, playerNames });
    await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
    const pointButton = page.getByTestId('point-btn-managed-point').first();
    await pointButton.waitFor({ state: 'visible', timeout: 10_000 });
    for (let i = 0; i < 3; i++) {
      await pointButton.click();
      await page.waitForTimeout(200);
    }
    await expect(page.getByTestId('live-score')).toHaveAttribute('data-home', '3');
    const score = await readLiveScore(page);
    await waitForAllSaved(page);
    await expectServerMatchesLiveScore(matchId, score);
  });
});
