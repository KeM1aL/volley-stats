import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Deletes the data the e2e suite creates in the shared Supabase project:
 * teams named "E2E Team …" with their players and matches (and the matches'
 * sets, points, stats and events), and championships named "E2E Championship …".
 * Nothing else is touched — the shared opponent "Team 1" and all real data stay.
 *
 * Runs as the e2e test account (TEST_EMAIL / TEST_PASSWORD), so row-level
 * security still limits it to what that account may delete. The one exception
 * is championships, which no policy lets their creator delete: those rows
 * (and only those) are deleted with the service-role key.
 */

export const E2E_TEAM_PATTERN = 'E2E Team %';
export const E2E_CHAMPIONSHIP_PATTERN = 'E2E Championship %';

export type CleanupReport = Record<string, number>;

const CHUNK = 100;

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

async function selectIds(
  client: SupabaseClient,
  table: string,
  column: string,
  values: string[]
): Promise<string[]> {
  const ids: string[] = [];
  for (const part of chunks(values)) {
    const { data, error } = await client.from(table).select('id').in(column, part);
    if (error) throw new Error(`select ${table}: ${error.message}`);
    ids.push(...(data ?? []).map((row) => row.id as string));
  }
  return ids;
}

async function deleteIds(client: SupabaseClient, table: string, ids: string[]): Promise<number> {
  let deleted = 0;
  for (const part of chunks(ids)) {
    const { data, error } = await client.from(table).delete().in('id', part).select('id');
    if (error) throw new Error(`delete ${table}: ${error.message}`);
    deleted += data?.length ?? 0;
  }
  // Row-level security skips rows silently instead of failing.
  if (deleted !== ids.length) {
    throw new Error(`delete ${table}: removed ${deleted} of ${ids.length} rows (row-level security?)`);
  }
  return deleted;
}

export async function cleanupE2eData(
  client: SupabaseClient,
  {
    dryRun = false,
    championshipClient = client,
  }: { dryRun?: boolean; championshipClient?: SupabaseClient } = {}
): Promise<CleanupReport> {
  const { data: teams, error: teamsError } = await client
    .from('teams')
    .select('id')
    .like('name', E2E_TEAM_PATTERN);
  if (teamsError) throw new Error(`select teams: ${teamsError.message}`);
  const teamIds = (teams ?? []).map((t) => t.id as string);

  const { data: championships, error: champError } = await client
    .from('championships')
    .select('id')
    .like('name', E2E_CHAMPIONSHIP_PATTERN);
  if (champError) throw new Error(`select championships: ${champError.message}`);
  const championshipIds = (championships ?? []).map((c) => c.id as string);

  const matchIds = [
    ...new Set([
      ...(await selectIds(client, 'matches', 'home_team_id', teamIds)),
      ...(await selectIds(client, 'matches', 'away_team_id', teamIds)),
    ]),
  ];
  const plan: [string, string[], SupabaseClient][] = [
    ['events', await selectIds(client, 'events', 'match_id', matchIds), client],
    ['score_points', await selectIds(client, 'score_points', 'match_id', matchIds), client],
    ['player_stats', await selectIds(client, 'player_stats', 'match_id', matchIds), client],
    ['sets', await selectIds(client, 'sets', 'match_id', matchIds), client],
    ['matches', matchIds, client],
    ['team_members', await selectIds(client, 'team_members', 'team_id', teamIds), client],
    ['teams', teamIds, client],
    ['championships', championshipIds, championshipClient],
  ];

  const report: CleanupReport = {};
  for (const [table, ids, tableClient] of plan) {
    report[table] = dryRun ? ids.length : await deleteIds(tableClient, table, ids);
  }
  return report;
}

/** Signs in as the e2e account and runs the cleanup. */
export async function cleanupE2eDataAsTestUser(options?: { dryRun?: boolean }): Promise<CleanupReport> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !email || !password || !serviceRoleKey) {
    throw new Error(
      'e2e cleanup needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD and SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`e2e cleanup sign-in: ${error.message}`);
  try {
    // Only used to delete the 'E2E Championship …' rows selected above.
    const championshipClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return await cleanupE2eData(client, { ...options, championshipClient });
  } finally {
    // Local sign-out only: a global sign-out would end the account's other sessions.
    await client.auth.signOut({ scope: 'local' });
  }
}
