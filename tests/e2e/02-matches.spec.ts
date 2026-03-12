/**
 * Matches E2E tests — full match flow
 *
 * 3.1–3.5  Create match + start it (delegated to createAndStartMatch helper)
 * 3.6  Set setup: serving team + court positions (reusable helper)
 * 3.7  Play set with randomised stats + substitution via Events panel
 * 3.8  Setup next set
 * 3.9  Continue until match finished
 */

import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { setupCourtPositions } from '../helpers/court';
import { createAndStartMatch } from '../helpers/match-setup';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

// Load team data saved by 01-teams.spec.ts
function loadFixture(): { teamName: string; playerNames: string[]; [key: string]: unknown } {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw);
}

function saveFixture(data: Record<string, unknown>): void {
  const existing = loadFixture();
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify({ ...existing, ...data }, null, 2));
}

// ─── Helper: play one full set ───────────────────────────────────────────────
/**
 * Records stats, performs a substitution (first set only), then scores
 * points for the managed team until the set (or match) ends.
 *
 * @returns true if the match is finished, false if only the set ended.
 */
async function playSetToCompletion(
  page: Page,
  playerNames: string[],
  isFirstSet: boolean
): Promise<boolean> {
  // renderMainContent() is called multiple times for different layout breakpoints,
  // causing duplicate testids. Use .first() throughout to target the visible instance.
  await page.getByTestId('point-btn-managed-point').first().waitFor({ state: 'visible', timeout: 10_000 });

  // Phase A — record at least one stat for every visible stat type
  // Stat types (lowercase, matching data-testid="stat-card-{type}"):
  const statTypes = ['serve', 'reception', 'spike', 'block', 'defense'];
  for (const type of statTypes) {
    const card = page.getByTestId(`stat-card-${type}`).first();
    const isVisible = await card.isVisible().catch(() => false);
    if (!isVisible) continue;

    // Select a player first (use first player in lineup)
    await page
      .getByRole('button', { name: new RegExp(playerNames[0], 'i') })
      .first()
      .click();
    await page.waitForTimeout(100);

    // Click the green Success button inside this stat card
    const successBtn = card.locator('button.bg-green-500').first();
    const isSuccessEnabled = await successBtn.isEnabled().catch(() => false);
    if (isSuccessEnabled) {
      await successBtn.click();
      await page.waitForTimeout(200);
    }
  }

  // Also click BAD (yellow) at least once
  const badBtns = page.locator('button.bg-yellow-500');
  if ((await badBtns.count()) > 0) {
    await page
      .getByRole('button', { name: new RegExp(playerNames[1], 'i') })
      .first()
      .click();
    await page.waitForTimeout(100);
    await badBtns.first().click();
    await page.waitForTimeout(200);
  }

  // Also click GOOD (blue) at least once
  const goodBtns = page.locator('button.bg-blue-500');
  if ((await goodBtns.count()) > 0) {
    await page
      .getByRole('button', { name: new RegExp(playerNames[2], 'i') })
      .first()
      .click();
    await page.waitForTimeout(100);
    await goodBtns.first().click();
    await page.waitForTimeout(200);
  }

  // Phase B — substitution via Events panel (first set only)
  if (isFirstSet) {
    // Open Events panel
    await page.getByTestId('sidebar-btn-events').first().click();

    // Wait for the Events panel to appear with the Substitution quick-action button.
    // The button uses the "eventShort" translation key which renders as "Sub".
    const subBtn = page.getByRole('button', { name: 'Sub', exact: true });
    await subBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await subBtn.click();

    // Dialog: "Add Substitution"
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });

    // Select player leaving (currently in lineup)
    const playerOutTrigger = page.getByLabel('Player Out (currently in lineup)');
    await playerOutTrigger.click();
    const firstOutOption = page.getByRole('option').first();
    await firstOutOption.waitFor({ state: 'visible', timeout: 3_000 });
    await firstOutOption.click();

    // Select player entering (on bench)
    const playerInTrigger = page.getByLabel('Player In (on the bench)');
    await playerInTrigger.click();
    const firstInOption = page.getByRole('option').first();
    await firstInOption.waitFor({ state: 'visible', timeout: 3_000 });
    await firstInOption.click();

    // Submit the substitution — use type="submit" because the button text is a missing
    // translation key (events.form.createEvent) that renders as a raw key string.
    await page.getByRole('dialog').locator('button[type="submit"]').click();
    await page.waitForTimeout(500);

    // Close Events panel
    await page.getByTestId('sidebar-btn-events').first().click();
    await page.waitForTimeout(300);
  }

  // Phase C — score points until set or match ends
  const pointBtn = page.getByTestId('point-btn-managed-point').first();

  /** Returns true if the page is showing the match-completed view (MVP/stats screen). */
  async function isMatchComplete(): Promise<boolean> {
    // The live page replaces content with MatchScoreDetails + MVPAnalysis on completion.
    // The toast "Match Finished" auto-dismisses, so also check for the persistent MVP heading.
    const matchFinished = await page.getByText('Match Finished').isVisible().catch(() => false);
    if (matchFinished) return true;
    const mvpVisible = await page.getByText('Match MVP Analysis').isVisible().catch(() => false);
    if (mvpVisible) return true;
    const statsBtn = await page.getByRole('button', { name: 'Match Statistics' }).isVisible().catch(() => false);
    if (statsBtn) return true;
    // Also check URL change (redirect was commented out, but may be re-enabled in future)
    return !page.url().includes('/live');
  }

  // Safety limit: max 60 iterations (way more than needed for any set)
  for (let attempt = 0; attempt < 60; attempt++) {
    // Check for match finished state first (higher priority than set-setup)
    if (await isMatchComplete()) return true; // match done

    // Check if the next set setup is visible (set ended)
    const setSetupVisible = await page.getByTestId('set-setup').first().isVisible().catch(() => false);
    if (setSetupVisible) return false; // set done, match continues

    // Check if point button is visible before clicking — the set/match may have just ended
    // and the button may have disappeared mid-loop (race condition after page transition).
    const pointBtnVisible = await pointBtn.isVisible().catch(() => false);
    if (!pointBtnVisible) {
      // Give the page a moment to settle and then re-check state on next iteration
      await page.waitForTimeout(300);
      continue;
    }

    // Score a point for the managed team
    await pointBtn.click();
    await page.waitForTimeout(150);
  }

  // After iteration limit, check final state
  return isMatchComplete();
}

