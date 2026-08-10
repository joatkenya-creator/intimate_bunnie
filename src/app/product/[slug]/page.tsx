import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { productBySlug, relatedProducts } from '@/server/catalog'
import { AddToCart } from '@/components/cart/AddToCart'
import { ProductGrid } from '@/components/product/ProductCard'
import { Gallery } from '@/components/product/Gallery'
import { RecentlyViewed, TrackView } from '@/components/product/RecentlyViewed'
import { SectionHeading } from '@/components/ui/Section'
import { StarIcon } from '@/components/ui/icons'
import { formatUSD, percentOff } from '@/lib/money'
import { pageMetadata, jsonLd, breadcrumbSchema } from '@/lib/seo'
import { absoluteUrl } from '@/config/site'

type Params = { slug: string }

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const product = await productBySlug((await params).slug)
  if (!product) return pageMetadata({ title: 'Product not found', description: '', path: '/shop', noindex: true })

  return pageMetadata({
    title: product.seoTitle ?? product.name,
    description: product.seoDesc ?? product.summary,
    path: `/product/${product.slug}`,
    image: product.media[0]?.url,
  })
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const product = await productBySlug((await params).slug)
  if (!product) notFound()

  const related = await relatedProducts(product.categoryId, product.id)
  const off = percentOff(product.priceCents, product.comparePrice)
  const inStock = product.inventory > 0 || product.variants.some((v) => v.inventory > 0)

  const trail = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: product.category.name, path: `/shop/${product.category.slug}` },
    { name: product.name, path: `/product/${product.slug}` },
  ]

  const schema = jsonLd({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.summary,
    sku: product.sku,
    image: product.media.map((m) => m.url),
    brand: { '@type': 'Brand', name: product.brand?.name ?? 'Intimate Bunnie' },
    ...(product.reviewCount > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating.toFixed(1),
        reviewCount: product.reviewCount,
      },
    }),
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/product/${product.slug}`),
      priceCurrency: 'USD',
      price: (product.priceCents / 100).toFixed(2),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  })
  const crumbs = jsonLd(breadcrumbSchema(trail))

  return (
    <>
      <script type={schema.type} dangerouslySetInnerHTML={{ __html: schema.html }} />
      <script type={crumbs.type} dangerouslySetInnerHTML={{ __html: crumbs.html }} />
      <TrackView productId={product.id} />

      <div className="container-ib pt-6">
        <nav aria-label="Breadcrumb" className="text-xs text-plum-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            {trail.slice(0, -1).map((crumb) => (
              <li key={crumb.path} className="flex items-center gap-1.5">
                <Link href={crumb.path} className="hover:text-rose-500">
                  {crumb.name}
                </Link>
                <span aria-hidden>/</span>
              </li>
            ))}
            <li aria-current="page" className="truncate text-plum-700">
              {product.name}
            </li>
          </ol>
        </nav>
      </div>

      <article className="container-ib grid gap-10 pb-16 pt-8 lg:grid-cols-2 lg:gap-16">
        <Gallery media={product.media} productName={product.name} />

        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">{product.brand?.name ?? product.category.name}</p>
          <h1 className="mt-2 text-3xl leading-tight lg:text-[2.5rem]">{product.name}</h1>

          {product.reviewCount > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-plum-500">
              <span className="flex" aria-hidden>
                {[1, 2, 3, 4, 5].map((n) => (
                  <StarIcon key={n} className="h-4 w-4 text-peach-500" filled={n <= Math.round(product.rating)} />
                ))}
              </span>
              <span>
                {product.rating.toFixed(1)} · {product.reviewCount} reviews
              </span>
            </p>
          )}

          <div className="mt-5 flex items-baseline gap-3">
            <p className={`text-2xl ${off !== null ? 'text-rose-600' : ''}`}>{formatUSD(product.priceCents)}</p>
            {product.comparePrice && off !== null && (
              <>
                <p className="text-base text-plum-300 line-through">{formatUSD(product.comparePrice)}</p>
                <span className="bg-rose-50 px-2 py-0.5 text-xs uppercase tracking-wider text-rose-600">
                  Save {off}%
                </span>
              </>
            )}
          </div>

          <p className="mt-5 text-[0.9375rem] leading-relaxed text-plum-700">{product.summary}</p>

          <div className="mt-8">
            <AddToCart
              productId={product.id}
              slug={product.slug}
              name={product.name}
              priceCents={product.priceCents}
              image={product.media[0]?.url ?? ''}
              inventory={product.inventory}
              optionName={product.variants[0]?.optionName}
              variants={product.variants.map((v) => ({
                id: v.id,
                label: v.optionValue,
                priceDelta: v.priceDelta,
                inventory: v.inventory,
              }))}
            />
          </div>

          <ul className="mt-8 space-y-2 border-t border-line pt-6 text-sm text-plum-500">
            <li>Ships in unbranded packaging with a neutral billing descriptor.</li>
            <li>Free U.S. shipping on orders over $59.</li>
            <li>30-day returns on unopened items.</li>
          </ul>

          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-lg">Details</h2>
            <div className="mt-3 space-y-3 text-[0.9375rem] leading-relaxed text-plum-700">
              {product.description.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            <dl className="mt-5 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
              <dt className="text-plum-500">SKU</dt>
              <dd>{product.sku}</dd>
              <dt className="text-plum-500">Category</dt>
              <dd>
                <Link href={`/shop/${product.category.slug}`} className="link-underline">
                  {product.category.name}
                </Link>
              </dd>
              {product.tags.length > 0 && (
                <>
                  <dt className="text-plum-500">Tags</dt>
                  <dd className="text-plum-700">{product.tags.join(', ')}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </article>

      {product.reviews.length > 0 && (
        <section className="container-ib pb-16">
          <SectionHeading eyebrow="Verified buyers" title="Reviews" />
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {product.reviews.map((review) => (
              <li key={review.id} className="border border-line bg-white p-5">
                <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <StarIcon key={n} className="h-3.5 w-3.5 text-peach-500" filled={n <= review.rating} />
                  ))}
                </div>
                <h3 className="mt-3 text-base">{review.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-plum-700">{review.body}</p>
                <p className="mt-3 text-xs text-plum-500">
                  {/* Timestamps arrive as ISO strings from json_agg, not Dates. */}
                  {review.authorName} · {new Date(review.createdAt).toLocaleDateString('en-US')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="container-ib pb-16">
          <SectionHeading eyebrow="You may also like" title={`More in ${product.category.name}`} href={`/shop/${product.category.slug}`} />
          <ProductGrid products={related} priorityCount={0} />
        </section>
      )}

      <RecentlyViewed excludeId={product.id} />
    </>
  )
}
