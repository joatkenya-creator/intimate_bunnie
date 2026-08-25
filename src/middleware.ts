import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, clientIp } from '@/lib/security'
import { resolveRedirect } from '@/lib/redirects'
import {
  SESSION_COOKIE,
  signSession,
  verifySessionToken,
  sessionCookieOptions,
  shouldRefresh,
} from '@/lib/session'

// Middleware is the only place that sees every request before routing, so it
// carries the things that must not be per-page opt-ins: the pathname the root
// layout needs, admin rate limiting, managed redirects, bouncing signed-out
// visitors off private pages, and keeping an active admin session alive.

// The account pages a signed-out visitor is supposed to reach. Everything else
// under /account is personal.
const PUBLIC_ACCOUNT_PATHS = ['/account/login', '/account/register', '/account/forgot', '/account/reset', '/account/verify']

/**
 * `redirect()` inside a streamed Server Component cannot set a status: by the
 * time it throws, the shell has been flushed, so Next falls back to a
 * `<meta http-equiv="refresh" content="1;url=…">` — a 200 response, a blank
 * second of screen, and a redirect assistive technology has no way to announce.
 *
 * Bouncing here instead makes it a real 307 before any rendering happens, and
 * saves the session lookup and layout render that were being thrown away.
 *
 * This is a bounce, not authorisation. Every page behind it still resolves the
 * session server-side; a forged cookie gets past this and no further.
 */
function needsSession(pathname: string): boolean {
  if (!pathname.startsWith('/account')) return false
  return !PUBLIC_ACCOUNT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function toLogin(request: NextRequest, pathname: string) {
  const login = new URL('/account/login', request.url)
  login.searchParams.set('next', pathname)
  return NextResponse.redirect(login)
}

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
async function redirectMap(request: NextRequest) {
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
  return redirectCache.map
}

/**
 * Slides the admin idle window forward. Only middleware can do this: a Server
 * Component cannot set a cookie, and the admin is almost entirely pages, so a
 * refresh anywhere else would miss ordinary navigation.
 *
 * Nothing here decides whether the session is *valid* — `requirePermission()`
 * still enforces the window server-side. This only extends a session that is
 * demonstrably being used, and never one whose age it cannot establish.
 */
async function refreshAdminSession(request: NextRequest, response: NextResponse): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return

  try {
    const payload = await verifySessionToken(token)
    if (!shouldRefresh(payload)) return

    const refreshed = await signSession({ ...payload, iat: Math.floor(Date.now() / 1000) })
    response.cookies.set(SESSION_COOKIE, refreshed, sessionCookieOptions())
  } catch {
    // A failed refresh must never block the request — the worst case is that
    // the session times out on schedule, which is the documented behaviour.
  }
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
    if (pathname.startsWith('/admin') && !request.cookies.has(SESSION_COOKIE)) return toLogin(request, pathname)
  } else {
    if (needsSession(pathname) && !request.cookies.has(SESSION_COOKIE)) return toLogin(request, pathname)

    const hit = resolveRedirect(await redirectMap(request), pathname)
    if (hit) {
      const target = new URL(hit.destination, request.url)
      // A destination that carries no query of its own inherits the request's,
      // so a redirect never drops the campaign parameters that paid for it.
      if (!target.search) target.search = request.nextUrl.search
      return NextResponse.redirect(target, hit.statusCode === 302 ? 307 : 308)
    }
  }

  const response = NextResponse.next({ request: { headers: withPathname(request) } })
  // Admin activity slides the idle window; storefront browsing deliberately
  // does not, because the window exists to cover an unattended admin screen.
  if (isAdmin) await refreshAdminSession(request, response)
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
