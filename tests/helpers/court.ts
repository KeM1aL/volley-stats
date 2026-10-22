import { expect, Page } from '@playwright/test';

// Volleyball roles to cycle through for the 6 court positions
const ROLES = [
  'Setter',
  'Outside Hitter',
  'Middle Hitter',
  'Opposite',
  'Outside Hitter',
  'Middle Hitter',
];

const POSITIONS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

/**
 * Reusable helper for the Set Setup screen.
 *
 * For each of the 6 positions (6x6 format):
 *  1. Click the court circle  → player selector card appears
 *  2. Click the player button
 *  3. If the role select is still empty, pick a role (required by set-setup.tsx useEffect)
 *
 * After all positions are filled, clicks "Start Set" and waits for the
 * stat tracker's point button to become visible.
 *
 * @param page - Playwright Page
 * @param players - Array of 6 player names to assign to P1..P6
 * @param options.selectServingTeam - Team name to select as server (required for set 1 and tie-break only)
 */
export async function setupCourtPositions(
  page: Page,
  players: string[],
  options?: { selectServingTeam?: string }
): Promise<void> {
  // renderMainContent() is called multiple times for different layout breakpoints.
  // At 768px the first instance is in the visible (hidden md:grid) container.
  // Use .first() throughout to avoid strict-mode violations from duplicate testids.
  await page.getByTestId('set-setup').first().waitFor({ state: 'visible', timeout: 10_000 });

  // 1. Select serving team (only required for first and tie-break set)
  if (options?.selectServingTeam) {
    const servingTrigger = page.getByTestId('serving-team-select').first();
    await servingTrigger.waitFor({ state: 'visible', timeout: 5_000 });
    await servingTrigger.click();
    await page.getByRole('option', { name: options.selectServingTeam }).click();
  }

  // 2. Assign each position
  for (let i = 0; i < POSITIONS.length; i++) {
    const pos = POSITIONS[i];

    // Click the court position circle
    await page.getByTestId(`court-position-${pos}`).first().click();

    // Click the player — use getByRole button with the player name; the selector card appears after the click.
    // Players show as buttons with name + number (e.g. "Player 1 #1")
    const playerButton = page.getByRole('button', { name: new RegExp(players[i], 'i') }).first();
    await expect(playerButton).toBeVisible();
    await playerButton.click();

    // The role select appears in the card and is never empty: it shows the player's volleyball position
    // (auto-filled), or the "Select role" placeholder.
    const lastCombobox = page.locator('[role="combobox"]').filter({ hasNotText: 'Select serving' }).last();
    await expect(lastCombobox).not.toHaveText(/^\s*$/);

    // If it still shows the placeholder, pick a role manually.
    // (Happens when the player has no volleyball position field set; the seeded teams all have one.)
    if (/Select role/i.test(await lastCombobox.innerText())) {
      await lastCombobox.click();
      await page.getByRole('option', { name: ROLES[i] }).click();
      await expect(lastCombobox).not.toHaveText(/Select role/i);
    }
  }

  // 3. Click "Start Set"
  await page.getByTestId('start-set-btn').first().click();

  // 4. Wait for stat tracker to be ready (managed-point button signals tracker is live)
  await page.getByTestId('point-btn-managed-point').first().waitFor({ state: 'visible', timeout: 15_000 });
}
