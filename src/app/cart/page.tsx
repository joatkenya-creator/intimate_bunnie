import type { Metadata } from 'next'
import { CartPageClient } from '@/components/cart/CartPageClient'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Your bag',
  description: 'Review the items in your Intimate Bunnie bag.',
  path: '/cart',
  noindex: true,
})

export default function CartPage() {
  return (
    <div className="container-ib py-12">
      <h1 className="text-3xl">Your bag</h1>
      <CartPageClient />
    </div>
  )
}
