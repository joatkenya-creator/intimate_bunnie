'use client'

import { useActionState } from 'react'
import type { ActionState } from '@/lib/form'
import { SubmitButton, FormMessage } from './forms'

/**
 * A single-record button — duplicate, delete, toggle, release. Every one of
 * these was otherwise going to be its own four-line client component.
 *
 * `extra` carries the handful of hidden fields some actions need (a `type`
 * discriminator, an `op`) without a bespoke wrapper per call site.
 */
export function RowAction({
  action,
  id,
  label,
  pendingLabel,
  variant = 'ghost',
  confirm,
  extra,
  idField = 'id',
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  id: string
  label: string
  pendingLabel?: string
  variant?: 'primary' | 'ghost' | 'danger'
  confirm?: string
  extra?: Record<string, string>
  idField?: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name={idField} value={id} />
      {extra &&
        Object.entries(extra).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <SubmitButton variant={variant} confirm={confirm} pendingLabel={pendingLabel ?? 'Working…'}>
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  )
}
