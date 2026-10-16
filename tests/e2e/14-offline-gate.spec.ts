/**
 * Offline gate: a screen that loads everything from Supabase, opened offline from inside the app, shows
 * the offline screen instead of an empty page, and loads once the connection is back.
 *
 * Web: a screen the router already holds renders the in-app OfflineGate; one it must fetch falls back to a
 * full load and the service worker's public/offline.html (which reloads once online). Static export
 * (E2E_TARGET=mobile): offline as in the Capacitor app, the app's files still load, so both screens
 * render the in-app OfflineGate. Retry also asks the server, for a browser that wrongly says offline.
 */

import { test, expect, Page } from '@playwright/test';
import { readFixture } from '../helpers/fixture';
import { goOfflineForTarget as goOffline, goOnlineForTarget as goOnline } from '../helpers/network';
import { onPath } from '../helpers/routes';

async function searchTeam(page: Page, teamName: string) {
  const searchBox = page.getByPlaceholder('Search by team name...');
  if (!(await searchBox.isVisible())) {
    await page.getByRole('button', { name: 'Filters' }).click();
    await expect(searchBox).toBeVisible({ timeout: 10_000 });
  }
  await searchBox.fill(teamName);
  await expect(page.getByRole('row').filter({ hasText: teamName })).toBeVisible();
}

const headerLink = (page: Page, name: string) => page.getByRole('banner').getByRole('link', { name, exact: true }).first();

test('a list the app already has in its router cache, opened offline, shows the in-app offline screen', async ({ page }) => {
  await page.goto('/teams');
  await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });
  // Visited once online: the router keeps the page, so going back to it offline needs no request.
  await headerLink(page, 'Championships').click();
  await expect(page.getByRole('heading', { name: 'Championships', level: 1 })).toBeVisible({ timeout: 15_000 });
  await headerLink(page, 'Teams').click();
  await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 15_000 });

  await goOffline(page);
  await headerLink(page, 'Championships').click();
  await page.waitForURL(onPath('/championships'), { timeout: 15_000 });
  const offline = page.getByTestId('offline-page');
  await expect(offline).toBeVisible({ timeout: 15_000 });
  // In the app (its header is there), the screen not mounted: no heading, no empty list.
  await expect(headerLink(page, 'Teams')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Championships', level: 1 })).toHaveCount(0);
  await expect(offline.getByRole('button', { name: 'Retry' })).toBeVisible();

  // Retry while still offline keeps the screen
  await offline.getByRole('button', { name: 'Retry' }).click();
  await expect(offline).toBeVisible();

  await goOnline(page);
  await expect(offline).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Championships', level: 1 })).toBeVisible({ timeout: 15_000 });
});

test('a team page opened offline shows the offline screen, then loads once online', async ({ page }) => {
  const { teamName } = readFixture();
  await page.goto('/teams');
  await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });
  await searchTeam(page, teamName);
  const teamRow = page.getByRole('row').filter({ hasText: teamName });

  await goOffline(page);
  // The list already loaded stays as it is.
  await expect(teamRow).toBeVisible();
  // View (Eye): index 0 in the Actions column.
  await teamRow.getByRole('button').nth(0).click();
  await page.waitForURL(onPath('/teams/view'), { timeout: 15_000 });
  await expect(page.getByTestId('offline-page')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('No teams found')).toHaveCount(0);
  expect(page.url()).not.toContain('chrome-error');

  await goOnline(page);
  await expect(page.getByTestId('offline-page')).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: teamName })).toBeVisible({ timeout: 15_000 });
});

test('Retry opens the screen when the browser wrongly says offline but the server answers', async ({ page }) => {
  const { teamName } = readFixture();
  await page.goto('/teams');
  await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });
  await searchTeam(page, teamName);
  // Some Android WebViews keep navigator.onLine false while online: the network still works here.
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  });
  await page.getByRole('row').filter({ hasText: teamName }).getByRole('button').nth(0).click();
  await page.waitForURL(onPath('/teams/view'), { timeout: 15_000 });
  const offline = page.getByTestId('offline-page');
  await expect(offline).toBeVisible({ timeout: 15_000 });
  await offline.getByRole('button', { name: 'Retry' }).click();
  await expect(offline).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: teamName })).toBeVisible({ timeout: 15_000 });
});
