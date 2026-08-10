import { db } from '@/lib/db'
import { runDueTransitions } from '@/server/scheduler'

export const dynamic = 'force-dynamic'

// Middleware polls this once per isolate per minute for the managed-redirect
// map. Redirect rules are public by nature — they are visible to anyone who
// follows one — so this needs no authentication.
//
// The scheduled-publish sweep rides along on the same poll. That gives
// minute-accurate scheduling with no cron binding; /api/admin/cron exposes the
// same sweep for a real Cloudflare trigger.

export async function GET() {
  try {
    const [rows] = await Promise.all([
      db.redirect.findMany({
        where: { active: true },
        select: { source: true, destination: true, statusCode: true },
        take: 2000,
      }),
      runDueTransitions().catch(() => null),
    ])

    const map = Object.fromEntries(
      rows.map((row) => [row.source, { destination: row.destination, statusCode: row.statusCode }]),
    )

    return Response.json(map, { headers: { 'cache-control': 'public, max-age=60' } })
  } catch {
    // An empty map means "no redirects", which is the safe answer. A 500 here
    // would make middleware retry on every request.
    return Response.json({}, { headers: { 'cache-control': 'public, max-age=10' } })
  }
}
