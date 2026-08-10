import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { saveCollection, deleteCollection } from '@/actions/admin/catalog'
import { countAutomaticMembers } from '@/server/admin'
import { PageHeader, Panel, Badge, EmptyState, formatDate } from '@/components/admin/ui'
import { AdminForm, TextField, TextArea, Toggle, CheckboxList } from '@/components/admin/forms'
import { RowAction } from '@/components/admin/RowAction'
import { CollectionRules } from '@/components/admin/CollectionRules'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Collections' }

export default async function AdminCollections({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requirePagePermission('collections.read')
  const { edit } = await searchParams

  const [collectionRows, products, mayWrite, mayDelete] = await Promise.all([
    db.collection.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { products: { select: { id: true } } },
    }),
    db.product.findMany({ orderBy: { name: 'asc' }, take: 300, select: { id: true, name: true } }),
    hasPermission('collections.write'),
    hasPermission('collections.delete'),
  ])

  // An automatic collection has no membership rows, so its size is a count
  // against the rules — resolved here so the table shows a real number.
  const collections = await Promise.all(
    collectionRows.map(async (collection) => ({
      ...collection,
      memberCount: collection.automatic ? await countAutomaticMembers(collection.rules) : collection.products.length,
    })),
  )

  const editing = edit ? collections.find((collection) => collection.id === edit) : null
  const now = new Date()

  return (
    <>
      <PageHeader
        title="Collections"
        description="Manual collections list products by hand. Automatic ones store rules and resolve their members at read time."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Panel bodyClassName="p-0">
          {collections.length === 0 ? (
            <EmptyState title="No collections yet" description="Build the first one on the right." />
          ) : (
            <div className="admin-scroll">
              <table className="admin-table w-full min-w-[42rem]">
                <thead className="border-b border-[var(--admin-line)]">
                  <tr>
                    <th scope="col">Collection</th>
                    <th scope="col">Type</th>
                    <th scope="col" className="text-right">
                      Products
                    </th>
                    <th scope="col">Window</th>
                    <th scope="col">State</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-line)]">
                  {collections.map((collection) => {
                    const live =
                      (!collection.startsAt || collection.startsAt <= now) && (!collection.endsAt || collection.endsAt > now)
                    return (
                      <tr key={collection.id}>
                        <td>
                          <span className="font-medium">{collection.name}</span>
                          <span className="block text-xs text-[var(--admin-muted)]">/{collection.slug}</span>
                        </td>
                        <td>
                          <Badge tone={collection.automatic ? 'info' : 'neutral'}>
                            {collection.automatic ? 'Automatic' : 'Manual'}
                          </Badge>
                        </td>
                        <td className="text-right tabular-nums">{collection.memberCount}</td>
                        <td className="text-xs text-[var(--admin-muted)]">
                          {collection.startsAt || collection.endsAt
                            ? `${formatDate(collection.startsAt)} → ${formatDate(collection.endsAt)}`
                            : 'Always'}
                        </td>
                        <td className="space-x-1">
                          {collection.featured && <Badge tone="accent">Featured</Badge>}
                          <Badge tone={live ? 'ok' : 'neutral'}>{live ? 'Live' : 'Scheduled'}</Badge>
                        </td>
                        <td className="space-x-2 text-right text-xs">
                          <Link href={`/admin/collections?edit=${collection.id}`} className="text-[var(--admin-accent)]">
                            Edit
                          </Link>
                          {mayDelete && (
                            <RowAction
                              action={deleteCollection}
                              id={collection.id}
                              label="Delete"
                              variant="danger"
                              confirm={`Delete ${collection.name}?`}
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title={editing ? `Edit ${editing.name}` : 'New collection'}>
          {mayWrite ? (
            <AdminForm action={saveCollection} key={editing?.id ?? 'new'}>
              {(state) => (
                <>
                  {editing && <input type="hidden" name="id" value={editing.id} />}
                  <TextField label="Name" name="name" defaultValue={editing?.name} required error={state.fieldErrors?.name} />
                  <TextField label="Slug" name="slug" defaultValue={editing?.slug} hint="Leave blank to generate." />
                  <TextArea label="Description" name="description" rows={2} defaultValue={editing?.description} />
                  <TextField label="Hero image URL" name="heroImage" defaultValue={editing?.heroImage ?? ''} />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Starts at" name="startsAt" type="datetime-local" defaultValue={editing?.startsAt?.toISOString().slice(0, 16) ?? ''} />
                    <TextField label="Ends at" name="endsAt" type="datetime-local" defaultValue={editing?.endsAt?.toISOString().slice(0, 16) ?? ''} />
                  </div>

                  <CollectionRules
                    automatic={editing?.automatic ?? false}
                    rules={(editing?.rules as { match: 'all' | 'any'; conditions: { field: string; operator: string; value: string }[] } | null) ?? null}
                  />

                  <CheckboxList
                    legend="Members (manual collections only)"
                    name="productIds"
                    options={products.map((product) => ({ value: product.id, label: product.name }))}
                    selected={editing?.products.map((product) => product.id) ?? []}
                  />

                  <TextField label="Position" name="position" type="number" defaultValue={editing?.position ?? 0} />
                  <TextField label="Meta title" name="seoTitle" defaultValue={editing?.seoTitle ?? ''} />
                  <TextArea label="Meta description" name="seoDesc" rows={2} defaultValue={editing?.seoDesc ?? ''} />
                  <Toggle label="Featured" name="featured" defaultChecked={editing?.featured} />
                  {editing && (
                    <Link href="/admin/collections" className="block text-xs text-[var(--admin-accent)]">
                      Cancel and start a new one
                    </Link>
                  )}
                </>
              )}
            </AdminForm>
          ) : (
            <p className="text-sm text-[var(--admin-muted)]">You have read-only access to collections.</p>
          )}
        </Panel>
      </div>
    </>
  )
}
