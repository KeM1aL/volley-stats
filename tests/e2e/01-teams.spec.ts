/**
 * Teams E2E test: create a team, rename it, add one player.
 *
 * The run's team (8 players, one archived) is seeded by API (see tests/helpers/seed.ts); this spec only
 * covers the team and player forms, on a team of its own that the global teardown deletes.
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Types the team name in the filter panel's search box (opening the panel when it is closed) and waits
 * for the team's row. Explicit search avoids the "initialFilters" re-application that occurs on every
 * page mount (which pre-fills the search with the user's favourite team name).
 */
async function searchTeam(page: Page, teamName: string) {
  const searchBox = page.getByPlaceholder('Search by team name...');
  if (!(await searchBox.isVisible())) {
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(searchBox).toBeVisible({ timeout: 10_000 });
  }
  await searchBox.fill(teamName);
  // Use getByRole('row') to target the desktop TABLE row (not the hidden mobile card h3)
  await expect(page.getByRole('row').filter({ hasText: teamName })).toBeVisible();
}

test.describe('Teams management', () => {
  test('create team, rename it, add a player', async ({ page }) => {
    const baseName = `E2E Team ${Date.now()} UI`;
    const renamed = `${baseName} Renamed`;

    // Create a new team
    await page.goto('/teams');
    await page.getByRole('button', { name: 'New Team' }).click();
    await page.getByLabel('Name').fill(baseName);
    await page.getByRole('button', { name: 'Create Team' }).click();
    // .first() avoids strict-mode with the aria-live duplicate
    await expect(page.getByText('Team created').first()).toBeVisible({ timeout: 5_000 });

    // Reload so the user's team memberships are refreshed; without it canManage() is false and the
    // Edit/Players buttons are hidden.
    await page.reload();
    await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });
    await searchTeam(page, baseName);

    // Rename it. Desktop table buttons: 0=Eye, 1=Players, 2=Edit, 3=Delete
    await page.getByRole('row').filter({ hasText: baseName }).getByRole('button').nth(2).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });
    const nameField = page.getByLabel('Name');
    await nameField.clear();
    await nameField.fill(renamed);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Team updated').first()).toBeVisible({ timeout: 5_000 });
    await searchTeam(page, renamed);

    // Players page: add Player 1, a setter
    await page.getByRole('row').filter({ hasText: renamed }).getByRole('button').nth(1).click();
    await page.waitForURL(/\/teams\/.+\/players/, { timeout: 5_000 });
    await page.getByRole('button', { name: 'New Player' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3_000 });
    await page.getByLabel('Name').fill('Player 1');
    await page.getByLabel('Number').fill('1');
    await page.getByRole('combobox', { name: 'Position' }).click();
    await page.getByRole('option', { name: 'Setter' }).click();
    await page.getByRole('combobox', { name: 'Role' }).click();
    await page.getByRole('option', { name: 'Player' }).click();
    await page.getByRole('button', { name: 'Create Player' }).click();
    await expect(page.getByText('Player created').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId('player-row').filter({ hasText: 'Player 1' })).toBeVisible();
  });
});
