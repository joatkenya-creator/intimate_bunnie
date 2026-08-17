import 'server-only'
import { cookies } from 'next/headers'
import { query, queryOne } from './sql'
import { b64url, fromB64url, timingSafeEqual } from './password'
import {
  hmac,
  signSession,
  verifySessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  type SessionPayload,
} from './session'

// Sessions run entirely on Web Crypto — available in both Node and workerd, so
// no auth dependency and no Node-only shim in the Worker. Password hashing
// lives in ./password because the seed script needs it too; token signing lives
// in ./session because middleware needs it and cannot import a server-only file.

export { hashPassword, verifyPassword } from './password'

const enc = new TextEncoder()

// ── Emailed links: verify address, reset password ───────────────────────────
// Signed and self-expiring, and bound to a value that changes once the link is
// used — a reset link is signed against the current password hash, so it stops
// working the moment the password changes. That buys single use without a token
// table, a write on every request, or a job to sweep expired rows.

export type TokenPurpose = 'verify-email' | 'password-reset'

type TokenPayload = { p: TokenPurpose; uid: string; exp: number }

export async function signToken(
  purpose: TokenPurpose,
  userId: string,
  ttlSeconds: number,
  bind: string,
): Promise<string> {
  const payload: TokenPayload = { p: purpose, uid: userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds }
  const body = b64url(enc.encode(JSON.stringify(payload)))
  return `${body}.${await hmac(`${body}.${bind}`)}`
}

/**
 * The user id a token claims, WITHOUT checking the signature. Only for looking
 * up the value to bind against; verifyToken decides whether to trust it.
 */
export function tokenSubject(token: string): string | null {
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(token.split('.')[0] ?? ''))) as TokenPayload
    return typeof payload.uid === 'string' && payload.uid ? payload.uid : null
  } catch {
    return null
  }
}

/** Returns the user id when the token is valid, unexpired, and for this purpose. */
export async function verifyToken(purpose: TokenPurpose, token: string, bind: string): Promise<string | null> {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  if (!timingSafeEqual(await hmac(`${body}.${bind}`), sig)) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as TokenPayload
    if (payload.p !== purpose) return null
    return payload.exp > Math.floor(Date.now() / 1000) ? payload.uid : null
  } catch {
    return null
  }
}

export async function createSession(userId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { uid: userId, exp: now + SESSION_MAX_AGE, iat: now }
  const jar = await cookies()
  jar.set(SESSION_COOKIE, await signSession(payload), sessionCookieOptions())
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

async function readSession(): Promise<SessionPayload | null> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value)
}

export type CurrentUser = { id: string; email: string; name: string | null; role: string }

/**
 * Runs on every request through the header, so it must not touch Prisma: the
 * WASM engine cannot be instantiated inside the free plan's CPU budget. Plain
 * SQL over Neon's HTTP endpoint — see lib/sql.ts.
 */
export async function currentUser(): Promise<CurrentUser | null> {
  const session = await readSession()
  if (!session) return null
  return queryOne<CurrentUser>('SELECT "id", "email", "name", "role" FROM "User" WHERE "id" = $1', [session.uid])
}

export async function requireUser() {
  const user = await currentUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}

export async function requireAdmin() {
  const user = await currentUser()
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) throw new Error('FORBIDDEN')
  return user
}

/**
 * Erases accounts. Addresses, wishlist rows, and the store-credit ledger cascade
 * with them; orders keep their row with `userId` nulled, so the books still
 * balance after the person is gone.
 *
 * CUSTOMER rows only, and that lives in the `WHERE` rather than at each call
 * site. Three doors reach this — the detail-page button, the bulk bar, and the
 * customer's own settings form — and a staff row leaving by any of them could
 * take the store's last super administrator with it. Staff removal belongs in
 * /admin/staff.
 *
 * Returns the emails actually deleted, for the audit entry. An id that names a
 * staff account or nothing at all is simply absent from the result, so a caller
 * that passes one id can treat an empty array as "refused".
 */
export async function deleteCustomerAccounts(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const rows = await query<{ email: string }>(
    `DELETE FROM "User" WHERE "id" = ANY($1::text[]) AND "role" = 'CUSTOMER' RETURNING "email"`,
    [ids],
  )
  return rows.map((row) => row.email)
}

/**
 * Seconds since this session was last issued or refreshed, or null when the
 * cookie is missing, invalid, or predates `iat`. Middleware restamps `iat` on
 * admin activity, so this measures idle time — the long storefront cookie
 * deliberately enforces no such window.
 */
export async function sessionAgeSeconds(): Promise<number | null> {
  const session = await readSession()
  if (!session?.iat) return null
  return Math.floor(Date.now() / 1000) - session.iat
}
