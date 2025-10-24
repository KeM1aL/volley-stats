const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/chunks\/.*$/],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: { unoptimized: true },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

module.exports = withPWA(nextConfig);
