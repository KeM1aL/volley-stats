import { defaultCache } from '@serwist/turbopack/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// skipWaiting + clientsClaim and Workbox-style default runtime caching, as
// the previous next-pwa config intended. cleanupOutdatedCaches drops
// precaches from older service worker versions.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Never cache Supabase API calls: screens outside the live match read live
    // data, and cached rows could outlive a sign-out on a shared device.
    // Offline match data lives in RxDB, not in the HTTP cache.
    {
      matcher: ({ url }) =>
        url.hostname.endsWith('.supabase.co') &&
        /^\/(rest|auth|functions|realtime)\/v1\//.test(url.pathname),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
