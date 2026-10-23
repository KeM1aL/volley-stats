import { test, expect } from '@playwright/test';

test('a /fr/ link shows French and ends on a clean URL @web', async ({ page }) => {
  await page.goto('/fr/teams');
  await expect(page).toHaveURL((url) => url.pathname.replace(/\/$/, '') === '/teams' && !url.searchParams.has('lang'));
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Équipes');
  // Back to English for the specs that follow in this browser state.
  await page.goto('/?lang=en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('the language switcher changes the language without a reload', async ({ page }) => {
  await page.goto('/teams');
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
  const isProfileSave = (r: import('@playwright/test').Response) =>
    r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH';
  await page.getByRole('button', { name: 'Change language' }).click();
  // The profile save must succeed (pins the profiles.role protecting trigger against blocking normal edits)
  const saveFr = page.waitForResponse(isProfileSave);
  await page.getByRole('menuitem', { name: /Français/ }).click();
  expect((await saveFr).ok()).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  await page.getByRole('button', { name: 'Changer la langue' }).click();
  const saveEn = page.waitForResponse(isProfileSave);
  await page.getByRole('menuitem', { name: /English/ }).click();
  expect((await saveEn).ok()).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('a failed profile save keeps the new language and the page (no error screen)', async ({ page }) => {
  await page.goto('/teams');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // The profile write fails as it would offline; the language chunks are served locally and still load.
  // (The toast is worded by the translator of the language being left: English.)
  await page.route('**/rest/v1/profiles*', (route) => (route.request().method() === 'GET' ? route.continue() : route.abort()));
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('menuitem', { name: /Français/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  // The toast itself (a list item of the toast viewport), not Radix's aria-live announcement of it
  await expect(
    page.getByRole('region', { name: /Notifications/ }).getByRole('listitem').filter({ hasText: 'Language changed on this device only' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Équipes');
  await expect(page.getByText('Application error')).toHaveCount(0);
  // Back to English, with the profile reachable again.
  await page.unroute('**/rest/v1/profiles*');
  await page.getByRole('button', { name: 'Changer la langue' }).click();
  await page.getByRole('menuitem', { name: /English/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
