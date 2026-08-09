'use client'

import { useState } from 'react'
import { useCart } from './CartProvider'
import { formatUSD } from '@/lib/money'

type VariantOption = { id: string; label: string; priceDelta: number; inventory: number }

type Props = {
  productId: string
  slug: string
  name: string
  priceCents: number
  image: string
  inventory: number
  optionName?: string | null
  variants: VariantOption[]
}

export function AddToCart({ productId, slug, name, priceCents, image, inventory, optionName, variants }: Props) {
  const { add } = useCart()
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)

  const variant = variants.find((v) => v.id === variantId)
  const unitCents = priceCents + (variant?.priceDelta ?? 0)
  const stock = variants.length ? (variant?.inventory ?? 0) : inventory
  const soldOut = stock <= 0

  return (
    <div className="space-y-5">
      {variants.length > 0 && (
        <fieldset>
          <legend className="eyebrow mb-2">{optionName ?? 'Options'}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const active = v.id === variantId
              const out = v.inventory <= 0
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  aria-pressed={active}
                  disabled={out}
                  className={`min-w-14 border px-3 py-2 text-sm transition-colors ${
                    active ? 'border-plum-900 bg-plum-900 text-cream' : 'border-line bg-white hover:border-peach-400'
                  } ${out ? 'cursor-not-allowed line-through opacity-40' : ''}`}
                >
                  {v.label}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <div className="flex items-stretch gap-3">
        <div>
          <label htmlFor="qty" className="sr-only">
            Quantity
          </label>
          <select
            id="qty"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            disabled={soldOut}
            className="h-full border border-line bg-white px-3 text-sm"
          >
            {Array.from({ length: Math.min(10, Math.max(stock, 1)) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={soldOut}
          onClick={() =>
            add(
              {
                productId,
                variantId: variant?.id,
                slug,
                name,
                variantName: variant?.label,
                unitCents,
                image,
              },
              quantity,
            )
          }
          className="btn btn-primary flex-1"
        >
          {soldOut ? 'Sold out' : `Add to bag — ${formatUSD(unitCents * quantity)}`}
        </button>
      </div>

      {!soldOut && stock <= 5 && <p className="text-xs text-rose-600">Only {stock} left.</p>}
    </div>
  )
}
