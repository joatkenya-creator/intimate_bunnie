import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePagePermission } from '@/lib/rbac'
import { buildReport, isReportKey, formatCell } from '@/server/reports'
import { PageHeader, Panel, StatCard, EmptyState } from '@/components/admin/ui'
import { PrintButton } from '@/components/admin/PrintButton'

export const dynamic = 'force-dynamic'

const RANGES = [7, 30, 90, 365]

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>
  searchParams: Promise<{ days?: string }>
}) {
  await requirePagePermission('reports.read')
  const { report: key } = await params
  if (!isReportKey(key)) notFound()

  const { days: daysParam } = await searchParams
  const days = RANGES.includes(Number(daysParam)) ? Number(daysParam) : 30
  const report = await buildReport(key, days)

  return (
    <>
      <PageHeader
        title={report.label}
        description={report.description}
        actions={
          <>
            <a href={`/api/admin/export?report=${key}&days=${days}`} className="admin-btn admin-btn-ghost">
              CSV
            </a>
            <a href={`/api/admin/export?report=${key}&days=${days}&format=excel`} className="admin-btn admin-btn-ghost">
              Excel
            </a>
            <PrintButton label="PDF / print" />
            <Link href="/admin/reports" className="admin-btn admin-btn-ghost">
              All reports
            </Link>
          </>
        }
      />

      <nav aria-label="Date range" className="no-print mb-3 flex gap-1.5 text-xs">
        {RANGES.map((range) => (
          <Link
            key={range}
            href={`/admin/reports/${key}?days=${range}`}
            className={`admin-btn ${days === range ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
          >
            {range} days
          </Link>
        ))}
      </nav>

      {report.summary && (
        <div className="mb-3 grid gap-3 sm:grid-cols-3">
          {report.summary.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      )}

      {report.note && (
        <p className="mb-3 rounded-lg border border-[var(--color-warn)] bg-[color-mix(in_srgb,var(--color-warn)_10%,transparent)] px-3 py-2 text-sm">
          {report.note}
        </p>
      )}

      <Panel bodyClassName="p-0">
        {report.rows.length === 0 ? (
          <EmptyState title="No data in this range" description="Try a longer window." />
        ) : (
          <div className="admin-scroll">
            <table className="admin-table w-full">
              <thead className="border-b border-[var(--admin-line)]">
                <tr>
                  {report.columns.map((column) => (
                    <th key={column.key} scope="col" className={column.align === 'right' ? 'text-right' : undefined}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-line)]">
                {report.rows.map((row, index) => (
                  <tr key={index}>
                    {report.columns.map((column) => (
                      <td key={column.key} className={column.align === 'right' ? 'text-right tabular-nums' : undefined}>
                        {formatCell(row[column.key], column)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-[var(--admin-line)] px-4 py-3 text-xs text-[var(--admin-muted)]">
          {report.rows.length} rows
        </p>
      </Panel>
    </>
  )
}
