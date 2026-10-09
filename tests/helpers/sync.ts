import { expect, type Page } from '@playwright/test';
import { fetchServerMatch } from './server-data';

export interface LiveScore {
  setId: string;
  home: number;
  away: number;
}

/** The score the live page shows for its current set. */
export async function readLiveScore(page: Page): Promise<LiveScore> {
  const element = page.getByTestId('live-score');
  return {
    setId: (await element.getAttribute('data-set-id'))!,
    home: Number(await element.getAttribute('data-home')),
    away: Number(await element.getAttribute('data-away')),
  };
}

export async function waitForAllSaved(page: Page, timeout = 60_000): Promise<void> {
  await expect(page.getByTestId('sync-badge').first()).toHaveAttribute('data-state', 'saved', { timeout });
}

/** The server's set has the score the device shows, and exactly that many live points. */
export async function expectServerMatchesLiveScore(matchId: string, score: LiveScore, timeout = 60_000): Promise<void> {
  await expect
    .poll(
      async () => {
        const server = await fetchServerMatch(matchId);
        const set = server.sets.find((row) => row.id === score.setId);
        return {
          home: set?.home_score ?? null,
          away: set?.away_score ?? null,
          points: server.points.filter((row) => row.set_id === score.setId).length,
        };
      },
      { timeout, intervals: [1000, 2000, 5000] }
    )
    .toEqual({ home: score.home, away: score.away, points: score.home + score.away });
}

/** A live page opened in another browser context asks before taking over scoring. */
export async function takeOverScoringIfAsked(page: Page): Promise<void> {
  const dialog = page.getByTestId('scorer-claim-dialog');
  const asked = await dialog.waitFor({ state: 'visible', timeout: 5_000 }).then(
    () => true,
    () => false
  );
  if (asked) await dialog.getByRole('button', { name: /take over scoring|score on this device/i }).click();
}

/** Reloads with unsent changes trigger the leave-page prompt: accept it. */
export function acceptBeforeUnload(page: Page): void {
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'beforeunload') void dialog.accept();
  });
}
