/**
 * A team member who wasn't ticked in the start dialog joins the match in progress, offline, and the
 * roster change reaches the server. Archived players are never offered.
 */
import { test, expect } from '@playwright/test';
import { createAndStartMatch } from '../helpers/match-setup';
import { readFixture } from '../helpers/fixture';
import { setupCourtPositions } from '../helpers/court';
import { goOffline, goOnline, waitForServiceWorker } from '../helpers/network';
import { fetchServerMatch } from '../helpers/server-data';
import { acceptBeforeUnload, waitForAllSaved } from '../helpers/sync';


test('adds a late player to the roster offline', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  acceptBeforeUnload(page);
  const { teamId, teamName, playerNames, archivedPlayerName } = readFixture();
  const late = playerNames[7]; // not needed on court in set 1
  const { matchId, selectedPlayers } = await createAndStartMatch(page, { teamId, teamName, excludePlayers: [late] });
  await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
  await page.getByTestId('point-btn-managed-point').first().waitFor({ state: 'visible', timeout: 10_000 });
  await waitForServiceWorker(page);
  await goOffline(page);

  // Events panel → Add late player
  await page.getByTestId('sidebar-btn-events').first().click();
  await page.getByTestId('add-late-player').first().click();
  const picker = page.getByTestId('late-player-dialog');
  await expect(picker).toBeVisible();
  if (archivedPlayerName) {
    await expect(picker.locator(`[data-player-name="${archivedPlayerName}"]`)).toHaveCount(0);
  }
  await picker.locator(`[data-testid="late-player-option"][data-player-name="${late}"]`).click();
  await expect(picker).toBeHidden();
  await expect(page.getByText(`${late} added to the roster`).first()).toBeVisible();

  // The late player is on the bench: offered as the player coming in
  await page.getByRole('button', { name: 'Substitution', exact: true }).click();
  await page.getByLabel('Player In (on the bench)').click();
  await expect(page.getByRole('option', { name: new RegExp(late) })).toBeVisible();
  await page.keyboard.press('Escape'); // closes the select
  await expect(page.getByRole('listbox')).toBeHidden(); // a second Escape too soon would be swallowed
  await page.keyboard.press('Escape'); // closes the substitution dialog
  await expect(page.getByRole('dialog')).toBeHidden();

  // Nobody left to add
  await page.getByTestId('add-late-player').first().click();
  await expect(picker).toContainText('Every active team member is already in the roster.');
  await page.keyboard.press('Escape');

  // The roster change uploads with the match
  await goOnline(page);
  await waitForAllSaved(page);
  const server = await fetchServerMatch(matchId);
  expect(server.match.home_available_players).toHaveLength(selectedPlayers + 1);
});
