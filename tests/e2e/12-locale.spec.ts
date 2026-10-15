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
  await page.getByRole('button', { name: 'Change language' }).click();
  await page.getByRole('menuitem', { name: /Français/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  await page.getByRole('button', { name: 'Changer la langue' }).click();
  await page.getByRole('menuitem', { name: /English/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
