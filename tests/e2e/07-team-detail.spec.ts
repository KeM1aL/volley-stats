/**
 * Team detail view
 *
 * 7.1 View the team detail page and verify key sections
 * The data the specs created is removed by tests/global-teardown.ts.
 */

import { test, expect, Page } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { onPath } from '../helpers/routes';
import { createMatchByApi, createScratchTeam } from '../helpers/seed';
import { routes } from '@/lib/routes';

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

    // Should navigate to /teams/view?id=<uuid> (NOT /teams/players)
    await page.waitForURL(onPath('/teams/view'), { timeout: 5_000 });

    // Team name appears in the page heading
    await expect(page.getByRole('heading', { name: teamName })).toBeVisible({ timeout: 5_000 });

    // "Recent Matches" card title (translated key: details.recentMatches)
    await expect(page.getByText('Recent Matches').first()).toBeVisible({ timeout: 5_000 });

    // "Team Members" section heading (includes member count, e.g. "Team Members (8)")
    await expect(page.getByText(/Team Members/i).first()).toBeVisible({ timeout: 5_000 });

    // At least the first player name should be listed in the members table
    await expect(page.getByText(playerNames[0]).first()).toBeVisible({ timeout: 5_000 });
  });

  // A team with a match can't be deleted (foreign keys); it is archived instead, and can be restored.
  test('archive and restore a team', async ({ page }, testInfo) => {
    const { runId } = readFixture();
    const teamName = `E2E Team to archive ${runId} ${testInfo.retry}`;
    const teamId = await createScratchTeam(teamName);
    await createMatchByApi(teamId);

    await page.goto(routes.teams());
    await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });
    await searchTeam(page, teamName);

    // Archive: gone from the default (active) list
    await page.getByRole('button', { name: `Archive ${teamName}` }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText(`Archive ${teamName}?`);
    await confirm.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText('Team archived').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('row').filter({ hasText: teamName })).toHaveCount(0);

    // Archived status filter: it is back
    await page.locator('.react-select__control').filter({ hasText: 'Active' }).click();
    await page.getByRole('option', { name: 'Archived' }).click();
    const row = page.getByRole('row').filter({ hasText: teamName });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText('Archived');

    // Restore: edit it and set the status back to Active
    await row.getByRole('button').nth(2).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('.react-select__control').filter({ hasText: 'Archived' }).click();
    await page.getByRole('option', { name: 'Active' }).click();
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Team updated').first()).toBeVisible({ timeout: 5_000 });

    // Clear the status filter: it is listed
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('row').filter({ hasText: teamName })).toBeVisible({ timeout: 10_000 });
  });
});
