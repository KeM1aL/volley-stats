import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Supabase as the e2e account (TEST_EMAIL / TEST_PASSWORD), to read what reached the server. */
export async function serverClient(): Promise<SupabaseClient> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!url || !anonKey || !email || !password) {
    throw new Error('server-data needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, TEST_EMAIL and TEST_PASSWORD');
  }
  const created = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await created.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`server-data sign-in: ${error.message}`);
  client = created;
  return created;
}

type Row = Record<string, any>;

export interface ServerMatchState {
  match: Row;
  sets: Row[];
  points: Row[];
  stats: Row[];
  events: Row[];
}

/** The match's rows on the server, soft-deleted rows excluded. */
export async function fetchServerMatch(matchId: string): Promise<ServerMatchState> {
  const supabase = await serverClient();
  const live = (rows: Row[] | null) => (rows ?? []).filter((row) => !row._deleted);
  const [match, sets, points, stats, events] = await Promise.all([
    supabase.from('matches').select('*').eq('id', matchId).single(),
    supabase.from('sets').select('*').eq('match_id', matchId),
    supabase.from('score_points').select('*').eq('match_id', matchId),
    supabase.from('player_stats').select('*').eq('match_id', matchId),
    supabase.from('events').select('*').eq('match_id', matchId),
  ]);
  for (const response of [match, sets, points, stats, events]) {
    if (response.error) throw new Error(response.error.message);
  }
  return { match: match.data!, sets: live(sets.data), points: live(points.data), stats: live(stats.data), events: live(events.data) };
}
