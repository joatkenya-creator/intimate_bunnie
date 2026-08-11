import type { Metadata } from 'next'
import Link from 'next/link'
import { queryOne } from '@/lib/sql'
import { formatUSD } from '@/lib/money'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Order confirmed',
  description: 'Your Intimate Bunnie order is confirmed.',
  path: '/checkout/confirmation',
  noindex: true,
})

type OrderSummary = {
  number: string
  email: string
  totalCents: number
  shipName: string
  shipCity: string
  shipState: string
  items: { id: string; name: string; variantName: string | null; quantity: number; unitCents: number }[]
}

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const number = (await searchParams).order
  const order = number
    ? await queryOne<OrderSummary>(
        `SELECT o."number", o."email", o."totalCents", o."shipName", o."shipCity", o."shipState",
           COALESCE((
             SELECT json_agg(json_build_object('id', i."id", 'name', i."name", 'variantName', i."variantName",
                                               'quantity', i."quantity", 'unitCents', i."unitCents"))
             FROM "OrderItem" i WHERE i."orderId" = o."id"
           ), '[]'::json) AS items
         FROM "Order" o WHERE o."number" = $1`,
        [number],
      )
    : null

  if (!order) {
    return (
      <div className="container-ib py-24 text-center">
        <h1 className="text-3xl">We couldn&apos;t find that order</h1>
        <p className="mt-3 text-sm text-plum-500">Check the link in your confirmation email, or contact us.</p>
        <Link href="/shop" className="btn btn-outline mt-8">
          Back to shop
        </Link>
      </div>
    )
  }

  return (
    <div className="container-ib max-w-2xl py-16">
      <p className="eyebrow">Order {order.number}</p>
      <h1 className="mt-3 text-4xl">Thank you.</h1>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-plum-700">
        We sent a confirmation to <strong>{order.email}</strong>. Your parcel ships to {order.shipName} in {order.shipCity},{' '}
        {order.shipState} in unbranded packaging.
      </p>

      <ul className="mt-10 divide-y divide-line border-y border-line">
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
      <p className="flex justify-between py-4 text-base font-medium">
        <span>Total paid</span>
        <span>{formatUSD(order.totalCents)}</span>
      </p>

      <div className="mt-6 flex gap-3">
        <Link href="/shop" className="btn btn-primary">
          Keep shopping
        </Link>
        <Link href="/account/orders" className="btn btn-outline">
          View orders
        </Link>
      </div>
    </div>
  )
}
