import { currentAdmin, can, audit } from '@/lib/rbac'
import { forbidden, rateLimit, clientIp, tooManyRequests } from '@/lib/security'
import { buildReport, isReportKey, toCsv } from '@/server/reports'

export const dynamic = 'force-dynamic'

// CSV export. Excel opens the same bytes once they carry a BOM — a real .xlsx
// writer is a 400 kB dependency for a file Excel already reads. PDF is the
// browser's own print-to-PDF from the report page, which is why there is no
// `format=pdf` here.

export async function GET(request: Request) {
  const admin = await currentAdmin()
  if (!admin || !can(admin.permissions, 'reports.read')) return forbidden()
  if (!rateLimit(`export:${clientIp(request)}`, 20, 60_000)) return tooManyRequests()

  const params = new URL(request.url).searchParams
  const key = params.get('report') ?? 'sales'
  if (!isReportKey(key)) return Response.json({ error: 'Unknown report' }, { status: 400 })

  const days = Math.min(365, Math.max(1, Number(params.get('days')) || 30))
  const excel = params.get('format') === 'excel'

  const report = await buildReport(key, days)
  const csv = toCsv(report)
  await audit(admin, 'report.export', key, { days, rows: report.rows.length, format: excel ? 'excel' : 'csv' })

  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(excel ? `﻿${csv}` : csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="intimate-bunnie-${key}-${stamp}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
