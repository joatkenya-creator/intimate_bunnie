'use client'

import { useActionState, useId, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionState } from '@/lib/form'

// Form plumbing shared by every admin screen. Labels are always rendered and
// always tied to their control — no placeholder-as-label anywhere in the admin.

export function SubmitButton({
  children = 'Save',
  pendingLabel = 'Saving…',
  variant = 'primary',
  formAction,
  name,
  value,
  confirm,
}: {
  children?: ReactNode
  pendingLabel?: string
  variant?: 'primary' | 'ghost' | 'danger'
  formAction?: (formData: FormData) => void
  name?: string
  value?: string
  confirm?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      disabled={pending}
      onClick={confirm ? (event) => { if (!window.confirm(confirm)) event.preventDefault() } : undefined}
      className={`admin-btn admin-btn-${variant}`}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}

/** Live region so a save result reaches a screen reader, not just the eye. */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state.error && !state.ok) return null
  return (
    <p
      role="status"
      aria-live="polite"
      className={`text-sm ${state.error ? 'text-[var(--color-danger)]' : 'text-[var(--color-ok)]'}`}
    >
      {state.error ?? state.ok}
    </p>
  )
}

export function Field({
  label,
  name,
  hint,
  error,
  children,
  required,
}: {
  label: string
  name: string
  hint?: string
  error?: string
  children?: ReactNode
  required?: boolean
}) {
  const hintId = `${name}-hint`
  return (
    <div>
      <label htmlFor={name} className="admin-label">
        {label}
        {required && (
          <span className="text-[var(--color-danger)]" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-[var(--admin-muted)]">
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField(props: {
  label: string
  name: string
  defaultValue?: string | number | null
  type?: string
  hint?: string
  error?: string
  required?: boolean
  placeholder?: string
  step?: string
  min?: string
  max?: string
  disabled?: boolean
}) {
  const { label, name, defaultValue, type = 'text', hint, error, required, ...rest } = props
  return (
    <Field label={label} name={name} hint={hint} error={error} required={required}>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? undefined}
        required={required}
        aria-describedby={hint ? `${name}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        className="admin-field"
        {...rest}
      />
    </Field>
  )
}

export function TextArea(props: {
  label: string
  name: string
  defaultValue?: string | null
  rows?: number
  hint?: string
  error?: string
  required?: boolean
  placeholder?: string
}) {
  const { label, name, defaultValue, rows = 4, hint, error, required, placeholder } = props
  return (
    <Field label={label} name={name} hint={hint} error={error} required={required}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        aria-describedby={hint ? `${name}-hint` : undefined}
        className="admin-field"
      />
    </Field>
  )
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  hint,
  error,
  required,
}: {
  label: string
  name: string
  options: { value: string; label: string }[]
  defaultValue?: string | null
  hint?: string
  error?: string
  required?: boolean
}) {
  return (
    <Field label={label} name={name} hint={hint} error={error} required={required}>
      <select id={name} name={name} defaultValue={defaultValue ?? ''} className="admin-field" required={required}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function Toggle({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string
  name: string
  defaultChecked?: boolean
  hint?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 accent-[var(--color-rose-500)]"
      />
      <div>
        <label htmlFor={name} className="text-sm font-medium">
          {label}
        </label>
        {hint && <p className="text-xs text-[var(--admin-muted)]">{hint}</p>}
      </div>
    </div>
  )
}

export function CheckboxList({
  legend,
  name,
  options,
  selected,
  columns = 2,
}: {
  legend: string
  name: string
  options: { value: string; label: string }[]
  selected: string[]
  columns?: number
}) {
  const id = useId()
  const chosen = new Set(selected)
  return (
    <fieldset>
      <legend className="admin-label">{legend}</legend>
      {/* Inline style, not a template-literal class: Tailwind only ships classes
          it can see in the source, and `sm:grid-cols-${n}` is invisible to it. */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={chosen.has(option.value)}
              id={`${id}-${option.value}`}
              className="size-4 accent-[var(--color-rose-500)]"
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * The standard admin form: binds an action, renders its message, and exposes
 * field errors to children through a render prop.
 */
export function AdminForm({
  action,
  children,
  className = 'space-y-4',
  footer,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  children: ReactNode | ((state: ActionState) => ReactNode)
  className?: string
  footer?: ReactNode
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {})
  return (
    <form action={formAction} className={className}>
      {typeof children === 'function' ? children(state) : children}
      <div className="flex flex-wrap items-center gap-3">
        {footer ?? <SubmitButton />}
        <FormMessage state={state} />
      </div>
    </form>
  )
}
