import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { query } from '@/lib/sql'
import { formatUSD } from '@/lib/money'
import { isReturnable } from '@/lib/returns'
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

  const orders = await query<{
    number: string
    status: string
    totalCents: number
    createdAt: Date
    items: { id: string; name: string; variantName: string | null; quantity: number; unitCents: number }[]
    returns: { number: string; status: string; resolutionNote: string | null }[]
  }>(
    `SELECT o."number", o."status", o."totalCents", o."createdAt",
       COALESCE((
         SELECT json_agg(json_build_object('id', i."id", 'name', i."name", 'variantName', i."variantName",
                                           'quantity', i."quantity", 'unitCents', i."unitCents"))
         FROM "OrderItem" i WHERE i."orderId" = o."id"
       ), '[]'::json) AS items,
       COALESCE((
         SELECT json_agg(json_build_object('number', r."number", 'status', r."status",
                                           'resolutionNote', r."resolutionNote") ORDER BY r."createdAt" DESC)
         FROM "Return" r WHERE r."orderId" = o."id"
       ), '[]'::json) AS returns
     FROM "Order" o
     WHERE o."userId" = $1
     ORDER BY o."createdAt" DESC LIMIT 50`,
    [user.id],
  )

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

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs">
                {order.returns.length > 0 ? (
                  <span className="text-plum-500">
                    Return {order.returns[0].number} · {order.returns[0].status.toLowerCase()}
                    {order.returns[0].resolutionNote && ` — ${order.returns[0].resolutionNote}`}
                  </span>
                ) : (
                  <span className="text-plum-300">Unopened items can go back within 30 days.</span>
                )}
                {isReturnable(order) && order.returns.length === 0 && (
                  <Link href={`/account/orders/${order.number}/return`} className="uppercase tracking-wider link-underline">
                    Request a return
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
