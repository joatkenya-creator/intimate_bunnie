// Charts as inline SVG, rendered on the server. A charting library would be
// 40–120 kB of client JavaScript to draw shapes React can already describe.
//
// Rules kept deliberately: one axis per chart (revenue and order count are two
// small multiples, never two y-scales on one plot), a single hue per series so
// colour never encodes rank, recessive grid lines, selective labels, and a
// <title> per mark so hover works without a tooltip runtime. Every chart also
// exposes its numbers as a real table for screen readers and for the person who
// actually wanted the figure.

import type { ReactNode } from 'react'

type Point = { label: string; value: number }

function niceMax(values: number[]): number {
  const max = Math.max(1, ...values)
  const magnitude = 10 ** Math.floor(Math.log10(max))
  return Math.ceil(max / magnitude) * magnitude
}

function DataTable({ points, valueLabel, format }: { points: Point[]; valueLabel: string; format: (n: number) => string }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-[var(--admin-muted)]">View as table</summary>
      <table className="admin-table mt-2 w-full">
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <td>{point.label}</td>
              <td className="tabular-nums">{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

/**
 * Single-series area + line. Height is fixed; width is a viewBox so it scales
 * to any column without a resize observer.
 */
export function TrendChart({
  points,
  format,
  valueLabel,
  height = 160,
}: {
  points: Point[]
  format: (value: number) => string
  valueLabel: string
  height?: number
}) {
  if (points.length === 0) return <p className="py-10 text-center text-sm text-[var(--admin-muted)]">No data yet.</p>

  const width = 640
  const padY = 12
  const max = niceMax(points.map((p) => p.value))
  const stepX = points.length > 1 ? width / (points.length - 1) : width
  const y = (value: number) => padY + (1 - value / max) * (height - padY * 2)

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${(index * stepX).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const peak = points.reduce((best, point, index) => (point.value > points[best].value ? index : best), 0)

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${valueLabel}: ${format(points[points.length - 1].value)} most recent, peak ${format(points[peak].value)}`}
        preserveAspectRatio="none"
      >
        {/* Recessive grid: three lines, no box, no ticks. */}
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1="0"
            x2={width}
            y1={y(max * fraction)}
            y2={y(max * fraction)}
            stroke="var(--admin-line)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill="var(--admin-accent)" opacity="0.12" />
        <path
          d={line}
          fill="none"
          stroke="var(--admin-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Invisible hit columns give every point a native tooltip for free. */}
        {points.map((point, index) => (
          <rect key={point.label} x={index * stepX - stepX / 2} y="0" width={stepX} height={height} fill="transparent">
            <title>{`${point.label}: ${format(point.value)}`}</title>
          </rect>
        ))}
        <circle
          cx={peak * stepX}
          cy={y(points[peak].value)}
          r="4"
          fill="var(--admin-accent)"
          stroke="var(--admin-panel)"
          strokeWidth="2"
        />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[0.6875rem] text-[var(--admin-muted)]">
        <span>{points[0].label}</span>
        <span>
          Peak {format(points[peak].value)} · {points[peak].label}
        </span>
        <span>{points[points.length - 1].label}</span>
      </figcaption>
      <DataTable points={points} valueLabel={valueLabel} format={format} />
    </figure>
  )
}

/**
 * Ranked magnitude. A bar list beats a pie for anything past four slices, and
 * it keeps the labels horizontal and readable.
 */
export function BarList({
  items,
  format,
  emptyLabel = 'Nothing to show yet.',
}: {
  items: { label: string; value: number; href?: string; meta?: string }[]
  format: (value: number) => string
  emptyLabel?: string
}) {
  if (items.length === 0) return <p className="py-8 text-center text-sm text-[var(--admin-muted)]">{emptyLabel}</p>
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <ol className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">
              {item.href ? (
                <a href={item.href} className="hover:text-[var(--admin-accent)]">
                  {item.label}
                </a>
              ) : (
                item.label
              )}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--admin-muted)]">
              {item.meta ? `${item.meta} · ` : ''}
              {format(item.value)}
            </span>
          </div>
          {/* The bar is decoration for the number beside it, so it is aria-hidden. */}
          <div className="mt-1 h-1.5 rounded-full bg-[var(--admin-raised)]" aria-hidden>
            <div
              className="h-full rounded-full bg-[var(--admin-accent)]"
              style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Inline trend for a stat tile. Decorative — the number next to it is the data. */
export function Sparkline({ values, className = '' }: { values: number[]; className?: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const step = 100 / (values.length - 1)
  const d = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${(20 - (value / max) * 18).toFixed(1)}`).join(' ')

  return (
    <svg viewBox="0 0 100 20" className={`h-5 w-24 ${className}`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="var(--admin-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Horizontal proportion bar for a small part-to-whole, with a real legend. */
export function ShareBar({ segments }: { segments: { label: string; value: number; tone: string }[] }): ReactNode {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (total === 0) return <p className="text-sm text-[var(--admin-muted)]">No data yet.</p>

  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div key={segment.label} style={{ width: `${(segment.value / total) * 100}%`, background: segment.tone }}>
              <span className="sr-only">{`${segment.label}: ${segment.value}`}</span>
            </div>
          ))}
      </div>
      <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: segment.tone }} aria-hidden />
            <span className="truncate text-[var(--admin-muted)]">{segment.label}</span>
            <span className="ml-auto tabular-nums">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
