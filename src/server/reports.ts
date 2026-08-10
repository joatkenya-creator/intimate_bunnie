import 'server-only'
import { db } from '@/lib/db'
import { formatUSD } from '@/lib/money'
import type { Permission } from '@/lib/permissions'

// One definition per report, used by both the report page and the export route.
// The screen and the CSV can never disagree because they are the same rows.

export type ReportColumn = { key: string; label: string; align?: 'right'; format?: 'money' | 'percent' }
export type ReportRow = Record<string, string | number | null>

export type Report = {
  key: string
  label: string
  description: string
  permission: Permission
  columns: ReportColumn[]
  rows: ReportRow[]
  summary?: { label: string; value: string }[]
  note?: string
}

const PAID = ['PAID', 'FULFILLED'] as const

function since(days: number): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (days - 1))
  return date
}

export const REPORTS = [
  { key: 'sales', label: 'Sales', description: 'Orders and revenue by day.' },
  { key: 'revenue', label: 'Revenue', description: 'Gross, refunds, shipping, and tax by month.' },
  { key: 'products', label: 'Products', description: 'Units and revenue per product.' },
  { key: 'customers', label: 'Customers', description: 'Lifetime value and order counts.' },
  { key: 'coupons', label: 'Coupons', description: 'Redemption counts against each promotion.' },
  { key: 'inventory', label: 'Inventory', description: 'On-hand, reserved, incoming, and stock value.' },
  { key: 'returns', label: 'Returns', description: 'Return volume, outcomes, and refunded value.' },
  { key: 'traffic', label: 'Traffic', description: 'Sessions and conversion — placeholder data.' },
] as const

export type ReportKey = (typeof REPORTS)[number]['key']

export function isReportKey(value: string): value is ReportKey {
  return REPORTS.some((report) => report.key === value)
}

