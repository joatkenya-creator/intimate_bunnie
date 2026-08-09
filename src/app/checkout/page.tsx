import type { Metadata } from 'next'
import { currentUser } from '@/lib/auth'
import { CheckoutForm } from '@/components/cart/CheckoutForm'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Checkout',
  description: 'Complete your Intimate Bunnie order.',
  path: '/checkout',
  noindex: true,
})

export default async function CheckoutPage() {
  const user = await currentUser().catch(() => null)

  return (
    <div className="container-ib py-12">
      <h1 className="text-3xl">Checkout</h1>
      <p className="mt-2 max-w-lg text-sm text-plum-500">
        Guest checkout is fine. Your order ships in plain packaging with a neutral billing descriptor.
      </p>
      <CheckoutForm defaultEmail={user?.email ?? ''} defaultName={user?.name ?? ''} />
    </div>
  )
}
