import { expect, type Page } from '@playwright/test';

/** Scores `count` points for the managed team, waiting for each to show on the scoreboard. */
export async function scorePoints(page: Page, count: number): Promise<void> {
  const button = page.getByTestId('point-btn-managed-point').first();
  const score = page.getByTestId('live-score');
  for (let i = 0; i < count; i++) {
    const before = Number(await score.getAttribute('data-home'));
    await button.click();
    await expect(score).toHaveAttribute('data-home', String(before + 1));
  }
}
