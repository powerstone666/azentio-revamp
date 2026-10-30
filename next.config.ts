import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // 'use cache' + cacheLife + cacheTag only for public content.
  // Never cache private, tenant, or shared-learning payloads across users.
  turbopack: {
    rules: {
      // Runs Tailwind v4 (@import 'tailwindcss', @theme) over CSS; there is no PostCSS config.
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
