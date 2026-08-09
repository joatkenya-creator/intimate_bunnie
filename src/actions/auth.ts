'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createSession, destroySession, hashPassword, verifyPassword } from '@/lib/auth'

export type AuthState = { error?: string }

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
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: 'An account with that email already exists' }
  }

  const user = await db.user.create({
    data: { email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) },
    select: { id: true },
  })
  await createSession(user.id)
  redirect('/account')
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { error: 'Enter your email and password' }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, passwordHash: true },
  })
  // Same message either way — never reveal which accounts exist.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: 'Incorrect email or password' }
  }

  await createSession(user.id)
  redirect('/account')
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect('/')
}
