// Request-level defences shared by middleware and the admin API routes.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Fixed-window counter. Returns false once the caller is over the limit.
 *
 * ponytail: the window lives in isolate memory, so each Worker isolate counts
 * separately and a burst spread across isolates gets a proportionally larger
 * allowance. That is fine for "stop a script hammering /admin"; put the counter
 * in a Durable Object or Upstash before relying on it for anything billable.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    // Opportunistic sweep so a long-lived isolate does not grow a bucket per IP
    // forever. Cheap because it only runs on a window rollover.
    if (buckets.size > 5_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
    return true
  }

  bucket.count += 1
  return bucket.count <= limit
}

/**
 * Route handlers hold a Request; Server Actions only get `await headers()`.
 * Both carry the same forwarding headers, so both are accepted.
 */
export function clientIp(source: Request | Headers): string {
  const head = source instanceof Headers ? source : source.headers
  return (
    head.get('cf-connecting-ip') ??
    head.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    head.get('x-real-ip') ??
    'unknown'
  )
}

/**
 * CSRF for route handlers. Server Actions already get this check from Next;
 * `/api/admin/*` handlers do not, and they are cookie-authenticated, so a
 * cross-site form post would otherwise be honoured.
 */
export function isSameOrigin(request: Request): boolean {
  if (request.method === 'GET' || request.method === 'HEAD') return true

  const origin = request.headers.get('origin')
  // A same-origin fetch from a browser always sends Origin on a state-changing
  // request. Absent means "not a browser form post" — reject rather than guess.
  if (!origin) return false

  try {
    return new URL(origin).host === (request.headers.get('host') ?? new URL(request.url).host)
  } catch {
    return false
  }
}

export function forbidden(message = 'Forbidden'): Response {
  return Response.json({ error: message }, { status: 403 })
}

export function tooManyRequests(): Response {
  return Response.json({ error: 'Too many requests' }, { status: 429, headers: { 'retry-after': '60' } })
}
