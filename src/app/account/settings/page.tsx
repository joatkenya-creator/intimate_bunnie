import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { queryOne } from '@/lib/sql'
import { ProfileForm } from '@/components/account/ProfileForm'
import { DeleteAccountForm } from '@/components/account/DeleteAccountForm'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Your details',
  description: 'Update the name and email on your Intimate Bunnie account.',
  path: '/account/settings',
  noindex: true,
})

export default async function SettingsPage() {
  const user = await currentUser().catch(() => null)
  if (!user) redirect('/account/login')

  const verified = await queryOne<{ emailVerifiedAt: Date | null }>(
    'SELECT "emailVerifiedAt" FROM "User" WHERE "id" = $1',
    [user.id],
  )
  const emailVerifiedAt = verified?.emailVerifiedAt ?? null

  return (
    <div className="container-ib max-w-md py-16">
      <p className="eyebrow">Account</p>
      <h1 className="mt-2 text-3xl">Your details</h1>

      {!emailVerifiedAt && (
        <p className="mt-6 border border-line bg-peach-50 px-4 py-3 text-sm">
          Your email is not confirmed yet. Check your inbox for the link we sent when you signed up.
        </p>
      )}

      <ProfileForm name={user.name} email={user.email} />

      <p className="mt-10 border-t border-line pt-6 text-sm text-plum-500">
        Changing your password?{' '}
        <Link href="/account/forgot" className="link-underline text-plum-900">
          Send yourself a reset link
        </Link>
        .
      </p>

      {/* Staff close their account through /admin/staff — the action refuses
          them anyway, but there is no reason to offer the door. */}
      {user.role === 'CUSTOMER' && <DeleteAccountForm />}
    </div>
  )
}
