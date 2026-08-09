'use client'

import Link from 'next/link'
import { useCart, lineKey } from './CartProvider'
import { formatUSD, quoteTotals } from '@/lib/money'
import { imageUrl } from '@/services/media'

export function CartPageClient() {
  const { lines, subtotalCents, setQuantity, remove } = useCart()

  if (lines.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-plum-500">Your bag is empty.</p>
        <Link href="/shop" className="btn btn-primary mt-6">
          Start shopping
        </Link>
      </div>
    )
  }

  const totals = quoteTotals(subtotalCents)

  return (
    <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_20rem]">
      <ul className="divide-y divide-line border-y border-line">
        {lines.map((line) => {
          const key = lineKey(line)
          return (
            <li key={key} className="flex gap-5 py-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(line.image, { width: 200 })}
                alt=""
                width={100}
                height={125}
                loading="lazy"
                className="h-[125px] w-[100px] shrink-0 bg-shell object-cover"
              />
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <Link href={`/product/${line.slug}`} className="text-base font-medium hover:text-rose-500">
                    {line.name}
                  </Link>
                  {line.variantName && <p className="mt-0.5 text-sm text-plum-500">{line.variantName}</p>}
                  <p className="mt-1 text-sm">{formatUSD(line.unitCents)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="sr-only" htmlFor={`cart-qty-${key}`}>
                    Quantity for {line.name}
                  </label>
                  <select
                    id={`cart-qty-${key}`}
                    value={line.quantity}
                    onChange={(e) => setQuantity(key, Number(e.target.value))}
                    className="border border-line bg-white px-2 py-1 text-sm"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => remove(key)} className="text-xs text-plum-500 underline hover:text-rose-500">
                    Remove
                  </button>
                </div>
              </div>
              <p className="w-20 shrink-0 text-right text-sm font-medium">
                {formatUSD(line.unitCents * line.quantity)}
              </p>
            </li>
          )
        })}
      </ul>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <h2 className="text-xl">Order summary</h2>
        <dl className="mt-5 space-y-2.5 border-y border-line py-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-plum-500">Subtotal</dt>
            <dd>{formatUSD(totals.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-plum-500">Shipping</dt>
            <dd>{totals.shippingCents === 0 ? 'Free' : formatUSD(totals.shippingCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-plum-500">Estimated tax</dt>
            <dd>{formatUSD(totals.taxCents)}</dd>
          </div>
        </dl>
        <div className="flex justify-between py-4 text-base font-medium">
          <span>Total</span>
          <span>{formatUSD(totals.totalCents)}</span>
        </div>
        <Link href="/checkout" className="btn btn-primary w-full">
          Checkout
        </Link>
        <p className="mt-3 text-xs text-plum-500">
          Final totals are recalculated on the server at checkout.
        </p>
      </aside>
    </div>
  )
}
