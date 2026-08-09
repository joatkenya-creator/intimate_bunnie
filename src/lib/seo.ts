import type { Metadata } from 'next'
import { site, absoluteUrl } from '@/config/site'

type PageMetaInput = {
  title: string
  description: string
  path: string
  image?: string | null
  noindex?: boolean
}

/** Single source of page metadata so canonical/OG/Twitter never drift apart. */
export function pageMetadata({ title, description, path, image, noindex }: PageMetaInput): Metadata {
  const url = absoluteUrl(path)
  const images = image ? [{ url: image, alt: title }] : undefined
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: { title, description, url, siteName: site.name, type: 'website', locale: 'en_US', images },
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
    name: site.name,
    url: site.url,
    description: site.description,
    email: site.email,
    areaServed: 'US',
    currenciesAccepted: 'USD',
  }
}
