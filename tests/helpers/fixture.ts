import fs from 'fs';
import path from 'path';

/** Written by the seed project for this run; git-ignored (playwright/ is in .gitignore). */
export const FIXTURE_PATH = path.join(__dirname, '../../playwright/.data/fixture.json');

export interface E2eFixture {
  runId: string;
  teamId: string;
  teamName: string;
  /** Eight active players, Player 1 … Player 8, with volleyball positions. */
  playerNames: string[];
  /** A ninth member, archived: never offered for a new match. */
  archivedPlayerName: string;
  /** Set by finished-match (02-matches). */
  completedMatchId?: string;
  /** Set by 03-championships. */
  championshipId?: string;
  offlineMatchId?: string;
}

/**
 * Keys that specs add after the seed. Each one has its own file (`fixture.<key>.json`) next to the seed's,
 * so two workers writing at the same time cannot lose each other's key (a shared read-modify-write could).
 */
const EXTRA_KEYS = ['completedMatchId', 'championshipId', 'offlineMatchId'] as const;
type ExtraKey = (typeof EXTRA_KEYS)[number];

function extraPath(key: ExtraKey): string {
  return path.join(path.dirname(FIXTURE_PATH), `fixture.${key}.json`);
}

export function readFixture(): E2eFixture {
  if (!fs.existsSync(FIXTURE_PATH)) throw new Error('No e2e fixture: run through the "seed" project (any project but setup depends on it)');
  const fixture: E2eFixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  for (const key of EXTRA_KEYS) {
    if (fs.existsSync(extraPath(key))) fixture[key] = JSON.parse(fs.readFileSync(extraPath(key), 'utf-8')) as string;
  }
  return fixture;
}

/** Called by the seed: starts a new run, so keys of the previous run are dropped. */
export function writeFixture(fixture: E2eFixture): void {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  for (const key of EXTRA_KEYS) fs.rmSync(extraPath(key), { force: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
}

export function updateFixture(patch: Partial<Pick<E2eFixture, ExtraKey>>): void {
  for (const key of EXTRA_KEYS) {
    const value = patch[key];
    if (value !== undefined) fs.writeFileSync(extraPath(key), JSON.stringify(value));
  }
}
