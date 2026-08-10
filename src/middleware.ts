import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, clientIp } from '@/lib/security'

// Middleware is the only place that sees every request before routing, so it
// carries the three things that must not be per-page opt-ins: the pathname the
// root layout needs, admin rate limiting, and managed redirects.

const SESSION_COOKIE = 'ib_session'
const REDIRECT_TTL_MS = 60_000

let redirectCache: { at: number; map: Record<string, { destination: string; statusCode: number }> } = {
  at: 0,
  map: {},
}

/**
 * Managed redirects live in Postgres, which middleware cannot reach — it has no
 * database client. One cached fetch per isolate per minute keeps the hot path
 * free of a query while still letting an editor add a redirect without a deploy.
 */
async function redirectFor(request: NextRequest, pathname: string) {
  if (Date.now() - redirectCache.at > REDIRECT_TTL_MS) {
    try {
      const response = await fetch(new URL('/api/redirects', request.nextUrl.origin), {
        headers: { 'x-internal': '1' },
      })
      if (response.ok) redirectCache = { at: Date.now(), map: await response.json() }
      else redirectCache = { ...redirectCache, at: Date.now() }
    } catch {
      // A redirect lookup must never take the site down.
      redirectCache = { ...redirectCache, at: Date.now() }
    }
  }
  return redirectCache.map[pathname]
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/api/admin')

  if (isAdmin) {
    // Tight on the admin surface: it is a small number of humans, and every
    // route behind it is authenticated and expensive.
    if (!rateLimit(`admin:${clientIp(request)}`, 240, 60_000)) {
      return new NextResponse('Too many requests', { status: 429, headers: { 'retry-after': '60' } })
    }

    // Cheap bounce before rendering. Authorization itself still happens on the
    // server in the admin layout — this only saves the work, it is not the gate.
    if (pathname.startsWith('/admin') && !request.cookies.has(SESSION_COOKIE)) {
      const login = new URL('/account/login', request.url)
      login.searchParams.set('next', pathname)
      return NextResponse.redirect(login)
    }
  } else {
    const hit = await redirectFor(request, pathname)
    if (hit) {
      return NextResponse.redirect(new URL(hit.destination, request.url), hit.statusCode === 302 ? 307 : 308)
    }
  }

  const response = NextResponse.next({ request: { headers: withPathname(request) } })
  return response
}

function withPathname(request: NextRequest): Headers {
  const headers = new Headers(request.headers)
  headers.set('x-pathname', request.nextUrl.pathname)
  return headers
}

export const config = {
  // Everything except static assets and the redirect map itself — fetching that
  // from inside middleware would otherwise recurse.
  matcher: ['/((?!_next/static|_next/image|api/redirects|favicon.ico|robots.txt|sitemap.xml).*)'],
}
