'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateOrderStatus } from '@/actions/admin/orders'
import type { ActionState } from '@/lib/form'

function Apply({ saved }: { saved?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="admin-btn admin-btn-ghost px-2 py-1 text-xs" disabled={pending}>
      {pending ? '…' : saved ? '✓' : 'Set'}
    </button>
  )
}

/** Inline status change from the orders list — the one edit worth making without opening the order. */
export function OrderStatusForm({ number, status, statuses }: { number: string; status: string; statuses: string[] }) {
  const [state, action] = useActionState<ActionState, FormData>(updateOrderStatus, {})

  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="number" value={number} />
      <label className="sr-only" htmlFor={`status-${number}`}>
        Status for order {number}
      </label>
      <select id={`status-${number}`} name="status" defaultValue={status} className="admin-field w-32 px-2 py-1 text-xs">
        {statuses.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <Apply saved={state.ok} />
      {state.error && (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          {state.error}
        </span>
      )}
    </form>
  )
}
