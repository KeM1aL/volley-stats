import { Page } from '@playwright/test';

export interface CreateAndStartMatchOptions {
  teamName: string;
  playerNames: string[];
  awayTeamName?: string;  // defaults to 'Team 1'
  formatName?: string;    // defaults to 'Test (6x6)'
}

export interface CreateAndStartMatchResult {
  matchId: string;
}

/**
 * Creates a new match and navigates to the live match page.
 *
 * Steps performed:
 * 1. Navigate to /matches
 * 2. Open Filters, set Team filter to teamName (combobox index 2)
 * 3. Click "New Match", fill the dialog (HomeTeam=teamName, AwayTeam, Format)
 * 4. Click "Create Match", wait for toast
 * 5. Click "Start Match" trigger (desktop button)
 * 6. In dialog: select managed team radio, toggle all players, confirm
 * 7. Wait for navigation to /matches/[id]/live, return matchId
 */
export async function createAndStartMatch(
  page: Page,
  options: CreateAndStartMatchOptions
): Promise<CreateAndStartMatchResult> {
  const {
    teamName,
    awayTeamName = 'Team 1',
    formatName = 'Test (6x6)',
  } = options;

  // ── 3.1 Navigate to Matches ───────────────────────────────────────────────
  await page.goto('/matches');
  await page.getByRole('heading', { name: 'Matches', level: 1 }).waitFor({
    state: 'visible',
    timeout: 30_000,
  });

  // ── 3.2 Apply team filter ─────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Filters' }).click();
  // Combobox order on matches page (no dialog): 0=Championship, 1=Club, 2=Team
  const teamFilterCombobox = page.getByRole('combobox').nth(2);
  if (await teamFilterCombobox.isVisible().catch(() => false)) {
    await teamFilterCombobox.click();
    await page
      .getByRole('option', { name: new RegExp(teamName, 'i') })
      .waitFor({ state: 'visible', timeout: 5_000 });
    await page.getByRole('option', { name: new RegExp(teamName, 'i') }).click();
  }

  // ── 3.3 Create new match ──────────────────────────────────────────────────
  await page.getByRole('button', { name: 'New Match' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 5_000 });

  // Home team (combobox index 1 inside dialog)
  await dialog.getByRole('combobox').nth(1).click();
  await page
    .getByRole('option', { name: new RegExp(teamName, 'i') })
    .waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByRole('option', { name: new RegExp(teamName, 'i') }).click();

  // Away team (combobox index 2 inside dialog) — exact match to avoid matching E2E team name
  await dialog.getByRole('combobox').nth(2).click();
  await page
    .getByRole('option', { name: awayTeamName, exact: true })
    .waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByRole('option', { name: awayTeamName, exact: true }).click();

  // Match format (combobox index 3 inside dialog)
  await dialog.getByRole('combobox').nth(3).click();
  await page
    .getByRole('option', { name: formatName })
    .waitFor({ state: 'visible', timeout: 3_000 });
  await page.getByRole('option', { name: formatName }).click();

  // Submit
  await page.getByRole('button', { name: 'Create Match' }).click();
  await page
    .getByText('Match created')
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  // ── 3.4 Start match ───────────────────────────────────────────────────────
  // Two triggers exist (mobile card + desktop table). At 768px viewport, use .last()
  // to target the visible desktop table button.
  const startMatchTrigger = page.getByTestId('start-match-trigger').last();
  await startMatchTrigger.waitFor({ state: 'visible', timeout: 10_000 });
  await startMatchTrigger.click();

  // ── 3.5 Configure match start dialog ─────────────────────────────────────
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 3_000 });

  // Select managed team (first radio — home team is our team)
  // RadioGroupItem uses sr-only; visual div overlays it. force:true bypasses the overlay.
  await page.getByRole('radio').first().click({ force: true });
  await page.waitForTimeout(300);

  // Select all players from the lineup toggles
  const playerToggles = page.getByTestId('lineup-player-toggle');
  const toggleCount = await playerToggles.count();
  for (let i = 0; i < toggleCount; i++) {
    await playerToggles.nth(i).click();
    await page.waitForTimeout(100);
  }

  // Confirm
  await page.getByTestId('start-match-confirm').click();

  // Wait for navigation to live match page
  await page.waitForURL(/\/matches\/.+\/live/, { timeout: 15_000 });

  // Extract matchId from URL: /matches/[matchId]/live
  const matchId = page.url().match(/\/matches\/([^/]+)\/live/)?.[1] ?? '';

  return { matchId };
}
