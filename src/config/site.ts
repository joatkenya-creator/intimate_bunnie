/**
 * The canonical origin. Every canonical URL, OG URL, and sitemap entry is built
 * from it, so an unset variable in production would publish `localhost` links
 * to the index — the deployment URL is the safer fallback, and localhost stays
 * the last resort for `next dev`.
 */
function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`
  return 'http://localhost:3000'
}

export const site = {
  name: 'Intimate Bunnie',
  tagline: 'Pleasure, beautifully considered.',
  description:
    'Body-safe intimates, toys, and adornments for women who like nice things. Discreet U.S. shipping, plain packaging, no judgment.',
  url: siteUrl(),
  email: 'care@intimatebunnie.com',
  currency: 'USD',
} as const

export function absoluteUrl(path = '/'): string {
  return `${site.url}${path.startsWith('/') ? path : `/${path}`}`
}
