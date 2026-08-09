import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { AuthForm } from '@/components/account/AuthForm'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Create an account',
  description: 'Create an Intimate Bunnie account for faster checkout and order tracking.',
  path: '/account/register',
  noindex: true,
})

export default async function RegisterPage() {
  if (await currentUser().catch(() => null)) redirect('/account')

  return (
    <div className="container-ib max-w-md py-16">
      <h1 className="text-3xl">Create an account</h1>
      <p className="mt-2 text-sm text-plum-500">Faster checkout, order tracking, and a saved wishlist.</p>
      <AuthForm mode="register" />
    </div>
  )
}
