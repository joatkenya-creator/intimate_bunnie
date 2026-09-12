import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { categoryBySlug, listProducts } from '@/server/catalog'
import { CatalogView, canonicalPath, parseFilters, type SearchParamsRecord } from '@/components/product/CatalogView'
import { imageUrl, imageSrcSet } from '@/services/media'
import { pageMetadata, jsonLd, breadcrumbSchema } from '@/lib/seo'

// The side-flush banners top out at 1672px and never render wider than half the
// viewport, so asking the optimiser for more would ship a heavier file for
// nothing. A baked banner is different: it runs edge to edge, and the baked
// headline is the first thing to go soft when the browser paints a 1080px
// rendition across 1440 CSS pixels — so it gets renditions up to its own 2353.
const HERO_WIDTHS = [640, 828, 1080, 1200]
const BAKED_WIDTHS = [828, 1200, 1920, 2048]
// Baked type is thin serif on a gradient; the 72 default re-encodes it into mush.
const BAKED_QUALITY = 85

// Each banner's intrinsic size, and which side the image sits on. The copy
// takes the opposite side, so it lands on the blurred fill rather than on her.
// `baked` marks the banners that carry their own headline (see
// scripts/bake-hero-copy.mjs): those run full width so the words sit where the
// art put them, and the overlay drops to a bar underneath.
// `inset` is art shot with its own negative space: it also runs full width and
// uncropped, but the HTML copy sits inside that space instead of beside the
// image, so the CTA stays a real link. `imageRight` says which side the space
// is on, same as the side-flush banners, and `copy` sizes the column to that
// space (default `lg:w-[42%]`; `lg:self-start` pins it to the top for art whose
// subject climbs into the lower half). `light` is inset art whose negative
// space is pale — marble, plaster — so from lg the copy flips from cream to
// plum; below lg it still sits under the image on the plum section.
const BANNERS: Record<
  string,
  {
    width: number
    height: number
    imageRight: boolean
    baked?: boolean
    inset?: boolean
    copy?: string
    light?: boolean
  }
