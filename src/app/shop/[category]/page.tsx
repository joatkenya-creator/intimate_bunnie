import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { categoryBySlug, listProducts } from '@/server/catalog'
import { CatalogView, canonicalPath, parseFilters, type SearchParamsRecord } from '@/components/product/CatalogView'
import { imageUrl, imageSrcSet } from '@/services/media'
import { pageMetadata, jsonLd, breadcrumbSchema } from '@/lib/seo'

const HERO_WIDTHS = [640, 828, 1080, 1920]

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
  const banner = category.heroImage?.startsWith('/') ? category.heroImage : null

  return (
    <>
      <script type={crumbs.type} dangerouslySetInnerHTML={{ __html: crumbs.html }} />

      {/* Hero. A local heroImage is one of our landscape category banners, shown
          uncropped at its own aspect with the copy over its dark side; the
          seeded remote placeholders are portrait, so those keep the plain
          header. Below lg the copy drops under the image. */}
      {banner ? (
        <section className="relative border-b border-line bg-plum-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(banner, { width: 1920 })}
            srcSet={imageSrcSet(banner, HERO_WIDTHS)}
            sizes="100vw"
            alt=""
            width={1344}
            height={768}
            fetchPriority="high"
            className="w-full"
          />
          <div
            aria-hidden
            className="hidden lg:absolute lg:inset-0 lg:block lg:bg-gradient-to-r lg:from-black/85 lg:via-black/55 lg:to-transparent"
          />
          <div className="container-ib py-10 lg:absolute lg:inset-0 lg:flex lg:items-center lg:py-0">
            <div className="max-w-xl text-cream">
              <nav aria-label="Breadcrumb" className="mb-4 text-xs text-cream/75">
                <ol className="flex flex-wrap items-center gap-1.5">
                  {trail.slice(0, -1).map((crumb) => (
                    <li key={crumb.path} className="flex items-center gap-1.5">
                      <Link href={crumb.path} className="hover:text-rose-300">
                        {crumb.name}
                      </Link>
                      <span aria-hidden>/</span>
                    </li>
                  ))}
                  <li aria-current="page" className="text-cream">
                    {category.name}
                  </li>
                </ol>
              </nav>
              <h1 className="text-4xl leading-[1.1] text-cream lg:text-5xl">{category.name}</h1>
              {category.description && (
                <p className="mt-4 text-base leading-relaxed text-cream/85">{category.description}</p>
              )}
              {category.children.length > 0 && (
                <div className="mt-7 flex flex-wrap gap-3">
                  {category.children.slice(0, 3).map((sub, i) => (
                    <Link
                      key={sub.slug}
                      href={`/shop/${sub.slug}`}
                      className={
                        i === 0
                          ? 'btn btn-primary'
                          : 'btn border-cream text-cream hover:bg-cream hover:text-plum-900'
                      }
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
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
      )}

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
