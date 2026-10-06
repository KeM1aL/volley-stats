/**
 * Before/after screenshots for visual upgrades (Tailwind, UI libraries).
 * Skipped unless SCREENSHOT_LABEL is set.
 * Output: playwright/screens/<label>/ (git-ignored and, unlike test-results/,
 * not wiped by each run).
 */
import { test, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LABEL = process.env.SCREENSHOT_LABEL;
const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const OUT_DIR = path.join(__dirname, '../../playwright/screens', LABEL ?? 'unused');

function loadFixture(): Record<string, string | undefined> {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

async function shoot(page: Page, name: string) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1_500); // let data and animations settle
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

test.describe('Screenshots', () => {
  test.skip(!LABEL, 'Set SCREENSHOT_LABEL to capture screenshots');

  for (const theme of ['light', 'dark'] as const) {
    test(`main screens (${theme})`, async ({ page }) => {
      test.setTimeout(3 * 60_000);
      await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
      const fixture = loadFixture();

      const pages: [string, string | undefined][] = [
        ['home', '/'],
        ['teams', '/teams'],
        ['matches', '/matches'],
        ['match-stats', fixture.completedMatchStatsUrl],
        ['live-match', fixture.offlineMatchLiveUrl],
        ['championships', '/championships'],
        [
          'championship-detail',
          fixture.championshipId ? `/championships/${fixture.championshipId}` : undefined,
        ],
        ['settings', '/settings'],
      ];
      for (const [name, url] of pages) {
        if (!url) continue;
        await page.goto(url);
        await shoot(page, `${theme}-${name}`);
      }

      // Date range picker popover (react-day-picker) behind the matches filters.
      await page.goto('/matches');
      await page.getByRole('button', { name: 'Filters' }).click();
      const dateButton = page.locator('#date').first();
      if (await dateButton.isVisible().catch(() => false)) {
        await dateButton.click();
        await shoot(page, `${theme}-date-picker`);
      }
    });
  }
});
