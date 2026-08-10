import 'server-only'
import { db } from '@/lib/db'
import { notify } from './admin'

// Scheduled publishing without a scheduler. Two UPDATEs flip anything whose
// publish time has passed; `/api/redirects` calls this on the once-a-minute
// poll middleware already makes, so scheduling works on the free plan with no
// cron binding. Point a Cloudflare cron trigger at /api/admin/cron when the
// piggyback is not precise enough.

export type SweepResult = { products: number; content: number; lowStockAlerts: number }

export async function runDueTransitions(): Promise<SweepResult> {
  const now = new Date()

  const [products, content] = await Promise.all([
    db.product.updateMany({
      where: { status: 'SCHEDULED', publishAt: { lte: now } },
      data: { status: 'PUBLISHED', active: true },
    }),
    db.contentEntry.updateMany({
      where: { status: 'SCHEDULED', publishAt: { lte: now } },
      data: { status: 'PUBLISHED' },
    }),
  ])

  return { products: products.count, content: content.count, lowStockAlerts: 0 }
}

/**
 * Raises one notification per product that has just crossed its threshold.
 * Deduplicated against the last day of notifications so a product sitting at
 * two units does not file an alert every minute.
 */
export async function sweepLowStock(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const low = await db.$queryRaw<{ id: string; name: string; inventory: number }[]>`
    SELECT p."id", p."name", p."inventory"
    FROM "Product" p
    WHERE p."active" = true AND p."inventory" <= p."lowStockAt"
      AND NOT EXISTS (
        SELECT 1 FROM "AdminNotification" n
        WHERE n."type" = 'LOW_STOCK' AND n."link" = '/admin/inventory?product=' || p."id" AND n."createdAt" >= ${since}
      )
    LIMIT 50`

  for (const product of low) {
    await notify({
      type: 'LOW_STOCK',
      level: product.inventory === 0 ? 'CRITICAL' : 'WARNING',
      title: product.inventory === 0 ? `Out of stock: ${product.name}` : `Low stock: ${product.name}`,
      body: `${product.inventory} left on hand.`,
      link: `/admin/inventory?product=${product.id}`,
    })
  }

  return low.length
}
