/**
 * Live page on a device that just signed in: the match formats and teams are still being downloaded
 * (reference replications) when the scorer starts a match. The live page waits for them on its loading
 * screen instead of leaving for the match list with "Its teams or match format are missing…".
 */

import { test, expect, type Route } from '@playwright/test';
import { createAndStartMatch } from '../helpers/match-setup';
import { readFixture } from '../helpers/fixture';
import { onPath } from '../helpers/routes';

// Requests a service worker handles skip page.route: keep it out, so the held requests are really held.
test.use({ serviceWorkers: 'block' });

/** The reference replications' pulls (ordered by the `_modified` checkpoint) of the match formats and teams. */
const isReferencePull = (url: URL) =>
  /\/rest\/v1\/(teams|match_formats)$/.test(url.pathname) && (url.searchParams.get('order') ?? '').startsWith('_modified');

test('opens the scoring screen on the first attempt while the match format and teams are still downloading', async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const { teamId, teamName } = readFixture();

  // Hold the device's first format and team downloads until the live page is open.
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let held = 0;
  await page.route(
    (url) => isReferencePull(url),
    async (route: Route) => {
      held++;
      await released;
      await route.continue().catch(() => {});
    }
  );

  await createAndStartMatch(page, { teamId, teamName });
  expect(held, 'the format and team downloads were held').toBeGreaterThan(0);

  // While they are held, the live page stays on its loading screen.
  const loading = page.getByText('Loading match format');
  await expect(loading).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  expect(onPath('/matches/live')(new URL(page.url())), 'still on the live page').toBe(true);
  await expect(loading).toBeVisible();
  await expect(page.getByTestId('set-setup')).toHaveCount(0);

  release();
  await expect(page.getByTestId('set-setup').first()).toBeVisible({ timeout: 30_000 });
  expect(onPath('/matches/live')(new URL(page.url())), 'still on the live page').toBe(true);
  await expect(page.getByText("This match couldn't be loaded on this device")).toHaveCount(0);
});
