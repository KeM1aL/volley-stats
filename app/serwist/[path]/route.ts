import { createSerwistRoute } from '@serwist/turbopack';

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: 'app/sw.ts',
  useNativeEsbuild: true,
  globIgnores: [
    // ~540 flag-icons SVGs: cached at runtime when shown, not downloaded up front.
    '.next/static/media/*.svg',
    // Leftovers from the old next-pwa build, if present locally.
    'public/sw.js',
    'public/workbox-*.js',
    'public/swe-worker-*.js',
  ],
});
