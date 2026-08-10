import Link from 'next/link'
import type { ReactNode } from 'react'

// Every admin screen is built from these. One file, no per-module variants —
// the moment a page needs a bespoke card is the moment the admin stops looking
// like one product.

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-[var(--admin-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = 'p-4',
}: {
  title?: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={`admin-panel ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-line)] px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-[var(--admin-muted)]">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

const TONES = {
  neutral: 'bg-[var(--admin-raised)] text-[var(--admin-muted)]',
  accent: 'bg-[var(--admin-accent-soft)] text-[var(--color-rose-600)]',
  ok: 'bg-[color-mix(in_srgb,var(--color-ok)_14%,transparent)] text-[var(--color-ok)]',
  warn: 'bg-[color-mix(in_srgb,var(--color-warn)_16%,transparent)] text-[var(--color-warn)]',
  danger: 'bg-[color-mix(in_srgb,var(--color-danger)_14%,transparent)] text-[var(--color-danger)]',
  info: 'bg-[color-mix(in_srgb,var(--color-info)_14%,transparent)] text-[var(--color-info)]',
} as const

export type Tone = keyof typeof TONES

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

/** Status word → tone. Shared so PAID is the same green on every screen. */
export function toneFor(status: string): Tone {
  switch (status) {
    case 'PAID':
    case 'FULFILLED':
    case 'PUBLISHED':
    case 'APPROVED':
    case 'ACTIVE':
    case 'ok':
      return 'ok'
    case 'PENDING':
    case 'REQUESTED':
    case 'SCHEDULED':
    case 'INVITED':
    case 'warn':
      return 'warn'
    case 'CANCELLED':
    case 'REFUNDED':
    case 'DENIED':
    case 'BLOCKED':
    case 'CRITICAL':
    case 'down':
      return 'danger'
    case 'DRAFT':
    case 'ARCHIVED':
      return 'neutral'
    default:
      return 'info'
  }
}

export function StatCard({
  label,
  value,
  hint,
  change,
  href,
}: {
  label: string
  value: string
  hint?: string
  change?: number | null
  href?: string
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 flex items-center gap-2 text-xs text-[var(--admin-muted)]">
        {typeof change === 'number' && (
          <span className={change >= 0 ? 'text-[var(--color-ok)]' : 'text-[var(--color-danger)]'}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change)}%
          </span>
        )}
        {hint}
      </p>
    </>
  )

  return href ? (
    <Link href={href} className="admin-panel block p-4 transition-colors hover:border-[var(--admin-accent)]">
      {body}
    </Link>
  ) : (
    <div className="admin-panel p-4">{body}</div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-[var(--admin-muted)]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/**
 * Link-based pagination: crawlable, cost-free, and survives a full reload —
 * which matters when someone is on page 14 of an inventory audit.
 */
export function Pagination({
  page,
  pages,
  hrefFor,
  total,
  noun,
}: {
  page: number
  pages: number
  hrefFor: (page: number) => string
  total: number
  noun: string
}) {
  if (pages <= 1) {
    return (
      <p className="px-4 py-3 text-xs text-[var(--admin-muted)]">
        {total} {noun}
      </p>
    )
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-[var(--admin-line)] px-4 py-3 text-xs"
    >
      <p className="text-[var(--admin-muted)]">
        {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="admin-btn admin-btn-ghost" rel="prev">
            Previous
          </Link>
        ) : (
          <span className="admin-btn admin-btn-ghost opacity-40">Previous</span>
        )}
        <span className="px-1 text-[var(--admin-muted)]">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className="admin-btn admin-btn-ghost" rel="next">
            Next
          </Link>
        ) : (
          <span className="admin-btn admin-btn-ghost opacity-40">Next</span>
        )}
      </div>
    </nav>
  )
}

/** A GET form. Filters stay in the URL so every admin view is shareable. */
export function FilterBar({ action, children }: { action: string; children: ReactNode }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 border-b border-[var(--admin-line)] px-4 py-3">
      {children}
      <button type="submit" className="admin-btn admin-btn-ghost">
        Apply
      </button>
    </form>
  )
}

export function SearchInput({ name = 'q', defaultValue = '', label = 'Search', placeholder = 'Search…' }) {
  return (
    <div>
      <label htmlFor={`filter-${name}`} className="admin-label">
        {label}
      </label>
      <input
        id={`filter-${name}`}
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="admin-field w-56"
      />
    </div>
  )
}

export function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string
  label: string
  value?: string
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label htmlFor={`filter-${name}`} className="admin-label">
        {label}
      </label>
      <select id={`filter-${name}`} name={name} defaultValue={value ?? ''} className="admin-field w-44">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Tabs({ tabs, current }: { tabs: { href: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className="admin-scroll -mb-px flex gap-1 border-b border-[var(--admin-line)]" aria-label="Sections">
      {tabs.map((tab) => {
        const active = tab.href === current
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              active
                ? 'border-[var(--admin-accent)] text-[var(--admin-ink)]'
                : 'border-transparent text-[var(--admin-muted)] hover:text-[var(--admin-ink)]'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className="ml-1.5 rounded bg-[var(--admin-raised)] px-1.5 py-0.5 text-[0.6875rem] tabular-nums">
                {tab.count}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

export function DefinitionList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-[var(--admin-line)] text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4 py-2">
          <dt className="text-[var(--admin-muted)]">{row.label}</dt>
          <dd className="text-right">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "3 days ago" without a date library — Intl does the wording. */
const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3600],
  ['minute', 60],
]

export function timeAgo(value: Date | string): string {
  const seconds = (Date.now() - new Date(value).getTime()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(-Math.round(seconds / size), unit)
  }
  return 'just now'
}
