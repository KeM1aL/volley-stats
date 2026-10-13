const { withSerwist } = require('@serwist/turbopack');
const withNextIntl = require('next-intl/plugin')('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: { unoptimized: true },
  // Pin the project root: without it Next infers the root from the nearest
  // lockfile, which breaks module resolution in nested git worktrees.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  // @react-pdf/renderer runs in the report route from node_modules, with its fonts traced in.
  serverExternalPackages: ['@react-pdf/renderer'],
  outputFileTracingIncludes: { '/api/v1/matches/[id]/report': ['./lib/report/fonts/**'] },
};

module.exports = withSerwist(withNextIntl(nextConfig));
