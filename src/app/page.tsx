import type { Metadata } from 'next'
import Link from 'next/link'
import { featuredProducts, newArrivals, topCategories } from '@/server/catalog'
import { ProductGrid } from '@/components/product/ProductCard'
import { Section, SectionHeading } from '@/components/ui/Section'
import { RecentlyViewed } from '@/components/product/RecentlyViewed'
import { imageUrl, imageSrcSet, PLACEHOLDER_IMAGE } from '@/services/media'
import { site } from '@/config/site'
import { pageMetadata } from '@/lib/seo'

// The root layout carries the site title and description; what it cannot carry
// is a canonical, because the layout does not know which URL it is rendering.
// Without this, every `/?utm_source=…` and `/?fbclid=…` is a separate URL with
// no canonical pointing home.
export const metadata: Metadata = {
  ...pageMetadata({ title: `${site.name} — ${site.tagline}`, description: site.description, path: '/' }),
  // `absolute` opts out of the layout's `%s | Intimate Bunnie` template, which
  // would otherwise print the brand name twice on the one page it owns.
  title: { absolute: `${site.name} — ${site.tagline}` },
}

// Live inventory. ISR would not help here anyway: the header reads the session
// cookie, which opts every storefront route into dynamic rendering.
export const dynamic = 'force-dynamic'

// Two tiles per row on phones, three from `lg`.
const TILE_SIZES = '(min-width: 1024px) 33vw, 50vw'
const TILE_WIDTHS = [384, 640, 750]
const HERO_WIDTHS = [640, 828, 1080, 1920]

const promises = [
  { title: 'Discreet by default', copy: 'Plain outer packaging. Neutral billing descriptor. No branding, ever.' },
  { title: 'Body-safe materials', copy: 'Platinum silicone and medical-grade steel. We list every material, every time.' },
  { title: 'Honest reviews', copy: 'Verified buyers only. We do not delete the two-star ones.' },
]

export default async function HomePage() {
  const [categories, featured, fresh] = await Promise.all([topCategories(6), featuredProducts(8), newArrivals(4)])

  return (
    <>
      {/* Hero — the shot is never cropped. Below lg it runs full width at its
          own aspect; from lg the height is capped and the image sets its own
          width from that, sitting flush right. A blurred, scaled copy of the
          same file fills the space it leaves, so capping the height costs no
          pixels of the original and no bare band beside it. */}
      <section className="relative overflow-hidden border-b border-line bg-plum-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl('/hero.webp', { width: 640 })}
          alt=""
          aria-hidden
          className="absolute inset-0 hidden h-full w-full scale-110 object-cover blur-2xl lg:block"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl('/hero.webp', { width: 1920 })}
          srcSet={imageSrcSet('/hero.webp', HERO_WIDTHS)}
          sizes="(min-width: 1024px) 60vw, 100vw"
          alt="Black silk robe and lace lingerie styled on a rose-lit bed"
          width={1672}
          height={941}
          fetchPriority="high"
          className="relative w-full lg:ml-auto lg:h-[480px] lg:w-auto xl:h-[540px]"
        />
        <div
          aria-hidden
          className="hidden lg:absolute lg:inset-0 lg:block lg:bg-gradient-to-r lg:from-plum-900 lg:from-30% lg:to-transparent lg:to-65%"
        />
        <div className="container-ib py-12 lg:absolute lg:inset-0 lg:pt-[70px]">
          <div className="max-w-xl text-cream">
            <p className="eyebrow text-rose-300">New season · Intimates</p>
            <h1 className="mt-3 text-4xl leading-[1.1] text-cream lg:text-6xl">
              Pleasure, <em className="not-italic text-rose-300">beautifully</em> considered.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-cream/85 lg:text-lg">
              Sheer lace, rose-petal vibrators, warm body oils, and jewelry that catches the light. Chosen for women who
              know exactly what they like.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn btn-primary">
                Shop the collection
              </Link>
              <Link
                href="/shop/lingerie"
                className="btn border-cream text-cream hover:bg-cream hover:text-plum-900"
              >
                Lingerie &amp; thongs
              </Link>
            </div>
            <p className="mt-6 text-xs uppercase tracking-[0.12em] text-cream/70">
              Free discreet U.S. shipping over $59
            </p>
          </div>
        </div>
      </section>

      {/* Category tiles */}
      <Section>
        <SectionHeading eyebrow="Browse" title="Shop by category" href="/shop" linkLabel="All products" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
          {categories.map((cat) => (
            <Link key={cat.slug} href={`/shop/${cat.slug}`} className="group relative block overflow-hidden bg-shell">
              <div className="aspect-[3/2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cat.heroImage ? imageUrl(cat.heroImage, { width: 828 }) : PLACEHOLDER_IMAGE}
                  srcSet={cat.heroImage ? imageSrcSet(cat.heroImage, TILE_WIDTHS) : undefined}
                  sizes={cat.heroImage ? TILE_SIZES : undefined}
                  alt=""
                  width={800}
                  height={540}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-plum-900/75 to-transparent px-5 pb-4 pt-10">
                <h3 className="text-lg text-cream">{cat.name}</h3>
                {cat.description && <p className="mt-0.5 line-clamp-1 text-xs text-peach-100">{cat.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Featured */}
      <Section className="!pt-0">
        <SectionHeading eyebrow="Most loved" title="Bestsellers this month" href="/shop?sort=rating" />
        <ProductGrid products={featured} />
      </Section>

      {/* Promise band */}
      <section className="border-y border-line bg-shell">
        <div className="container-ib grid gap-8 py-12 md:grid-cols-3">
          {promises.map((item) => (
            <div key={item.title}>
              <h2 className="text-lg">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-plum-500">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* New arrivals */}
      <Section>
        <SectionHeading eyebrow="Just in" title="New arrivals" href="/shop?sort=newest" />
        <ProductGrid products={fresh} priorityCount={0} />
      </Section>

      <RecentlyViewed />
    </>
  )
}
