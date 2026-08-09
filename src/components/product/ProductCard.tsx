import Link from 'next/link'
import { formatUSD, percentOff } from '@/lib/money'
import { imageUrl, PLACEHOLDER_IMAGE } from '@/services/media'
import { StarIcon } from '@/components/ui/icons'
import type { ProductCardData } from '@/server/catalog'
import { WishlistButton } from './WishlistButton'

/**
 * Server component. The only client JS on a grid of 24 cards is the wishlist
 * heart — the card itself, hover swap included, is CSS.
 */
export function ProductCard({ product, priority }: { product: ProductCardData; priority?: boolean }) {
  const [primary, secondary] = product.media
  const off = percentOff(product.priceCents, product.comparePrice)
  const soldOut = product.inventory <= 0

  return (
    <article className="group relative">
      <div className="relative aspect-[4/5] overflow-hidden bg-shell">
        <Link href={`/product/${product.slug}`} tabIndex={-1} aria-hidden className="block h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={primary ? imageUrl(primary.url, { width: 640 }) : PLACEHOLDER_IMAGE}
            alt=""
            width={640}
            height={800}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-0"
          />
          {secondary && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl(secondary.url, { width: 640 })}
              alt=""
              width={640}
              height={800}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          )}
        </Link>

        {off !== null && !soldOut && (
          <span className="absolute left-0 top-3 bg-rose-500 px-2.5 py-1 text-[0.6875rem] uppercase tracking-wider text-white">
            {off}% off
          </span>
        )}
        {soldOut && (
          <span className="absolute left-0 top-3 bg-plum-900 px-2.5 py-1 text-[0.6875rem] uppercase tracking-wider text-cream">
            Sold out
          </span>
        )}

        <WishlistButton productId={product.id} productName={product.name} />
      </div>

      <div className="pt-3">
        <p className="eyebrow">{product.category.name}</p>
        <h3 className="mt-1 text-[0.9375rem] font-medium leading-snug">
          <Link href={`/product/${product.slug}`} className="after:absolute after:inset-0 hover:text-rose-500">
            {product.name}
          </Link>
        </h3>

        {product.reviewCount > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs text-plum-500">
            <StarIcon className="h-3.5 w-3.5 text-peach-500" filled />
            {product.rating.toFixed(1)}
            <span className="text-plum-300">({product.reviewCount})</span>
          </p>
        )}

        <p className="mt-1.5 flex items-baseline gap-2 text-sm">
          <span className={off !== null ? 'font-medium text-rose-600' : 'font-medium'}>
            {formatUSD(product.priceCents)}
          </span>
          {product.comparePrice && off !== null && (
            <span className="text-xs text-plum-300 line-through">{formatUSD(product.comparePrice)}</span>
          )}
        </p>
      </div>
    </article>
  )
}

export function ProductGrid({ products, priorityCount = 4 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} priority={i < priorityCount} />
      ))}
    </div>
  )
}
