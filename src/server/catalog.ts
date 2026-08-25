import 'server-only'
import { query, queryOne, binder, limitOffset } from '@/lib/sql'

// The storefront query layer. Plain SQL over Neon's HTTP endpoint — see
// lib/sql.ts for why Prisma cannot serve these paths on the free plan.
//
// Types are hand-written here because there is no generator any more. They are
// the contract the components consume, so they get to be exactly the card
// fields and nothing else — which was already the rule with `select`.

export const PAGE_SIZE = 24

export type ProductCardData = {
  id: string
  slug: string
  name: string
  summary: string
  priceCents: number
  comparePrice: number | null
  inventory: number
  rating: number
  reviewCount: number
  category: { slug: string; name: string }
  media: { url: string; altText: string }[]
}

export type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'rating'

// Whitelisted, never interpolated from user input: a sort key that is not in
// this map falls back to `featured`.
//
// Every sort ends in `p."id"`. Without a unique tie-break Postgres may return
// tied rows in any order, which shuffles the grid between requests and — worse —
// lets a product appear on both page 1 and page 2, or on neither.
const TIE_BREAK = 'p."id" ASC'

const ORDER_BY: Record<SortKey, string> = {
  featured: `p."featured" DESC, p."rating" DESC, ${TIE_BREAK}`,
  newest: `p."createdAt" DESC, ${TIE_BREAK}`,
  'price-asc': `p."priceCents" ASC, ${TIE_BREAK}`,
  'price-desc': `p."priceCents" DESC, ${TIE_BREAK}`,
  rating: `p."rating" DESC, p."reviewCount" DESC, ${TIE_BREAK}`,
}

// Exactly the card fields. No SELECT *, and no description dragged into a grid
// of 24 products. Media comes back as JSON from a lateral join so two images
// per card cost no extra round trip.
const CARD_SCALARS = `
  p."id", p."slug", p."name", p."summary", p."priceCents", p."comparePrice",
  p."inventory", p."rating", p."reviewCount",
  json_build_object('slug', c."slug", 'name', c."name") AS category`

const CARD_COLUMNS = `${CARD_SCALARS}, COALESCE(m."media", '[]'::json) AS media`

const CARD_FROM = `
  FROM "Product" p
  JOIN "Category" c ON c."id" = p."categoryId"
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('url', t."url", 'altText', t."altText")) AS "media"
    FROM (
      SELECT pm."url", pm."altText" FROM "ProductMedia" pm
      WHERE pm."productId" = p."id" ORDER BY pm."position" ASC LIMIT 2
    ) t
  ) m ON true`

export type CatalogFilters = {
  categorySlug?: string
  q?: string
  minCents?: number
  maxCents?: number
  inStock?: boolean
  sort?: SortKey
  page?: number
}

/** Shared by the list and its count, so the two can never disagree. */
function whereFor(filters: CatalogFilters, p: ReturnType<typeof binder>): string {
  const clauses = ['p."active" = true']

  if (filters.categorySlug) {
    // The category itself or any of its children, so /shop/lingerie includes
    // /shop/thongs without a second round trip.
    const slug = p.add(filters.categorySlug)
    clauses.push(`(c."slug" = ${slug} OR EXISTS (
      SELECT 1 FROM "Category" parent WHERE parent."id" = c."parentId" AND parent."slug" = ${slug}))`)
  }
  if (filters.q) {
    const like = p.add(`%${filters.q}%`)
    const tag = p.add(filters.q.toLowerCase())
    clauses.push(`(p."name" ILIKE ${like} OR p."summary" ILIKE ${like} OR ${tag} = ANY(p."tags"))`)
  }
  if (filters.minCents !== undefined) clauses.push(`p."priceCents" >= ${p.add(filters.minCents)}`)
  if (filters.maxCents !== undefined) clauses.push(`p."priceCents" <= ${p.add(filters.maxCents)}`)
  if (filters.inStock) clauses.push('p."inventory" > 0')

  return clauses.join(' AND ')
}

export async function listProducts(filters: CatalogFilters) {
  const page = Math.max(1, filters.page ?? 1)

  const listBinder = binder()
  const where = whereFor(filters, listBinder)
  const order = ORDER_BY[filters.sort ?? 'featured'] ?? ORDER_BY.featured

  const countBinder = binder()
  const countWhere = whereFor(filters, countBinder)

  const [items, counted] = await Promise.all([
    query<ProductCardData>(
      `SELECT ${CARD_COLUMNS} ${CARD_FROM} WHERE ${where} ORDER BY ${order} ${limitOffset(PAGE_SIZE, (page - 1) * PAGE_SIZE)}`,
      listBinder.values,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId" WHERE ${countWhere}`,
      countBinder.values,
    ),
  ])

  const total = counted[0]?.total ?? 0
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) }
}

export function featuredProducts(take = 8) {
  return query<ProductCardData>(
    `SELECT ${CARD_COLUMNS} ${CARD_FROM}
     WHERE p."active" = true AND p."featured" = true
     ORDER BY p."rating" DESC, ${TIE_BREAK} ${limitOffset(take)}`,
  )
}

