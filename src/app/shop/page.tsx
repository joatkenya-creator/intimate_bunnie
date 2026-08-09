import type { Metadata } from 'next'
import { listProducts } from '@/server/catalog'
import { CatalogView, parseFilters, type SearchParamsRecord } from '@/components/product/CatalogView'
import { pageMetadata, jsonLd, breadcrumbSchema } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Shop All — Lingerie, Toys, Oils & Body Jewelry',
  description:
    'Browse every Intimate Bunnie product: lace lingerie and thongs, rose vibrators, dildos, penis rings, lubricants, body oils, and body jewelry. Discreet U.S. shipping.',
  path: '/shop',
})

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const params = await searchParams
  const filters = parseFilters(params)
  const { items, total, page, pageCount } = await listProducts(filters)
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
