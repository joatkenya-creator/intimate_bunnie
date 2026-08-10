import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { PageHeader, Panel, Tabs } from '@/components/admin/ui'
import { ContentTable } from '@/components/admin/ContentTable'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Content' }

const TYPES = ['PAGE', 'POLICY', 'FAQ', 'ANNOUNCEMENT', 'BANNER'] as const

export default async function AdminContent({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requirePagePermission('content.read')
  const { type } = await searchParams
  const mayWrite = await hasPermission('content.write')

  const filter = TYPES.includes(type as (typeof TYPES)[number]) ? (type as (typeof TYPES)[number]) : null

  const [rows, counts] = await Promise.all([
    db.contentEntry.findMany({
      where: { type: filter ?? { in: [...TYPES] } },
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
      include: { author: { select: { name: true, email: true } } },
    }),
    db.contentEntry.groupBy({ by: ['type'], _count: true }),
  ])

  const byType = Object.fromEntries(counts.map((row) => [row.type, row._count]))

  return (
    <>
      <PageHeader
        title="Content"
        description="Pages, policies, FAQ entries, announcements, and homepage banners. One record type, different fields."
        actions={
          mayWrite ? (
            <Link href="/admin/content/new" className="admin-btn admin-btn-primary">
              New entry
            </Link>
          ) : undefined
        }
      />

      <Tabs
        current={filter ? `/admin/content?type=${filter}` : '/admin/content'}
        tabs={[
          { href: '/admin/content', label: 'Everything' },
          ...TYPES.map((value) => ({
            href: `/admin/content?type=${value}`,
            label: value.charAt(0) + value.slice(1).toLowerCase(),
            count: byType[value] ?? 0,
          })),
        ]}
      />

      <Panel className="mt-3" bodyClassName="p-0">
        <ContentTable rows={rows} basePath="/admin/content" showType={!filter} mayWrite={mayWrite} />
      </Panel>

      <Panel title="Storefront wiring" className="mt-4">
        <p className="text-sm text-[var(--admin-muted)]">
          The storefront still serves <code>/pages/[slug]</code> from the static copy in that route file. Published{' '}
          <strong>Page</strong> and <strong>Policy</strong> entries here are the database-backed replacement — swap the
          route to read <code>ContentEntry</code> when you are ready to retire the hard-coded documents.
        </p>
      </Panel>
    </>
  )
}
