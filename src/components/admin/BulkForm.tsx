'use client'

import { useActionState, useRef, useState, type ReactNode } from 'react'
import type { ActionState } from '@/lib/form'
import { FormMessage, SubmitButton } from './forms'

/**
 * Wraps a table in one form. Rows render a plain `<input type="checkbox"
 * name="ids">` on the server; this counts them and reveals the action bar.
 *
 * The selection lives in the DOM rather than React state, so a 500-row table
 * costs one re-render per click instead of five hundred.
 */
export function BulkForm({
  action,
  children,
  actions,
  noun = 'items',
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  children: ReactNode
  /** Bulk buttons; each submits with its own `name`/`value` so one action can
      branch on which button was pressed. */
  actions: ReactNode
  noun?: string
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  const [selected, setSelected] = useState(0)
  const form = useRef<HTMLFormElement>(null)

  function recount() {
    const boxes = form.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked')
    setSelected(boxes?.length ?? 0)
  }

  function toggleAll(checked: boolean) {
    form.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((box) => {
      box.checked = checked
    })
    recount()
  }

  return (
    <form ref={form} action={formAction} onChange={recount}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-line)] px-4 py-2">
        <label className="flex items-center gap-2 text-xs text-[var(--admin-muted)]">
          <input
            type="checkbox"
            onChange={(event) => toggleAll(event.target.checked)}
            className="size-4 accent-[var(--color-rose-500)]"
            aria-label={`Select all ${noun} on this page`}
          />
          Select all on page
        </label>
        <FormMessage state={state} />
      </div>

      {children}

      {selected > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky bottom-4 z-20 mx-4 mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--admin-line)] bg-[var(--admin-panel)] p-3 shadow-lg"
        >
          <span className="text-sm font-semibold tabular-nums">
            {selected} {noun} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      )}
    </form>
  )
}

/** A bulk button. Kept here so callers do not have to import useFormStatus. */
export function BulkButton({
  op,
  children,
  variant = 'ghost',
  confirm,
}: {
  op: string
  children: ReactNode
  variant?: 'primary' | 'ghost' | 'danger'
  confirm?: string
}) {
  return (
    <SubmitButton name="op" value={op} variant={variant} confirm={confirm}>
      {children}
    </SubmitButton>
  )
}
