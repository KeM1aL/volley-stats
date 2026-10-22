/**
 * The FFVB import writes with service-role rights, so it is for application admins (profiles.role) on the web
 * build. The e2e user is not an admin: no button, and the route answers 403.
 */
import { test, expect } from '@playwright/test';
import { routes } from '@/lib/routes';
import { readFixture } from '../helpers/fixture';
import { serverClient } from '../helpers/server-data';

/** A championship of its own (named "E2E Championship …": the global teardown deletes it), so the spec runs on its own. */
async function createChampionship(): Promise<string> {
  const supabase = await serverClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: format, error: formatError } = await supabase.from('match_formats').select('id').eq('format', '6x6').limit(1).maybeSingle();
  if (formatError || !format) throw new Error('no 6x6 match format to create a championship with');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error } = await supabase.from('championships').insert({
    id, name: `E2E Championship ffvb-admin ${readFixture().runId}`, type: 'regional', gender: 'mixte', age_category: 'senior',
    default_match_format: format.id, season_id: null, user_id: user!.id, created_at: now, updated_at: now,
  });
  if (error) throw new Error(`create championship: ${error.message}`);
  return id;
}

test.describe('@web FFVB import is admin only', () => {
  test('a non-admin sees no import button on a championship', async ({ page }) => {
    await page.goto(routes.championship(await createChampionship()));
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('ffvb-import-button')).toHaveCount(0);
  });

  test('the import route refuses a signed-in non-admin', async ({ page }) => {
    const response = await page.request.post('/api/import/ffvb', { data: { seasonId: 'x', championshipId: 'y' } });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });
});