// ─── Main test ────────────────────────────────────────────────────────────────

test.describe('Matches — full match flow', () => {
  test('create and play a full match to completion', async ({ page }) => {
    const { teamName, playerNames } = loadFixture();
    expect(teamName, 'Team fixture not found — run 01-teams.spec.ts first').toBeTruthy();

    // 3.1 – 3.5 Create match and navigate to live page
    await createAndStartMatch(page, { teamName, playerNames });

    // 3.6 First set setup (with serving team selection)
    await setupCourtPositions(page, playerNames.slice(0, 6), {
      selectServingTeam: teamName,
    });

    // 3.7 Play first set
    let matchDone = await playSetToCompletion(page, playerNames.slice(0, 6), true);

    // 3.8 / 3.9 Continue sets until match is finished
    let setNumber = 1;
    while (!matchDone && setNumber < 5) {
      setNumber++;

      // Setup next set (serving team auto-determined for sets 2–4, required again for set 5)
      const servingTeamArg = setNumber === 5 ? teamName : undefined;
      await setupCourtPositions(page, playerNames.slice(0, 6), {
        selectServingTeam: servingTeamArg,
      });

      matchDone = await playSetToCompletion(page, playerNames.slice(0, 6), false);
    }

    // Assert match is complete — wait specifically for the Match Statistics button
    // (which we need to navigate to the stats URL) rather than the more general MVP text.
    const statsBtn = page.getByRole('button', { name: 'Match Statistics' });
    await expect(statsBtn).toBeVisible({ timeout: 15_000 });

    // Navigate to stats page and save the full URL (includes ?team= query param)
    await statsBtn.click();
    await page.waitForURL(/\/matches\/.+\/stats/, { timeout: 10_000 });
    saveFixture({ completedMatchStatsUrl: page.url() });
  });
});
