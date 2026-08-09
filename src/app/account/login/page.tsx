import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { AuthForm } from '@/components/account/AuthForm'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Sign in',
  description: 'Sign in to your Intimate Bunnie account.',
  path: '/account/login',
  noindex: true,
})

export default async function LoginPage() {
  if (await currentUser().catch(() => null)) redirect('/account')

  return (
    <div className="container-ib max-w-md py-16">
      <h1 className="text-3xl">Sign in</h1>
      <p className="mt-2 text-sm text-plum-500">Your order history and wishlist, waiting where you left them.</p>
      <AuthForm mode="login" />
    </div>
  )
}
