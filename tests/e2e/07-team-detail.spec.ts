/**
 * Team detail view
 *
 * 7.1 View the team detail page and verify key sections
 * The data the specs created is removed by tests/global-teardown.ts.
 */

import { test, expect, Page } from '@playwright/test';
import { readFixture } from '../helpers/fixture';

/** Opens the filter panel (if needed), searches for teamName and waits for its row in the desktop table. */
async function searchTeam(page: Page, teamName: string) {
  const searchBox = page.getByPlaceholder('Search by team name...');
  if (!(await searchBox.isVisible())) {
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(searchBox).toBeVisible({ timeout: 10_000 });
  }
  await searchBox.fill(teamName);
  await expect(page.getByRole('row').filter({ hasText: teamName })).toBeVisible();
}

test.describe('Team detail', () => {
  test('view team detail page', async ({ page }) => {
    const { teamName, playerNames } = readFixture();

    await page.goto('/teams');
    // Wait for the page to be ready
    await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });

    await searchTeam(page, teamName);

    const teamRow = page.getByRole('row').filter({ hasText: teamName });

    // Click the Eye (View) button — index 0 in the Actions column
    await teamRow.getByRole('button').nth(0).click();

    // Should navigate to /teams/<uuid> (NOT /players)
    await page.waitForURL(/\/teams\/[a-f0-9-]+$/, { timeout: 5_000 });

    // Team name appears in the page heading
    await expect(page.getByRole('heading', { name: teamName })).toBeVisible({ timeout: 5_000 });

    // "Recent Matches" card title (translated key: details.recentMatches)
    await expect(page.getByText('Recent Matches').first()).toBeVisible({ timeout: 5_000 });

    // "Team Members" section heading (includes member count, e.g. "Team Members (8)")
    await expect(page.getByText(/Team Members/i).first()).toBeVisible({ timeout: 5_000 });

    // At least the first player name should be listed in the members table
    await expect(page.getByText(playerNames[0]).first()).toBeVisible({ timeout: 5_000 });
  });
});
