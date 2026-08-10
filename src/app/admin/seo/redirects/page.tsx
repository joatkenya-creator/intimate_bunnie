import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { saveRedirect, deleteRedirect } from '@/actions/admin/seo'
import { PageHeader, Panel, Badge, EmptyState, formatDate } from '@/components/admin/ui'
import { AdminForm, TextField, SelectField, Toggle } from '@/components/admin/forms'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Redirects' }

export default async function AdminRedirects({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requirePagePermission('seo.read')
  const { edit } = await searchParams
  const mayWrite = await hasPermission('seo.write')
  const mayDelete = await hasPermission('seo.delete')

  const redirects = await db.redirect.findMany({ orderBy: { createdAt: 'desc' }, take: 500 })
  const editing = edit ? redirects.find((redirect) => redirect.id === edit) : null

  return (
    <>
      <PageHeader
        title="Redirects"
        description="Applied in middleware before routing. A 301 is permanent and gets cached by browsers — use 302 while you are still deciding."
        actions={
          <Link href="/admin/seo" className="admin-btn admin-btn-ghost">
            Back to SEO
          </Link>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Panel bodyClassName="p-0">
          {redirects.length === 0 ? (
            <EmptyState title="No redirects" description="Add one when a URL moves." />
          ) : (
            <div className="admin-scroll">
              <table className="admin-table w-full min-w-[42rem]">
                <thead className="border-b border-[var(--admin-line)]">
                  <tr>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Code</th>
                    <th scope="col">Note</th>
                    <th scope="col">Added</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-line)]">
                  {redirects.map((redirect) => (
                    <tr key={redirect.id}>
                      <td className="max-w-64 truncate font-medium">{redirect.source}</td>
                      <td className="max-w-64 truncate text-[var(--admin-muted)]">{redirect.destination}</td>
                      <td>
                        <Badge tone={redirect.active ? (redirect.statusCode === 301 ? 'ok' : 'warn') : 'neutral'}>
                          {redirect.active ? redirect.statusCode : 'off'}
                        </Badge>
                      </td>
                      <td className="max-w-48 truncate text-xs text-[var(--admin-muted)]">{redirect.note ?? '—'}</td>
                      <td className="text-xs text-[var(--admin-muted)]">{formatDate(redirect.createdAt)}</td>
                      <td className="space-x-2 text-right text-xs">
                        <Link href={`/admin/seo/redirects?edit=${redirect.id}`} className="text-[var(--admin-accent)]">
                          Edit
                        </Link>
                        {mayDelete && <RowAction action={deleteRedirect} id={redirect.id} label="Delete" variant="danger" confirm={`Remove ${redirect.source}?`} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-3">
          <Panel title={editing ? 'Edit redirect' : 'New redirect'}>
            {mayWrite ? (
              <AdminForm action={saveRedirect} key={editing?.id ?? 'new'}>
                {editing && <input type="hidden" name="id" value={editing.id} />}
                <TextField label="From (path on this site)" name="source" defaultValue={editing?.source} required placeholder="/old-product-url" />
                <TextField label="To" name="destination" defaultValue={editing?.destination} required placeholder="/product/new-url" />
                <SelectField
                  label="Status code"
                  name="statusCode"
                  defaultValue={String(editing?.statusCode ?? 301)}
                  options={[
                    { value: '301', label: '301 — permanent' },
                    { value: '302', label: '302 — temporary' },
                  ]}
                />
                <TextField label="Note" name="note" defaultValue={editing?.note ?? ''} hint="Why this exists, for whoever finds it in a year." />
                <Toggle label="Active" name="active" defaultChecked={editing ? editing.active : true} />
                {editing && (
                  <Link href="/admin/seo/redirects" className="block text-xs text-[var(--admin-accent)]">
                    Cancel and add a new one
                  </Link>
                )}
              </AdminForm>
            ) : (
              <p className="text-sm text-[var(--admin-muted)]">You have read-only access to redirects.</p>
            )}
          </Panel>

          <Panel title="How these are served">
            <p className="text-sm text-[var(--admin-muted)]">
              Middleware fetches the active map once a minute per isolate and matches before routing, so a redirect costs
              no database query on the request path. Chains are refused at save time — A → B → C would make a crawler take
              two hops.
            </p>
          </Panel>
        </div>
      </div>
    </>
  )
}
