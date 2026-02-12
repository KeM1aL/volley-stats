/**
 * Teams E2E tests
 *
 * 2.1 Create a new team
 * 2.2 Edit the team name
 * 2.3 Add 8 players with role "Player" and volleyball positions
 * 2.4 Save team details to fixtures for use in the matches test
 *
 * All steps are combined in a single test to avoid Playwright's
 * per-test module re-evaluation which would produce different Date.now() values.
 */

import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Position label map: PlayerRole enum value → display label in English UI
const POSITION_LABELS: Record<string, string> = {
  setter: 'Setter',
  outside_hitter: 'Outside Hitter',
  middle_hitter: 'Middle Hitter',
  opposite: 'Opposite',
  libero: 'Libero',
};

// Players with volleyball positions so role auto-selects in set-setup
const PLAYERS = [
  { name: 'Player 1', number: 1, position: 'setter' },
  { name: 'Player 2', number: 2, position: 'outside_hitter' },
  { name: 'Player 3', number: 3, position: 'middle_hitter' },
  { name: 'Player 4', number: 4, position: 'opposite' },
  { name: 'Player 5', number: 5, position: 'outside_hitter' },
  { name: 'Player 6', number: 6, position: 'middle_hitter' },
  { name: 'Player 7', number: 7, position: 'outside_hitter' },
  { name: 'Player 8', number: 8, position: 'setter' },
];

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

/**
 * Open the filter panel (if not already open) and type the team name in the
 * search box, then wait for the 500 ms input debounce to fire.
 *
 * Using explicit search avoids the "initialFilters" re-application that
 * occurs on every page mount (which pre-fills the search with the user's
 * favourite team name).
 */
async function searchTeam(page: Page, teamName: string) {
  // Use getByPlaceholder — more reliable than getByRole(name) for inputs with no aria-label
  const searchBox = page.getByPlaceholder('Search by team name...');
  const isVisible = await searchBox.isVisible().catch(() => false);
  if (!isVisible) {
    // Open filter panel and wait for the textbox to actually be visible
    await page.getByRole('button', { name: 'Filters' }).click();
    await searchBox.waitFor({ state: 'visible', timeout: 10_000 });
  }
  await searchBox.clear();
  await searchBox.fill(teamName);
  await page.waitForTimeout(600); // Wait for 500 ms input debounce + margin
}

test.describe('Teams management', () => {
  // 2.1 → 2.4 in one test to share TEAM_NAME state
  test('create team, rename it, add 8 players, save fixture', async ({ page }) => {
    const TEAM_BASE_NAME = `E2E Team ${Date.now()}`;
    let TEAM_NAME = TEAM_BASE_NAME;

    // ── 2.1 Create a new team ────────────────────────────────────────────────
    await page.goto('/teams');

    await page.getByRole('button', { name: 'New Team' }).click();
    await page.getByLabel('Name').fill(TEAM_BASE_NAME);
    await page.getByRole('button', { name: 'Create Team' }).click();

    // Confirm success toast (.first() avoids strict-mode with aria-live duplicate)
    await expect(page.getByText('Team created').first()).toBeVisible({ timeout: 5_000 });

    // Reload the page so the user's team memberships are refreshed.
    // Without reload, canManage() returns false and the Edit/Players buttons are hidden.
    await page.reload();
    // Wait for the New Team button to appear — page is ready when this is visible
    await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });

    // Search for the newly created team to verify it's in the list
    await searchTeam(page, TEAM_BASE_NAME);
    // Use getByRole('row') to target the desktop TABLE row (not the hidden mobile card h3)
    await expect(page.getByRole('row').filter({ hasText: TEAM_BASE_NAME })).toBeVisible({ timeout: 5_000 });

    // ── 2.2 Edit the team name ───────────────────────────────────────────────
    // Desktop table buttons: index 0=Eye, 1=Players, 2=Pencil(Edit), 3=Trash
    await page.getByRole('row').filter({ hasText: TEAM_BASE_NAME }).getByRole('button').nth(2).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });

    const nameField = page.getByLabel('Name');
    await nameField.clear();
    TEAM_NAME = `${TEAM_BASE_NAME} Renamed`;
    await nameField.fill(TEAM_NAME);

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Team updated').first()).toBeVisible({ timeout: 5_000 });
    // Brief pause for router.refresh() to complete (Next.js App Router background re-render)
    await page.waitForTimeout(500);

    // Search for the renamed team
    await searchTeam(page, TEAM_NAME);
    await expect(page.getByRole('row').filter({ hasText: TEAM_NAME })).toBeVisible({ timeout: 3_000 });

    // ── 2.3 Navigate to team players page ────────────────────────────────────
    // Players button is index 1 (Eye, Players, Pencil, Trash)
    await page.getByRole('row').filter({ hasText: TEAM_NAME }).getByRole('button').nth(1).click();
    await page.waitForURL(/\/teams\/.+\/players/, { timeout: 5_000 });

    // Add 8 players
    for (const player of PLAYERS) {
      await page.getByRole('button', { name: 'New Player' }).click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });

      await page.getByLabel('Name').fill(player.name);
      await page.getByLabel('Number').fill(String(player.number));

      // Position (Shadcn combobox)
      const positionSelect = page.getByRole('combobox', { name: 'Position' });
      if (await positionSelect.isVisible()) {
        await positionSelect.click();
        await page.getByRole('option', { name: POSITION_LABELS[player.position] }).click();
      }

      // Role (Shadcn combobox)
      const roleSelect = page.getByRole('combobox', { name: 'Role' });
      if (await roleSelect.isVisible()) {
        await roleSelect.click();
        await page.getByRole('option', { name: 'Player' }).click();
      }

      await page.getByRole('button', { name: 'Create Player' }).click();
      await expect(page.getByText('Player created').first()).toBeVisible({ timeout: 5_000 });
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
    }

    // Verify all 8 players are listed
    for (const player of PLAYERS) {
      await expect(page.getByText(player.name).first()).toBeVisible();
    }

    // ── 2.4 Save fixture for the matches test ────────────────────────────────
    const fixture = {
      teamName: TEAM_NAME,
      playerNames: PLAYERS.map((p) => p.name),
    };
    fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
    fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2), 'utf-8');
  });
});
