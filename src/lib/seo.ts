import type { Metadata } from 'next'
import { site, absoluteUrl } from '@/config/site'

type PageMetaInput = {
  title: string
  description: string
  /** The page's own path. Used for the canonical unless `canonical` overrides it. */
  path: string
  image?: string | null
  noindex?: boolean
  /**
   * An editor-set canonical from the admin, which is `null` for the vast
   * majority of rows — so `null` has to mean "no override", not "no canonical".
   * `false` is the separate, explicit suppression, and it is what a not-found
   * response wants: a canonical on a 404 pointing at an unrelated page is worse
   * than no canonical at all.
   */
  canonical?: string | null | false
  /** A raw directive such as `noindex,follow`. Wins over `noindex`. */
  robots?: string | null
}

/** Absolute, HTTPS, no trailing slash — the one canonical shape the site emits. */
function canonicalFor(path: string, override?: string | null | false): string | undefined {
  if (override === false) return undefined
  const target = override?.trim() || path
  if (!target) return undefined
  return /^https?:\/\//i.test(target) ? target : absoluteUrl(target)
}

function robotsFor(directive?: string | null, noindex?: boolean): Metadata['robots'] {
  if (directive) {
    const parts = directive.toLowerCase().split(/[,\s]+/).filter(Boolean)
    return { index: !parts.includes('noindex'), follow: !parts.includes('nofollow') }
  }
  return noindex ? { index: false, follow: false } : undefined
}

/** Single source of page metadata so canonical/OG/Twitter never drift apart. */
export function pageMetadata({ title, description, path, image, noindex, canonical, robots }: PageMetaInput): Metadata {
  const url = canonicalFor(path, canonical)
  const images = image ? [{ url: image, alt: title }] : undefined
  return {
    title,
    description,
    alternates: url ? { canonical: url } : undefined,
    robots: robotsFor(robots, noindex),
    openGraph: {
      title,
      description,
      url: url ?? absoluteUrl(path),
      siteName: site.name,
      type: 'website',
      locale: 'en_US',
      images,
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
  }
}

/** Renders JSON-LD. Kept as a function so pages never hand-write script tags. */
export function jsonLd(data: Record<string, unknown>) {
  return {
    type: 'application/ld+json',
    // JSON.stringify already escapes quotes; `<` is the only XSS vector left.
    html: JSON.stringify(data).replace(/</g, '\\u003c'),
  }
}

export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  }
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': absoluteUrl('/#organization'),
    name: site.name,
    url: site.url,
    // Google reads `logo` off the organisation, not off the page. Absolute, and
    // pointing at a real file in /public — a broken logo URL invalidates the
    // whole node.
    logo: absoluteUrl('/logo-mark.png'),
    description: site.description,
    email: site.email,
    areaServed: 'US',
    currenciesAccepted: 'USD',
  }
}
