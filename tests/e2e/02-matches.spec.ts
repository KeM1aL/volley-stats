/**
 * Matches E2E tests — full match flow
 *
 * 3.0  Create a match through the "New Match" dialog (the only spec that does)
 * 3.1–3.5  Create a match by API + start it (delegated to createAndStartMatch helper)
 * 3.6  Set setup: serving team + court positions (reusable helper)
 * 3.7  Play set with randomised stats + substitution via Events panel
 * 3.8  Setup next set
 * 3.9  Continue until match finished
 */

import { test, expect, Locator, Page } from '@playwright/test';
import { readFixture, updateFixture } from '../helpers/fixture';
import { setupCourtPositions } from '../helpers/court';
import { createAndStartMatch } from '../helpers/match-setup';
import { scorePoints } from '../helpers/live';

// ─── Helper: the "New Match" dialog ──────────────────────────────────────────

/** Creates an upcoming match (team vs "Team 1", format "Test (6x6)") through the "New Match" dialog. */
async function createMatchThroughDialog(page: Page, teamName: string) {
  await page.goto('/matches');
  await expect(page.getByRole('heading', { name: 'Matches', level: 1 })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'New Match' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Home team (combobox index 1 inside dialog)
  await dialog.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: new RegExp(teamName, 'i') }).click();

  // Away team (combobox index 2 inside dialog) — exact match to avoid matching the E2E team name
  await dialog.getByRole('combobox').nth(2).click();
  await page.getByRole('option', { name: 'Team 1', exact: true }).click();

  // Match format (combobox index 3 inside dialog)
  await dialog.getByRole('combobox').nth(3).click();
  await page.getByRole('option', { name: 'Test (6x6)' }).click();

  await page.getByRole('button', { name: 'Create Match' }).click();
  await expect(page.getByText('Match created').first()).toBeVisible({ timeout: 10_000 });
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

  // Phase A — record at least one stat for every stat type on screen: spike, block and defense always,
  // plus serve or reception depending on who serves the set.
  // Stat types (lowercase, matching data-testid="stat-card-{type}"):
  for (const type of ['spike', 'block', 'defense']) {
    await expect(page.getByTestId(`stat-card-${type}`).first()).toBeVisible();
  }
  const serveOrReception = page.getByTestId('stat-card-serve').first().or(page.getByTestId('stat-card-reception').first());
  await expect(serveOrReception.first()).toBeVisible();

  /** Selects a player, then records a result with the first button of that colour; the player is released afterwards. */
  async function recordResult(playerName: string, button: Locator) {
    await page.getByRole('button', { name: new RegExp(playerName, 'i') }).first().click();
    await expect(button).toBeEnabled();
    await button.click();
    await expect(button).toBeDisabled();
  }

  for (const type of ['serve', 'reception', 'spike', 'block', 'defense']) {
    const card = page.getByTestId(`stat-card-${type}`).first();
    if ((await card.count()) === 0) continue; // serve and reception exclude each other
    await recordResult(playerNames[0], card.locator('button.bg-green-500').first());
  }

  // Also click BAD (yellow) and GOOD (blue) at least once
  await recordResult(playerNames[1], page.locator('button.bg-yellow-500').first());
  await recordResult(playerNames[2], page.locator('button.bg-blue-500').first());

  // Phase B — substitution via Events panel (first set only)
  if (isFirstSet) {
    // Open Events panel
    await page.getByTestId('sidebar-btn-events').first().click();

    // Wait for the Events panel to appear with the Substitution quick-action button.
    // The button uses the "live.substitution" translation key which renders as "Substitution".
    const subBtn = page.getByRole('button', { name: 'Substitution', exact: true });
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
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Close Events panel with the sidebar caret: it collapses the panel back to the icon column
    await expect(page.getByTestId('live-panel')).toBeVisible();
    await page.getByTestId('sidebar-toggle').click();
    await expect(page.getByTestId('live-panel')).toHaveCount(0);
    await expect(page.getByTestId('sidebar-toggle')).toHaveAttribute('data-state', 'collapsed');
  }

  // Phase C — score points until the set or the match ends
  const statsButton = page.getByRole('button', { name: 'Match Statistics' });
  const setSetup = page.getByTestId('set-setup').first();
  const scoring = page.getByTestId('point-btn-managed-point').first().or(setSetup).or(statsButton.first()).first();

  // Safety limit: far more points than any set needs (sets are played to 5 in this format)
  for (let point = 0; point < 60; point++) {
    // Wait for the page to show either the scoring button or the end of the set/match
    await expect(scoring).toBeVisible();
    if ((await statsButton.isVisible()) || (await setSetup.isVisible())) break;
    await scorePoints(page, 1, { mayEndSet: true });
  }

  // The match-completed view (MVP analysis + Match Statistics) replaces the set setup when the match is over
  return statsButton.isVisible();
}

// ─── Main test ────────────────────────────────────────────────────────────────

test.describe('Matches — full match flow', () => {
  test('create and play a full match to completion', async ({ page }) => {
    test.setTimeout(8 * 60_000);
    const { teamId, teamName, playerNames, archivedPlayerName } = readFixture();

    // 3.0 Create a match through the "New Match" dialog
    await createMatchThroughDialog(page, teamName);

    // 3.1 – 3.5 Create a match by API and navigate to its live page
    const { matchId } = await createAndStartMatch(page, {
      teamId,
      teamName,
      absentPlayers: [archivedPlayerName],
    });

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

    // Navigate to the stats page and record the match id
    await statsBtn.click();
    await page.waitForURL(/\/matches\/.+\/stats/, { timeout: 10_000 });
    updateFixture({ completedMatchId: matchId });
  });
});
