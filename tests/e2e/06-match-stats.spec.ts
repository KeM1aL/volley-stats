/**
 * Match Statistics E2E tests
 *
 * 7.1  Build the stats URL from completedMatchId in the fixture
 * 7.2  Navigate directly to the stats page (URL includes ?team= param)
 * 7.3  Verify page heading and basic structure
 * 7.4  Verify player stats are visible (via Players tab)
 * 7.5  Export the report PDF; the route refuses callers without a session
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import { readFixture } from '../helpers/fixture';
import { routes } from '@/lib/routes';
import { routeId } from '../helpers/routes';

/** The finished match written by the finished-match project (02-matches), with its stats URL (?team= included). */
function loadFixture() {
  const { completedMatchId, teamId, playerNames } = readFixture();
  return {
    completedMatchStatsUrl: completedMatchId ? routes.matchStats(completedMatchId, { team: teamId }) : undefined,
    playerNames,
  };
}

test.describe('Match Statistics', () => {
  test('view post-match statistics page', async ({ page }) => {
    const { completedMatchStatsUrl, playerNames } = loadFixture();

    // 7.1 Require the fixture URL written by 02-matches.spec.ts
    expect(
      completedMatchStatsUrl,
      'completedMatchStatsUrl not found in fixture — run 02-matches.spec.ts first'
    ).toBeTruthy();

    // 7.2 Navigate to the stats page (full URL already contains ?team= param)
    await page.goto(completedMatchStatsUrl!);
    await page.waitForLoadState('domcontentloaded');

    // 7.3 Verify "Match Statistics" h1 is visible
    await expect(
      page.getByRole('heading', { name: 'Match Statistics', level: 1 })
    ).toBeVisible({ timeout: 15_000 });

    // 7.3 Verify the tab list is present (overview / score progression / set breakdown / player performance / team performance)
    const tabList = page.getByRole('tablist');
    await expect(tabList).toBeVisible({ timeout: 10_000 });

    // Verify the default "Match Overview" tab is active
    await expect(
      page.getByRole('tab', { name: 'Match Overview' })
    ).toBeVisible();

    // 7.3 Verify at least one stats-related section is visible (overview tab content)
    // The overview tab renders inside id="overview-section"
    const overviewSection = page.locator('#overview-section');
    await expect(overviewSection).toBeVisible({ timeout: 10_000 });

    // 7.4 Navigate to the "Player Performance" tab and verify a player name appears
    await page.getByRole('tab', { name: 'Player Performance' }).click();

    if (playerNames && playerNames.length > 0) {
      // The player performance panel shows player names in tables/cards
      await expect(
        page.getByText(playerNames[0], { exact: false }).first()
      ).toBeVisible({ timeout: 10_000 });
    }

    // 7.5 The test user created the team, so the report export is offered; it downloads a PDF.
    const exportPdfButton = page.getByRole('button', { name: /export pdf/i });
    await expect(exportPdfButton).toBeEnabled({ timeout: 15_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), exportPdfButton.click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const downloaded = await download.path();
    expect(fs.readFileSync(downloaded!).subarray(0, 4).toString()).toBe('%PDF');

    // Also verify the Share button is visible
    await expect(page.getByRole('button', { name: /share/i })).toBeVisible();
  });

  test('signed-out visitors get no export, and the report route refuses them', async ({ browser, playwright, baseURL }) => {
    const { completedMatchStatsUrl } = loadFixture();
    expect(completedMatchStatsUrl).toBeTruthy();
    const statsUrl = new URL(completedMatchStatsUrl!, baseURL);
    const matchId = routeId(statsUrl.toString());
    const teamId = statsUrl.searchParams.get('team');

    // The stats page stays public, without the export button.
    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(statsUrl.toString());
    await expect(visitorPage.getByRole('heading', { name: 'Match Statistics', level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(visitorPage.getByRole('button', { name: /export pdf/i })).toHaveCount(0);
    await visitor.close();

    const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const path = `/api/v1/matches/${matchId}/report?team=${teamId}`;
    expect((await anonymous.get(path, { maxRedirects: 0 })).status()).toBe(401);
    expect((await anonymous.get(path, { maxRedirects: 0, headers: { Authorization: 'Bearer not-a-token' } })).status()).toBe(401);
    await anonymous.dispose();
  });
});

test.describe('Match Statistics — logged out', () => {
  // A visitor with no session cookies must still reach the public stats page.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('stats page is reachable without signing in', async ({ page }) => {
    const { completedMatchStatsUrl } = loadFixture();
    expect(
      completedMatchStatsUrl,
      'completedMatchStatsUrl not found in fixture — run 02-matches.spec.ts first'
    ).toBeTruthy();

    await page.goto(completedMatchStatsUrl!);
    await page.waitForLoadState('domcontentloaded');

    await expect(page).not.toHaveURL(/\/auth/);
    await expect(page.getByRole('heading', { name: 'Match Statistics', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe('Match Statistics — PDF export', () => {
  // Desktop viewport.
  test.use({ viewport: { width: 1440, height: 900 } });

  test('exports the statistics as a PDF', async ({ page }) => {
    test.setTimeout(3 * 60_000);
    const { completedMatchStatsUrl } = loadFixture();
    expect(
      completedMatchStatsUrl,
      'completedMatchStatsUrl not found in fixture — run 02-matches.spec.ts first'
    ).toBeTruthy();

    await page.goto(completedMatchStatsUrl!);
    await expect(page.getByRole('heading', { name: 'Match Statistics', level: 1 })).toBeVisible({
      timeout: 30_000,
    });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 120_000 }),
      page.getByRole('button', { name: /export pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const file = await download.path();
    const header = fs.readFileSync(file).subarray(0, 5).toString();
    expect(header).toBe('%PDF-');
  });
});
