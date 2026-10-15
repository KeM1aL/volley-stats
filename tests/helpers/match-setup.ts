import { expect, Page } from '@playwright/test';
import { createMatchByApi } from './seed';

export interface CreateAndStartMatchOptions {
  teamId: string;
  teamName: string;
  /** Players left unticked in the start dialog (e.g. a player who arrives late). */
  excludePlayers?: string[];
  /** Players the start dialog must not offer (archived). */
  absentPlayers?: string[];
}

export interface CreateAndStartMatchResult {
  matchId: string;
  /** How many players were ticked: the roster size. */
  selectedPlayers: number;
}

/** Creates an upcoming match by API, starts it through the start dialog, and waits for the live page. */
export async function createAndStartMatch(page: Page, options: CreateAndStartMatchOptions): Promise<CreateAndStartMatchResult> {
  const { teamId, teamName, excludePlayers = [], absentPlayers = [] } = options;
  const matchId = await createMatchByApi(teamId);

  await page.goto('/matches');
  await expect(page.getByRole('heading', { name: 'Matches', level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Filters' }).click();
  // Combobox order on the matches page: 0=Championship, 1=Club, 2=Team
  await page.getByRole('combobox').nth(2).click();
  await page.getByRole('option', { name: new RegExp(teamName, 'i') }).click();

  // Two triggers per match (mobile card + desktop table); at 768 px the desktop one is visible.
  await page.locator(`[data-testid="start-match-trigger"][data-match-id="${matchId}"]`).last().click();
  const dialog = page.getByRole('dialog', { name: 'Start Match' });
  await expect(dialog).toBeVisible();

  // Managed team: the home team (first radio). The radio input is sr-only under a styled div.
  await dialog.getByRole('radio').first().click({ force: true });
  const toggles = dialog.getByTestId('lineup-player-toggle');
  await expect(toggles.first()).toBeVisible({ timeout: 10_000 });
  for (const name of absentPlayers) {
    await expect(dialog.locator(`[data-testid="lineup-player-toggle"][data-player-name="${name}"]`)).toHaveCount(0);
  }
  let selectedPlayers = 0;
  for (const toggle of await toggles.all()) {
    if (excludePlayers.includes((await toggle.getAttribute('data-player-name')) ?? '')) continue;
    await toggle.click();
    selectedPlayers++;
    await expect(dialog.getByTestId('lineup-selected-count')).toHaveText(new RegExp(`^${selectedPlayers} selected`));
  }

  await dialog.getByTestId('start-match-confirm').click();
  await page.waitForURL((url) => url.searchParams.get('id') === matchId || url.pathname.includes(`/matches/${matchId}/live`), { timeout: 15_000 });
  return { matchId, selectedPlayers };
}
