'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useCart } from './CartProvider'
import { placeOrder } from '@/actions/checkout'
import { formatUSD, quoteTotals } from '@/lib/money'
import { US_STATES, stateForZip } from '@/lib/zip'

export function CheckoutForm({ defaultEmail, defaultName }: { defaultEmail: string; defaultName: string }) {
  const { lines, subtotalCents, clear } = useCart()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  // The ZIP decides the state, never the other way round: a state has thousands
  // of ZIPs, so filling one from the other would invent an address.
  const [state, setState] = useState('')
  const [zipFilledState, setZipFilledState] = useState(false)

  function onZipChange(value: string) {
    const resolved = stateForZip(value)
    if (resolved && US_STATES.includes(resolved as (typeof US_STATES)[number]) && resolved !== state) {
      setState(resolved)
      setZipFilledState(true)
    }
  }

  if (lines.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-plum-500">There is nothing to check out.</p>
        <Link href="/shop" className="btn btn-primary mt-6">
          Browse products
        </Link>
      </div>
    )
  }

  const totals = quoteTotals(subtotalCents)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const data = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await placeOrder({
        email: String(data.get('email')),
        fullName: String(data.get('fullName')),
        line1: String(data.get('line1')),
        line2: String(data.get('line2') ?? ''),
        city: String(data.get('city')),
        state: String(data.get('state')),
        zip: String(data.get('zip')),
        lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
      })

      if (!result.ok) {
        setError(result.error)
        return
      }
      clear()
      router.push(`/checkout/confirmation?order=${result.orderNumber}`)
    })
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-12 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        <fieldset>
          <legend className="eyebrow mb-4">Contact</legend>
          <label htmlFor="email" className="mb-1.5 block text-sm">
            Email
          </label>
          <input id="email" name="email" type="email" required defaultValue={defaultEmail} autoComplete="email" className="field" />
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-4">Shipping address (U.S. only)</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="fullName" className="mb-1.5 block text-sm">
                Full name
              </label>
              <input id="fullName" name="fullName" required defaultValue={defaultName} autoComplete="name" className="field" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="line1" className="mb-1.5 block text-sm">
                Street address
              </label>
              <input id="line1" name="line1" required autoComplete="address-line1" className="field" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="line2" className="mb-1.5 block text-sm">
                Apartment, suite <span className="text-plum-300">(optional)</span>
              </label>
              <input id="line2" name="line2" autoComplete="address-line2" className="field" />
            </div>
            <div>
              <label htmlFor="city" className="mb-1.5 block text-sm">
                City
              </label>
              <input id="city" name="city" required autoComplete="address-level2" className="field" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="state" className="mb-1.5 block text-sm">
                  State
                </label>
                <select
                  id="state"
                  name="state"
                  required
                  autoComplete="address-level1"
                  className="field"
                  value={state}
                  onChange={(event) => {
                    setState(event.target.value)
                    setZipFilledState(false)
                  }}
                  aria-describedby={zipFilledState ? 'state-hint' : undefined}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {US_STATES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
                {zipFilledState && (
                  <p id="state-hint" role="status" className="mt-1.5 text-xs text-plum-500">
                    Filled from your ZIP. Change it if that is wrong.
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="zip" className="mb-1.5 block text-sm">
                  ZIP
                </label>
                <input
                  id="zip"
                  name="zip"
                  required
                  inputMode="numeric"
                  autoComplete="postal-code"
                  className="field"
                  onChange={(event) => onZipChange(event.target.value)}
                />
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="eyebrow mb-4">Payment</legend>
          <div className="border border-line bg-peach-50 p-5 text-sm text-plum-700">
            <p className="font-medium">Test payment mode</p>
            <p className="mt-1.5 leading-relaxed text-plum-500">
              No card is charged. Orders are recorded through the payment abstraction so a live provider can be
              connected without changing this checkout.
            </p>
          </div>
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <h2 className="text-xl">Order summary</h2>
        <ul className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
          {lines.map((line) => (
            <li key={`${line.productId}:${line.variantId ?? ''}`} className="flex justify-between gap-4">
              <span className="text-plum-700">
                {line.name}
                {line.variantName && <span className="text-plum-500"> · {line.variantName}</span>}
                <span className="text-plum-500"> × {line.quantity}</span>
              </span>
              <span>{formatUSD(line.unitCents * line.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2.5 border-t border-line py-4 text-sm">
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
        <div className="flex justify-between border-t border-line py-4 text-base font-medium">
          <span>Total</span>
          <span>{formatUSD(totals.totalCents)}</span>
        </div>

        {error && (
          <p role="alert" className="mb-3 border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? 'Placing order…' : `Place order — ${formatUSD(totals.totalCents)}`}
        </button>
      </aside>
    </form>
  )
}
