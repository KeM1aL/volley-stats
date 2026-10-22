const { withSerwist } = require('@serwist/turbopack');

// `web`: the Vercel deployment (server routes, proxy, service worker).
// `mobile`: a static export in out/, bundled by the Capacitor app.
const target = process.env.BUILD_TARGET === 'mobile' ? 'mobile' : 'web';
const isWeb = target === 'web';

// Keep in sync with LEGACY_ROUTE_REDIRECTS in lib/routes.ts (tests/unit/routes/legacy-redirects.test.ts checks it).
const UUID = ':id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})';
const LEGACY_ROUTE_REDIRECTS = [
  { source: `/matches/${UUID}/live`, destination: '/matches/live?id=:id' },
  { source: `/matches/${UUID}/score`, destination: '/matches/score?id=:id' },
  { source: `/matches/${UUID}/stats`, destination: '/matches/stats?id=:id' },
  { source: `/teams/${UUID}/players`, destination: '/teams/players?id=:id' },
  { source: `/teams/${UUID}`, destination: '/teams/view?id=:id' },
  { source: `/championships/${UUID}`, destination: '/championships/view?id=:id' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: { unoptimized: true },
  // Pin the project root: without it Next infers the root from the nearest
  // lockfile, which breaks module resolution in nested git worktrees.
  outputFileTracingRoot: __dirname,
  // Server-only route handlers are named *.web.ts: only the web target treats them as Next files.
  pageExtensions: isWeb
    ? ['web.tsx', 'web.ts', 'tsx', 'ts', 'jsx', 'js']
    : // No 'ts': proxy.ts and the *.web.ts route handlers are server-only. Every page/layout is .tsx; a future .ts convention file (e.g. app/robots.ts) would be left out of the export.
      ['tsx', 'jsx'],
  turbopack: {
    root: __dirname,
    resolveAlias: { '@platform-impl': isWeb ? './lib/platform/web/index.ts' : './lib/platform/mobile/index.ts' },
  },
  env: { NEXT_PUBLIC_BUILD_TARGET: target },
  ...(isWeb
    ? {
        // @react-pdf/renderer runs in the report route from node_modules, with its fonts traced in.
        serverExternalPackages: ['@react-pdf/renderer'],
        outputFileTracingIncludes: { '/api/v1/matches/[id]/report': ['./lib/report/fonts/**'] },
        async redirects() {
          // Next keeps the original query string (e.g. ?team=) on top of the destination's.
          return LEGACY_ROUTE_REDIRECTS.map((r) => ({ ...r, permanent: true }));
        },
      }
    : { output: 'export', trailingSlash: true }),
};

module.exports = isWeb ? withSerwist(nextConfig) : nextConfig;
