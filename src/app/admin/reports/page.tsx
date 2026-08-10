import Link from 'next/link'
import { requirePagePermission } from '@/lib/rbac'
import { REPORTS } from '@/server/reports'
import { salesSeries } from '@/server/admin'
import { formatUSD } from '@/lib/money'
import { PageHeader, Panel } from '@/components/admin/ui'
import { TrendChart } from '@/components/admin/charts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reports' }

export default async function AdminReports() {
  await requirePagePermission('reports.read')
  const series = await salesSeries(90)

  return (
    <>
      <PageHeader
        title="Reports"
        description="Every report exports to CSV, opens in Excel, and prints to PDF through the browser."
      />

      <Panel title="Revenue, last 90 days" className="mb-4">
        <TrendChart
          points={series.map((point) => ({ label: point.day.slice(5), value: point.revenueCents }))}
          format={formatUSD}
          valueLabel="Revenue"
          height={200}
        />
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {REPORTS.map((report) => (
          <Link key={report.key} href={`/admin/reports/${report.key}`} className="admin-panel block p-4 transition-colors hover:border-[var(--admin-accent)]">
            <p className="font-medium">{report.label}</p>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">{report.description}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
