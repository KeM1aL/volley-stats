/**
 * Team detail view + E2E data teardown
 *
 * 7.1 View the team detail page and verify key sections
 * 7.2 Delete the E2E team and reset the shared fixture to {}
 *
 * This is the LAST spec in the suite. It cleans up all data created
 * by 01-teams.spec.ts so that subsequent runs start fresh.
 */

import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

function loadFixture(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

/**
 * Open the filter panel (if needed) and search for teamName,
 * waiting for the 500 ms input debounce to fire.
 */
async function searchTeam(page: Page, teamName: string) {
  const searchBox = page.getByPlaceholder('Search by team name...');
  const isVisible = await searchBox.isVisible().catch(() => false);
  if (!isVisible) {
    await page.getByRole('button', { name: 'Filters' }).click();
    await searchBox.waitFor({ state: 'visible', timeout: 10_000 });
  }
  await searchBox.clear();
  await searchBox.fill(teamName);
  await page.waitForTimeout(600); // 500 ms debounce + margin
}

test.describe('Team detail and cleanup', () => {
  test('view team detail page', async ({ page }) => {
    // Load fixture written by 01-teams.spec.ts
    const { teamName, playerNames } = loadFixture() as {
      teamName: string;
      playerNames: string[];
    };

    await page.goto('/teams');
    // Wait for the page to be ready
    await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });

    await searchTeam(page, teamName);

    // Wait for the team row to appear in the desktop table
    const teamRow = page.getByRole('row').filter({ hasText: teamName });
    await expect(teamRow).toBeVisible({ timeout: 5_000 });

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

  test('delete E2E team (cleanup)', async ({ page }) => {
    const { teamName } = loadFixture() as { teamName: string };

    await page.goto('/teams');
    await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });

    await searchTeam(page, teamName);

    // Wait for the team row to appear
    const teamRow = page.getByRole('row').filter({ hasText: teamName });
    await expect(teamRow).toBeVisible({ timeout: 5_000 });

    // Click the Trash (Delete) button — index 3 in the Actions column
    await teamRow.getByRole('button').nth(3).click();

    // AlertDialog appears with title "Are you sure?"
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3_000 });

    // Click the confirm/delete button (translated via common actions.delete → "Delete")
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    // Wait for the success toast ("Team deleted")
    await expect(page.getByText('Team deleted').first()).toBeVisible({ timeout: 5_000 });

    // Team should no longer appear in the filtered list
    await searchTeam(page, teamName);
    await expect(page.getByRole('row').filter({ hasText: teamName })).not.toBeVisible({ timeout: 5_000 });

    // Reset fixture so next run starts with an empty slate
    fs.writeFileSync(FIXTURE_PATH, JSON.stringify({}, null, 2), 'utf-8');
  });
});
