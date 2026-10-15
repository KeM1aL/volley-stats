const { withSerwist } = require('@serwist/turbopack');
const withNextIntl = require('next-intl/plugin')('./i18n.ts');

// `web`: the Vercel deployment (server routes, proxy, service worker).
// `mobile`: a static export in out/, bundled by the Capacitor app.
const target = process.env.BUILD_TARGET === 'mobile' ? 'mobile' : 'web';
const isWeb = target === 'web';

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
      }
    : { output: 'export', trailingSlash: true }),
};

module.exports = isWeb ? withSerwist(withNextIntl(nextConfig)) : withNextIntl(nextConfig);
