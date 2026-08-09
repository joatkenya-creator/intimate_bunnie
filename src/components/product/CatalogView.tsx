import Link from 'next/link'
import { ProductGrid } from './ProductCard'
import { SortSelect } from './SortSelect'
import type { CatalogFilters, ProductCardData, SortKey } from '@/server/catalog'

export type SearchParamsRecord = Record<string, string | string[] | undefined>

const PRICE_BANDS = [
  { label: 'Under $25', min: 0, max: 2499 },
  { label: '$25 – $49', min: 2500, max: 4999 },
  { label: '$50 – $99', min: 5000, max: 9999 },
  { label: '$100+', min: 10000, max: undefined },
]

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
]

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function parseFilters(params: SearchParamsRecord): CatalogFilters {
  const sort = one(params.sort)
  return {
    q: one(params.q)?.slice(0, 80) || undefined,
    minCents: Number.isFinite(Number(one(params.min))) && one(params.min) ? Number(one(params.min)) : undefined,
    maxCents: Number.isFinite(Number(one(params.max))) && one(params.max) ? Number(one(params.max)) : undefined,
    inStock: one(params.stock) === '1',
    sort: SORTS.some((s) => s.value === sort) ? (sort as SortKey) : 'featured',
    page: Math.max(1, Number(one(params.page)) || 1),
  }
}

/** Builds a href with patched params; nulls remove a key and reset paging. */
function href(basePath: string, params: SearchParamsRecord, patch: Record<string, string | null>) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    const v = one(value)
    if (v) next.set(key, v)
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) next.delete(key)
    else next.set(key, value)
  }
  if (!('page' in patch)) next.delete('page')
  const qs = next.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

type Props = {
  basePath: string
  params: SearchParamsRecord
  products: ProductCardData[]
  total: number
  page: number
  pageCount: number
  subcategories?: { slug: string; name: string }[]
}

export function CatalogView({ basePath, params, products, total, page, pageCount, subcategories = [] }: Props) {
  const filters = parseFilters(params)
  const activeBand = PRICE_BANDS.find((b) => b.min === filters.minCents && b.max === filters.maxCents)
  const hasFilters = Boolean(activeBand || filters.inStock)

  return (
    <div className="container-ib grid gap-10 pb-16 lg:grid-cols-[15rem_1fr] lg:gap-12">
      {/* Filters are plain links: server-rendered, crawlable, zero JS. */}
      <aside aria-label="Filters" className="lg:sticky lg:top-28 lg:self-start">
        {subcategories.length > 0 && (
          <div className="mb-8">
            <h2 className="eyebrow mb-3">Refine</h2>
            <ul className="space-y-1.5">
              {subcategories.map((sub) => (
                <li key={sub.slug}>
                  <Link href={`/shop/${sub.slug}`} className="text-sm text-plum-700 hover:text-rose-500">
                    {sub.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mb-8">
          <h2 className="eyebrow mb-3">Price</h2>
          <ul className="space-y-1.5">
            {PRICE_BANDS.map((band) => {
              const active = band === activeBand
              return (
                <li key={band.label}>
                  <Link
                    href={href(
                      basePath,
                      params,
                      active
                        ? { min: null, max: null }
                        : { min: String(band.min), max: band.max === undefined ? '' : String(band.max) },
                    )}
                    aria-current={active ? 'true' : undefined}
                    className={`text-sm hover:text-rose-500 ${active ? 'font-medium text-rose-500' : 'text-plum-700'}`}
                  >
                    {band.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="mb-8">
          <h2 className="eyebrow mb-3">Availability</h2>
          <Link
            href={href(basePath, params, { stock: filters.inStock ? null : '1' })}
            aria-pressed={filters.inStock}
            className={`text-sm hover:text-rose-500 ${filters.inStock ? 'font-medium text-rose-500' : 'text-plum-700'}`}
          >
            In stock only
          </Link>
        </div>

        {hasFilters && (
          <Link href={basePath} className="text-xs uppercase tracking-[0.1em] text-plum-500 link-underline">
            Clear filters
          </Link>
        )}
      </aside>

      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <p className="text-sm text-plum-500">
            {total} {total === 1 ? 'product' : 'products'}
          </p>
          <SortSelect options={SORTS} value={filters.sort ?? 'featured'} />
        </div>

        {products.length === 0 ? (
          <div className="py-20 text-center">
            <h2 className="text-xl">Nothing matches those filters</h2>
            <p className="mt-2 text-sm text-plum-500">Try a wider price range, or browse everything.</p>
            <Link href="/shop" className="btn btn-outline mt-6">
              Shop all products
            </Link>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}

        {pageCount > 1 && (
          <nav aria-label="Pagination" className="mt-14 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link href={href(basePath, params, { page: String(page - 1) })} rel="prev" className="btn btn-outline">
                Previous
              </Link>
            )}
            <span className="px-4 text-sm text-plum-500">
              Page {page} of {pageCount}
            </span>
            {page < pageCount && (
              <Link href={href(basePath, params, { page: String(page + 1) })} rel="next" className="btn btn-outline">
                Next
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  )
}
