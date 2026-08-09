'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateProduct, type AdminState } from '@/actions/admin'

type Product = {
  id: string
  slug: string
  name: string
  sku: string
  priceCents: number
  inventory: number
  active: boolean
  category: { name: string }
}

function SaveButton({ saved }: { saved?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="text-xs uppercase tracking-wider link-underline">
      {pending ? 'Saving…' : saved ? 'Saved' : 'Save'}
    </button>
  )
}

/** Inline edit for the fields that actually change day to day. */
export function ProductRow({ product }: { product: Product }) {
  const [state, action] = useActionState<AdminState, FormData>(updateProduct, {})

  return (
    <tr>
      <td className="py-2.5 pr-4">
        <Link href={`/product/${product.slug}`} className="font-medium hover:text-rose-500">
          {product.name}
        </Link>
        <p className="text-xs text-plum-300">{product.sku}</p>
        {state.error && <p className="text-xs text-rose-600">{state.error}</p>}
      </td>
      <td className="py-2.5 pr-4 text-plum-500">{product.category.name}</td>
      <td colSpan={4} className="py-2.5">
        <form action={action} className="flex items-center gap-3">
          <input type="hidden" name="id" value={product.id} />
          <label className="sr-only" htmlFor={`price-${product.id}`}>
            Price for {product.name}
          </label>
          <input
            id={`price-${product.id}`}
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(product.priceCents / 100).toFixed(2)}
            className="w-24 border border-line px-2 py-1"
          />
          <label className="sr-only" htmlFor={`stock-${product.id}`}>
            Inventory for {product.name}
          </label>
          <input
            id={`stock-${product.id}`}
            name="inventory"
            type="number"
            min="0"
            defaultValue={product.inventory}
            className="w-20 border border-line px-2 py-1"
          />
          <label className="flex items-center gap-1.5 text-xs text-plum-500">
            <input type="checkbox" name="active" defaultChecked={product.active} />
            Live
          </label>
          <SaveButton saved={state.saved} />
        </form>
      </td>
    </tr>
  )
}
