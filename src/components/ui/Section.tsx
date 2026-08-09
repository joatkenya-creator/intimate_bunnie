import Link from 'next/link'
import type { ReactNode } from 'react'

export function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel = 'View all',
}: {
  eyebrow?: string
  title: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 border-b border-line pb-4">
      <div>
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h2 className="text-2xl lg:text-[1.75rem]">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-xs uppercase tracking-[0.1em] text-plum-700 link-underline">
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

export function Section({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`container-ib py-14 lg:py-20 ${className}`}>{children}</section>
}
