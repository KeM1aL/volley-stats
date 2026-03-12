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
  await page.waitForTimeout(400); // let React re-render
}

/**
 * Go online: restores external network + dispatches window 'online' event
 * so React's useOnlineStatus hook sees isOnline=true.
 * RxDB's continuous replication resumes and syncs queued offline writes to Supabase.
 */
export async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(400); // let React re-render
}

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
