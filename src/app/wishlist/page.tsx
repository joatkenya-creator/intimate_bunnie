import type { Metadata } from 'next'
import { WishlistView } from '@/components/product/WishlistView'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Wishlist',
  description: 'Products you saved at Intimate Bunnie.',
  path: '/wishlist',
  noindex: true,
})

export default function WishlistPage() {
  return (
    <div className="container-ib py-14">
      <p className="eyebrow">Saved</p>
      <h1 className="mt-2 text-3xl">Your wishlist</h1>
      <div className="mt-8">
        <WishlistView />
      </div>
    </div>
  )
}
