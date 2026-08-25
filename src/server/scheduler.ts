import 'server-only'
import { query } from '@/lib/sql'

// Scheduled publishing. Two UPDATEs flip anything whose publish time has passed.
// `/api/redirects` calls this on the once-a-minute poll middleware already makes,
// so scheduling keeps working between cron runs; the cron entry in vercel.json
// calls /api/admin/cron for exact timing and the low-stock sweep.
//
// Plain SQL, not Prisma: this runs on a public request path, which is kept free
// of the ORM — see lib/sql.ts.

export type SweepResult = { products: number; content: number; lowStockAlerts: number }

export async function runDueTransitions(): Promise<SweepResult> {
  const [products, content] = await Promise.all([
    query<{ id: string }>(
      `UPDATE "Product" SET "status" = 'PUBLISHED', "active" = true
       WHERE "status" = 'SCHEDULED' AND "publishAt" <= now() RETURNING "id"`,
    ),
    query<{ id: string }>(
      `UPDATE "ContentEntry" SET "status" = 'PUBLISHED'
       WHERE "status" = 'SCHEDULED' AND "publishAt" <= now() RETURNING "id"`,
    ),
  ])

  return { products: products.length, content: content.length, lowStockAlerts: 0 }
}

/**
 * Raises one notification per product that has just crossed its threshold.
 * Deduplicated against the last day of notifications so a product sitting at
 * two units does not file an alert every minute.
 */
export async function sweepLowStock(): Promise<number> {
  const raised = await query<{ id: string }>(
    `INSERT INTO "AdminNotification" ("id", "type", "level", "title", "body", "link", "createdAt")
     SELECT gen_random_uuid()::text, 'LOW_STOCK',
       CASE WHEN p."inventory" = 0 THEN 'CRITICAL'::"NotificationLevel" ELSE 'WARNING'::"NotificationLevel" END,
       CASE WHEN p."inventory" = 0 THEN 'Out of stock: ' || p."name" ELSE 'Low stock: ' || p."name" END,
       p."inventory" || ' left on hand.',
       '/admin/inventory?product=' || p."id",
       now()
     FROM "Product" p
     WHERE p."active" = true AND p."inventory" <= p."lowStockAt"
       AND NOT EXISTS (
         SELECT 1 FROM "AdminNotification" n
         WHERE n."type" = 'LOW_STOCK'
           AND n."link" = '/admin/inventory?product=' || p."id"
           AND n."createdAt" >= now() - interval '24 hours'
       )
     LIMIT 50
     RETURNING "id"`,
  )

  return raised.length
}
