import 'server-only'
import { cookies } from 'next/headers'
import { db } from './db'
import { b64url, fromB64url, timingSafeEqual } from './password'

// Sessions run entirely on Web Crypto — available in both Node and workerd, so
// no auth dependency and no Node-only shim in the Worker. Password hashing
// lives in ./password because the seed script needs it too.

export { hashPassword, verifyPassword } from './password'

const SESSION_COOKIE = 'ib_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

const enc = new TextEncoder()

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 16) throw new Error('AUTH_SECRET is missing or too short')
  return s
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)))
}

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

// `iat` is what admin idle timeout reads. It is optional on the type because
// sessions minted before it existed are still valid for the storefront — the
// admin gate treats a missing `iat` as "unknown age" and asks for a fresh login.
type SessionPayload = { uid: string; exp: number; iat?: number }

export async function createSession(userId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = { uid: userId, exp: now + SESSION_MAX_AGE, iat: now }
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const token = `${body}.${await hmac(body)}`
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  if (!timingSafeEqual(await hmac(body), sig)) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null
  } catch {
    return null
  }
}

export async function currentUser() {
  const session = await readSession()
  if (!session) return null
  return db.user.findUnique({
    where: { id: session.uid },
    select: { id: true, email: true, name: true, role: true },
  })
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
 * Seconds since this session was issued, or null when the cookie is missing,
 * invalid, or predates `iat`. Admin routes use it for an idle timeout that the
 * long storefront cookie deliberately does not enforce.
 */
export async function sessionAgeSeconds(): Promise<number | null> {
  const session = await readSession()
  if (!session?.iat) return null
  return Math.floor(Date.now() / 1000) - session.iat
}
