/**
 * Set setup: every player on court needs a role. A player whose volleyball position is not a field role
 * is placed without one; starting the set is refused and the court position and role select turn red
 * until a role is chosen. Works on a team of its own (players without a position, so no default role).
 */
import { test, expect } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { createScratchTeam } from '../helpers/seed';
import { createAndStartMatch } from '../helpers/match-setup';

const PLAYERS = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'];
const POSITIONS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const ROLES = ['Setter', 'Outside Hitter', 'Middle Hitter', 'Opposite', 'Outside Hitter', 'Middle Hitter'];

test('start set is blocked while a player on court has no role', async ({ page }, testInfo) => {
  test.setTimeout(2 * 60_000);
  const { runId } = readFixture();
  const teamName = `E2E Team roles ${runId} ${testInfo.retry}`;
  const teamId = await createScratchTeam(teamName, PLAYERS);
  await createAndStartMatch(page, { teamId, teamName });

  // renderMainContent() renders more than once for the layout breakpoints: .first() on every test id
  await page.getByTestId('set-setup').first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByTestId('serving-team-select').first().click();
  await page.getByRole('option', { name: teamName }).click();

  // Six players on court, none with a role
  for (let i = 0; i < POSITIONS.length; i++) {
    await page.getByTestId(`court-position-${POSITIONS[i]}`).first().click();
    await page.getByRole('button', { name: new RegExp(PLAYERS[i], 'i') }).first().click();
  }
  const roleSelect = page.getByTestId('role-select').first();
  await expect(roleSelect).toHaveText(/Select role/i);
  await expect(roleSelect).toHaveAttribute('aria-invalid', 'true');

  // Start set is refused
  await page.getByTestId('start-set-btn').first().click();
  await expect(page.getByText('Choose a role for the player at P1, P2, P3, P4, P5, P6').first()).toBeVisible();
  await expect(page.getByTestId('start-set-btn').first()).toBeVisible();
  await expect(page.getByTestId('point-btn-managed-point')).toHaveCount(0);
  await expect(page.getByTestId('court-position-p1').first()).toHaveClass(/border-destructive/);

  // A role for each player: the position turns back to normal, then the set starts
  for (let i = 0; i < POSITIONS.length; i++) {
    await page.getByTestId(`court-position-${POSITIONS[i]}`).first().click();
    if (i > 0) await expect(page.getByTestId(`court-position-${POSITIONS[i]}`).first()).toHaveClass(/border-destructive/);
    await page.getByTestId('role-select').first().click();
    await page.getByRole('option', { name: ROLES[i], exact: true }).click();
    await expect(page.getByTestId(`court-position-${POSITIONS[i]}`).first()).not.toHaveClass(/border-destructive/);
  }
  await page.getByTestId('start-set-btn').first().click();
  await page.getByTestId('point-btn-managed-point').first().waitFor({ state: 'visible', timeout: 15_000 });
});