export function newArrivals(take = 8) {
  return query<ProductCardData>(
    `SELECT ${CARD_COLUMNS} ${CARD_FROM} WHERE p."active" = true ORDER BY p."createdAt" DESC, ${TIE_BREAK} ${limitOffset(take)}`,
  )
}

export type ProductDetail = ProductCardData & {
  categoryId: string
  description: string
  sku: string
  tags: string[]
  seoTitle: string | null
  seoDesc: string | null
  // Set from Admin → SEO. The page renders both; without them the editor writes
  // to columns nothing reads.
  canonicalUrl: string | null
  robots: string | null
  brand: { name: string; slug: string } | null
  variants: { id: string; optionName: string; optionValue: string; priceDelta: number; inventory: number }[]
  reviews: { id: string; authorName: string; rating: number; title: string; body: string; createdAt: string }[]
}

export function productBySlug(slug: string) {
  // The detail page wants the full gallery rather than the two-image card set,
  // so `media` is rebuilt here instead of reusing CARD_FROM.
  return queryOne<ProductDetail>(
    `SELECT ${CARD_SCALARS},
      COALESCE((
        SELECT json_agg(json_build_object('url', pm."url", 'altText', pm."altText", 'width', pm."width", 'height', pm."height") ORDER BY pm."position")
        FROM "ProductMedia" pm WHERE pm."productId" = p."id"
      ), '[]'::json) AS media,
      p."categoryId", p."description", p."sku", p."tags", p."seoTitle", p."seoDesc",
      p."canonicalUrl", p."robots",
      CASE WHEN b."id" IS NULL THEN NULL
           ELSE json_build_object('name', b."name", 'slug', b."slug") END AS brand,
      COALESCE((
        SELECT json_agg(json_build_object('id', v."id", 'optionName', v."optionName", 'optionValue', v."optionValue",
                                          'priceDelta', v."priceDelta", 'inventory', v."inventory") ORDER BY v."optionValue")
        FROM "Variant" v WHERE v."productId" = p."id"
      ), '[]'::json) AS variants,
      COALESCE((
        SELECT json_agg(r) FROM (
          SELECT rv."id", rv."authorName", rv."rating", rv."title", rv."body", rv."createdAt"
          FROM "Review" rv WHERE rv."productId" = p."id" AND rv."approved" = true
          ORDER BY rv."createdAt" DESC LIMIT 6
        ) r
      ), '[]'::json) AS reviews
     FROM "Product" p
     JOIN "Category" c ON c."id" = p."categoryId"
     LEFT JOIN "Brand" b ON b."id" = p."brandId"
     WHERE p."slug" = $1 AND p."active" = true`,
    [slug],
  )
}

/** Same category, featured and best-rated first so the rail never looks random. */
export function relatedProducts(categoryId: string, excludeId: string, take = 4) {
  return query<ProductCardData>(
    `SELECT ${CARD_COLUMNS} ${CARD_FROM}
     WHERE p."active" = true AND p."categoryId" = $1 AND p."id" <> $2
     ORDER BY p."featured" DESC, p."rating" DESC, ${TIE_BREAK} ${limitOffset(take)}`,
    [categoryId, excludeId],
  )
}

export type CategoryDetail = {
  id: string
  slug: string
  name: string
  description: string | null
  seoTitle: string | null
  seoDesc: string | null
  heroImage: string | null
  parent: { slug: string; name: string } | null
  children: { slug: string; name: string }[]
}

export function categoryBySlug(slug: string) {
  return queryOne<CategoryDetail>(
    `SELECT c."id", c."slug", c."name", c."description", c."seoTitle", c."seoDesc", c."heroImage",
      CASE WHEN pc."id" IS NULL THEN NULL
           ELSE json_build_object('slug', pc."slug", 'name', pc."name") END AS parent,
      COALESCE((
        SELECT json_agg(json_build_object('slug', ch."slug", 'name', ch."name") ORDER BY ch."position")
        FROM "Category" ch WHERE ch."parentId" = c."id" AND ch."visible" = true
      ), '[]'::json) AS children
     FROM "Category" c
     LEFT JOIN "Category" pc ON pc."id" = c."parentId"
     WHERE c."slug" = $1`,
    [slug],
  )
}

export function topCategories(take = 6) {
  return query<{ slug: string; name: string; description: string | null; heroImage: string | null }>(
    `SELECT "slug", "name", "description", "heroImage" FROM "Category"
     WHERE "parentId" IS NULL AND "visible" = true ORDER BY "position" ASC ${limitOffset(take)}`,
  )
}

/** Autocomplete: names only, capped. Never ships the catalog to the browser. */
export function suggest(q: string, take = 6) {
  return query<{ slug: string; name: string }>(
    `SELECT "slug", "name" FROM "Product" WHERE "active" = true AND "name" ILIKE $1 ${limitOffset(take)}`,
    [`%${q}%`],
  )
}

export function productsByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([])
  return query<ProductCardData>(
    `SELECT ${CARD_COLUMNS} ${CARD_FROM} WHERE p."active" = true AND p."id" = ANY($1)`,
    [ids.slice(0, 12)],
  )
}
