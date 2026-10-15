/**
 * Archiving a player hides them from the roster; "Show archived" lists them; restoring brings them back.
 * Works on an extra "Player 10" of the run's team; the seed already holds the archived "Player 9" that the
 * start dialog (02) and the late-player picker (04h) must not offer.
 */
import { test, expect } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { serverClient } from '../helpers/server-data';

const PLAYER = 'Player 10';

test('archive and restore a player', async ({ page }) => {
  const { teamId } = readFixture();
  await page.goto(`/teams/${teamId}/players`);

  try {
    // A tenth player
    await page.getByRole('button', { name: 'New Player' }).click();
    await page.getByLabel('Name').fill(PLAYER);
    await page.getByLabel('Number').fill('10');
    await page.getByRole('button', { name: 'Create Player' }).click();
    await expect(page.getByText('Player created').first()).toBeVisible({ timeout: 5_000 });
    const activeRow = page.getByTestId('player-row').filter({ hasText: PLAYER });
    await expect(activeRow).toBeVisible();

    // The creator's own membership row (role Owner) can't be archived
    for (const ownRow of await page.getByTestId('player-row').filter({ hasText: 'Owner' }).all()) {
      await expect(ownRow.getByRole('button', { name: /^Archive / })).toHaveCount(0);
    }

    // Archive: gone from the active list
    await page.getByRole('button', { name: `Archive ${PLAYER}` }).click();
    const confirm = page.getByRole('alertdialog');
    await expect(confirm).toContainText(`Archive ${PLAYER}?`);
    await confirm.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText('Player archived').first()).toBeVisible({ timeout: 5_000 });
    await expect(activeRow).toHaveCount(0);

    // Show archived: listed with the badge and a Restore button. The seed's archived Player 9 and this
    // Player 10 are the two archived members.
    await page.getByRole('button', { name: 'Show archived (2)' }).click();
    const archivedRow = page.getByTestId('archived-player-row').filter({ hasText: PLAYER });
    await expect(archivedRow).toContainText('Archived');

    // Restore: back in the active list
    await page.getByRole('button', { name: `Restore ${PLAYER}` }).click();
    await expect(page.getByText('Player restored').first()).toBeVisible({ timeout: 5_000 });
    await expect(activeRow).toBeVisible();

    // Archive again for the next specs, and check the team page count leaves them out
    await page.getByRole('button', { name: `Archive ${PLAYER}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
    await expect(activeRow).toHaveCount(0);
    const activeCount = await page.getByTestId('player-row').count();
    await page.goto(`/teams/${teamId}`);
    await expect(page.getByText(`Team Members (${activeCount})`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('cell', { name: PLAYER, exact: true })).toHaveCount(0);
  } finally {
    // Whatever failed above, Player 10 must not stay active: 02 would tick it and 04h would not find it late.
    const supabase = await serverClient();
    const { error } = await supabase
      .from('team_members')
      .update({ archived_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('name', PLAYER)
      .is('archived_at', null);
    if (error) throw new Error(`could not archive ${PLAYER}: ${error.message}`);
  }
});
