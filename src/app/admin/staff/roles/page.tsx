import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { RESOURCES, ACTIONS, RESOURCE_LABELS, can } from '@/lib/permissions'
import { saveRole, deleteRole } from '@/actions/admin/staff'
import { PageHeader, Panel, Badge, EmptyState } from '@/components/admin/ui'
import { AdminForm, TextField, TextArea, SelectField } from '@/components/admin/forms'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Roles' }

export default async function AdminRoles({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requirePagePermission('staff.read')
  const { edit } = await searchParams
  const mayWrite = await hasPermission('staff.write')
  const mayDelete = await hasPermission('staff.delete')

  const roles = await db.adminRole.findMany({
    orderBy: [{ system: 'desc' }, { name: 'asc' }],
    include: { inherits: { select: { id: true, name: true } }, _count: { select: { users: true } } },
  })

  const editing = edit ? roles.find((role) => role.id === edit) : null

  return (
    <>
      <PageHeader
        title="Roles"
        description="A role is a permission set. Inheritance is a single chain — a role adds to what its parent already grants."
        actions={
          <Link href="/admin/staff" className="admin-btn admin-btn-ghost">
            Back to staff
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <Panel bodyClassName="p-0">
          {roles.length === 0 ? (
            <EmptyState title="No roles" description="Run the admin seed to create the built-in set." />
          ) : (
            <div className="admin-scroll">
              <table className="admin-table w-full min-w-[40rem]">
                <thead className="border-b border-[var(--admin-line)]">
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Inherits</th>
                    <th scope="col" className="text-right">
                      Permissions
                    </th>
                    <th scope="col" className="text-right">
                      Staff
                    </th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-line)]">
                  {roles.map((role) => (
                    <tr key={role.id}>
                      <td>
                        <span className="font-medium">{role.name}</span>
                        {role.system && <Badge tone="neutral">Built-in</Badge>}
                        <span className="block text-xs text-[var(--admin-muted)]">{role.description ?? role.slug}</span>
                      </td>
                      <td className="text-[var(--admin-muted)]">{role.inherits?.name ?? '—'}</td>
                      <td className="text-right tabular-nums">
                        {role.permissions.includes('*') ? 'All' : role.permissions.length}
                      </td>
                      <td className="text-right tabular-nums">{role._count.users}</td>
                      <td className="space-x-2 text-right text-xs">
                        {mayWrite && (
                          <Link href={`/admin/staff/roles?edit=${role.id}`} className="text-[var(--admin-accent)]">
                            Edit
                          </Link>
                        )}
                        {mayDelete && !role.system && (
                          <RowAction action={deleteRole} id={role.id} label="Delete" variant="danger" confirm={`Delete the ${role.name} role?`} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title={editing ? `Edit ${editing.name}` : 'New role'}>
          {!mayWrite ? (
            <p className="text-sm text-[var(--admin-muted)]">You have read-only access to roles.</p>
          ) : (
            <AdminForm action={saveRole} key={editing?.id ?? 'new'}>
              {(state) => (
                <>
                  {editing && <input type="hidden" name="id" value={editing.id} />}
                  <TextField
                    label="Name"
                    name="name"
                    defaultValue={editing?.name}
                    required
                    disabled={editing?.system}
                    error={state.fieldErrors?.name}
                    hint={editing?.system ? 'Built-in roles keep their name; their permissions can still change.' : undefined}
                  />
                  <TextField label="Slug" name="slug" defaultValue={editing?.slug} disabled={editing?.system} />
                  <TextArea label="Description" name="description" rows={2} defaultValue={editing?.description} />
                  <SelectField
                    label="Inherits from"
                    name="inheritsId"
                    defaultValue={editing?.inheritsId ?? ''}
                    options={[
                      { value: '', label: 'Nothing' },
                      ...roles.filter((role) => role.id !== editing?.id).map((role) => ({ value: role.id, label: role.name })),
                    ]}
                    hint="Permissions from the parent are added to the ones ticked below."
                  />

                  <fieldset>
                    <legend className="admin-label">Permissions</legend>
                    <div className="admin-scroll max-h-96 overflow-y-auto rounded border border-[var(--admin-line)]">
                      <table className="admin-table w-full">
                        <thead className="sticky top-0 bg-[var(--admin-panel)]">
                          <tr>
                            <th scope="col">Area</th>
                            {ACTIONS.map((action) => (
                              <th key={action} scope="col" className="text-center">
                                {action}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--admin-line)]">
                          {RESOURCES.map((resource) => (
                            <tr key={resource}>
                              <td className="text-xs">{RESOURCE_LABELS[resource]}</td>
                              {ACTIONS.map((action) => {
                                const permission = `${resource}.${action}` as const
                                return (
                                  <td key={action} className="text-center">
                                    <input
                                      type="checkbox"
                                      name="permissions"
                                      value={permission}
                                      defaultChecked={can(editing?.permissions ?? [], permission)}
                                      aria-label={`${RESOURCE_LABELS[resource]}: ${action}`}
                                      className="size-4 accent-[var(--color-rose-500)]"
                                    />
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-1 text-xs text-[var(--admin-muted)]">
                      Ticks show what this role grants directly, including any wildcard it holds. Permissions coming from
                      the parent role are not shown and cannot be revoked here — change the parent instead.
                    </p>
                  </fieldset>

                  {editing && (
                    <Link href="/admin/staff/roles" className="block text-xs text-[var(--admin-accent)]">
                      Cancel and create a new role
                    </Link>
                  )}
                </>
              )}
            </AdminForm>
          )}
        </Panel>
      </div>
    </>
  )
}
