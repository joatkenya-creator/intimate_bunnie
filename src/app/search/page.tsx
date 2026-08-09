import type { Metadata } from 'next'
import { listProducts } from '@/server/catalog'
import { CatalogView, parseFilters, type SearchParamsRecord } from '@/components/product/CatalogView'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>
}): Promise<Metadata> {
  const q = (await searchParams).q
  const term = Array.isArray(q) ? q[0] : q
  return pageMetadata({
    title: term ? `Search results for “${term}”` : 'Search',
    description: 'Search the Intimate Bunnie catalog.',
    path: '/search',
    // Search result pages are thin and infinite — keep them out of the index.
    noindex: true,
  })
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const params = await searchParams
  const filters = parseFilters(params)
  const { items, total, page, pageCount } = await listProducts(filters)

  return (
    <>
      <div className="border-b border-line bg-peach-50">
        <div className="container-ib py-10">
          <p className="eyebrow">Search</p>
          <h1 className="mt-2 text-3xl">
            {filters.q ? (
              <>
                Results for <span className="text-rose-500">“{filters.q}”</span>
              </>
            ) : (
              'Search the shop'
            )}
          </h1>
          <form action="/search" role="search" className="mt-5 flex max-w-lg gap-2">
            <label htmlFor="q" className="sr-only">
              Search products
            </label>
            <input id="q" name="q" type="search" defaultValue={filters.q ?? ''} placeholder="Try “rose vibrator”" className="field" />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="pt-10">
        <CatalogView basePath="/search" params={params} products={items} total={total} page={page} pageCount={pageCount} />
      </div>
    </>
  )
}
