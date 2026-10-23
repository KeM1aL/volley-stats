/**
 * Public access — resources that must work without a session.
 */
import { test, expect } from '@playwright/test';

test.describe('Public access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('service worker script is served to logged-out visitors @web', async ({ request }) => {
    const response = await request.get('/serwist/sw.js', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('javascript');
  });

  test('a signed-out visitor can read the privacy policy', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByTestId('privacy-policy')).toBeVisible();
    await expect(page).toHaveURL(/\/privacy\/?$/);
  });
});
