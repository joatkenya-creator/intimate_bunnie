import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { saveCategory, deleteCategory, reorderCategories } from '@/actions/admin/catalog'
import { PageHeader, Panel, Badge, EmptyState } from '@/components/admin/ui'
import { AdminForm, TextField, TextArea, Toggle, SelectField, SubmitButton } from '@/components/admin/forms'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Categories' }

export default async function AdminCategories({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requirePagePermission('categories.read')
  const { edit } = await searchParams

  const [categories, mayWrite, mayDelete] = await Promise.all([
    db.category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        position: true,
        visible: true,
        featured: true,
        heroImage: true,
        description: true,
        seoTitle: true,
        seoDesc: true,
        _count: { select: { products: true, children: true } },
      },
    }),
    hasPermission('categories.write'),
    hasPermission('categories.delete'),
  ])

  const editing = edit ? categories.find((category) => category.id === edit) : null
  // Parents first, each followed by its children — the storefront nav order.
  const tree = categories
    .filter((category) => !category.parentId)
    .flatMap((parent) => [parent, ...categories.filter((child) => child.parentId === parent.id)])

  return (
    <>
      <PageHeader
        title="Categories"
        description="One level of nesting. A parent category also lists everything in its children."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Panel title="Tree" description="Position controls the order in the storefront nav" bodyClassName="p-0">
          {tree.length === 0 ? (
            <EmptyState title="No categories yet" description="Create the first one on the right." />
          ) : (
            <AdminForm
              action={reorderCategories}
              className="[&>div:last-child]:border-t [&>div:last-child]:border-[var(--admin-line)] [&>div:last-child]:px-4 [&>div:last-child]:py-3"
              footer={mayWrite ? <SubmitButton>Save order</SubmitButton> : <span />}
            >
              <div className="admin-scroll">
                <table className="admin-table w-full min-w-[40rem]">
                  <thead className="border-b border-[var(--admin-line)]">
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Slug</th>
                      <th scope="col" className="text-right">
                        Products
                      </th>
                      <th scope="col" className="w-24">
                        Position
                      </th>
                      <th scope="col">Visibility</th>
                      <th scope="col">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-line)]">
                    {tree.map((category) => (
                      <tr key={category.id}>
                        <td>
                          <span className={category.parentId ? 'pl-5 text-[var(--admin-muted)]' : 'font-medium'}>
                            {category.parentId && '↳ '}
                            {category.name}
                          </span>
                        </td>
                        <td className="text-xs text-[var(--admin-muted)]">/shop/{category.slug}</td>
                        <td className="text-right tabular-nums">{category._count.products}</td>
                        <td>
                          <label className="sr-only" htmlFor={`position-${category.id}`}>
                            Position for {category.name}
                          </label>
                          <input
                            id={`position-${category.id}`}
                            name={`position:${category.id}`}
                            type="number"
                            defaultValue={category.position}
                            disabled={!mayWrite}
                            className="admin-field w-20 py-1 text-xs"
                          />
                        </td>
                        <td className="space-x-1">
                          {category.featured && <Badge tone="accent">Featured</Badge>}
                          <Badge tone={category.visible ? 'ok' : 'neutral'}>{category.visible ? 'Visible' : 'Hidden'}</Badge>
                        </td>
                        <td className="space-x-2 text-right text-xs">
                          <Link href={`/admin/categories?edit=${category.id}`} className="text-[var(--admin-accent)]">
                            Edit
                          </Link>
                          {mayDelete && <RowAction action={deleteCategory} id={category.id} label="Delete" variant="danger" confirm={`Delete ${category.name}?`} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminForm>
          )}
        </Panel>

        <Panel title={editing ? `Edit ${editing.name}` : 'New category'}>
          {mayWrite ? (
            <AdminForm action={saveCategory} key={editing?.id ?? 'new'}>
              {(state) => (
                <>
                  {editing && <input type="hidden" name="id" value={editing.id} />}
                  <TextField label="Name" name="name" defaultValue={editing?.name} required error={state.fieldErrors?.name} />
                  <TextField label="Slug" name="slug" defaultValue={editing?.slug} hint="Leave blank to generate." />
                  <SelectField
                    label="Parent"
                    name="parentId"
                    defaultValue={editing?.parentId ?? ''}
                    options={[
                      { value: '', label: 'Top level' },
                      ...categories
                        .filter((category) => !category.parentId && category.id !== editing?.id)
                        .map((category) => ({ value: category.id, label: category.name })),
                    ]}
                  />
                  <TextArea label="Description" name="description" rows={3} defaultValue={editing?.description} />
                  <TextField label="Hero image URL" name="heroImage" defaultValue={editing?.heroImage ?? ''} />
                  <TextField label="Position" name="position" type="number" defaultValue={editing?.position ?? 0} />
                  <TextField label="Meta title" name="seoTitle" defaultValue={editing?.seoTitle ?? ''} />
                  <TextArea label="Meta description" name="seoDesc" rows={2} defaultValue={editing?.seoDesc ?? ''} />
                  <Toggle label="Visible" name="visible" defaultChecked={editing ? editing.visible : true} hint="Hidden categories keep their URL but leave the nav." />
                  <Toggle label="Featured" name="featured" defaultChecked={editing?.featured} />
                  {editing && (
                    <Link href="/admin/categories" className="block text-xs text-[var(--admin-accent)]">
                      Cancel and start a new one
                    </Link>
                  )}
                </>
              )}
            </AdminForm>
          ) : (
            <p className="text-sm text-[var(--admin-muted)]">You have read-only access to categories.</p>
          )}
        </Panel>
      </div>
    </>
  )
}
