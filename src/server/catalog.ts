import 'server-only'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export const PAGE_SIZE = 24

// Every list query pulls exactly the card fields. No SELECT *, no eager
// loading of descriptions into a grid of 24 products.
const cardSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  priceCents: true,
  comparePrice: true,
  inventory: true,
  rating: true,
  reviewCount: true,
  category: { select: { slug: true, name: true } },
  media: { take: 2, orderBy: { position: 'asc' }, select: { url: true, altText: true } },
} satisfies Prisma.ProductSelect

export type ProductCardData = Prisma.ProductGetPayload<{ select: typeof cardSelect }>

export type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'rating'

const orderByFor: Record<SortKey, Prisma.ProductOrderByWithRelationInput[]> = {
  featured: [{ featured: 'desc' }, { rating: 'desc' }],
  newest: [{ createdAt: 'desc' }],
  'price-asc': [{ priceCents: 'asc' }],
  'price-desc': [{ priceCents: 'desc' }],
  rating: [{ rating: 'desc' }, { reviewCount: 'desc' }],
}

export type CatalogFilters = {
  categorySlug?: string
  q?: string
  minCents?: number
  maxCents?: number
  inStock?: boolean
  sort?: SortKey
  page?: number
}

function whereFor({ categorySlug, q, minCents, maxCents, inStock }: CatalogFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { active: true }

  if (categorySlug) {
    // Match the category itself or any of its children, so /shop/lingerie
    // includes /shop/thongs without a second round trip.
    where.category = { OR: [{ slug: categorySlug }, { parent: { slug: categorySlug } }] }
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { tags: { has: q.toLowerCase() } },
    ]
  }
  if (minCents !== undefined || maxCents !== undefined) {
    where.priceCents = { ...(minCents !== undefined && { gte: minCents }), ...(maxCents !== undefined && { lte: maxCents }) }
  }
  if (inStock) where.inventory = { gt: 0 }

  return where
}

export async function listProducts(filters: CatalogFilters) {
  const page = Math.max(1, filters.page ?? 1)
  const where = whereFor(filters)

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      select: cardSelect,
      orderBy: orderByFor[filters.sort ?? 'featured'],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.product.count({ where }),
  ])

  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
}

export function featuredProducts(take = 8) {
  return db.product.findMany({
    where: { active: true, featured: true },
    select: cardSelect,
    orderBy: { rating: 'desc' },
    take,
  })
}

export function newArrivals(take = 8) {
  return db.product.findMany({
    where: { active: true },
    select: cardSelect,
    orderBy: { createdAt: 'desc' },
    take,
  })
}

export function productBySlug(slug: string) {
  return db.product.findFirst({
    where: { slug, active: true },
    select: {
      ...cardSelect,
      categoryId: true,
      description: true,
      sku: true,
      tags: true,
      seoTitle: true,
      seoDesc: true,
      brand: { select: { name: true, slug: true } },
      media: { orderBy: { position: 'asc' }, select: { url: true, altText: true, width: true, height: true } },
      variants: {
        orderBy: { optionValue: 'asc' },
        select: { id: true, optionName: true, optionValue: true, priceDelta: true, inventory: true },
      },
      reviews: {
        where: { approved: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, authorName: true, rating: true, title: true, body: true, createdAt: true },
      },
    },
  })
}

/** Same category, cheapest-first tie-break so the rail never looks random. */
export function relatedProducts(categoryId: string, excludeId: string, take = 4) {
  return db.product.findMany({
    where: { active: true, categoryId, NOT: { id: excludeId } },
    select: cardSelect,
    orderBy: [{ featured: 'desc' }, { rating: 'desc' }],
    take,
  })
}

export function categoryBySlug(slug: string) {
  return db.category.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      seoTitle: true,
      seoDesc: true,
      heroImage: true,
      parent: { select: { slug: true, name: true } },
      children: { orderBy: { position: 'asc' }, select: { slug: true, name: true } },
    },
  })
}

export function topCategories(take = 6) {
  return db.category.findMany({
    where: { parentId: null },
    orderBy: { position: 'asc' },
    take,
    select: { slug: true, name: true, description: true, heroImage: true },
  })
}

/** Autocomplete: names only, capped. Never ships the catalog to the browser. */
export function suggest(q: string, take = 6) {
  return db.product.findMany({
    where: { active: true, name: { contains: q, mode: 'insensitive' } },
    select: { slug: true, name: true },
    take,
  })
}

export function productsByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return db.product.findMany({ where: { id: { in: ids.slice(0, 12) }, active: true }, select: cardSelect })
}
