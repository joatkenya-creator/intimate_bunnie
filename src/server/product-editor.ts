import 'server-only'
import { db } from '@/lib/db'
import type { EditorProduct } from '@/components/admin/ProductEditor'

// Shared by /admin/products/new and /admin/products/[id]. The two pages differ
// only in whether a product comes back, so the option lists load once here.

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time, not an ISO string. */
function toLocalInput(date: Date | null): string | null {
  if (!date) return null
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export async function editorOptions() {
  const [categories, collections, brands, products] = await Promise.all([
    db.category.findMany({ orderBy: [{ parentId: 'asc' }, { position: 'asc' }], select: { id: true, name: true } }),
    db.collection.findMany({ where: { automatic: false }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.brand.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    // Capped: the related-products picker is a select, and a select with the
    // whole catalog in it is unusable long before it is slow.
    db.product.findMany({ orderBy: { name: 'asc' }, take: 300, select: { id: true, name: true } }),
  ])
  return { categories, collections, brands, products }
}

export async function loadEditorProduct(id: string): Promise<EditorProduct | null> {
  const product = await db.product.findUnique({
    where: { id },
    include: {
      media: { orderBy: { position: 'asc' } },
      variants: { orderBy: { position: 'asc' } },
      collections: { select: { id: true } },
    },
  })
  if (!product) return null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    summary: product.summary,
    description: product.description,
    priceCents: product.priceCents,
    comparePrice: product.comparePrice,
    inventory: product.inventory,
    lowStockAt: product.lowStockAt,
    status: product.status,
    publishAt: toLocalInput(product.publishAt),
    featured: product.featured,
    tags: product.tags,
    categoryId: product.categoryId,
    brandId: product.brandId,
    weightGrams: product.weightGrams,
    shippingClass: product.shippingClass,
    seoTitle: product.seoTitle,
    seoDesc: product.seoDesc,
    canonicalUrl: product.canonicalUrl,
    ogImage: product.ogImage,
    robots: product.robots,
    relatedIds: product.relatedIds,
    boughtTogetherIds: product.boughtTogetherIds,
    attributes: Array.isArray(product.attributes) ? (product.attributes as { label: string; value: string }[]) : [],
    media: product.media.map((item) => ({ url: item.url, altText: item.altText, width: item.width, height: item.height })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      optionName: variant.optionName,
      optionValue: variant.optionValue,
      sku: variant.sku,
      priceDelta: variant.priceDelta,
      inventory: variant.inventory,
    })),
    collectionIds: product.collections.map((collection) => collection.id),
  }
}
