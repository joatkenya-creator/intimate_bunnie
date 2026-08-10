import { db } from '@/lib/db'
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
  const products = await db.product.findMany({ where: { id: { in: ids } }, select: { id: true } })

  await db.$transaction([
    db.wishlistItem.deleteMany({ where: { userId: user.id } }),
    db.wishlistItem.createMany({
      data: products.map((product) => ({ userId: user.id, productId: product.id })),
      skipDuplicates: true,
    }),
  ])

  return new Response(null, { status: 204 })
}
