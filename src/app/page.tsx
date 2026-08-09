import Link from 'next/link'
import { featuredProducts, newArrivals, topCategories } from '@/server/catalog'
import { ProductGrid } from '@/components/product/ProductCard'
import { Section, SectionHeading } from '@/components/ui/Section'
import { RecentlyViewed } from '@/components/product/RecentlyViewed'
import { imageUrl } from '@/services/media'

// Live inventory, and no KV binding on the free plan to back ISR.
export const dynamic = 'force-dynamic'

const promises = [
  { title: 'Discreet by default', copy: 'Plain outer packaging. Neutral billing descriptor. No branding, ever.' },
  { title: 'Body-safe materials', copy: 'Platinum silicone and medical-grade steel. We list every material, every time.' },
  { title: 'Honest reviews', copy: 'Verified buyers only. We do not delete the two-star ones.' },
]

export default async function HomePage() {
  const [categories, featured, fresh] = await Promise.all([topCategories(6), featuredProducts(8), newArrivals(4)])

  return (
    <>
      {/* Hero — editorial split, no full-bleed gradient. */}
      <section className="border-b border-line bg-peach-50">
        <div className="container-ib grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-24">
          <div className="max-w-xl">
            <p className="eyebrow">New season · Intimates</p>
            <h1 className="mt-3 text-4xl leading-[1.1] lg:text-6xl">
              Pleasure, <em className="not-italic text-rose-500">beautifully</em> considered.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-plum-700 lg:text-lg">
              Sheer lace, rose-petal vibrators, warm body oils, and jewelry that catches the light. Chosen for women who
              know exactly what they like.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn btn-primary">
                Shop the collection
              </Link>
              <Link href="/shop/lingerie" className="btn btn-outline">
                Lingerie &amp; thongs
              </Link>
            </div>
            <p className="mt-6 text-xs uppercase tracking-[0.12em] text-plum-500">
              Free discreet U.S. shipping over $59
            </p>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden bg-shell lg:aspect-[5/6]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl('https://picsum.photos/seed/ib-hero/1000/1200', { width: 1000 })}
                alt="Blush silk and lace intimates styled on a peach backdrop"
                width={1000}
                height={1200}
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-5 left-0 hidden bg-cream px-6 py-4 lg:block">
              <p className="font-display text-2xl text-rose-500">4.8★</p>
              <p className="text-xs text-plum-500">from 2,100+ verified reviews</p>
            </div>
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
                  src={imageUrl(cat.heroImage ?? `https://picsum.photos/seed/${cat.slug}/800/540`, { width: 800 })}
                  alt=""
                  width={800}
                  height={540}
                  loading="lazy"
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
