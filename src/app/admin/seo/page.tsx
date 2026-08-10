import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { absoluteUrl } from '@/config/site'
import { saveSeoOverride } from '@/actions/admin/seo'
import { PageHeader, Panel, StatCard, Badge, Tabs, EmptyState } from '@/components/admin/ui'
import { AdminForm, TextField, TextArea, SelectField } from '@/components/admin/forms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'SEO' }

const TITLE_MAX = 60
const DESC_MAX = 155

type Search = { kind?: string; edit?: string }

export default async function AdminSeo({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission('seo.read')
  const params = await searchParams
  const mayWrite = await hasPermission('seo.write')
  const kind = params.kind === 'category' || params.kind === 'content' ? params.kind : 'product'

  const [products, categories, entries, redirectCount] = await Promise.all([
    db.product.findMany({
      where: { status: { not: 'ARCHIVED' } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { id: true, name: true, slug: true, seoTitle: true, seoDesc: true, canonicalUrl: true, robots: true },
    }),
    db.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, seoTitle: true, seoDesc: true } }),
    db.contentEntry.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { id: true, title: true, slug: true, type: true, seoTitle: true, seoDesc: true, canonicalUrl: true, robots: true },
    }),
    db.redirect.count(),
  ])

  const rows =
    kind === 'product'
      ? products.map((row) => ({ id: row.id, label: row.name, path: `/product/${row.slug}`, seoTitle: row.seoTitle, seoDesc: row.seoDesc, canonicalUrl: row.canonicalUrl, robots: row.robots }))
      : kind === 'category'
        ? categories.map((row) => ({ id: row.id, label: row.name, path: `/shop/${row.slug}`, seoTitle: row.seoTitle, seoDesc: row.seoDesc, canonicalUrl: null, robots: null }))
        : entries.map((row) => ({ id: row.id, label: row.title, path: `/${row.type.toLowerCase()}/${row.slug}`, seoTitle: row.seoTitle, seoDesc: row.seoDesc, canonicalUrl: row.canonicalUrl, robots: row.robots }))

  const editing = params.edit ? rows.find((row) => row.id === params.edit) : null
  const missingTitle = rows.filter((row) => !row.seoTitle).length
  const missingDesc = rows.filter((row) => !row.seoDesc).length
  const tooLong = rows.filter((row) => (row.seoTitle?.length ?? 0) > TITLE_MAX || (row.seoDesc?.length ?? 0) > DESC_MAX).length

  return (
    <>
      <PageHeader
        title="SEO"
        description="Metadata overrides per record. Canonical, Open Graph, Twitter, and JSON-LD are generated from these by lib/seo.ts."
        actions={
          <>
            <Link href="/admin/seo/redirects" className="admin-btn admin-btn-ghost">
              Redirects ({redirectCount})
            </Link>
            <Link href={absoluteUrl('/sitemap.xml')} target="_blank" className="admin-btn admin-btn-ghost">
              View sitemap
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Records in view" value={String(rows.length)} />
        <StatCard label="Missing meta title" value={String(missingTitle)} />
        <StatCard label="Missing description" value={String(missingDesc)} />
        <StatCard label="Over recommended length" value={String(tooLong)} />
      </div>

      <div className="mt-3">
        <Tabs
          current={`/admin/seo?kind=${kind}`}
          tabs={[
            { href: '/admin/seo?kind=product', label: 'Products', count: products.length },
            { href: '/admin/seo?kind=category', label: 'Categories', count: categories.length },
            { href: '/admin/seo?kind=content', label: 'Content', count: entries.length },
          ]}
        />
      </div>

      <div className="mt-3 grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Panel bodyClassName="p-0">
          {rows.length === 0 ? (
            <EmptyState title="Nothing to audit yet" />
          ) : (
            <div className="admin-scroll">
              <table className="admin-table w-full min-w-[46rem]">
                <thead className="border-b border-[var(--admin-line)]">
                  <tr>
                    <th scope="col">Record</th>
                    <th scope="col">Meta title</th>
                    <th scope="col">Description</th>
                    <th scope="col">Flags</th>
                    <th scope="col">
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-line)]">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="font-medium">{row.label}</span>
                        <span className="block text-xs text-[var(--admin-muted)]">{row.path}</span>
                      </td>
                      <td className="max-w-64 truncate text-xs">
                        {row.seoTitle ?? <span className="text-[var(--color-warn)]">Not set</span>}
                        {row.seoTitle && row.seoTitle.length > TITLE_MAX && (
                          <span className="block text-[var(--color-warn)]">{row.seoTitle.length} chars</span>
                        )}
                      </td>
                      <td className="max-w-72 truncate text-xs">
                        {row.seoDesc ?? <span className="text-[var(--color-warn)]">Not set</span>}
                        {row.seoDesc && row.seoDesc.length > DESC_MAX && (
                          <span className="block text-[var(--color-warn)]">{row.seoDesc.length} chars</span>
                        )}
                      </td>
                      <td className="space-x-1">
                        {row.canonicalUrl && <Badge tone="info">Canonical</Badge>}
                        {row.robots && <Badge tone="warn">{row.robots}</Badge>}
                      </td>
                      <td className="text-right text-xs">
                        <Link href={`/admin/seo?kind=${kind}&edit=${row.id}`} className="text-[var(--admin-accent)]">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-3">
          <Panel title={editing ? `Edit ${editing.label}` : 'Metadata'}>
            {!mayWrite ? (
              <p className="text-sm text-[var(--admin-muted)]">You have read-only access to SEO.</p>
            ) : !editing ? (
              <p className="text-sm text-[var(--admin-muted)]">Pick a record from the table.</p>
            ) : (
              <AdminForm action={saveSeoOverride} key={editing.id}>
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="id" value={editing.id} />
                <TextField label="Meta title" name="seoTitle" defaultValue={editing.seoTitle ?? ''} hint={`Aim for ${TITLE_MAX} characters or fewer.`} />
                <TextArea label="Meta description" name="seoDesc" rows={3} defaultValue={editing.seoDesc ?? ''} hint={`Aim for ${DESC_MAX} characters or fewer.`} />
                {kind !== 'category' && (
                  <>
                    <TextField label="Canonical URL" name="canonicalUrl" defaultValue={editing.canonicalUrl ?? ''} />
                    <SelectField
                      label="Robots"
                      name="robots"
                      defaultValue={editing.robots ?? ''}
                      options={[
                        { value: '', label: 'Default (index, follow)' },
                        { value: 'noindex,follow', label: 'noindex, follow' },
                        { value: 'noindex,nofollow', label: 'noindex, nofollow' },
                      ]}
                    />
                  </>
                )}
              </AdminForm>
            )}
          </Panel>

          <Panel title="Generated automatically">
            <ul className="space-y-1.5 text-sm text-[var(--admin-muted)]">
              <li>Canonical URL, Open Graph, and Twitter cards — from <code>pageMetadata()</code>.</li>
              <li>Organisation and breadcrumb JSON-LD — from <code>lib/seo.ts</code>.</li>
              <li><code>/sitemap.xml</code> and <code>/robots.txt</code> — regenerated on every request.</li>
              <li>The admin itself is <code>noindex, nofollow</code> at the layout level.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}
