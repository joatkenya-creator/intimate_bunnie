'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { query, queryOne } from '@/lib/sql'
import { requireUser, signToken } from '@/lib/auth'
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

  if (!emailChanged && !nameChanged) return { saved: true }

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
