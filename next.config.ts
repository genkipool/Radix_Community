import type { NextConfig } from 'next';
import path from 'path';

/**
 * next.config.ts — Next.js 16
 *
 * Key Next.js 16 features enabled here:
 *
 * ┌─ reactCompiler ──────────────────────────────────────────────────────────┐
 * │ Stable in Next.js 16 (React Compiler 1.0). Automatically memoizes       │
 * │ components and hooks — no manual useMemo/useCallback needed.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ proxy.ts ────────────────────────────────────────────────────────────────┐
 * │ In Next.js 16, middleware.ts is deprecated → renamed to proxy.ts.        │
 * │ proxy.ts runs on Node.js runtime (not Edge). Our i18n locale detection   │
 * │ logic lives there. skipProxyUrlNormalize replaces skipMiddlewareUrl...    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const nextConfig: NextConfig = {

  // ── React Compiler (stable in Next.js 16) ─────────────────────────────────
  reactCompiler: true,

  // ── Package import optimisation ────────────────────────────────────────────
  // Rewrites barrel-file imports (e.g. `import { X } from 'lucide-react'`) into
  // direct sub-path imports so only the symbols actually used end up in the
  // bundle — reduces unused JS by ~20–35 KiB on average.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'motion/react',
      '@tanstack/react-query',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
    ],
  },

  // Explicitly set the workspace root to this project's directory,
  // preventing Next.js from picking up stray lockfiles (e.g. from Trash).
  outputFileTracingRoot: path.join(__dirname),

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // 'unsafe-eval' is required by animation libraries (motion/react)
            // and Next.js internals (HMR, webpack runtime).
            // 'unsafe-inline' covers inline scripts/styles used for theme init.
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com https://vercel.live",
              "img-src 'self' data: https: https://vercel.com",
              "connect-src 'self' https: wss: https://cloudflareinsights.com https://vercel.live",
              "frame-src https://vercel.live",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: [
              'camera=()',
              'microphone=()',
              'geolocation=()',
              'interest-cohort=()',
            ].join(', '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
