import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { daysLeftToReturn, isReturnable } from '@/lib/returns'
import { ReturnRequestForm } from '@/components/account/ReturnRequestForm'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Request a return',
  description: 'Start a return for an Intimate Bunnie order.',
  path: '/account/orders',
  noindex: true,
})

export default async function ReturnPage({ params }: { params: Promise<{ number: string }> }) {
  const user = await currentUser().catch(() => null)
  if (!user) redirect('/account/login')

  const { number } = await params
  const order = await db.order.findUnique({
    where: { number },
    select: {
      number: true,
      userId: true,
      status: true,
      createdAt: true,
      items: { select: { id: true, name: true, variantName: true, quantity: true, unitCents: true } },
      returns: { select: { number: true, status: true }, where: { status: { in: ['REQUESTED', 'APPROVED'] } } },
    },
  })

  // Someone else's order is indistinguishable from one that does not exist.
  if (!order || order.userId !== user.id) notFound()

  return (
    <div className="container-ib max-w-lg py-16">
      <p className="eyebrow">Order {order.number}</p>
      <h1 className="mt-2 text-3xl">Request a return</h1>

      {isReturnable(order) ? (
        <>
          <p className="mt-2 text-sm text-plum-500">
            {daysLeftToReturn(order)} days left on this order&apos;s return window.
          </p>
          {order.returns.length > 0 && (
            <p className="mt-6 border border-line bg-peach-50 px-4 py-3 text-sm">
              Return {order.returns[0].number} on this order is already {order.returns[0].status.toLowerCase()}.
            </p>
          )}
          <ReturnRequestForm number={order.number} items={order.items} />
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-plum-500">
            This order is past its 30-day return window, or is not in a state we can take back.
          </p>
          <p className="mt-6 text-sm">
            If it arrived damaged or faulty, write to us anyway — that is handled separately from the window.
          </p>
          <Link href="/account/orders" className="btn btn-outline mt-6">
            Back to orders
          </Link>
        </>
      )}
    </div>
  )
}
