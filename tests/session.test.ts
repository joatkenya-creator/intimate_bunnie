import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldRefresh,
  ADMIN_IDLE_TIMEOUT_SECONDS,
  ADMIN_REFRESH_AFTER_SECONDS,
  signSession,
  verifySessionToken,
} from '../src/lib/session.ts'

// The refresh rule decides whether an admin session survives. Too eager and the
// idle timeout stops meaning anything; too shy and someone gets logged out
// mid-edit. Both failure modes are silent, so they get assertions.

const now = () => Math.floor(Date.now() / 1000)
const aged = (seconds: number) => ({ uid: 'u1', exp: now() + 60_000, iat: now() - seconds })

test('the refresh point is halfway through the idle window', () => {
  assert.equal(ADMIN_REFRESH_AFTER_SECONDS, Math.floor(ADMIN_IDLE_TIMEOUT_SECONDS / 2))
})

test('a fresh session is not re-issued', () => {
  assert.equal(shouldRefresh(aged(0)), false)
  assert.equal(shouldRefresh(aged(ADMIN_REFRESH_AFTER_SECONDS - 1)), false)
})

test('a session past halfway is re-issued', () => {
  assert.equal(shouldRefresh(aged(ADMIN_REFRESH_AFTER_SECONDS)), true)
  assert.equal(shouldRefresh(aged(ADMIN_IDLE_TIMEOUT_SECONDS - 1)), true)
})

test('an already-expired session is never revived', () => {
  // Refreshing past the window would make the idle timeout unreachable.
  assert.equal(shouldRefresh(aged(ADMIN_IDLE_TIMEOUT_SECONDS + 1)), false)
  assert.equal(shouldRefresh(aged(ADMIN_IDLE_TIMEOUT_SECONDS * 10)), false)
})

test('a session of unknown age is never refreshed', () => {
  assert.equal(shouldRefresh(null), false)
  // Pre-dates `iat`: stamping one now would resurrect a cookie of any age.
  assert.equal(shouldRefresh({ uid: 'u1', exp: now() + 60_000 }), false)
})

// ── Token integrity ─────────────────────────────────────────────────────────

test('a signed session round-trips', async () => {
  process.env.AUTH_SECRET = 'test-secret-value-at-least-16-chars'
  const issued = { uid: 'user-123', exp: now() + 3600, iat: now() }
  const payload = await verifySessionToken(await signSession(issued))
  assert.equal(payload?.uid, 'user-123')
  assert.equal(payload?.iat, issued.iat)
})

test('a tampered payload is rejected', async () => {
  process.env.AUTH_SECRET = 'test-secret-value-at-least-16-chars'
  const token = await signSession({ uid: 'user-123', exp: now() + 3600, iat: now() })
  const [body, signature] = token.split('.')
  // Same signature, different body — the classic forged-cookie attempt.
  const forged = `${body.slice(0, -2)}XY.${signature}`
  assert.equal(await verifySessionToken(forged), null)
})

test('an expired token is rejected even with a valid signature', async () => {
  process.env.AUTH_SECRET = 'test-secret-value-at-least-16-chars'
  const token = await signSession({ uid: 'user-123', exp: now() - 1, iat: now() - 10 })
  assert.equal(await verifySessionToken(token), null)
})

test('a malformed token is rejected rather than thrown on', async () => {
  process.env.AUTH_SECRET = 'test-secret-value-at-least-16-chars'
  for (const bad of [undefined, '', 'nodot', 'a.b.c', '...']) {
    assert.equal(await verifySessionToken(bad), null)
  }
})
