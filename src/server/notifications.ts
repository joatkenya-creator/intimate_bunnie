import 'server-only'
import { query } from '@/lib/sql'
import { newId } from '@/lib/ids'

// Notification writes live here rather than in server/admin.ts because checkout
// and returns raise them, and those run on customer requests. Importing the
// admin query layer would drag Prisma onto the storefront, and the WASM engine
// cannot be instantiated inside the free plan's CPU budget.

type NotificationInput = {
  type: 'ORDER' | 'LOW_STOCK' | 'REFUND' | 'PAYMENT_FAILED' | 'CUSTOMER' | 'SYSTEM'
  level?: 'INFO' | 'WARNING' | 'CRITICAL'
  title: string
  body?: string
  link?: string
}

/** Fire-and-forget: a failed notification must never fail the thing it reports. */
export async function notify(input: NotificationInput): Promise<void> {
  await query(
    `INSERT INTO "AdminNotification" ("id", "type", "level", "title", "body", "link")
     VALUES ($1, $2::"NotificationType", $3::"NotificationLevel", $4, $5, $6)`,
    [newId(), input.type, input.level ?? 'INFO', input.title, input.body ?? null, input.link ?? null],
  ).catch(() => undefined)
}
