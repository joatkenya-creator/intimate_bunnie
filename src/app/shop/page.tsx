import type { Metadata } from 'next'
import { listProducts } from '@/server/catalog'
import { notFound } from 'next/navigation'
import { CatalogView, canonicalPath, parseFilters, type SearchParamsRecord } from '@/components/product/CatalogView'
import { pageMetadata, jsonLd, breadcrumbSchema } from '@/lib/seo'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>
}): Promise<Metadata> {
  const params = await searchParams
  const page = parseFilters(params).page ?? 1
  return pageMetadata({
    title: page > 1 ? `Shop All — Page ${page}` : 'Shop All — Lingerie, Toys, Oils & Body Jewelry',
    description:
      'Browse every Intimate Bunnie product: lace lingerie and thongs, rose vibrators, dildos, penis rings, lubricants, body oils, and body jewelry. Discreet U.S. shipping.',
    path: canonicalPath('/shop', params),
  })
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const params = await searchParams
  const filters = parseFilters(params)
  const { items, total, page, pageCount } = await listProducts(filters)
  // A page number past the end is an empty 200 — a soft 404, and an unbounded
  // crawl surface. Answer it as the 404 it is.
  if (page > pageCount && page > 1) notFound()
  const crumbs = jsonLd(breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Shop', path: '/shop' }]))

  return (
    <>
      <script type={crumbs.type} dangerouslySetInnerHTML={{ __html: crumbs.html }} />
      <div className="border-b border-line bg-peach-50">
        <div className="container-ib py-10 lg:py-14">
          <p className="eyebrow">Everything</p>
          <h1 className="mt-2 text-3xl lg:text-4xl">Shop all</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-plum-700">
            Every piece is body-safe, honestly described, and shipped in plain packaging.
          </p>
        </div>
      </div>
      <div className="pt-10">
        <CatalogView basePath="/shop" params={params} products={items} total={total} page={page} pageCount={pageCount} />
      </div>
    </>
  )
}
