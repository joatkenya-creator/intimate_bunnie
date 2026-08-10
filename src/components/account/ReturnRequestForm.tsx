'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { requestReturn, type ReturnState } from '@/actions/returns'
import { formatUSD } from '@/lib/money'

type Item = { id: string; name: string; variantName: string | null; quantity: number; unitCents: number }

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full">
      {pending ? 'Sending…' : 'Request return'}
    </button>
  )
}

export function ReturnRequestForm({ number, items }: { number: string; items: Item[] }) {
  const [state, action] = useActionState<ReturnState, FormData>(requestReturn, {})

  if (state.saved) {
    return (
      <div className="mt-8 border border-line bg-peach-50 px-5 py-4">
        <p className="text-sm">Return {state.rma} is with us. We emailed you a copy.</p>
        <p className="mt-1.5 text-xs text-plum-500">You will hear back within two business days.</p>
        <Link href="/account/orders" className="btn btn-outline mt-5">
          Back to orders
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="number" value={number} />

      <fieldset>
        <legend className="mb-3 text-sm">Which items are going back?</legend>
        <ul className="divide-y divide-line border-y border-line">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex items-center gap-3 py-3 text-sm">
                <input type="checkbox" name="orderItemId" value={item.id} className="size-4 accent-rose-500" />
                <span className="flex-1">
                  {item.name}
                  {item.variantName && <span className="text-plum-500"> · {item.variantName}</span>}
                  <span className="text-plum-500"> × {item.quantity}</span>
                </span>
                <span>{formatUSD(item.unitCents * item.quantity)}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-plum-500">Whole lines only. To send back part of one, mention it below.</p>
      </fieldset>

      <div>
        <label htmlFor="reason" className="mb-1.5 block text-sm">
          What is wrong?
        </label>
        <textarea id="reason" name="reason" required minLength={10} maxLength={1000} rows={4} className="field" />
        <p className="mt-1.5 text-xs text-plum-500">
          Unopened items only, except for damage or a fault — then tell us and we will sort it either way.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  )
}
