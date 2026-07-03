import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:", // blob: required for Web Workers (IndexedDB offline-sync)
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://sentry.io https://o4511424569868288.ingest.us.sentry.io https://vercel.live wss://vercel.live",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "manifest-src 'self'",
      "media-src 'self'",
    ].join('; '),
  },
];

const userManualsHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
    ].join('; '),
  },
];

const apiNoStoreHeaders = [
  { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
];

const nextConfig: NextConfig = {
  // Disable type checking during build (handled by CI/IDE)
  typescript: {
    ignoreBuildErrors: false, // Keep enabled for now to catch errors
  },
  // Strip console.log/info/debug in production builds. Keeps console.error/warn
  // so real errors still surface in Sentry. Saves bundle size + runtime cost.
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  // Transpile workspace packages for Next.js (mobile + web code sharing)
  transpilePackages: ['@bella/shared'],
  // Tree-shake heavy barrel imports. lucide-react / date-fns / recharts are
  // already optimized by default in Next 16; framer-motion is not, so add it.
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: apiNoStoreHeaders,
      },
      {
        source: '/user-manuals/:path*',
        headers: userManualsHeaders,
      },
      {
        source: '/((?!user-manuals).*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "bella-spa",
  project: "bella-spa-erp",
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  sourcemaps: { disable: true },
});
