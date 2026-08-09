import 'server-only'
import { db } from '@/lib/db'
import { normalize, type RawRecord } from './normalize'

export * from './normalize'

export type ImportReport = { created: number; updated: number; skipped: number; errors: string[] }

/** Upserts by SKU — re-running an import updates rather than duplicating. */
export async function importProducts(records: RawRecord[]): Promise<ImportReport> {
  const report: ImportReport = { created: 0, updated: 0, skipped: 0, errors: [] }
  const seen = new Set<string>()

  for (const record of records) {
    const product = normalize(record)
    if (!product) {
      report.skipped++
      continue
    }
    if (seen.has(product.sku)) {
      report.skipped++
      continue
    }
    seen.add(product.sku)

    const category = await db.category.findUnique({ where: { slug: product.categorySlug }, select: { id: true } })
    if (!category) {
      report.errors.push(`${product.sku}: unknown category "${product.categorySlug}"`)
      continue
    }

    const existing = await db.product.findUnique({ where: { sku: product.sku }, select: { id: true } })
    const data = {
      slug: product.slug,
      name: product.name,
      summary: product.summary,
      description: product.description,
      priceCents: product.priceCents,
      comparePrice: product.comparePrice,
      inventory: product.inventory,
      tags: product.tags,
      categoryId: category.id,
    }

    if (existing) {
      await db.product.update({ where: { id: existing.id }, data })
      report.updated++
    } else {
      await db.product.create({
        data: {
          ...data,
          sku: product.sku,
          media: {
            create: product.media.map((m, i) => ({
              url: m.url,
              altText: m.altText,
              position: i,
              sourceUrl: m.sourceUrl,
              sourceType: 'import',
              licenseStatus: 'unverified',
            })),
          },
        },
      })
      report.created++
    }
  }

  return report
}
