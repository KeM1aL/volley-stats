/**
 * The service worker must not cache Supabase API responses: other screens read
 * live data, and cached rows could outlive a sign-out on a shared device.
 */
import { test, expect } from '@playwright/test';
import { waitForServiceWorker } from '../helpers/network';

test('service worker does not cache Supabase API responses', async ({ page }) => {
  await page.goto('/teams');
  await waitForServiceWorker(page);

  // Reload so the page's Supabase requests go through the active worker.
  await page.reload();
  await expect(page.getByRole('button', { name: 'New Team' })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2_000);

  const cachedSupabaseUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (new URL(request.url).hostname.endsWith('.supabase.co')) urls.push(`${name}: ${request.url}`);
      }
    }
    return urls;
  });
  expect(cachedSupabaseUrls).toEqual([]);
});
