// Extensioned specifier so `node --test` can load this module directly — the
// bundler is happy either way, but Node's ESM resolver is not.
import { b64url, fromB64url, timingSafeEqual } from './password.ts'

// Session token encode/decode, with no dependency on `next/headers`.
//
// That independence is the point: `lib/auth.ts` reads and writes the cookie jar
// from Server Components and actions, while middleware works with request and
// response cookies instead. Both need to verify and mint the same token, and a
// `server-only` module cannot be imported into middleware.

export const SESSION_COOKIE = 'ib_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30

/**
 * How long an admin session survives without activity. Any admin request past
 * the halfway mark re-issues the cookie, so this is an idle window rather than
 * a hard cap — a shared stockroom laptop is the threat, not a long shift.
 */
export const ADMIN_IDLE_TIMEOUT_SECONDS = Number(process.env.ADMIN_SESSION_TIMEOUT_MINUTES ?? 60) * 60

/** Re-issue once past halfway, so an active session is never interrupted and a
 *  quiet one still sets at most one cookie per half-window. */
export const ADMIN_REFRESH_AFTER_SECONDS = Math.floor(ADMIN_IDLE_TIMEOUT_SECONDS / 2)

export type SessionPayload = {
  uid: string
  exp: number
  /** Issued-at, refreshed on activity. Absent on sessions minted before idle
   *  timeouts existed — those read as "unknown age" and are asked to sign in. */
  iat?: number
}

const enc = new TextEncoder()

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) throw new Error('AUTH_SECRET is missing or too short')
  return secret
}

/** The signing primitive behind both session cookies and emailed links. */
export async function hmac(payload: string, secret = authSecret()): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(payload)))
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  return `${body}.${await hmac(body)}`
}

/** Returns the payload when the signature holds and the token has not expired. */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  if (!timingSafeEqual(await hmac(body), signature)) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null
  } catch {
    return null
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  }
}

/**
 * Should this admin request extend the session? True once the session is past
 * halfway to the idle limit. A session with no `iat` is never refreshed —
 * backfilling one would silently resurrect a cookie of unknown age.
 */
export function shouldRefresh(payload: SessionPayload | null): payload is SessionPayload & { iat: number } {
  if (!payload?.iat) return false
  const age = Math.floor(Date.now() / 1000) - payload.iat
  return age >= ADMIN_REFRESH_AFTER_SECONDS && age <= ADMIN_IDLE_TIMEOUT_SECONDS
}
