import type { MetadataRoute } from 'next'
import { query } from '@/lib/sql'
import { absoluteUrl } from '@/config/site'

export const dynamic = 'force-dynamic'

// The seven documents that exist as code in app/pages/[slug], whether or not a
// CMS entry has been written for them.
const STATIC_SLUGS = ['about', 'shipping', 'returns', 'care', 'faq', 'privacy', 'terms']

const isNoindex = (robots: string | null) => Boolean(robots?.toLowerCase().includes('noindex'))

type ContentRow = { slug: string; updatedAt: Date; robots: string | null }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A sitemap that 500s is worse than a short one: Search Console records the
  // fetch failure and backs off. The static entries below always exist, so a
  // database blip degrades the file instead of breaking it.
  const [categories, products, entries] = await Promise.all([
    query<{ slug: string }>('SELECT "slug" FROM "Category" WHERE "visible" = true').catch(() => []),
    query<{ slug: string; updatedAt: Date }>(
      'SELECT "slug", "updatedAt" FROM "Product" WHERE "active" = true LIMIT 5000',
    ).catch(() => []),
    query<ContentRow>(
      `SELECT "slug", "updatedAt", "robots" FROM "ContentEntry"
       WHERE "type" IN ('PAGE', 'POLICY') AND "status" = 'PUBLISHED' LIMIT 500`,
    ).catch((): ContentRow[] => []),
  ])

  // A CMS entry marked noindex overrides the static document of the same slug —
  // listing it here while the page says noindex is a contradiction a crawler
  // reports back as an error.
  const suppressed = new Set(entries.filter((entry) => isNoindex(entry.robots)).map((entry) => entry.slug))
  const managed = entries.filter((entry) => !isNoindex(entry.robots))

  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/shop'), changeFrequency: 'daily', priority: 0.9 },
    ...STATIC_SLUGS.filter((slug) => !suppressed.has(slug)).map((slug) => ({
      url: absoluteUrl(`/pages/${slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
    ...managed
      .filter((entry) => !STATIC_SLUGS.includes(entry.slug))
      .map((entry) => ({
        url: absoluteUrl(`/pages/${entry.slug}`),
        lastModified: entry.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.3,
      })),
    ...categories.map((c) => ({
      url: absoluteUrl(`/shop/${c.slug}`),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: absoluteUrl(`/product/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
