/**
 * Matches list: a match that never started is deleted for good; a played one is archived (out of the list
 * and the statistics), listed on demand with "Show archived" and restored. Each test works on a team of its
 * own, made by API, so the run's team that other specs use is never touched.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { createMatchByApi, createScratchTeam } from '../helpers/seed';
import { serverClient } from '../helpers/server-data';
import { adminClient } from '../helpers/throwaway-user';

/** The matches list filtered to this team (Filters > Team). */
async function openListFor(page: Page, teamName: string) {
  await page.goto('/matches');
  await expect(page.getByRole('heading', { name: 'Matches', level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Filters' }).click();
  const teamField = page.getByText('Team', { exact: true }).locator('xpath=following-sibling::*').getByRole('combobox');
  await teamField.click();
  await teamField.fill(teamName);
  await page.getByRole('option', { name: teamName, exact: true }).click();
}

/** The list renders a card per match for narrow screens and a table row for wide ones: only one is visible. */
function visibleRows(page: Page, testId: 'match-row' | 'archived-match-row') {
  return page.locator(`[data-testid="${testId}"]:visible`);
}

/** The win rate card reads "{wins} wins out of {total} matches" (statistics count the matches that are not archived). */
async function expectWinStats(page: Page, wins: number, total: number) {
  await expect(page.getByText(`${wins} wins out of ${total} matches`)).toBeVisible();
}

test('delete a match that never started', async ({ page }, testInfo) => {
  const { runId } = readFixture();
  const teamName = `E2E Team match-delete ${runId} ${testInfo.retry}`;
  const teamId = await createScratchTeam(teamName);
  const matchId = await createMatchByApi(teamId);

  await openListFor(page, teamName);
  await expect(visibleRows(page, 'match-row')).toHaveCount(1, { timeout: 30_000 });

  await page.getByRole('button', { name: /^Delete match / }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText('Delete this match?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(page.getByText('Match deleted').first()).toBeVisible({ timeout: 10_000 });
  await expect(visibleRows(page, 'match-row')).toHaveCount(0);
  // Deleted, not archived
  await expect(page.getByText(/Show archived/)).toHaveCount(0);
  const { data } = await adminClient().from('matches').select('id').eq('id', matchId);
  expect(data).toEqual([]);
});

test('archive and restore a played match', async ({ page }, testInfo) => {
  const { runId } = readFixture();
  const teamName = `E2E Team match-archive ${runId} ${testInfo.retry}`;
  const teamId = await createScratchTeam(teamName);
  const matchId = await createMatchByApi(teamId);
  const supabase = await serverClient();
  const { error } = await supabase
    .from('matches')
    .update({ status: 'completed', home_score: 3, away_score: 0 })
    .eq('id', matchId);
  expect(error).toBeNull();

  await openListFor(page, teamName);
  await expect(visibleRows(page, 'match-row')).toHaveCount(1, { timeout: 30_000 });
  await expectWinStats(page, 1, 1);

  // Archive: gone from the list and from the statistics
  await page.getByRole('button', { name: /^Archive match / }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText('Archive this match?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByText('Match archived').first()).toBeVisible({ timeout: 10_000 });
  await expect(visibleRows(page, 'match-row')).toHaveCount(0);
  await expectWinStats(page, 0, 0);

  // Listed on demand, marked, and still out of the statistics
  await page.getByRole('switch', { name: 'Show archived (1)' }).click();
  const archivedRow = visibleRows(page, 'archived-match-row');
  await expect(archivedRow).toHaveCount(1);
  await expect(archivedRow.getByText('Archived', { exact: true })).toBeVisible();
  await expectWinStats(page, 0, 0);

  // Restore: back in the list and in the statistics
  await archivedRow.getByRole('button', { name: /^Restore match / }).click();
  await expect(page.getByText('Match restored').first()).toBeVisible({ timeout: 10_000 });
  await expect(visibleRows(page, 'archived-match-row')).toHaveCount(0);
  await page.getByRole('switch', { name: 'Show archived (0)' }).click();
  await expect(visibleRows(page, 'match-row')).toHaveCount(1);
  await expectWinStats(page, 1, 1);
});
