import { test, expect } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { onPath } from '../helpers/routes';

test('old URLs redirect to the query-param routes, keeping their query @web', async ({ page }) => {
  const { teamId, completedMatchId } = readFixture();
  await page.goto(`/teams/${teamId}/players`);
  await expect(page).toHaveURL((url) => onPath('/teams/players')(url) && url.searchParams.get('id') === teamId);
  await page.goto(`/teams/${teamId}`);
  await expect(page).toHaveURL((url) => onPath('/teams/view')(url) && url.searchParams.get('id') === teamId);
  await page.goto('/teams/new');
  await expect(page).toHaveURL(onPath('/teams/new'));
  if (completedMatchId) {
    await page.goto(`/matches/${completedMatchId}/stats?team=${teamId}`);
    await expect(page).toHaveURL(
      (url) => onPath('/matches/stats')(url) && url.searchParams.get('id') === completedMatchId && url.searchParams.get('team') === teamId
    );
  }
});

test('a route without a valid id shows the not-found page', async ({ page }) => {
  for (const path of ['/matches/live', '/teams/view?id=abc']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/not found|404/i);
  }
});
