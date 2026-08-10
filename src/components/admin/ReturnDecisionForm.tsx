'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { resolveReturn, type ReturnState } from '@/actions/returns'

function Buttons() {
  const { pending } = useFormStatus()
  return (
    <>
      <button type="submit" name="decision" value="APPROVED" disabled={pending} className="admin-btn admin-btn-primary">
        Approve
      </button>
      <button type="submit" name="decision" value="DENIED" disabled={pending} className="admin-btn admin-btn-ghost">
        Deny
      </button>
    </>
  )
}

export function ReturnDecisionForm({ number }: { number: string }) {
  const [state, action] = useActionState<ReturnState, FormData>(resolveReturn, {})

  if (state.saved) {
    return (
      <p role="status" className="text-sm text-[var(--color-ok)]">
        Decision recorded.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="number" value={number} />
      <label className="admin-label" htmlFor={`note-${number}`}>
        Note to the customer
      </label>
      <input id={`note-${number}`} name="note" maxLength={500} placeholder="Optional — shown on their order" className="admin-field" />
      <div className="flex gap-2">
        <Buttons />
      </div>
      {state.error && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {state.error}
        </p>
      )}
    </form>
  )
}
