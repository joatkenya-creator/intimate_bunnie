'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { query, queryOne } from '@/lib/sql'
import { deleteCustomerAccounts, destroySession, requireUser, signToken, verifyPassword } from '@/lib/auth'
import { newId } from '@/lib/ids'
import { rateLimit } from '@/lib/security'
import { absoluteUrl } from '@/config/site'
import { sendProfileUpdated, sendVerifyEmail } from '@/services/email'

export type ProfileState = { error?: string; saved?: boolean }

const VERIFY_TTL_HOURS = 72

const profileSchema = z.object({
  name: z.string().max(80).optional(),
  email: z.string().email('Enter a valid email'),
})

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  let user
  try {
    user = await requireUser()
  } catch {
    return { error: 'Sign in again to change your details' }
  }

  const parsed = profileSchema.safeParse({
    name: (formData.get('name') as string)?.trim() || undefined,
    email: formData.get('email'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const email = parsed.data.email.toLowerCase()
  const name = parsed.data.name ?? null
  const emailChanged = email !== user.email
  const nameChanged = name !== user.name

  // A no-op save sends nothing, so it costs nothing and is not counted.
  if (!emailChanged && !nameChanged) return { saved: true }

  // Keyed by account, not IP: this action is authenticated, and every real
  // change mails the old address — repointing the email repeatedly is how you
  // would use a stolen session to bury the "your details changed" warning.
  if (!rateLimit(`profile:${user.id}`, 5, 60 * 60_000)) {
    return { error: 'Too many changes just now. Try again in an hour.' }
  }

  if (emailChanged) {
    const taken = await queryOne<{ id: string }>('SELECT "id" FROM "User" WHERE "email" = $1', [email])
    if (taken) return { error: 'That email is already in use' }
  }

  // A new address starts unverified — the old confirmation says nothing about it.
  await query(
    emailChanged
      ? 'UPDATE "User" SET "name" = $1, "email" = $2, "emailVerifiedAt" = NULL WHERE "id" = $3'
      : 'UPDATE "User" SET "name" = $1, "email" = $2 WHERE "id" = $3',
    [name, email, user.id],
  )

  const changes = [nameChanged ? 'Name' : null, emailChanged ? 'Email address' : null].filter(
    (change): change is string => change !== null,
  )

  // The notice goes to the address on file BEFORE the change. If someone else
  // is changing these details, that is the only inbox that will notice.
  await sendProfileUpdated(user.email, changes)

  if (emailChanged) {
    const token = await signToken('verify-email', user.id, VERIFY_TTL_HOURS * 3600, email)
    await sendVerifyEmail(email, absoluteUrl(`/account/verify?token=${token}`), VERIFY_TTL_HOURS)
  }

  revalidatePath('/account')
  revalidatePath('/account/settings')
  return { saved: true }
}

export type DeleteState = { error?: string }

/**
 * Self-service deletion. The password is re-checked here rather than trusted
 * from the session cookie: a borrowed laptop with the account still signed in
 * is the threat, and this is the one action nothing can undo.
 */
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  let user
  try {
    user = await requireUser()
  } catch {
    return { error: 'Sign in again to delete your account' }
  }

  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== 'DELETE') {
    return { error: 'Type DELETE to confirm' }
  }

  // Keyed by account: this is authenticated, so the guess being throttled is a
  // guess at THIS password, by someone already holding the session.
  if (!rateLimit(`delete-account:${user.id}`, 5, 60 * 60_000)) {
    return { error: 'Too many attempts. Try again in an hour.' }
  }

  const row = await queryOne<{ passwordHash: string }>('SELECT "passwordHash" FROM "User" WHERE "id" = $1', [user.id])
  if (!row || !(await verifyPassword(String(formData.get('password') ?? ''), row.passwordHash))) {
    return { error: 'That password is not right' }
  }

  const [deleted] = await deleteCustomerAccounts([user.id])
  if (!deleted) return { error: 'Staff accounts cannot be closed here. Ask a super administrator.' }

  // Written before the cookie goes, and the row it names no longer exists — so
  // `actorId` is deliberately left null rather than pointing at a dead id.
  await query('INSERT INTO "AuditLog" ("id", "actor", "action") VALUES ($1,$2,$3)', [
    newId(),
    user.email,
    'account.delete',
  ]).catch(() => null)

  await destroySession()
  redirect('/')
}