export async function buildReport(key: ReportKey, days = 30): Promise<Report> {
  const meta = REPORTS.find((report) => report.key === key)!
  const from = since(days)

  switch (key) {
    case 'sales': {
      const rows = await db.$queryRaw<{ day: Date; orders: number; revenue: number; units: number }[]>`
        SELECT date_trunc('day', o."createdAt") AS day,
               COUNT(DISTINCT o."id")::int AS orders,
               COALESCE(SUM(o."totalCents"), 0)::int AS revenue,
               COALESCE(SUM(oi."quantity"), 0)::int AS units
        FROM "Order" o LEFT JOIN "OrderItem" oi ON oi."orderId" = o."id"
        WHERE o."createdAt" >= ${from} AND o."status" = ANY(${[...PAID]}::"OrderStatus"[])
        GROUP BY 1 ORDER BY 1 DESC`

      const revenue = rows.reduce((sum, row) => sum + row.revenue, 0)
      const orders = rows.reduce((sum, row) => sum + row.orders, 0)

      return {
        ...meta,
        permission: 'reports.read',
        columns: [
          { key: 'day', label: 'Day' },
          { key: 'orders', label: 'Orders', align: 'right' },
          { key: 'units', label: 'Units', align: 'right' },
          { key: 'revenue', label: 'Revenue', align: 'right', format: 'money' },
        ],
        rows: rows.map((row) => ({
          day: row.day.toISOString().slice(0, 10),
          orders: row.orders,
          units: row.units,
          revenue: row.revenue,
        })),
        summary: [
          { label: 'Orders', value: String(orders) },
          { label: 'Revenue', value: formatUSD(revenue) },
          { label: 'Average order', value: formatUSD(orders ? Math.round(revenue / orders) : 0) },
        ],
      }
    }

    case 'revenue': {
      const rows = await db.$queryRaw<{ month: Date; gross: number; shipping: number; tax: number; refunded: number }[]>`
        SELECT date_trunc('month', "createdAt") AS month,
               COALESCE(SUM("totalCents"), 0)::int AS gross,
               COALESCE(SUM("shippingCents"), 0)::int AS shipping,
               COALESCE(SUM("taxCents"), 0)::int AS tax,
               COALESCE(SUM("refundedCents"), 0)::int AS refunded
        FROM "Order"
        WHERE "status" = ANY(${[...PAID, 'REFUNDED']}::"OrderStatus"[])
        GROUP BY 1 ORDER BY 1 DESC LIMIT 24`

      return {
        ...meta,
        permission: 'reports.read',
        columns: [
          { key: 'month', label: 'Month' },
          { key: 'gross', label: 'Gross', align: 'right', format: 'money' },
          { key: 'shipping', label: 'Shipping', align: 'right', format: 'money' },
          { key: 'tax', label: 'Tax', align: 'right', format: 'money' },
          { key: 'refunded', label: 'Refunded', align: 'right', format: 'money' },
          { key: 'net', label: 'Net', align: 'right', format: 'money' },
        ],
        rows: rows.map((row) => ({
          month: row.month.toISOString().slice(0, 7),
          gross: row.gross,
          shipping: row.shipping,
          tax: row.tax,
          refunded: row.refunded,
          net: row.gross - row.refunded,
        })),
      }
    }

    case 'products': {
      const rows = await db.$queryRaw<{ name: string; sku: string; units: number; revenue: number; orders: number }[]>`
        SELECT p."name", p."sku",
               SUM(oi."quantity")::int AS units,
               SUM(oi."quantity" * oi."unitCents")::int AS revenue,
               COUNT(DISTINCT o."id")::int AS orders
        FROM "OrderItem" oi
        JOIN "Order" o ON o."id" = oi."orderId"
        JOIN "Product" p ON p."id" = oi."productId"
        WHERE o."createdAt" >= ${from} AND o."status" = ANY(${[...PAID]}::"OrderStatus"[])
        GROUP BY p."name", p."sku" ORDER BY revenue DESC LIMIT 200`

      return {
        ...meta,
        permission: 'reports.read',
        columns: [
          { key: 'name', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'orders', label: 'Orders', align: 'right' },
          { key: 'units', label: 'Units', align: 'right' },
          { key: 'revenue', label: 'Revenue', align: 'right', format: 'money' },
        ],
        rows,
      }
    }

    case 'customers': {
      const rows = await db.$queryRaw<{ email: string; name: string | null; orders: number; lifetime: number; last: Date | null }[]>`
        SELECT o."email",
               MAX(o."shipName") AS name,
               COUNT(*)::int AS orders,
               COALESCE(SUM(o."totalCents"), 0)::int AS lifetime,
               MAX(o."createdAt") AS last
        FROM "Order" o
        WHERE o."status" = ANY(${[...PAID]}::"OrderStatus"[])
        GROUP BY o."email" ORDER BY lifetime DESC LIMIT 200`

      return {
        ...meta,
        permission: 'reports.read',
        columns: [
          { key: 'email', label: 'Customer' },
          { key: 'name', label: 'Name' },
          { key: 'orders', label: 'Orders', align: 'right' },
          { key: 'lifetime', label: 'Lifetime value', align: 'right', format: 'money' },
          { key: 'last', label: 'Last order' },
        ],
        rows: rows.map((row) => ({ ...row, last: row.last ? row.last.toISOString().slice(0, 10) : null })),
      }
    }

    case 'coupons': {
      const coupons = await db.coupon.findMany({
        orderBy: { usedCount: 'desc' },
        take: 200,
        select: { code: true, name: true, kind: true, percentOff: true, amountOffCents: true, usedCount: true, usageLimit: true, active: true, expiresAt: true },
      })

      return {
        ...meta,
        permission: 'reports.read',
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'kind', label: 'Kind' },
          { key: 'discount', label: 'Discount' },
          { key: 'usedCount', label: 'Redeemed', align: 'right' },
          { key: 'usageLimit', label: 'Limit', align: 'right' },
          { key: 'state', label: 'State' },
        ],
        rows: coupons.map((coupon) => ({
          code: coupon.code,
          name: coupon.name,
          kind: coupon.kind,
          discount: coupon.percentOff ? `${coupon.percentOff}%` : coupon.amountOffCents ? formatUSD(coupon.amountOffCents) : '—',
          usedCount: coupon.usedCount,
          usageLimit: coupon.usageLimit ?? '∞',
          state: !coupon.active ? 'Paused' : coupon.expiresAt && coupon.expiresAt < new Date() ? 'Expired' : 'Active',
        })),
      }
    }

    case 'inventory': {
      const products = await db.product.findMany({
        where: { status: { not: 'ARCHIVED' } },
        orderBy: { inventory: 'asc' },
        take: 500,
        select: { name: true, sku: true, inventory: true, reservedStock: true, incomingStock: true, priceCents: true, lowStockAt: true },
      })

      const value = products.reduce((sum, product) => sum + product.inventory * product.priceCents, 0)

      return {
        ...meta,
        permission: 'reports.read',
        columns: [
          { key: 'name', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'inventory', label: 'On hand', align: 'right' },
          // On-hand already excludes sold units; "reserved" is what is sold but
          // not yet shipped, so it is a picking figure, not a deduction.
          { key: 'reservedStock', label: 'Awaiting shipment', align: 'right' },
          { key: 'incomingStock', label: 'Incoming', align: 'right' },
          { key: 'value', label: 'Stock value', align: 'right', format: 'money' },
        ],
        rows: products.map((product) => ({
          name: product.name,
          sku: product.sku,
          inventory: product.inventory,
          reservedStock: product.reservedStock,
          incomingStock: product.incomingStock,
          value: product.inventory * product.priceCents,
        })),
        summary: [
          { label: 'SKUs', value: String(products.length) },
          { label: 'Stock value at retail', value: formatUSD(value) },
          { label: 'At or below threshold', value: String(products.filter((p) => p.inventory <= p.lowStockAt).length) },
        ],
      }
    }

    case 'returns': {
      const returns = await db.return.findMany({
        where: { createdAt: { gte: from } },
        orderBy: { createdAt: 'desc' },
        take: 300,
        select: { number: true, status: true, reason: true, refundCents: true, createdAt: true, order: { select: { number: true } } },
      })

      return {
        ...meta,
        permission: 'reports.read',
        columns: [
          { key: 'number', label: 'RMA' },
          { key: 'order', label: 'Order' },
          { key: 'status', label: 'Status' },
          { key: 'reason', label: 'Reason' },
          { key: 'refundCents', label: 'Refunded', align: 'right', format: 'money' },
          { key: 'createdAt', label: 'Requested' },
        ],
        rows: returns.map((request) => ({
          number: request.number,
          order: request.order.number,
          status: request.status,
          reason: request.reason.slice(0, 120),
          refundCents: request.refundCents,
          createdAt: request.createdAt.toISOString().slice(0, 10),
        })),
        summary: [
          { label: 'Requests', value: String(returns.length) },
          { label: 'Approved', value: String(returns.filter((r) => r.status === 'APPROVED').length) },
          { label: 'Refunded', value: formatUSD(returns.reduce((sum, r) => sum + r.refundCents, 0)) },
        ],
      }
    }

    case 'traffic': {
      // No analytics store exists yet, and inventing one to hold made-up numbers
      // would be worse than saying so. The shape is real; the values are seeded
      // from the day so the page does not flicker between reloads.
      const orders = await db.$queryRaw<{ day: Date; orders: number }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::int AS orders
        FROM "Order" WHERE "createdAt" >= ${from} GROUP BY 1 ORDER BY 1 DESC`

      const rows = orders.map((row) => {
        const day = row.day.toISOString().slice(0, 10)
        const seed = [...day].reduce((sum, character) => sum + character.charCodeAt(0), 0)
        const sessions = 400 + (seed % 260)
        return {
          day,
          sessions,
          orders: row.orders,
          conversion: sessions ? Number(((row.orders / sessions) * 100).toFixed(2)) : 0,
        }
      })

      return {
        ...meta,
        permission: 'reports.read',
        columns: [
          { key: 'day', label: 'Day' },
          { key: 'sessions', label: 'Sessions', align: 'right' },
          { key: 'orders', label: 'Orders', align: 'right' },
          { key: 'conversion', label: 'Conversion', align: 'right', format: 'percent' },
        ],
        rows,
        note: 'Session counts are placeholders. Wire a real analytics source before quoting these numbers.',
      }
    }
  }
}

export function formatCell(value: string | number | null, column: ReportColumn): string {
  if (value === null || value === undefined) return '—'
  if (column.format === 'money' && typeof value === 'number') return formatUSD(value)
  if (column.format === 'percent') return `${value}%`
  return String(value)
}

/** RFC 4180: quote everything, double the quotes inside. Excel and Sheets agree on that. */
export function toCsv(report: Report): string {
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const header = report.columns.map((column) => escape(column.label)).join(',')
  const body = report.rows.map((row) =>
    report.columns
      .map((column) => escape(column.format === 'money' && typeof row[column.key] === 'number' ? (row[column.key] as number) / 100 : row[column.key]))
      .join(','),
  )
  return [header, ...body].join('\r\n')
}
