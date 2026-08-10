import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { SETTINGS_DEFAULTS, type SettingsGroup, type SettingsGroups } from '@/config/settings'

// The admin query layer. Storefront queries stay in server/catalog.ts; nothing
// here is imported by a customer-facing page.

// ── Settings ────────────────────────────────────────────────────────────────

/** Stored values merged over the defaults, so a new field never reads undefined. */
export const getSettings = cache(async <G extends SettingsGroup>(group: G): Promise<SettingsGroups[G]> => {
  const row = await db.setting.findUnique({ where: { key: group } }).catch(() => null)
  return { ...SETTINGS_DEFAULTS[group], ...((row?.value as object | null) ?? {}) }
})

export async function getAllSettings(): Promise<SettingsGroups> {
  const rows = await db.setting.findMany().catch(() => [])
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value])) as Partial<SettingsGroups>
  return Object.fromEntries(
    Object.entries(SETTINGS_DEFAULTS).map(([key, defaults]) => [
      key,
      { ...defaults, ...((stored[key as SettingsGroup] as object | undefined) ?? {}) },
    ]),
  ) as SettingsGroups
}

// ── Notifications ───────────────────────────────────────────────────────────

type NotificationInput = {
  type: 'ORDER' | 'LOW_STOCK' | 'REFUND' | 'PAYMENT_FAILED' | 'CUSTOMER' | 'SYSTEM'
  level?: 'INFO' | 'WARNING' | 'CRITICAL'
  title: string
  body?: string
  link?: string
}

/** Fire-and-forget: a failed notification must never fail the thing it reports. */
export async function notify(input: NotificationInput): Promise<void> {
  await db.adminNotification
    .create({ data: { type: input.type, level: input.level ?? 'INFO', title: input.title, body: input.body, link: input.link } })
    .catch(() => null)
}

// ── Sidebar badges ──────────────────────────────────────────────────────────

export type NavBadges = { orders: number; returns: number; lowStock: number; notifications: number }

export const navBadges = cache(async (): Promise<NavBadges> => {
  const [orders, returns, lowStock, notifications] = await Promise.all([
    db.order.count({ where: { status: 'PENDING' } }),
    db.return.count({ where: { status: 'REQUESTED' } }),
    db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM "Product"
      WHERE "active" = true AND "inventory" <= "lowStockAt"`.then((rows) => rows[0]?.count ?? 0),
    db.adminNotification.count({ where: { readAt: null } }),
  ])
  return { orders, returns, lowStock, notifications }
})

// ── Dashboard ───────────────────────────────────────────────────────────────

const REVENUE_STATUSES = ['PAID', 'FULFILLED'] as const

function startOfDay(offsetDays = 0): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - offsetDays)
  return date
}

export type SalesPoint = { day: string; revenueCents: number; orders: number }

/** Daily revenue for the trend chart. Grouped in Postgres, not in JavaScript. */
export async function salesSeries(days = 30): Promise<SalesPoint[]> {
  const rows = await db.$queryRaw<{ day: Date; revenue: number; orders: number }[]>`
    SELECT date_trunc('day', "createdAt") AS day,
           COALESCE(SUM("totalCents"), 0)::int AS revenue,
           COUNT(*)::int AS orders
    FROM "Order"
    WHERE "createdAt" >= ${startOfDay(days - 1)} AND "status" = ANY(${[...REVENUE_STATUSES]}::"OrderStatus"[])
    GROUP BY 1
    ORDER BY 1`

  // Fill the gaps so a quiet Tuesday is a zero on the chart, not a missing point.
  const byDay = new Map(rows.map((row) => [row.day.toISOString().slice(0, 10), row]))
  return Array.from({ length: days }, (_, index) => {
    const key = startOfDay(days - 1 - index).toISOString().slice(0, 10)
    const row = byDay.get(key)
    return { day: key, revenueCents: row?.revenue ?? 0, orders: row?.orders ?? 0 }
  })
}

export async function dashboardData() {
  const today = startOfDay()
  const monthAgo = startOfDay(29)
  const prevMonthAgo = startOfDay(59)

  const [
    revenueAll,
    revenue30,
    revenuePrev30,
    ordersToday,
    pendingOrders,
    refundRequests,
    customers,
    newCustomers30,
    lowStock,
    outOfStock,
    topProducts,
    topCategories,
    recentActivity,
    recentOrders,
  ] = await Promise.all([
    db.order.aggregate({ _sum: { totalCents: true }, where: { status: { in: [...REVENUE_STATUSES] } } }),
    db.order.aggregate({
      _sum: { totalCents: true },
      _count: true,
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: monthAgo } },
    }),
    db.order.aggregate({
      _sum: { totalCents: true },
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: prevMonthAgo, lt: monthAgo } },
    }),
    db.order.aggregate({ _sum: { totalCents: true }, _count: true, where: { createdAt: { gte: today } } }),
    db.order.count({ where: { status: 'PENDING' } }),
    db.return.count({ where: { status: 'REQUESTED' } }),
    db.user.count({ where: { role: 'CUSTOMER' } }),
    db.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: monthAgo } } }),
    db.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM "Product"
      WHERE "active" = true AND "inventory" > 0 AND "inventory" <= "lowStockAt"`,
    db.product.count({ where: { active: true, inventory: 0 } }),
    db.$queryRaw<{ id: string; name: string; slug: string; units: number; revenue: number }[]>`
      SELECT p."id", p."name", p."slug",
             SUM(oi."quantity")::int AS units,
             SUM(oi."quantity" * oi."unitCents")::int AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Product" p ON p."id" = oi."productId"
      WHERE o."createdAt" >= ${monthAgo} AND o."status" = ANY(${[...REVENUE_STATUSES]}::"OrderStatus"[])
      GROUP BY p."id", p."name", p."slug"
      ORDER BY revenue DESC
      LIMIT 6`,
    db.$queryRaw<{ name: string; slug: string; revenue: number }[]>`
      SELECT c."name", c."slug", SUM(oi."quantity" * oi."unitCents")::int AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      JOIN "Product" p ON p."id" = oi."productId"
      JOIN "Category" c ON c."id" = p."categoryId"
      WHERE o."createdAt" >= ${monthAgo} AND o."status" = ANY(${[...REVENUE_STATUSES]}::"OrderStatus"[])
      GROUP BY c."name", c."slug"
      ORDER BY revenue DESC
      LIMIT 6`,
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, actor: true, action: true, target: true, createdAt: true },
    }),
    db.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { number: true, email: true, status: true, totalCents: true, createdAt: true },
    }),
  ])

  const current = revenue30._sum.totalCents ?? 0
  const previous = revenuePrev30._sum.totalCents ?? 0

  return {
    revenueAllCents: revenueAll._sum.totalCents ?? 0,
    revenue30Cents: current,
    revenueChangePercent: previous === 0 ? null : Math.round(((current - previous) / previous) * 100),
    orders30: revenue30._count,
    ordersToday: ordersToday._count,
    revenueTodayCents: ordersToday._sum.totalCents ?? 0,
    pendingOrders,
    refundRequests,
    customers,
    newCustomers30,
    lowStock: lowStock[0]?.count ?? 0,
    outOfStock,
    topProducts,
    topCategories,
    recentActivity,
    recentOrders,
  }
}

