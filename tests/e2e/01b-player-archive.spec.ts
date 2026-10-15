/**
 * Archiving a player hides them from the roster; "Show archived" lists them; restoring brings them back.
 * Works on a team of its own (made by API, one per attempt so a CI retry starts clean, and it never touches
 * the run's team that other specs may be using at the same time).
 */
import { test, expect } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { createScratchTeam } from '../helpers/seed';

const PLAYER = 'Player 10';

test('archive and restore a player', async ({ page }, testInfo) => {
  const { runId } = readFixture();
  const teamId = await createScratchTeam(`E2E Team archive ${runId} ${testInfo.retry}`);
  await page.goto(`/teams/${teamId}/players`);

  // A second player
  await page.getByRole('button', { name: 'New Player' }).click();
  await page.getByLabel('Name').fill(PLAYER);
  await page.getByLabel('Number').fill('10');
  await page.getByRole('button', { name: 'Create Player' }).click();
  await expect(page.getByText('Player created').first()).toBeVisible({ timeout: 5_000 });
  const activeRow = page.getByTestId('player-row').filter({ hasText: PLAYER });
  await expect(activeRow).toBeVisible();

  // The creator's own membership row (role Owner) can't be archived
  const ownRows = page.getByTestId('player-row').filter({ hasText: 'Owner' });
  await expect(ownRows).not.toHaveCount(0);
  for (const ownRow of await ownRows.all()) {
    await expect(ownRow.getByRole('button', { name: /^Archive / })).toHaveCount(0);
  }

  // Archive: gone from the active list
  await page.getByRole('button', { name: `Archive ${PLAYER}` }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText(`Archive ${PLAYER}?`);
  await confirm.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Player archived').first()).toBeVisible({ timeout: 5_000 });
  await expect(activeRow).toHaveCount(0);

  // Show archived: this team's only archived member, listed with the badge and a Restore button
  await page.getByRole('button', { name: 'Show archived (1)' }).click();
  const archivedRow = page.getByTestId('archived-player-row').filter({ hasText: PLAYER });
  await expect(archivedRow).toContainText('Archived');

  // Restore: back in the active list
  await page.getByRole('button', { name: `Restore ${PLAYER}` }).click();
  await expect(page.getByText('Player restored').first()).toBeVisible({ timeout: 5_000 });
  await expect(activeRow).toBeVisible();

  // Archive again, and check the team page count leaves them out
  await page.getByRole('button', { name: `Archive ${PLAYER}` }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
  await expect(activeRow).toHaveCount(0);
  const activeCount = await page.getByTestId('player-row').count();
  await page.goto(`/teams/${teamId}`);
  await expect(page.getByText(`Team Members (${activeCount})`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('cell', { name: PLAYER, exact: true })).toHaveCount(0);
});
