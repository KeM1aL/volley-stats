/**
 * Archiving a player hides them from the roster; "Show archived" lists them; restoring brings them back.
 * Leaves "Player 9" archived for the specs that follow (02 checks the start dialog, 04h the late-player picker).
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const ARCHIVED = 'Player 9';

function loadFixture(): { teamName: string; [key: string]: unknown } {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

function saveFixture(data: Record<string, unknown>): void {
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify({ ...loadFixture(), ...data }, null, 2));
}

async function openPlayersPage(page: Page, teamName: string): Promise<string> {
  await page.goto('/teams');
  await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });
  const searchBox = page.getByPlaceholder('Search by team name...');
  if (!(await searchBox.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Filters' }).click();
    await searchBox.waitFor({ state: 'visible', timeout: 10_000 });
  }
  await searchBox.fill(teamName);
  await page.waitForTimeout(600); // 500 ms search debounce
  // Desktop table buttons: 0=Eye, 1=Players, 2=Edit, 3=Delete
  await page.getByRole('row').filter({ hasText: teamName }).getByRole('button').nth(1).click();
  await page.waitForURL(/\/teams\/.+\/players/, { timeout: 10_000 });
  return page.url().match(/\/teams\/([^/]+)\/players/)![1];
}

test('archive and restore a player', async ({ page }) => {
  const { teamName } = loadFixture();
  expect(teamName, 'Team fixture not found — run 01-teams.spec.ts first').toBeTruthy();
  const teamId = await openPlayersPage(page, teamName);

  // A ninth player
  await page.getByRole('button', { name: 'New Player' }).click();
  await page.getByLabel('Name').fill(ARCHIVED);
  await page.getByLabel('Number').fill('9');
  await page.getByRole('button', { name: 'Create Player' }).click();
  await expect(page.getByText('Player created').first()).toBeVisible({ timeout: 5_000 });
  const activeRow = page.getByTestId('player-row').filter({ hasText: ARCHIVED });
  await expect(activeRow).toBeVisible();

  // The creator's own membership row (role Owner) can't be archived
  for (const ownRow of await page.getByTestId('player-row').filter({ hasText: 'Owner' }).all()) {
    await expect(ownRow.getByRole('button', { name: /^Archive / })).toHaveCount(0);
  }

  // Archive: gone from the active list
  await page.getByRole('button', { name: `Archive ${ARCHIVED}` }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText(`Archive ${ARCHIVED}?`);
  await confirm.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Player archived').first()).toBeVisible({ timeout: 5_000 });
  await expect(activeRow).toHaveCount(0);

  // Show archived: listed with the badge and a Restore button
  await page.getByRole('button', { name: 'Show archived (1)' }).click();
  const archivedRow = page.getByTestId('archived-player-row').filter({ hasText: ARCHIVED });
  await expect(archivedRow).toContainText('Archived');

  // Restore: back in the active list
  await page.getByRole('button', { name: `Restore ${ARCHIVED}` }).click();
  await expect(page.getByText('Player restored').first()).toBeVisible({ timeout: 5_000 });
  await expect(activeRow).toBeVisible();

  // Archive again for the next specs, and check the team page count leaves them out
  await page.getByRole('button', { name: `Archive ${ARCHIVED}` }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
  await expect(activeRow).toHaveCount(0);
  const activeCount = await page.getByTestId('player-row').count();
  await page.goto(`/teams/${teamId}`);
  await expect(page.getByText(`Team Members (${activeCount})`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('cell', { name: ARCHIVED, exact: true })).toHaveCount(0);

  saveFixture({ archivedPlayerName: ARCHIVED });
});
