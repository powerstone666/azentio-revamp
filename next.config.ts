import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // Email templates are read from disk at runtime, so serverless builds must ship them with the API routes.
  outputFileTracingIncludes: {
    '/api/**': ['./app/api/(services)/email/templates/**/*', './public/brand/azentio-logo-white.png', './app/api/(services)/aira/ragData.md'],
  },
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
