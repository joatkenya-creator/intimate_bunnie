import { suggest } from '@/server/search'
import { rateLimit, clientIp } from '@/lib/security'

export const dynamic = 'force-dynamic'

/**
 * Typeahead for the storefront search box. Public, read-only, and capped at
 * seven rows — it returns names and thumbnails, never enough to reconstruct the
 * catalog from.
 */
export async function GET(request: Request) {
  if (!rateLimit(`suggest:${clientIp(request)}`, 120, 60_000)) {
    return Response.json({ suggestions: [] }, { status: 429 })
  }

  const term = new URL(request.url).searchParams.get('q') ?? ''

  try {
    const suggestions = await suggest(term)
    return Response.json(
      { suggestions },
      // Short shared cache: the same few prefixes get typed constantly, and a
      // suggestion list is not personal.
      { headers: { 'cache-control': 'public, max-age=30, s-maxage=60' } },
    )
  } catch {
    // A failed lookup must degrade to "no suggestions", never break the box.
    return Response.json({ suggestions: [] })
  }
}
