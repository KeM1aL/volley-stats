const { withSerwist } = require('@serwist/turbopack');
const withNextIntl = require('next-intl/plugin')('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: { unoptimized: true },
};

module.exports = withSerwist(withNextIntl(nextConfig));
