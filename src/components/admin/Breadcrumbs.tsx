'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SEGMENT_LABELS } from '@/config/admin-nav'

/**
 * Derived from the URL rather than passed down. Every admin route is a real
 * path, so the URL already knows the trail — threading a `breadcrumbs` prop
 * through twenty pages would be twenty chances to get it wrong.
 *
 * An id segment is shown truncated: the page heading names the record, so the
 * crumb only has to be clickable back to its list.
 */
export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="no-print mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--admin-muted)]">
        {segments.map((segment, index) => {
          const href = `/${segments.slice(0, index + 1).join('/')}`
          const last = index === segments.length - 1
          const label = SEGMENT_LABELS[segment] ?? (segment.length > 14 ? `${segment.slice(0, 10)}…` : segment)

          return (
            <li key={href} className="flex items-center gap-1.5">
              {index > 0 && <span aria-hidden>/</span>}
              {last ? (
                <span aria-current="page" className="font-medium text-[var(--admin-ink)]">
                  {label}
                </span>
              ) : (
                <Link href={href} className="hover:text-[var(--admin-accent)]">
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
