import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { PageHeader, Panel, StatCard, FilterBar, SearchInput, FilterSelect } from '@/components/admin/ui'
import { ContentTable } from '@/components/admin/ContentTable'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Blog' }

type Search = { q?: string; status?: string; category?: string }

export default async function AdminBlog({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission('blog.read')
  const params = await searchParams
  const mayWrite = await hasPermission('blog.write')

  const where = {
    type: 'POST' as const,
    ...(params.status ? { status: params.status as 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: 'insensitive' as const } },
            { excerpt: { contains: params.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [rows, counts, categories] = await Promise.all([
    db.contentEntry.findMany({
      where,
      orderBy: [{ publishAt: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
      include: { author: { select: { name: true, email: true } } },
    }),
    db.contentEntry.groupBy({ by: ['status'], where: { type: 'POST' }, _count: true }),
    db.contentEntry.groupBy({ by: ['category'], where: { type: 'POST', category: { not: null } }, _count: true }),
  ])

  const byStatus = Object.fromEntries(counts.map((row) => [row.status, row._count]))

  return (
    <>
      <PageHeader
        title="Blog"
        description="Posts share the content table with pages — they just carry an author, a category, and a publish date."
        actions={
          mayWrite ? (
            <Link href="/admin/blog/new" className="admin-btn admin-btn-primary">
              New post
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Published" value={String(byStatus.PUBLISHED ?? 0)} />
        <StatCard label="Drafts" value={String(byStatus.DRAFT ?? 0)} />
        <StatCard label="Scheduled" value={String(byStatus.SCHEDULED ?? 0)} />
      </div>

      <Panel className="mt-3" bodyClassName="p-0">
        <FilterBar action="/admin/blog">
          <SearchInput defaultValue={params.q ?? ''} label="Search" placeholder="Title or excerpt" />
          <FilterSelect
            name="status"
            label="Status"
            value={params.status}
            options={[
              { value: '', label: 'Any status' },
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'SCHEDULED', label: 'Scheduled' },
            ]}
          />
          <FilterSelect
            name="category"
            label="Category"
            value={params.category}
            options={[
              { value: '', label: 'All categories' },
              ...categories.map((row) => ({ value: row.category ?? '', label: `${row.category} (${row._count})` })),
            ]}
          />
        </FilterBar>

        <ContentTable rows={rows} basePath="/admin/blog" showType={false} mayWrite={mayWrite} />
      </Panel>

      <Panel title="Storefront wiring" className="mt-4">
        <p className="text-sm text-[var(--admin-muted)]">
          There is no <code>/blog</code> route on the storefront yet. Posts written here are stored, versioned by their
          status, and exposed in the sitemap once a blog route reads them — building that route is a storefront change,
          which is deliberately out of scope for this admin.
        </p>
      </Panel>
    </>
  )
}
