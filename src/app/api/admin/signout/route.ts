import { redirect } from 'next/navigation'
import { destroySession } from '@/lib/auth'
import { currentAdmin, audit } from '@/lib/rbac'
import { isSameOrigin, forbidden } from '@/lib/security'

export const dynamic = 'force-dynamic'

/** POST-only: a GET sign-out link is a one-pixel image away from being a prank. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden()

  const admin = await currentAdmin()
  if (admin) await audit(admin, 'auth.signout').catch(() => null)

  await destroySession()
  redirect('/account/login')
}
