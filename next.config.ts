import type { NextConfig } from 'next'
import { withBotId } from 'botid/next/config'

// Content-Security-Policy.
//
// `script-src` keeps 'unsafe-inline': Next's own hydration bootstrap, the
// JSON-LD blocks, the admin theme bootstrap, and the gtag snippet are all
// inline, and a nonce cannot be attached to them without routing every response
// through middleware. Everything else is closed — and the directives that
// actually stop the common injections (`base-uri`, `object-src`,
// `form-action`, `frame-ancestors`) do not depend on script-src at all.
//
// 'unsafe-eval' is dev-only: React Refresh needs it, production does not.
const csp = (dev: boolean) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.clarity.ms https://vercel.live`,
    "style-src 'self' 'unsafe-inline'",
    // next/font self-hosts its files under /_next; data: covers inlined faces.
    "font-src 'self' data:",
    // Product imagery is remote and editor-supplied; the optimiser fetches it
    // server-side, but the browser still loads the result from this origin.
    "img-src 'self' data: blob: https:",
    // Vercel Analytics and Speed Insights post to /_vercel/* on this origin.
    "connect-src 'self' https://www.google-analytics.com https://*.clarity.ms https://vitals.vercel-insights.com https://vercel.live",
    "frame-src 'self' https://vercel.live",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')

const securityHeaders = (dev: boolean) => [
  { key: 'Content-Security-Policy', value: csp(dev) },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

/**
 * Hosts the image optimiser is allowed to fetch from.
 *
 * `hostname: '**'` was an open proxy: anyone could pass any URL through
 * /_next/image on this domain, serving third-party bytes under our certificate
 * and billing the transformations to this project. Restricted to the stores we
 * actually use, with IMAGE_HOSTS as the escape hatch for a CDN added later —
 * a comma-separated list of hostnames, wildcards allowed.
 */
const extraImageHosts = (process.env.IMAGE_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean)

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin tracing to this project; a lockfile higher up the tree would otherwise
  // be picked as the workspace root and drag unrelated files into the bundle.
  outputFileTracingRoot: import.meta.dirname,
  images: {
    // Remote-only: never bundle product imagery into the deployment.
    remotePatterns: [
      { protocol: 'https', hostname: '**.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
      ...extraImageHosts.map((hostname) => ({ protocol: 'https' as const, hostname })),
    ],
    formats: ['image/avif', 'image/webp'],
    // Optimised renditions are immutable per (url, w, q); a day is the shortest
    // sensible life for one.
    minimumCacheTTL: 86_400,
  },
  experimental: {
    // Keeps server-action payloads small; product edits are field-level.
    serverActions: { bodySizeLimit: '1mb' },
  },
  async headers() {
    const dev = process.env.NODE_ENV !== 'production'
    return [
      { source: '/:path*', headers: securityHeaders(dev) },
      // The admin is not a page anyone should reach from a search result, and
      // the meta robots tag only covers documents — not the API beneath it.
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ]
  },
}

// withBotId adds the first-party rewrites that serve the challenge from our own
// origin — a third-party script URL is the first thing an ad-blocker drops.
export default withBotId(nextConfig)
