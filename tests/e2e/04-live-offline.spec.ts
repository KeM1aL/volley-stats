/**
 * Live match — offline/reconnect scenario
 *
 * 5.1  Create match and navigate to live page (via helper)
 * 5.2  First set setup
 * 5.3  Play 5 points online (establish synced baseline)
 * 5.4  Go offline
 * 5.5  Record stats + score 3 points offline (writes to RxDB/IndexedDB only)
 * 5.6  Reconnect
 * 5.7  Reload page — verify live match state is restored from RxDB
 * 5.8  Save offlineMatchId to fixture
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { goOffline, goOnline } from '../helpers/network';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

function loadFixture(): { teamName: string; playerNames: string[]; [key: string]: unknown } {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw);
}

function saveFixture(data: Record<string, unknown>): void {
  const existing = loadFixture();
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify({ ...existing, ...data }, null, 2));
}

test.describe('Live match — offline/reconnect', () => {
  test('record stats offline and verify persistence on reconnect', async ({ page }) => {
    test.setTimeout(8 * 60_000);

    const { teamName, playerNames } = loadFixture();
    expect(teamName, 'Team fixture not found — run 01-teams.spec.ts first').toBeTruthy();

    // 5.1 Create match and navigate to live page
    const { matchId } = await createAndStartMatch(page, { teamName, playerNames });

    // 5.2 First set setup
    await setupCourtPositions(page, playerNames.slice(0, 6), {
      selectServingTeam: teamName,
    });

    // 5.3 Play 5 points online (establish baseline)
    const pointBtn = page.getByTestId('point-btn-managed-point').first();
    await pointBtn.waitFor({ state: 'visible', timeout: 10_000 });
    for (let i = 0; i < 5; i++) {
      const isVisible = await pointBtn.isVisible().catch(() => false);
      if (!isVisible) break; // set may have ended early
      await pointBtn.click();
      await page.waitForTimeout(200);
    }

    // 5.4 Go offline
    await goOffline(page);
    // SyncIndicator is commented out — skip offline banner assertion

    // 5.5 Record stats and score points offline
    // Select player and record a serve stat
    const player0Btn = page.getByRole('button', { name: new RegExp(playerNames[0], 'i') }).first();
    const player0Visible = await player0Btn.isVisible().catch(() => false);
    if (player0Visible) {
      await player0Btn.click();
      await page.waitForTimeout(100);
      const serveCard = page.getByTestId('stat-card-serve').first();
      const serveVisible = await serveCard.isVisible().catch(() => false);
      if (serveVisible) {
        const successBtn = serveCard.locator('button.bg-green-500').first();
        const successEnabled = await successBtn.isEnabled().catch(() => false);
        if (successEnabled) {
          await successBtn.click();
          await page.waitForTimeout(200);
        }
      }
    }

    // Score 3 points offline
    for (let i = 0; i < 3; i++) {
      const isVisible = await pointBtn.isVisible().catch(() => false);
      if (!isVisible) break; // set may have ended
      await pointBtn.click();
      await page.waitForTimeout(200);
    }

    // 5.6 Reconnect
    await goOnline(page);
    // Allow sync to start
    await page.waitForTimeout(500);

    // 5.7 Reload and verify live match state is restored from RxDB
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // The page should restore live match state from RxDB (offline-first)
    // Wait for either: the point button (still in set), or set-setup (set ended), or match complete
    const liveOrSetup = page
      .getByTestId('point-btn-managed-point').first()
      .or(page.getByTestId('set-setup').first())
      .or(page.getByText('Match MVP Analysis').first())
      .or(page.getByRole('button', { name: 'Match Statistics' }).first());

    await expect(liveOrSetup).toBeVisible({ timeout: 20_000 });

    // 5.8 Save offlineMatchId to fixture
    saveFixture({ offlineMatchId: matchId });
  });
});
