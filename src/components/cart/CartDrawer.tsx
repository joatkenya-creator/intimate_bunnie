'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useCart, lineKey } from './CartProvider'
import { CloseIcon } from '@/components/ui/icons'
import { formatUSD, FREE_SHIPPING_THRESHOLD_CENTS } from '@/lib/money'

export function CartDrawer() {
  const { lines, isOpen, setOpen, setQuantity, remove, subtotalCents } = useCart()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, setOpen])

  if (!isOpen) return null

  const remaining = FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <button
        className="absolute inset-0 bg-plum-900/40"
        aria-label="Close bag"
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-[26rem] flex-col bg-cream shadow-xl outline-none"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg">Your bag</h2>
          <button onClick={() => setOpen(false)} aria-label="Close bag" className="p-1 text-plum-500 hover:text-plum-900">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-plum-500">Your bag is empty.</p>
            <Link href="/shop" onClick={() => setOpen(false)} className="btn btn-outline">
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {lines.map((line) => {
                const key = lineKey(line)
                return (
                  <li key={key} className="flex gap-4 py-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={line.image}
                      alt=""
                      width={72}
                      height={90}
                      loading="lazy"
                      className="h-[90px] w-[72px] shrink-0 bg-shell object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/product/${line.slug}`}
                        onClick={() => setOpen(false)}
                        className="block truncate text-sm font-medium hover:text-rose-500"
                      >
                        {line.name}
                      </Link>
                      {line.variantName && <p className="mt-0.5 text-xs text-plum-500">{line.variantName}</p>}
                      <p className="mt-1 text-sm">{formatUSD(line.unitCents)}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <label className="sr-only" htmlFor={`qty-${key}`}>
                          Quantity for {line.name}
                        </label>
                        <select
                          id={`qty-${key}`}
                          value={line.quantity}
                          onChange={(e) => setQuantity(key, Number(e.target.value))}
                          className="border border-line bg-white px-2 py-1 text-xs"
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
                  </li>
                )
              })}
            </ul>

            <footer className="border-t border-line px-5 py-4">
              {remaining > 0 && (
                <p className="mb-3 bg-peach-50 px-3 py-2 text-xs text-plum-700">
                  {formatUSD(remaining)} away from free discreet shipping.
                </p>
              )}
              <div className="mb-3 flex justify-between text-sm">
                <span>Subtotal</span>
                <span className="font-medium">{formatUSD(subtotalCents)}</span>
              </div>
              <p className="mb-3 text-xs text-plum-500">Shipping and tax calculated at checkout.</p>
              <Link href="/checkout" onClick={() => setOpen(false)} className="btn btn-primary w-full">
                Checkout
              </Link>
              <Link
                href="/cart"
                onClick={() => setOpen(false)}
                className="mt-2 block text-center text-xs text-plum-500 underline"
              >
                View bag
              </Link>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
