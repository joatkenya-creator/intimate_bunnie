'use client'

import { useActionState } from 'react'
import { updateOrderStatus, type AdminState } from '@/actions/admin'

export function OrderStatusForm({
  number,
  status,
  statuses,
}: {
  number: string
  status: string
  statuses: string[]
}) {
  const [state, action] = useActionState<AdminState, FormData>(updateOrderStatus, {})

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="number" value={number} />
      <label className="sr-only" htmlFor={`status-${number}`}>
        Status for order {number}
      </label>
      <select
        id={`status-${number}`}
        name="status"
        defaultValue={status}
        className="border border-line bg-white px-2 py-1 text-xs"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button type="submit" className="text-xs uppercase tracking-wider link-underline">
        {state.saved ? 'Saved' : 'Set'}
      </button>
    </form>
  )
}
