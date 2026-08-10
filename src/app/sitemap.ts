import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { absoluteUrl } from '@/config/site'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, pages] = await Promise.all([
    db.category.findMany({ where: { visible: true }, select: { slug: true } }),
    db.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true }, take: 5000 }),
    // CMS pages that are not one of the static documents below.
    db.contentEntry.findMany({
      where: { type: { in: ['PAGE', 'POLICY'] }, status: 'PUBLISHED', robots: null },
      select: { slug: true, updatedAt: true },
      take: 500,
    }),
  ])

  const staticSlugs = ['about', 'shipping', 'returns', 'care', 'faq', 'privacy', 'terms']

  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/shop'), changeFrequency: 'daily', priority: 0.9 },
    ...staticSlugs.map((slug) => ({
      url: absoluteUrl(`/pages/${slug}`),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
    ...pages
      .filter((page) => !staticSlugs.includes(page.slug))
      .map((page) => ({
        url: absoluteUrl(`/pages/${page.slug}`),
        lastModified: page.updatedAt,
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
