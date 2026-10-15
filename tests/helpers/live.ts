import { expect, type Page } from '@playwright/test';

/**
 * Scores `count` points for the managed team, waiting for each to show on the scoreboard.
 * With `mayEndSet`, the point that wins the set (or the match) counts as shown once the set setup or the
 * match summary is on screen: the scoreboard is replaced then.
 */
export async function scorePoints(page: Page, count: number, options: { mayEndSet?: boolean } = {}): Promise<void> {
  const button = page.getByTestId('point-btn-managed-point').first();
  const score = page.getByTestId('live-score');
  const ended = page.getByTestId('set-setup').first().or(page.getByRole('button', { name: 'Match Statistics' }).first());
  for (let i = 0; i < count; i++) {
    const before = Number(await score.getAttribute('data-home'));
    await button.click();
    if (!options.mayEndSet) {
      await expect(score).toHaveAttribute('data-home', String(before + 1));
      continue;
    }
    await expect(async () => {
      if (await ended.isVisible()) return;
      expect(await score.getAttribute('data-home', { timeout: 1_000 })).toBe(String(before + 1));
    }).toPass({ timeout: 15_000 });
  }
}
