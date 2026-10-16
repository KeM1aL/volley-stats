import { Page } from '@playwright/test';

/**
 * Go offline: cuts external network + dispatches window 'offline' event
 * so React's useOnlineStatus hook sees isOnline=false.
 *
 * Note: setOffline(true) only blocks non-loopback (external) connections.
 * localhost:3000 (the Next.js dev server) remains reachable.
 * Supabase API calls (external) will fail silently — writes go to RxDB/IndexedDB.
 */
export async function goOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForFunction((online) => navigator.onLine === online, false);
}

/**
 * Go online: restores external network + dispatches window 'online' event
 * so React's useOnlineStatus hook sees isOnline=true.
 * RxDB's continuous replication resumes and syncs queued offline writes to Supabase.
 */
export async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
  // public/offline.html reloads on 'online': the page may navigate away under this evaluate.
  await page.evaluate(() => window.dispatchEvent(new Event('online'))).catch((error: unknown) => {
    if (!String(error).includes('Execution context was destroyed')) throw error;
  });
  await page.waitForFunction((online) => navigator.onLine === online, true);
}

const APP_FILES_ONLY = '**/*';

/**
 * Offline as the Capacitor app is: the app's own files still load (they are on the device), everything
 * else fails, and navigator.onLine is false. `setOffline` can't stand for it with the static export
 * served over HTTP: it also cuts the app's files, so an in-app navigation ends on the browser's error page.
 */
export async function goOfflineKeepingAppFiles(page: Page): Promise<void> {
  const appOrigin = new URL(page.url()).origin;
  await page.route(APP_FILES_ONLY, (route) =>
    new URL(route.request().url()).origin === appOrigin ? route.fallback() : route.abort('internetdisconnected')
  );
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  });
}

/** Undoes goOfflineKeepingAppFiles. */
export async function goOnlineKeepingAppFiles(page: Page): Promise<void> {
  await page.unroute(APP_FILES_ONLY);
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
  });
}

/** Offline for the target under test: the static export (E2E_TARGET=mobile) keeps its files, like the app. */
export const goOfflineForTarget = (page: Page) =>
  process.env.E2E_TARGET === 'mobile' ? goOfflineKeepingAppFiles(page) : goOffline(page);
export const goOnlineForTarget = (page: Page) =>
  process.env.E2E_TARGET === 'mobile' ? goOnlineKeepingAppFiles(page) : goOnline(page);

/**
 * Selectively block Supabase REST API requests without cutting all external connections.
 * Useful for testing partial network failures.
 * Returns an unblock function that must be called to restore access.
 *
 * @example
 * const unblock = await blockSupabase(page);
 * // ... do something with Supabase blocked
 * await unblock();
 */
export async function blockSupabase(page: Page): Promise<() => Promise<void>> {
  const pattern = '**/rest/v1/**';
  await page.route(pattern, route => route.abort('internetdisconnected'));
  return () => page.unroute(pattern);
}

/**
 * Wait until a service worker controls the page, so offline reloads are
 * served from its cache.
 */
export async function waitForServiceWorker(page: Page): Promise<void> {
  // The static export has no service worker when served by a plain static server (the Capacitor app bundles its files).
  if (process.env.E2E_TARGET === 'mobile') return;
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
    timeout: 15_000,
  });
}
