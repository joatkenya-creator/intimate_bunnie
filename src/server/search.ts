import 'server-only'
import { query, binder, limitOffset } from '@/lib/sql'
import type { ProductCardData, CatalogFilters } from './catalog'
import { normaliseQuery } from '@/lib/search-query'

// Search, separate from the catalog queries because it needs something they do
// not: a relevance score to order by. Everything else lists in a fixed order —
// price, date, rating — and never has to rank a row against a phrase.
//
// Typo tolerance comes from pg_trgm's `word_similarity`, not plain `similarity`.
// The difference matters: `similarity('vibrater', 'The Rose Suction Vibrator')`
// is low because the name is long, while `word_similarity` scores the query
// against the best-matching run of words inside it and returns 0.67. Whole-string
// similarity finds nothing for most real typos.

export { normaliseQuery }

// Below this, `word_similarity` starts returning things a shopper would call
// wrong. Tuned against the real catalog: "lubrcant" and "shimer oil" both need
// under the pg_trgm default of 0.6, and 0.3 lets unrelated products through.
const NAME_THRESHOLD = 0.4
const SUMMARY_THRESHOLD = 0.5

/**
 * Matches a name or summary exactly, by substring, or approximately. The three
 * are OR'd so an exact match is never lost to a fuzzy one, and ranking puts them
 * back in the right order.
 */
function matchClause(p: ReturnType<typeof binder>, term: string): string {
  const exact = p.add(term)
  const contains = p.add(`%${term}%`)
  return `(
    p."name" ILIKE ${contains}
    OR p."summary" ILIKE ${contains}
    OR ${exact} = ANY(p."tags")
    OR word_similarity(${exact}, p."name") >= ${NAME_THRESHOLD}
    OR word_similarity(${exact}, p."summary") >= ${SUMMARY_THRESHOLD}
  )`
}

/** Starts-with beats contains, contains beats fuzzy, then trigram score. */
function rankOrder(p: ReturnType<typeof binder>, term: string): string {
  const prefix = p.add(`${term}%`)
  const contains = p.add(`%${term}%`)
  const exact = p.add(term)
  return `(p."name" ILIKE ${prefix}) DESC,
          (p."name" ILIKE ${contains}) DESC,
          GREATEST(word_similarity(${exact}, p."name"), word_similarity(${exact}, p."summary")) DESC,
          p."name" ASC`
}

export type Suggestion = {
  slug: string
  name: string
  priceCents: number
  categoryName: string
  image: string | null
}

/**
 * Autocomplete. Names, prices, and one thumbnail — never the catalog, and never
 * enough to render a grid from.
 */
export async function suggest(raw: string, take = 7): Promise<Suggestion[]> {
  const term = normaliseQuery(raw)
  if (term.length < 2) return []

  const p = binder()
  const where = matchClause(p, term)
  const order = rankOrder(p, term)

  return query<Suggestion>(
    `SELECT p."slug", p."name", p."priceCents", c."name" AS "categoryName",
       (SELECT pm."url" FROM "ProductMedia" pm WHERE pm."productId" = p."id" ORDER BY pm."position" ASC LIMIT 1) AS image
     FROM "Product" p
     JOIN "Category" c ON c."id" = p."categoryId"
     WHERE p."active" = true AND ${where}
     ORDER BY ${order}
     ${limitOffset(take)}`,
    p.values,
  )
}

const CARD_SELECT = `
  p."id", p."slug", p."name", p."summary", p."priceCents", p."comparePrice",
  p."inventory", p."rating", p."reviewCount",
  json_build_object('slug', c."slug", 'name', c."name") AS category,
  COALESCE((
    SELECT json_agg(json_build_object('url', t."url", 'altText', t."altText"))
    FROM (
      SELECT pm."url", pm."altText" FROM "ProductMedia" pm
      WHERE pm."productId" = p."id" ORDER BY pm."position" ASC LIMIT 2
    ) t
  ), '[]'::json) AS media`

export const SEARCH_PAGE_SIZE = 24

/**
 * The results page. Same card shape the catalog grid renders, ordered by
 * relevance rather than by a column — which is why this does not reuse
 * `listProducts`.
 */
export async function searchProducts(filters: CatalogFilters) {
  const term = normaliseQuery(filters.q ?? '')
  const page = Math.max(1, filters.page ?? 1)

  const conditions = (p: ReturnType<typeof binder>) => {
    const clauses = ['p."active" = true', matchClause(p, term)]
    if (filters.categorySlug) {
      const slug = p.add(filters.categorySlug)
      clauses.push(`(c."slug" = ${slug} OR EXISTS (
        SELECT 1 FROM "Category" parent WHERE parent."id" = c."parentId" AND parent."slug" = ${slug}))`)
    }
    if (filters.minCents !== undefined) clauses.push(`p."priceCents" >= ${p.add(filters.minCents)}`)
    if (filters.maxCents !== undefined) clauses.push(`p."priceCents" <= ${p.add(filters.maxCents)}`)
    if (filters.inStock) clauses.push('p."inventory" > 0')
    return clauses.join(' AND ')
  }

  if (term.length === 0) return { items: [], total: 0, page, pageCount: 1 }

  const listBinder = binder()
  const where = conditions(listBinder)
  const order = rankOrder(listBinder, term)

  const countBinder = binder()
  const countWhere = conditions(countBinder)

  const [items, counted] = await Promise.all([
    query<ProductCardData>(
      `SELECT ${CARD_SELECT}
       FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId"
       WHERE ${where}
       ORDER BY ${order}
       ${limitOffset(SEARCH_PAGE_SIZE, (page - 1) * SEARCH_PAGE_SIZE)}`,
      listBinder.values,
    ),
    query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId" WHERE ${countWhere}`,
      countBinder.values,
    ),
  ])

  const total = counted[0]?.total ?? 0
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE)) }
}