// ── System health ───────────────────────────────────────────────────────────

export async function systemHealth() {
  const started = Date.now()
  let database: 'ok' | 'down' = 'ok'
  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    database = 'down'
  }

  return [
    { label: 'Database', status: database, detail: `${Date.now() - started} ms round trip` },
    {
      label: 'Email delivery',
      status: process.env.RESEND_API_KEY ? ('ok' as const) : ('warn' as const),
      detail: process.env.RESEND_API_KEY ? 'Resend key present' : 'No RESEND_API_KEY — mail is logged, not sent',
    },
    {
      label: 'Payments',
      status: process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== 'dev' ? ('ok' as const) : ('warn' as const),
      detail: `Provider: ${process.env.PAYMENT_PROVIDER ?? 'dev'}`,
    },
    {
      label: 'Session secret',
      status: (process.env.AUTH_SECRET?.length ?? 0) >= 32 ? ('ok' as const) : ('warn' as const),
      detail: (process.env.AUTH_SECRET?.length ?? 0) >= 32 ? 'Strong' : 'Shorter than 32 characters',
    },
  ]
}

// ── Automatic collections ───────────────────────────────────────────────────

export type CollectionRules = {
  match: 'all' | 'any'
  conditions: { field: 'tag' | 'category' | 'price' | 'featured'; operator: 'is' | 'is_not' | 'gt' | 'lt'; value: string }[]
}

/**
 * Turns saved rules into a Prisma `where`. Membership is resolved on read
 * rather than stored, so a product that gets a new tag joins the collection
 * without anything having to notice.
 */
export function collectionWhere(rules: CollectionRules) {
  const clauses = rules.conditions.map((condition) => {
    switch (condition.field) {
      case 'tag':
        return condition.operator === 'is_not'
          ? { NOT: { tags: { has: condition.value } } }
          : { tags: { has: condition.value } }
      case 'category':
        return condition.operator === 'is_not'
          ? { NOT: { category: { slug: condition.value } } }
          : { category: { slug: condition.value } }
      case 'price': {
        const cents = Number(condition.value) || 0
        if (condition.operator === 'gt') return { priceCents: { gt: cents } }
        if (condition.operator === 'lt') return { priceCents: { lt: cents } }
        return { priceCents: cents }
      }
      case 'featured':
        return { featured: condition.value !== 'false' && condition.value !== '' }
    }
  })

  if (clauses.length === 0) return { active: true }
  return { active: true, [rules.match === 'any' ? 'OR' : 'AND']: clauses }
}

/** Live member count, so an editor can see a rule works before saving it. */
export async function countAutomaticMembers(rules: unknown): Promise<number> {
  const parsed = rules as CollectionRules | null
  if (!parsed?.conditions?.length) return 0
  return db.product.count({ where: collectionWhere(parsed) }).catch(() => 0)
}

// ── Shared list helpers ─────────────────────────────────────────────────────

export const PER_PAGE = 25

export function paging(pageParam: string | undefined, perPage = PER_PAGE) {
  const page = Math.max(1, Number(pageParam) || 1)
  return { page, skip: (page - 1) * perPage, take: perPage }
}

export function pageCount(total: number, perPage = PER_PAGE): number {
  return Math.max(1, Math.ceil(total / perPage))
}
