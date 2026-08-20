import type { Metadata } from 'next'
import Link from 'next/link'
import { query, queryOne } from '@/lib/sql'
import { tokenSubject, verifyToken } from '@/lib/auth'
import { pageMetadata } from '@/lib/seo'
import { sendWelcome } from '@/services/email'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Confirm your email',
  description: 'Confirm the email address on your Intimate Bunnie account.',
  path: '/account/verify',
  noindex: true,
})

async function confirm(token: string | undefined): Promise<boolean> {
  if (!token) return false

  const claimed = tokenSubject(token)
  const user = claimed
    ? await queryOne<{
        id: string
        email: string
        name: string | null
        role: string
        createdAt: Date
        emailVerifiedAt: Date | null
      }>(
        'SELECT "id", "email", "name", "role", "createdAt", "emailVerifiedAt" FROM "User" WHERE "id" = $1',
        [claimed],
      )
    : null
  // Bound to the address: a link mailed to the old address cannot confirm a new one.
  if (!user || !(await verifyToken('verify-email', token, user.email))) return false

  // Only on the first confirmation. The link stays valid for three days, and
  // mail clients pre-fetch — without this guard a scanner or a second click
  // would send the welcome again. The send cannot throw, so a mail outage
  // still leaves the address confirmed.
  if (!user.emailVerifiedAt) {
    await query('UPDATE "User" SET "emailVerifiedAt" = now() WHERE "id" = $1', [user.id])
    await sendWelcome({
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: new Date(user.createdAt),
    })
  }
  return true
}

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const confirmed = await confirm((await searchParams).token)

  return (
    <div className="container-ib max-w-md py-16">
      <h1 className="text-3xl">{confirmed ? 'Email confirmed' : 'That link has expired'}</h1>
      <p className="mt-2 text-sm text-plum-500">
        {confirmed
          ? 'Thank you — your order updates will come to this address.'
          : 'Confirmation links last three days. Sign in and we will send a fresh one.'}
      </p>
      <Link href={confirmed ? '/shop' : '/account/login'} className="btn btn-outline mt-6">
        {confirmed ? 'Start shopping' : 'Sign in'}
      </Link>
    </div>
  )
}
