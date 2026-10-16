import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Throwaway accounts for the account-deletion specs. They live in the shared Supabase project, so
 * they are named `e2e-delete-<time>-<random>@example.com` and removed by the global teardown even
 * when a spec fails. Needs SUPABASE_SERVICE_ROLE_KEY (local env files only; never printed).
 */

export const THROWAWAY_PREFIX = 'e2e-delete-';
export const THROWAWAY_DOMAIN = '@example.com';
/** Teams the deletion specs create; removed with the service role because their owner is a throwaway user. */
export const THROWAWAY_TEAM_PATTERN = 'E2E Team del-%';

export interface ThrowawayUser {
  id: string;
  email: string;
  password: string;
}

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('throwaway users need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createThrowawayUser(): Promise<ThrowawayUser> {
  const email = `${THROWAWAY_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = crypto.randomUUID();
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`create throwaway user: ${error?.message ?? 'no user returned'}`);
  return { id: data.user.id, email, password };
}

/** Only addresses created by createThrowawayUser are ever deleted. */
export function isThrowawayEmail(email: string | undefined): boolean {
  return !!email && email.startsWith(THROWAWAY_PREFIX) && email.endsWith(THROWAWAY_DOMAIN);
}

/**
 * Removes the deletion specs' teams, then every throwaway user still there. Returns how many users it removed.
 * A team is only removed when it has the spec team name AND no owner (its owner's account was already deleted)
 * or a throwaway user as owner; a real user's team is never touched, whatever its name.
 */
export async function deleteThrowawayUsers(): Promise<number> {
  const admin = adminClient();

  const leftovers: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`list users: ${error.message}`);
    if (data.users.length === 0) break;
    leftovers.push(...data.users.filter((user) => isThrowawayEmail(user.email)).map((user) => user.id));
  }

  const { data: teams, error: teamsError } = await admin.from('teams').select('id, user_id').like('name', THROWAWAY_TEAM_PATTERN);
  if (teamsError) throw new Error(`select throwaway teams: ${teamsError.message}`);
  const teamIds = (teams ?? [])
    .filter((team) => team.user_id === null || leftovers.includes(team.user_id as string))
    .map((team) => team.id as string);
  if (teamIds.length > 0) {
    const { error: membersError } = await admin.from('team_members').delete().in('team_id', teamIds);
    if (membersError) throw new Error(`delete throwaway team members: ${membersError.message}`);
    const { error } = await admin.from('teams').delete().in('id', teamIds);
    if (error) throw new Error(`delete throwaway teams: ${error.message}`);
  }

  for (const id of leftovers) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(`delete throwaway user: ${error.message}`);
  }
  return leftovers.length;
}
