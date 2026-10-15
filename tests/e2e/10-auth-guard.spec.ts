import { test, expect } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { routes } from '@/lib/routes';

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a protected deep link goes to sign-in and comes back to the same page', async ({ page }) => {
    const { teamId } = readFixture();
    const target = routes.teamPlayers(teamId);
    await page.goto(target);
    await expect(page).toHaveURL((url) => url.pathname.replace(/\/$/, '') === '/auth' && url.searchParams.get('redirectTo') === target);
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL!);
    await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL((url) => url.pathname.replace(/\/$/, '') === '/teams/players' && url.searchParams.get('id') === teamId);
  });

  test('an unsafe redirectTo falls back to the home page', async ({ page }) => {
    await page.goto('/auth?redirectTo=%2F%2Fevil.com');
    await page.getByLabel('Email').fill(process.env.TEST_EMAIL!);
    await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.host.startsWith('localhost'));
  });
});

test('the FFVB import refuses anonymous callers', async ({ playwright, baseURL }) => {
  // The static export has no API: E2E_API_URL points at the web deployment that serves it.
  const anonymous = await playwright.request.newContext({ baseURL: process.env.E2E_API_URL ?? baseURL, storageState: { cookies: [], origins: [] } });
  const response = await anonymous.post('/api/import/ffvb', { data: { seasonId: 'x', championshipId: 'x' }, maxRedirects: 0 });
  expect(response.status()).toBe(401);
  const bearer = await anonymous.post('/api/import/ffvb', {
    data: { seasonId: 'x', championshipId: 'x' },
    maxRedirects: 0,
    headers: { Authorization: 'Bearer not-a-token' },
  });
  expect(bearer.status()).toBe(401);
  await anonymous.dispose();
});
