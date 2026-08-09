import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatUSD } from '@/lib/money'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Order history',
  description: 'Your Intimate Bunnie order history.',
  path: '/account/orders',
  noindex: true,
})

export default async function OrdersPage() {
  const user = await currentUser().catch(() => null)
  if (!user) redirect('/account/login')

  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      number: true,
      status: true,
      totalCents: true,
      createdAt: true,
      items: { select: { id: true, name: true, variantName: true, quantity: true, unitCents: true } },
    },
  })

  return (
    <div className="container-ib max-w-3xl py-14">
      <p className="eyebrow">Account</p>
      <h1 className="mt-2 text-3xl">Order history</h1>

      {orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-plum-500">You haven&apos;t ordered anything yet.</p>
          <Link href="/shop" className="btn btn-primary mt-6">
            Browse the shop
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-6">
          {orders.map((order) => (
            <li key={order.number} className="border border-line">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-shell px-5 py-3 text-sm">
                <span className="font-medium">{order.number}</span>
                <span className="text-xs uppercase tracking-wider text-plum-500">{order.status}</span>
                <span className="text-xs text-plum-500">{order.createdAt.toLocaleDateString('en-US')}</span>
                <span className="font-medium">{formatUSD(order.totalCents)}</span>
              </div>
              <ul className="divide-y divide-line px-5">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                    <span>
                      {item.name}
                      {item.variantName && <span className="text-plum-500"> · {item.variantName}</span>}
                      <span className="text-plum-500"> × {item.quantity}</span>
                    </span>
                    <span>{formatUSD(item.unitCents * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
