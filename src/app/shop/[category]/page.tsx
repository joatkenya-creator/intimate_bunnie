import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { categoryBySlug, listProducts } from '@/server/catalog'
import { CatalogView, canonicalPath, parseFilters, type SearchParamsRecord } from '@/components/product/CatalogView'
import { pageMetadata, jsonLd, breadcrumbSchema } from '@/lib/seo'

type Params = { category: string }

// Rendered per request: inventory and pricing must be live, and the free-plan
// Worker has no KV binding to back ISR. Add `revalidate` once a cache is wired.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParamsRecord>
}): Promise<Metadata> {
  const [{ category: slug }, sp] = await Promise.all([params, searchParams])
  const category = await categoryBySlug(slug)
  if (!category) {
    return pageMetadata({
      title: 'Category not found',
      description: 'This category is no longer available.',
      path: `/shop/${slug}`,
      canonical: false,
      noindex: true,
    })
  }

  const page = parseFilters(sp).page ?? 1
  // The brand is appended by the layout's title template, and repeating the
  // category name twice in one title is the template metadata this is meant to
  // avoid — not a phrase anyone searches for.
  const title = category.seoTitle ?? `Shop ${category.name}`

  return pageMetadata({
    title: page > 1 ? `${title} — Page ${page}` : title,
    description:
      category.seoDesc ?? category.description ?? `Shop ${category.name} at Intimate Bunnie. Discreet U.S. shipping.`,
    path: canonicalPath(`/shop/${category.slug}`, sp),
    image: category.heroImage,
  })
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParamsRecord>
}) {
  const [{ category: slug }, sp] = await Promise.all([params, searchParams])
  const category = await categoryBySlug(slug)
  if (!category) notFound()

  const filters = parseFilters(sp)
  const { items, total, page, pageCount } = await listProducts({ ...filters, categorySlug: slug })
  // Past the last page is a soft 404 and an unbounded crawl surface.
  if (page > pageCount && page > 1) notFound()

  const trail = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    ...(category.parent ? [{ name: category.parent.name, path: `/shop/${category.parent.slug}` }] : []),
    { name: category.name, path: `/shop/${category.slug}` },
  ]
  const crumbs = jsonLd(breadcrumbSchema(trail))

  return (
    <>
      <script type={crumbs.type} dangerouslySetInnerHTML={{ __html: crumbs.html }} />

      <div className="border-b border-line bg-peach-50">
        <div className="container-ib py-10 lg:py-14">
          <nav aria-label="Breadcrumb" className="mb-4 text-xs text-plum-500">
            <ol className="flex flex-wrap items-center gap-1.5">
              {trail.slice(0, -1).map((crumb) => (
                <li key={crumb.path} className="flex items-center gap-1.5">
                  <Link href={crumb.path} className="hover:text-rose-500">
                    {crumb.name}
                  </Link>
                  <span aria-hidden>/</span>
                </li>
              ))}
              <li aria-current="page" className="text-plum-700">
                {category.name}
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl lg:text-4xl">{category.name}</h1>
          {category.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-plum-700">{category.description}</p>
          )}
        </div>
      </div>

      <div className="pt-10">
        <CatalogView
          basePath={`/shop/${category.slug}`}
          params={sp}
          products={items}
          total={total}
          page={page}
          pageCount={pageCount}
          subcategories={category.children}
        />
      </div>
    </>
  )
}
