export const site = {
  name: 'Intimate Bunnie',
  tagline: 'Pleasure, beautifully considered.',
  description:
    'Body-safe intimates, toys, and adornments for women who like nice things. Discreet U.S. shipping, plain packaging, no judgment.',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  email: 'care@intimatebunnie.com',
  currency: 'USD',
} as const

export function absoluteUrl(path = '/'): string {
  return `${site.url}${path.startsWith('/') ? path : `/${path}`}`
}