> = {
  thongs: { width: 1672, height: 941, imageRight: true },
  bodysuits: { width: 1344, height: 768, imageRight: true },
  babydolls: { width: 1344, height: 768, imageRight: false },
  lingerie: { width: 1344, height: 768, imageRight: false },
  vibrators: { width: 2353, height: 941, imageRight: true, baked: true },
  'rose-vibrators': { width: 2353, height: 941, imageRight: true, baked: true },
  'bullet-wand': { width: 2353, height: 941, imageRight: true, baked: true },
  dildos: { width: 2560, height: 1440, imageRight: false, inset: true },
  'for-him': { width: 2560, height: 1440, imageRight: true, inset: true },
  'penis-rings': { width: 2560, height: 1440, imageRight: true, inset: true, copy: 'lg:w-[42%] lg:self-start' },
  strokers: { width: 2560, height: 1440, imageRight: false, inset: true, copy: 'lg:w-[36%]' },
  enhancement: { width: 2560, height: 1440, imageRight: true, inset: true, copy: 'lg:w-[36%]' },
  wellness: { width: 2560, height: 1440, imageRight: true, inset: true, light: true, copy: 'lg:w-[36%] lg:self-start' },
  lubricants: { width: 2560, height: 1440, imageRight: false, inset: true, light: true },
  'body-oils': { width: 2560, height: 1440, imageRight: true, inset: true, light: true, copy: 'lg:w-[42%] lg:self-start' },
  condoms: { width: 2560, height: 1440, imageRight: false, inset: true, light: true, copy: 'lg:w-[42%] lg:self-start' },
  'body-jewelry': { width: 2560, height: 1440, imageRight: true, inset: true, copy: 'lg:w-[28%]' },
  'nose-jewelry': { width: 2560, height: 1440, imageRight: true, inset: true, copy: 'lg:w-[40%]' },
  // Shot edge to edge with no clear space, so these fall back to side-flush:
  // the whole frame still shows, the copy just sits on the blurred fill.
  'belly-rings': { width: 2560, height: 1440, imageRight: true },
  'tongue-bars': { width: 2560, height: 1440, imageRight: true },
  'nipple-jewelry': { width: 2560, height: 1440, imageRight: true },
}
const BANNER_FALLBACK = { width: 1344, height: 768, imageRight: false }

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
  const { width, height, imageRight, baked, inset, copy, light } = BANNERS[category.slug] ?? BANNER_FALLBACK
  // Full-width banners bring their own room for the copy; the side-flush ones
  // borrow it from a blurred fill.
  const fullWidth = baked || inset
  // Plum on pale art from lg up; the rose primary stays off it so no blush
  // lands on the marble.
  const ink = light
    ? {
        nav: 'lg:text-plum-500 lg:[&_a:hover]:text-rose-600',
        current: 'lg:text-plum-900',
        h1: 'lg:text-plum-900',
        p: 'lg:text-plum-700',
        solid: 'lg:border-plum-900 lg:bg-plum-900 lg:text-cream lg:hover:bg-plum-700',
        ghost: 'lg:border-plum-900 lg:text-plum-900 lg:hover:bg-plum-900 lg:hover:text-cream',
      }
    : { nav: '', current: '', h1: '', p: '', solid: '', ghost: '' }

  return (
    <>
      <script type={crumbs.type} dangerouslySetInnerHTML={{ __html: crumbs.html }} />

      {/* Hero. A local heroImage is one of our 16:9 category banners; the seeded
          remote placeholders are portrait, so those keep the plain header. The
          banner is never cropped. Below lg it runs full width at its own aspect;
          from lg the height is capped and the image takes its width from that,
          sitting flush to one side so the copy has the other to itself.
          A blurred, scaled copy of the same file fills the space the cap leaves,
          so bounding the height costs no pixels and leaves no bare band. */}
      {banner ? (
        <section className="relative overflow-hidden border-b border-line bg-plum-900">
          {!fullWidth && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl(banner, { width: 640 })}
              alt=""
              aria-hidden
              className="absolute inset-0 hidden h-full w-full scale-110 object-cover blur-2xl lg:block"
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(banner, { width: fullWidth ? 1920 : 1200, quality: baked ? BAKED_QUALITY : undefined })}
            srcSet={imageSrcSet(banner, fullWidth ? BAKED_WIDTHS : HERO_WIDTHS, baked ? BAKED_QUALITY : undefined)}
            sizes={fullWidth ? '100vw' : '(min-width: 1024px) 960px, 100vw'}
            alt=""
            width={width}
            height={height}
            fetchPriority="high"
            className={
              fullWidth
                ? 'relative w-full'
                : `relative w-full lg:h-[480px] lg:w-auto xl:h-[540px] ${imageRight ? 'lg:ml-auto' : 'lg:mr-auto'}`
            }
          />
          {!fullWidth && (
            <div
              aria-hidden
              className={`hidden lg:absolute lg:inset-0 lg:block lg:from-black/85 lg:via-black/60 lg:to-transparent ${
                imageRight ? 'lg:bg-gradient-to-r' : 'lg:bg-gradient-to-l'
              }`}
            />
          )}
          <div
            className={`container-ib py-10 ${
              baked ? '' : inset ? 'lg:absolute lg:inset-0 lg:flex lg:items-center' : 'lg:absolute lg:inset-0 lg:pt-[70px]'
            }`}
          >
            {/* The inset art keeps roughly 40% of its width clear, so the copy
                is held to that rather than max-w-xl, which would reach the
                products at lg. */}
            <div
              className={`max-w-xl text-cream ${inset ? `${copy ?? 'lg:w-[42%]'} lg:max-w-none` : ''} ${
                imageRight || baked ? '' : 'lg:ml-auto'
              }`}
            >
              <nav aria-label="Breadcrumb" className={`mb-4 text-xs text-cream/75 ${ink.nav}`}>
                <ol className="flex flex-wrap items-center gap-1.5">
                  {trail.slice(0, -1).map((crumb) => (
                    <li key={crumb.path} className="flex items-center gap-1.5">
                      <Link href={crumb.path} className="hover:text-rose-300">
                        {crumb.name}
                      </Link>
                      <span aria-hidden>/</span>
                    </li>
                  ))}
                  <li aria-current="page" className={`text-cream ${ink.current}`}>
                    {category.name}
                  </li>
                </ol>
              </nav>
              <h1 className={`text-4xl leading-[1.1] text-cream lg:text-5xl ${ink.h1} ${baked ? 'lg:sr-only' : ''}`}>
                {category.name}
              </h1>
              {category.description && (
                <p className={`mt-4 text-base leading-relaxed text-cream/85 ${ink.p} ${baked ? 'lg:sr-only' : ''}`}>
                  {category.description}
                </p>
              )}
              {category.children.length === 0 && inset && (
                <div className="mt-7">
                  <a href="#products" className={`btn border-cream bg-cream text-plum-900 hover:bg-white ${ink.solid}`}>
                    Shop {category.name}
                  </a>
                </div>
              )}
              {category.children.length > 0 && (
                <div className="mt-7 flex flex-wrap gap-3">
                  {category.children.slice(0, 3).map((sub, i) => (
                    <Link
                      key={sub.slug}
                      href={`/shop/${sub.slug}`}
                      className={
                        i === 0
                          ? `btn btn-primary ${ink.solid}`
                          : `btn border-cream text-cream hover:bg-cream hover:text-plum-900 ${ink.ghost}`
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

      <div id="products" className="pt-10">
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
