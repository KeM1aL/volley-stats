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

export function readFixture(): E2eFixture {
  if (!fs.existsSync(FIXTURE_PATH)) throw new Error('No e2e fixture: run through the "seed" project (any project but setup depends on it)');
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

export function writeFixture(fixture: E2eFixture): void {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
}

export function updateFixture(patch: Partial<E2eFixture>): void {
  writeFixture({ ...readFixture(), ...patch });
}
