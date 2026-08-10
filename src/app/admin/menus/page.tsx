import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { saveMenuItem, deleteMenuItem, reorderMenu } from '@/actions/admin/content'
import { PageHeader, Panel, Badge, EmptyState } from '@/components/admin/ui'
import { AdminForm, TextField, SelectField, Toggle, SubmitButton } from '@/components/admin/forms'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Navigation' }

const MENUS = ['HEADER', 'FOOTER'] as const

export default async function AdminMenus({ searchParams }: { searchParams: Promise<{ edit?: string; menu?: string }> }) {
  await requirePagePermission('menus.read')
  const params = await searchParams
  const mayWrite = await hasPermission('menus.write')
  const mayDelete = await hasPermission('menus.delete')

  const items = await db.menuItem.findMany({ orderBy: [{ menu: 'asc' }, { position: 'asc' }] })
  const editing = params.edit ? items.find((item) => item.id === params.edit) : null

  return (
    <>
      <PageHeader
        title="Navigation"
        description="Header and footer links. One level of nesting — a child sits under the parent you pick."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {MENUS.map((menu) => {
            const menuItems = items.filter((item) => item.menu === menu)
            const tree = menuItems
              .filter((item) => !item.parentId)
              .flatMap((parent) => [parent, ...menuItems.filter((child) => child.parentId === parent.id)])

            return (
              <Panel key={menu} title={menu === 'HEADER' ? 'Header menu' : 'Footer menu'} bodyClassName="p-0">
                {tree.length === 0 ? (
                  <EmptyState title="Empty" description="Add the first link on the right." />
                ) : (
                  <AdminForm
                    action={reorderMenu}
                    className="[&>div:last-child]:border-t [&>div:last-child]:border-[var(--admin-line)] [&>div:last-child]:px-4 [&>div:last-child]:py-3"
                    footer={mayWrite ? <SubmitButton>Save order</SubmitButton> : <span />}
                  >
                    <table className="admin-table w-full">
                      <thead className="border-b border-[var(--admin-line)]">
                        <tr>
                          <th scope="col">Label</th>
                          <th scope="col">URL</th>
                          <th scope="col" className="w-24">
                            Position
                          </th>
                          <th scope="col">State</th>
                          <th scope="col">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--admin-line)]">
                        {tree.map((item) => (
                          <tr key={item.id}>
                            <td className={item.parentId ? 'pl-6 text-[var(--admin-muted)]' : 'font-medium'}>
                              {item.parentId && '↳ '}
                              {item.label}
                            </td>
                            <td className="max-w-56 truncate text-xs text-[var(--admin-muted)]">{item.url}</td>
                            <td>
                              <label className="sr-only" htmlFor={`position-${item.id}`}>
                                Position for {item.label}
                              </label>
                              <input
                                id={`position-${item.id}`}
                                name={`position:${item.id}`}
                                type="number"
                                defaultValue={item.position}
                                disabled={!mayWrite}
                                className="admin-field w-20 py-1 text-xs"
                              />
                            </td>
                            <td>
                              <Badge tone={item.visible ? 'ok' : 'neutral'}>{item.visible ? 'Visible' : 'Hidden'}</Badge>
                            </td>
                            <td className="space-x-2 text-right text-xs">
                              <Link href={`/admin/menus?edit=${item.id}`} className="text-[var(--admin-accent)]">
                                Edit
                              </Link>
                              {mayDelete && <RowAction action={deleteMenuItem} id={item.id} label="Remove" variant="danger" confirm={`Remove ${item.label}?`} />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AdminForm>
                )}
              </Panel>
            )
          })}
        </div>

        <Panel title={editing ? `Edit ${editing.label}` : 'New link'}>
          {mayWrite ? (
            <AdminForm action={saveMenuItem} key={editing?.id ?? 'new'}>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <SelectField
                label="Menu"
                name="menu"
                defaultValue={editing?.menu ?? params.menu ?? 'HEADER'}
                options={[
                  { value: 'HEADER', label: 'Header' },
                  { value: 'FOOTER', label: 'Footer' },
                ]}
              />
              <TextField label="Label" name="label" defaultValue={editing?.label} required />
              <TextField label="URL" name="url" defaultValue={editing?.url} required hint="Must start with / or http." />
              <SelectField
                label="Nest under"
                name="parentId"
                defaultValue={editing?.parentId ?? ''}
                options={[
                  { value: '', label: 'Top level' },
                  ...items
                    .filter((item) => !item.parentId && item.id !== editing?.id)
                    .map((item) => ({ value: item.id, label: `${item.menu} · ${item.label}` })),
                ]}
              />
              <TextField label="Position" name="position" type="number" defaultValue={editing?.position ?? 0} />
              <Toggle label="Visible" name="visible" defaultChecked={editing ? editing.visible : true} />
              {editing && (
                <Link href="/admin/menus" className="block text-xs text-[var(--admin-accent)]">
                  Cancel and add a new one
                </Link>
              )}
            </AdminForm>
          ) : (
            <p className="text-sm text-[var(--admin-muted)]">You have read-only access to navigation.</p>
          )}
        </Panel>
      </div>
    </>
  )
}
