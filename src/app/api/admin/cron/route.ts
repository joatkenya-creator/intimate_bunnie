import { runDueTransitions, sweepLowStock } from '@/server/scheduler'

export const dynamic = 'force-dynamic'

// Vercel Cron points here (see vercel.json). /api/redirects already runs
// `runDueTransitions` on middleware's minute poll — this endpoint additionally
// sweeps low stock, which is too heavy for that path.
//
// Guarded by a shared secret rather than a session: a scheduler has no cookies.

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: 'CRON_SECRET is not set' }, { status: 501 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const transitions = await runDueTransitions()
  const lowStockAlerts = await sweepLowStock()

  return Response.json({ ...transitions, lowStockAlerts })
}

// Vercel Cron issues GET and signs it `Authorization: Bearer $CRON_SECRET`,
// which is exactly the guard above. Same handler, no second code path.
export const GET = POST
