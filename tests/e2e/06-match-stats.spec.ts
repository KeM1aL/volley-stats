/**
 * Match Statistics E2E tests
 *
 * 7.1  Load completedMatchStatsUrl from fixture
 * 7.2  Navigate directly to the stats page (URL includes ?team= param)
 * 7.3  Verify page heading and basic structure
 * 7.4  Verify player stats are visible (via Players tab)
 * 7.5  Verify Export PDF button is in the DOM (hidden at 768px by CSS)
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

function loadFixture(): {
  completedMatchStatsUrl?: string;
  playerNames?: string[];
  [key: string]: unknown;
} {
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw);
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
        page.getByText(playerNames[0], { exact: false })
      ).toBeVisible({ timeout: 10_000 });
    }

    // 7.5 Verify the Export PDF button is attached to the DOM.
    // The button has className="invisible lg:visible" — at 768px viewport it is
    // visibility:hidden (Tailwind `invisible`), which removes it from the ARIA tree.
    // Use a CSS-based locator rather than getByRole() to find it regardless of visibility.
    const exportPdfButton = page.locator('button').filter({ hasText: /export pdf/i });
    await expect(exportPdfButton).toBeAttached();

    // Also verify the Share button is visible (no visibility restriction on it)
    await expect(
      page.getByRole('button', { name: /share/i })
    ).toBeVisible();
  });
});
