import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { saveStaff, revokeStaff } from '@/actions/admin/staff'
import { PageHeader, Panel, Badge, toneFor, EmptyState, formatDate, formatDateTime } from '@/components/admin/ui'
import { AdminForm, TextField, SelectField } from '@/components/admin/forms'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Staff' }

export default async function AdminStaff({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const admin = await requirePagePermission('staff.read')
  const { edit } = await searchParams
  const mayWrite = await hasPermission('staff.write')
  const mayDelete = await hasPermission('staff.delete')

  const [staff, roles, logins] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ['STAFF', 'ADMIN', 'SUPER_ADMIN'] } },
      orderBy: [{ role: 'desc' }, { email: 'asc' }],
      select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true, adminRole: { select: { id: true, name: true } } },
    }),
    db.adminRole.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.auditLog.findMany({
      where: { action: { in: ['auth.login', 'auth.login.failed'] } },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, actor: true, action: true, ip: true, createdAt: true },
    }),
  ])

  const editing = edit ? staff.find((person) => person.id === edit) : null

  return (
    <>
      <PageHeader
        title="Staff & roles"
        description="Access level opens the admin door; the role decides what is behind it."
        actions={
          <Link href="/admin/staff/roles" className="admin-btn admin-btn-ghost">
            Manage roles
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Panel title="Staff" bodyClassName="p-0">
            {staff.length === 0 ? (
              <EmptyState title="No staff yet" description="Invite someone on the right." />
            ) : (
              <div className="admin-scroll">
                <table className="admin-table w-full min-w-[42rem]">
                  <thead className="border-b border-[var(--admin-line)]">
                    <tr>
                      <th scope="col">Person</th>
                      <th scope="col">Access level</th>
                      <th scope="col">Role</th>
                      <th scope="col">Last sign-in</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-line)]">
                    {staff.map((person) => (
                      <tr key={person.id}>
                        <td>
                          <span className="font-medium">{person.name ?? person.email}</span>
                          <span className="block text-xs text-[var(--admin-muted)]">{person.email}</span>
                        </td>
                        <td>
                          <Badge tone={person.role === 'SUPER_ADMIN' ? 'accent' : 'info'}>{person.role.replace('_', ' ')}</Badge>
                        </td>
                        <td className="text-[var(--admin-muted)]">
                          {person.role === 'SUPER_ADMIN' ? 'All permissions' : (person.adminRole?.name ?? '— none assigned')}
                        </td>
                        <td className="text-xs text-[var(--admin-muted)]">
                          {person.lastLoginAt ? formatDateTime(person.lastLoginAt) : 'Never'}
                        </td>
                        <td>
                          <Badge tone={toneFor(person.status)}>{person.status}</Badge>
                        </td>
                        <td className="space-x-2 text-right text-xs">
                          {mayWrite && (
                            <Link href={`/admin/staff?edit=${person.id}`} className="text-[var(--admin-accent)]">
                              Edit
                            </Link>
                          )}
                          {mayDelete && person.id !== admin.id && (
                            <RowAction action={revokeStaff} id={person.id} label="Revoke" variant="danger" confirm={`Remove admin access for ${person.email}? Their customer account stays.`} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Login history" description="Successful and failed sign-ins, newest first">
            {logins.length === 0 ? (
              <p className="text-sm text-[var(--admin-muted)]">Nothing recorded yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--admin-line)] text-sm">
                {logins.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                    <span>
                      {entry.actor}{' '}
                      <Badge tone={entry.action === 'auth.login' ? 'ok' : 'danger'}>
                        {entry.action === 'auth.login' ? 'success' : 'failed'}
                      </Badge>
                    </span>
                    <span className="text-xs text-[var(--admin-muted)]">
                      {entry.ip ?? 'unknown IP'} · {formatDateTime(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title={editing ? `Edit ${editing.email}` : 'Invite or promote'}>
            {mayWrite ? (
              <AdminForm action={saveStaff} key={editing?.id ?? 'new'}>
                {editing && <input type="hidden" name="id" value={editing.id} />}
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  defaultValue={editing?.email}
                  disabled={Boolean(editing)}
                  required={!editing}
                  hint={editing ? undefined : 'An existing customer is promoted; a new address is invited.'}
                />
                <TextField label="Name" name="name" defaultValue={editing?.name ?? ''} />
                <SelectField
                  label="Access level"
                  name="role"
                  defaultValue={editing?.role ?? 'STAFF'}
                  options={[
                    { value: 'STAFF', label: 'Staff' },
                    { value: 'ADMIN', label: 'Administrator' },
                    ...(admin.role === 'SUPER_ADMIN' ? [{ value: 'SUPER_ADMIN', label: 'Super Administrator' }] : []),
                    { value: 'CUSTOMER', label: 'Customer — no admin access' },
                  ]}
                  hint="Super Administrator holds every permission unconditionally."
                />
                <SelectField
                  label="Role"
                  name="adminRoleId"
                  defaultValue={editing?.adminRole?.id ?? ''}
                  options={[{ value: '', label: 'No role — no permissions' }, ...roles.map((role) => ({ value: role.id, label: role.name }))]}
                />
                <SelectField
                  label="Status"
                  name="status"
                  defaultValue={editing?.status ?? 'ACTIVE'}
                  options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'INVITED', label: 'Invited' },
                    { value: 'BLOCKED', label: 'Blocked' },
                  ]}
                />
                {editing && (
                  <Link href="/admin/staff" className="block text-xs text-[var(--admin-accent)]">
                    Cancel and invite someone else
                  </Link>
                )}
              </AdminForm>
            ) : (
              <p className="text-sm text-[var(--admin-muted)]">You have read-only access to staff.</p>
            )}
          </Panel>

          <Panel title="How invites work">
            <p className="text-sm text-[var(--admin-muted)]">
              An invited account is created with a random password nobody knows. Send the person through
              &ldquo;Forgot password&rdquo; on the storefront to set their own — there is no invite email to intercept and no
              temporary password to leak in a chat window.
            </p>
            {editing && (
              <p className="mt-2 text-sm text-[var(--admin-muted)]">Account created {formatDate(editing.createdAt)}.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
