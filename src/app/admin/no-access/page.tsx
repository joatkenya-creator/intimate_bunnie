import Link from 'next/link'
import { currentAdmin } from '@/lib/rbac'
import { RESOURCE_LABELS, type Resource } from '@/lib/permissions'
import { Panel } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'No access' }

// The only admin route with no permission check — everything else redirects
// here when a permission is missing, so the dashboard being gated cannot turn
// into a redirect loop.

export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ permission?: string }> }) {
  const { permission } = await searchParams
  const admin = await currentAdmin()

  const resource = permission?.split('.')[0] as Resource | undefined
  const area = resource && RESOURCE_LABELS[resource] ? RESOURCE_LABELS[resource] : 'that section'
  const hasNoRole = admin !== null && admin.permissions.length === 0

  return (
    <Panel className="mx-auto max-w-lg">
      <h1 className="text-lg font-semibold">You cannot open {area}</h1>

      {hasNoRole ? (
        <>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            Your account has admin access but <strong>no role assigned</strong>, so it currently grants no permissions at
            all. A Super Administrator needs to assign you one under Staff &amp; roles.
          </p>
          <p className="mt-2 text-sm text-[var(--admin-muted)]">
            If you are the only administrator, promote yourself to Super Administrator directly in the database:
          </p>
          <pre className="admin-scroll mt-2 rounded bg-[var(--admin-raised)] p-3 text-xs">
            {`UPDATE "User" SET role = 'SUPER_ADMIN'\nWHERE email = '${admin?.email ?? 'you@example.com'}';`}
          </pre>
          <p className="mt-2 text-xs text-[var(--admin-muted)]">
            A Super Administrator holds every permission unconditionally, which is what stops a store locking itself out.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-[var(--admin-muted)]">
          Your role does not include <code className="text-xs">{permission ?? 'the required permission'}</code>. Ask a
          Super Administrator to add it, or to move you to a role that has it.
        </p>
      )}

      <p className="mt-4 text-sm">
        <Link href="/admin" className="text-[var(--admin-accent)]">
          Back to the dashboard
        </Link>
        {' · '}
        <Link href="/" className="text-[var(--admin-accent)]">
          View the storefront
        </Link>
      </p>
    </Panel>
  )
}
