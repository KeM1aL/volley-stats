import { test, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { adminClient, createThrowawayUser, type ThrowawayUser } from '../helpers/throwaway-user';

// Throwaway accounts (e2e-delete-…@example.com) are created and deleted here; the global teardown
// removes whatever a failed run leaves. Needs SUPABASE_SERVICE_ROLE_KEY.
test.use({ storageState: { cookies: [], origins: [] } });
test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, 'needs SUPABASE_SERVICE_ROLE_KEY');

function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedInClient(user: ThrowawayUser): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`throwaway sign-in: ${error.message}`);
  return client;
}

async function createTeam(client: SupabaseClient, user: ThrowawayUser, name: string): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error } = await client.from('teams').insert({
    id, name, status: 'active', user_id: user.id, championship_id: null, club_id: null, created_at: now, updated_at: now, ext_code: null, ext_source: null,
  });
  if (error) throw new Error(`create team: ${error.message}`);
  return id;
}

async function signInAndOpenSettings(page: Page, user: ThrowawayUser) {
  await page.goto('/auth?lang=en');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).not.toHaveURL((url) => url.pathname.replace(/\/$/, '') === '/auth');
  await page.goto('/settings');
  const open = page.getByTestId('delete-account-button');
  await expect(open).toBeEnabled({ timeout: 30_000 });
  await open.click();
  await expect(page.getByTestId('delete-account-dialog')).toBeVisible();
  await expect(page.getByTestId('delete-account-loading')).toHaveCount(0);
}

async function pick(page: Page, teamId: string, typed: string | null, option: string) {
  const row = page.locator(`[data-testid="delete-account-team"][data-team-id="${teamId}"]`);
  await row.getByRole('combobox').click();
  if (typed) await row.getByRole('combobox').fill(typed);
  await page.getByRole('option', { name: option, exact: true }).click();
}

test('account deletion with no team removes the account', async ({ page }) => {
  const user = await createThrowawayUser();
  await signInAndOpenSettings(page, user);
  await expect(page.getByTestId('delete-account-team')).toHaveCount(0);

  const confirm = page.getByTestId('delete-account-confirm');
  await expect(confirm).toBeDisabled();
  await page.locator('#delete-account-email').fill(user.email);
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByTestId('account-deleted')).toBeVisible({ timeout: 30_000 });
  const { error } = await anonClient().auth.signInWithPassword({ email: user.email, password: user.password });
  expect(error).not.toBeNull();
});

test('account deletion hands one team over and deletes the other', async ({ page }) => {
  const stamp = Date.now();
  const [a, b] = [await createThrowawayUser(), await createThrowawayUser()];
  const clientA = await signedInClient(a);
  const keepId = await createTeam(clientA, a, `E2E Team del-${stamp} keep`);
  const dropId = await createTeam(clientA, a, `E2E Team del-${stamp} drop`);
  const { error } = await clientA.from('team_members').insert({ team_id: keepId, user_id: b.id, name: 'Coach B', number: 0, role: 'coach' });
  if (error) throw new Error(`add B: ${error.message}`);
  await clientA.auth.signOut({ scope: 'local' });

  await signInAndOpenSettings(page, a);
  await expect(page.getByTestId('delete-account-team')).toHaveCount(2);
  const confirm = page.getByTestId('delete-account-confirm');
  await page.locator('#delete-account-email').fill(a.email);
  await expect(confirm).toBeDisabled();

  await pick(page, keepId, 'Coach', 'Hand over to Coach B');
  await expect(confirm).toBeDisabled();
  await pick(page, dropId, null, 'Delete the team');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByTestId('account-deleted')).toBeVisible({ timeout: 30_000 });

  const admin = adminClient();
  const { data: keep } = await admin.from('teams').select('user_id, _deleted').eq('id', keepId).single();
  expect(keep).toMatchObject({ user_id: b.id, _deleted: false });
  const { data: member } = await admin.from('team_members').select('role').eq('team_id', keepId).eq('user_id', b.id).single();
  expect(member?.role).toBe('owner');
  const { data: drop } = await admin.from('teams').select('_deleted').eq('id', dropId).single();
  expect(drop?._deleted).toBe(true);
});

test('account deletion needs a choice for a team nobody can take over', async ({ page }) => {
  const user = await createThrowawayUser();
  const client = await signedInClient(user);
  const teamId = await createTeam(client, user, `E2E Team del-${Date.now()} alone`);
  await client.auth.signOut({ scope: 'local' });

  await signInAndOpenSettings(page, user);
  const row = page.locator(`[data-testid="delete-account-team"][data-team-id="${teamId}"]`);
  await expect(row).toContainText('No member of this team has an account to take it over.');
  const confirm = page.getByTestId('delete-account-confirm');
  await page.locator('#delete-account-email').fill(user.email);
  await expect(confirm).toBeDisabled();

  await pick(page, teamId, null, 'Delete the team');
  await expect(confirm).toBeEnabled();

  // Not deleting: the account and the team stay until the global teardown removes them.
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByTestId('delete-account-dialog')).toHaveCount(0);
  const { data } = await adminClient().from('teams').select('_deleted').eq('id', teamId).single();
  expect(data?._deleted).toBe(false);
});
