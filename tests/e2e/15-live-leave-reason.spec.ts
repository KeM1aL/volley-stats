/**
 * The live page never sends the user back to the match list without saying why.
 */

import { test, expect } from '@playwright/test';
import { onPath } from '../helpers/routes';

test('a live match link without its team returns to the match list and says why', async ({ page }) => {
  await page.goto('/matches/live?id=3f2b8c1e-9d4a-4b6f-8e2a-1c5d7e9f0a1b');
  await page.waitForURL(onPath('/matches'), { timeout: 30_000 });
  await expect(page.getByText("This match couldn't be loaded on this device").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("The link doesn't say which team you score for.").first()).toBeVisible();
});
