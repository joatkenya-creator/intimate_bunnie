'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { query, queryOne } from '@/lib/sql'
import {
  createSession,
  destroySession,
  hashPassword,
  signToken,
  tokenSubject,
  verifyPassword,
  verifyToken,
} from '@/lib/auth'
import { absoluteUrl } from '@/config/site'
import { rateLimit } from '@/lib/security'
import { newId } from '@/lib/ids'
import { sendPasswordChanged, sendPasswordReset, sendVerifyEmail, sendWelcome } from '@/services/email'

export type AuthState = { error?: string; sent?: boolean }

const VERIFY_TTL_HOURS = 72
const RESET_TTL_MINUTES = 60

const credentials = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
})

const registration = credentials.extend({ name: z.string().min(1).max(80).optional() })

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registration.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const email = parsed.data.email.toLowerCase()
  if (await queryOne<{ id: string }>('SELECT "id" FROM "User" WHERE "email" = $1', [email])) {
    return { error: 'An account with that email already exists' }
  }

  const user = (await queryOne<{ id: string }>(
    'INSERT INTO "User" ("id", "email", "name", "passwordHash") VALUES ($1,$2,$3,$4) RETURNING "id"',
    [newId(), email, parsed.data.name ?? null, await hashPassword(parsed.data.password)],
  ))!

  // Bound to the address itself, so a link mailed to an old address cannot
  // verify a new one. Neither send can throw; both run before the redirect.
  const token = await signToken('verify-email', user.id, VERIFY_TTL_HOURS * 3600, email)
  await sendWelcome(email, parsed.data.name)
  await sendVerifyEmail(email, absoluteUrl(`/account/verify?token=${token}`), VERIFY_TTL_HOURS)

  await createSession(user.id)
  redirect('/account')
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.string().email().safeParse(formData.get('email'))
  // Same answer whether or not the account exists — the form must not become a
  // way to test which addresses are registered.
  if (!parsed.success) return { sent: true }

  const user = await queryOne<{ id: string; email: string; passwordHash: string }>(
    'SELECT "id", "email", "passwordHash" FROM "User" WHERE "email" = $1',
    [parsed.data.toLowerCase()],
  )

  if (user) {
    // Signed against the current hash: the link dies as soon as it is used.
    const token = await signToken('password-reset', user.id, RESET_TTL_MINUTES * 60, user.passwordHash)
    await sendPasswordReset(user.email, absoluteUrl(`/account/reset?token=${token}`), RESET_TTL_MINUTES)
  }

  return { sent: true }
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
})

export async function resetPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = resetSchema.safeParse({ token: formData.get('token'), password: formData.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const claimed = tokenSubject(parsed.data.token)
  const user = claimed
    ? await queryOne<{ id: string; email: string; passwordHash: string }>(
        'SELECT "id", "email", "passwordHash" FROM "User" WHERE "id" = $1',
        [claimed],
      )
    : null
  if (!user || !(await verifyToken('password-reset', parsed.data.token, user.passwordHash))) {
    return { error: 'That link has expired or has already been used. Request a new one.' }
  }

  await query('UPDATE "User" SET "passwordHash" = $1 WHERE "id" = $2', [
    await hashPassword(parsed.data.password),
    user.id,
  ])
  await sendPasswordChanged(user.email, new Date())

  await createSession(user.id)
  redirect('/account')
}

/** Only a path on this site. An open redirect here would be a phishing gift. */
function safeNext(value: FormDataEntryValue | null): string | null {
  const next = String(value ?? '')
  return next.startsWith('/') && !next.startsWith('//') ? next : null
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { error: 'Enter your email and password' }

  const email = parsed.data.email.toLowerCase()
  // Throttled per account, not per IP: credential stuffing rotates addresses
  // far more cheaply than it rotates targets.
  if (!rateLimit(`login:${email}`, 8, 15 * 60_000)) {
    return { error: 'Too many attempts. Wait a few minutes and try again.' }
  }

  const user = await queryOne<{ id: string; passwordHash: string; role: string; status: string }>(
    'SELECT "id", "passwordHash", "role", "status" FROM "User" WHERE "email" = $1',
    [email],
  )
  // Same message either way — never reveal which accounts exist.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    // Failed attempts are the login history that matters; the successful ones
    // are only interesting next to them.
    await query('INSERT INTO "AuditLog" ("id", "actor", "action") VALUES ($1,$2,$3)', [
      newId(),
      email,
      'auth.login.failed',
    ]).catch(() => null)
    return { error: 'Incorrect email or password' }
  }

  if (user.status === 'BLOCKED') return { error: 'That account has been suspended. Contact support.' }

  await query(`UPDATE "User" SET "lastLoginAt" = now(), "status" = 'ACTIVE' WHERE "id" = $1`, [user.id])
  await query(
    'INSERT INTO "AuditLog" ("id", "actor", "actorId", "action", "meta") VALUES ($1,$2,$3,$4,$5::jsonb)',
    [newId(), email, user.id, 'auth.login', JSON.stringify({ role: user.role })],
  ).catch(() => null)

  await createSession(user.id)
  redirect(safeNext(formData.get('next')) ?? '/account')
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect('/')
}
