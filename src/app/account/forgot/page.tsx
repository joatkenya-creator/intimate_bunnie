import type { Metadata } from 'next'
import { ForgotForm } from '@/components/account/PasswordForms'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Reset your password',
  description: 'Request a password reset link for your Intimate Bunnie account.',
  path: '/account/forgot',
  noindex: true,
})

export default function ForgotPage() {
  return (
    <div className="container-ib max-w-md py-16">
      <h1 className="text-3xl">Reset your password</h1>
      <p className="mt-2 text-sm text-plum-500">We will email you a link to choose a new one.</p>
      <ForgotForm />
    </div>
  )
}
