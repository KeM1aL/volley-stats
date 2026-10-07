/**
 * The signed-in user's profile is saved on the device (for offline cold
 * starts) and removed once the device has no session.
 *
 * The session is dropped by clearing cookies rather than clicking "Sign Out":
 * Supabase's default sign-out revokes every session of the test account.
 */
import { test, expect } from '@playwright/test';

const CACHE_KEY = 'volleystats:cached-user';

test('profile is saved on the device and cleared without a session', async ({ page, context }) => {
  await page.goto('/teams');
  await expect(page.getByRole('button', { name: 'New Team' })).toBeVisible({ timeout: 30_000 });

  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), CACHE_KEY))
    .not.toBeNull();
  const saved = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), CACHE_KEY))!);
  expect(saved.user?.profile?.id, 'saved user has a profile').toBeTruthy();
  expect(saved.userId).toBe(saved.user.id);

  await context.clearCookies();
  await page.goto('/');
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), CACHE_KEY))
    .toBeNull();
});
