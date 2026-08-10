import type { Metadata } from 'next'
import Link from 'next/link'
import { ResetForm } from '@/components/account/PasswordForms'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Choose a new password',
  description: 'Set a new password for your Intimate Bunnie account.',
  path: '/account/reset',
  noindex: true,
})

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  // The token is only checked when the form is submitted — a page that reported
  // "valid" or "invalid" on load would confirm live links to anyone holding one.
  const token = (await searchParams).token

  if (!token) {
    return (
      <div className="container-ib max-w-md py-16">
        <h1 className="text-3xl">That link is incomplete</h1>
        <p className="mt-2 text-sm text-plum-500">Open the link from your email again, or request a new one.</p>
        <Link href="/account/forgot" className="btn btn-outline mt-6">
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="container-ib max-w-md py-16">
      <h1 className="text-3xl">Choose a new password</h1>
      <p className="mt-2 text-sm text-plum-500">Once you save it, you are signed in.</p>
      <ResetForm token={token} />
    </div>
  )
}
