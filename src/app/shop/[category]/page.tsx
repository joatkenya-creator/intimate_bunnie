import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { categoryBySlug, listProducts } from '@/server/catalog'
import { CatalogView, canonicalPath, parseFilters, type SearchParamsRecord } from '@/components/product/CatalogView'
import { imageUrl, imageSrcSet } from '@/services/media'
import { pageMetadata, jsonLd, breadcrumbSchema } from '@/lib/seo'

// The banners top out at 1672px, so asking the optimiser for more would upscale
// the source and ship a soft, heavier file for nothing.
const HERO_WIDTHS = [640, 828, 1080, 1200]

// Each banner's intrinsic size, and which side the copy takes — always the half
// the model is not standing on, so the words never land over her.
const BANNERS: Record<string, { width: number; height: number; copyRight: boolean }> = {
  thongs: { width: 1672, height: 941, copyRight: true },
  bodysuits: { width: 1344, height: 768, copyRight: true },
  babydolls: { width: 1344, height: 768, copyRight: false },
  lingerie: { width: 1344, height: 768, copyRight: false },
}
const BANNER_FALLBACK = { width: 1344, height: 768, copyRight: false }

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
  const { width, height, copyRight } = BANNERS[category.slug] ?? BANNER_FALLBACK

  return (
    <>
      <script type={crumbs.type} dangerouslySetInnerHTML={{ __html: crumbs.html }} />

      {/* Hero. A local heroImage is one of our 16:9 category banners; the seeded
          remote placeholders are portrait, so those keep the plain header. The
          banner is never cropped. Below lg it runs full width at its own aspect;
          from lg the height is capped and the image takes its width from that,
          sitting flush to the copy's side so the words land on its empty half.
          A blurred, scaled copy of the same file fills the space the cap leaves,
          so bounding the height costs no pixels and leaves no bare band. */}
      {banner ? (
        <section className="relative overflow-hidden border-b border-line bg-plum-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(banner, { width: 640 })}
            alt=""
            aria-hidden
            className="absolute inset-0 hidden h-full w-full scale-110 object-cover blur-2xl lg:block"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(banner, { width: 1200 })}
            srcSet={imageSrcSet(banner, HERO_WIDTHS)}
            sizes="(min-width: 1024px) 960px, 100vw"
            alt=""
            width={width}
            height={height}
            fetchPriority="high"
            className={`relative w-full lg:h-[480px] lg:w-auto xl:h-[540px] ${
              copyRight ? 'lg:ml-auto' : 'lg:mr-auto'
            }`}
          />
          <div
            aria-hidden
            className={`hidden lg:absolute lg:inset-0 lg:block lg:from-black/85 lg:via-black/60 lg:to-transparent ${
              copyRight ? 'lg:bg-gradient-to-l' : 'lg:bg-gradient-to-r'
            }`}
          />
          <div className="container-ib py-10 lg:absolute lg:inset-0 lg:pt-[70px]">
            <div className={`max-w-xl text-cream ${copyRight ? 'lg:ml-auto' : ''}`}>
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
