import { serverClient } from './server-data';

const PLAYERS = [
  { name: 'Player 1', number: 1, position: 'setter' },
  { name: 'Player 2', number: 2, position: 'outside_hitter' },
  { name: 'Player 3', number: 3, position: 'middle_hitter' },
  { name: 'Player 4', number: 4, position: 'opposite' },
  { name: 'Player 5', number: 5, position: 'outside_hitter' },
  { name: 'Player 6', number: 6, position: 'middle_hitter' },
  { name: 'Player 7', number: 7, position: 'outside_hitter' },
  { name: 'Player 8', number: 8, position: 'setter' },
];
export const ARCHIVED_PLAYER = 'Player 9';

async function must<T>(label: string, request: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await request;
  if (error) throw new Error(`seed ${label}: ${error.message}`);
  return data as NonNullable<T>;
}

/** The run's team as the e2e account: 8 active players and one archived (names match the UI specs). */
export async function seedTeam(runId: string) {
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const teamId = crypto.randomUUID();
  const teamName = `E2E Team ${runId}`;
  await must('team', supabase.from('teams').insert({
    id: teamId, name: teamName, status: 'active', user_id: user!.id,
    championship_id: null, club_id: null, created_at: now, updated_at: now, ext_code: null, ext_source: null,
  }));
  await must('players', supabase.from('team_members').insert([
    ...PLAYERS.map((p) => ({ team_id: teamId, name: p.name, number: p.number, position: p.position, role: 'player' })),
    { team_id: teamId, name: ARCHIVED_PLAYER, number: 9, position: null, role: 'player', archived_at: now },
  ]));
  return { teamId, teamName, playerNames: PLAYERS.map((p) => p.name), archivedPlayerName: ARCHIVED_PLAYER };
}

/** An upcoming match of the run's team against the shared "Team 1", format "Test (6x6)" (5 points per set). */
export async function createMatchByApi(teamId: string): Promise<string> {
  const supabase = await serverClient();
  const [away] = await must('away team', supabase.from('teams').select('id').eq('name', 'Team 1').eq('_deleted', false).limit(1));
  const [format] = await must('format', supabase.from('match_formats').select('id').eq('description', 'Test').eq('format', '6x6').limit(1));
  if (!away || !format) throw new Error('seed: the shared "Team 1" team or the "Test (6x6)" format is missing');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await must('match', supabase.from('matches').insert({
    id, home_team_id: teamId, away_team_id: (away as { id: string }).id, date: now,
    match_format_id: (format as { id: string }).id, championship_id: null, season_id: null, location: null,
    status: 'upcoming', home_score: 0, away_score: 0, created_at: now, updated_at: now,
  }));
  return id;
}

/**
 * A team of its own for a spec that changes its roster (the run's team is shared by specs that may run at the
 * same time). Name it "E2E Team …": the global teardown deletes it. The creator's own membership row comes
 * with the team, as for a team made in the UI; `playerNames` become active players.
 */
export async function createScratchTeam(name: string, playerNames: string[] = ['Player 1']) {
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const teamId = crypto.randomUUID();
  await must('scratch team', supabase.from('teams').insert({
    id: teamId, name, status: 'active', user_id: user!.id,
    championship_id: null, club_id: null, created_at: now, updated_at: now, ext_code: null, ext_source: null,
  }));
  await must('scratch players', supabase.from('team_members').insert(
    playerNames.map((player, index) => ({ team_id: teamId, name: player, number: index + 1, position: null, role: 'player' }))
  ));
  return teamId;
}
