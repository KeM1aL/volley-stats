import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('an invalid or expired email link shows the expired card', async ({ page }) => {
  await page.goto('/auth/confirm?token_hash=not-a-real-token&type=recovery');
  await expect(page.getByTestId('confirm-invalid')).toBeVisible({ timeout: 15_000 });
  // The credential is removed from the address bar before it is verified.
  expect(page.url()).not.toContain('token_hash');
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(page).toHaveURL((url) => url.pathname.replace(/\/$/, '') === '/auth');
});

test('a link without a token shows the expired card', async ({ page }) => {
  await page.goto('/auth/confirm');
  await expect(page.getByTestId('confirm-invalid')).toBeVisible();
});
