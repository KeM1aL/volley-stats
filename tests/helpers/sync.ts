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

/**
 * The server's rows of the match are consistent with each other and with what the device shows:
 * every set's score is the highest running score of its live points (and their count), and the set the
 * device is on has the score it shows. Pass the page showing the live match, or a score read from it earlier.
 */
export async function expectServerMatchesDevice(device: Page | LiveScore, matchId: string, timeout = 60_000): Promise<void> {
  const live = 'home' in device ? device : await readLiveScore(device);
  await expect
    .poll(
      async () => {
        const server = await fetchServerMatch(matchId);
        const problems: string[] = [];
        for (const set of server.sets) {
          const points = server.points.filter((row) => row.set_id === set.id);
          const home = Math.max(0, ...points.map((row) => row.home_score));
          const away = Math.max(0, ...points.map((row) => row.away_score));
          const label = `set ${set.set_number}`;
          if (set.home_score !== home || set.away_score !== away) {
            problems.push(`${label}: score ${set.home_score}-${set.away_score}, its points say ${home}-${away}`);
          }
          if (points.length !== home + away) problems.push(`${label}: ${points.length} points for ${home}-${away}`);
        }
        const current = server.sets.find((row) => row.id === live.setId);
        if (!current) problems.push('the set shown on the device is not on the server');
        else if (current.home_score !== live.home || current.away_score !== live.away) {
          problems.push(`current set: server ${current.home_score}-${current.away_score}, device ${live.home}-${live.away}`);
        }
        return problems;
      },
      { timeout, intervals: [1000, 2000, 5000] }
    )
    .toEqual([]);
}

/** Fails if the server's set stops matching the score within `windowMs` (for a change that must never arrive). */
export async function expectServerStaysAt(matchId: string, score: LiveScore, windowMs = 5_000): Promise<void> {
  const deadline = Date.now() + windowMs;
  do {
    const server = await fetchServerMatch(matchId);
    const set = server.sets.find((row) => row.id === score.setId);
    expect(
      {
        home: set?.home_score ?? null,
        away: set?.away_score ?? null,
        points: server.points.filter((row) => row.set_id === score.setId).length,
      },
      'the server changed although nothing more should arrive'
    ).toEqual({ home: score.home, away: score.away, points: score.home + score.away });
    await new Promise((resolve) => setTimeout(resolve, 500));
  } while (Date.now() < deadline);
}

/**
 * A live page opened in another browser context either asks before taking over scoring or goes
 * straight to the live view (scoring controls, set setup, or the summary of a finished match).
 * Waits up to 20 s for whichever appears first and clicks only the dialog. Nothing appearing is not
 * an error here: the caller's own assertions say what it expected.
 */
export async function takeOverScoringIfAsked(page: Page): Promise<void> {
  const dialog = page.getByTestId('scorer-claim-dialog');
  const live = page
    .getByTestId('point-btn-managed-point')
    .first()
    .or(page.getByTestId('set-setup').first())
    .or(page.getByText('Match MVP Analysis').first())
    .or(page.getByRole('button', { name: 'Match Statistics' }).first());
  const appeared = await dialog
    .or(live)
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .then(
      () => true,
      () => false
    );
  if (appeared && (await dialog.isVisible())) {
    await dialog.getByRole('button', { name: /take over scoring|score on this device/i }).click();
    await expect(dialog).toBeHidden();
  }
}

/** Reloads with unsent changes trigger the leave-page prompt: accept it. Any other dialog is dismissed so it cannot hang a test. */
export function acceptBeforeUnload(page: Page): void {
  page.on('dialog', (dialog) => {
    void (dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss()).catch(() => undefined);
  });
}
