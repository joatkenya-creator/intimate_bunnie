import { query, transaction } from '@/lib/sql'
import { newId } from '@/lib/ids'
import { currentUser } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'

const MAX_ITEMS = 60

/**
 * Mirrors a signed-in shopper's localStorage wishlist so the admin can see it.
 * localStorage stays the source of truth on the storefront; this is a copy.
 *
 * Sent with `navigator.sendBeacon`, which cannot set an Origin header on every
 * browser — so this route only ever replaces the caller's own rows and never
 * reads anything back. There is nothing here for a cross-site post to steal.
 */
export async function POST(request: Request) {
  const user = await currentUser().catch(() => null)
  // A signed-out visitor is not an error; their wishlist is simply local.
  if (!user) return new Response(null, { status: 204 })

  if (!rateLimit(`wishlist:${clientIp(request)}`, 60, 60_000)) return new Response(null, { status: 429 })

  let ids: string[]
  try {
    const body = (await request.json()) as { ids?: unknown }
    if (!Array.isArray(body.ids)) return new Response(null, { status: 400 })
    ids = body.ids.filter((id): id is string => typeof id === 'string').slice(0, MAX_ITEMS)
  } catch {
    return new Response(null, { status: 400 })
  }

  // Only ids that are real products — a crafted payload must not create rows
  // pointing at nothing.
  const products = await query<{ id: string }>('SELECT "id" FROM "Product" WHERE "id" = ANY($1)', [ids])

  await transaction([
    { text: 'DELETE FROM "WishlistItem" WHERE "userId" = $1', values: [user.id] },
    ...products.map((product) => ({
      text: `INSERT INTO "WishlistItem" ("id", "userId", "productId") VALUES ($1,$2,$3)
             ON CONFLICT ("userId", "productId") DO NOTHING`,
      values: [newId(), user.id, product.id],
    })),
  ])

  return new Response(null, { status: 204 })
}
