import { db } from '@/lib/db'
import { requirePagePermission } from '@/lib/rbac'
import { paging, pageCount } from '@/server/admin'
import { PageHeader, Panel, Badge, Pagination, FilterBar, SearchInput, FilterSelect, EmptyState, formatDateTime } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Audit log' }

const PER_PAGE = 50

type Search = { actor?: string; action?: string; page?: string }

export default async function AdminAudit({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission('audit.read')
  const params = await searchParams
  const { page, skip, take } = paging(params.page, PER_PAGE)

  const where = {
    ...(params.actor ? { actor: { contains: params.actor, mode: 'insensitive' as const } } : {}),
    ...(params.action ? { action: { startsWith: params.action } } : {}),
  }

  const [entries, total, actions] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    db.auditLog.count({ where }),
    // The prefix before the dot is the subject area: product, order, staff…
    db.$queryRaw<{ prefix: string; count: number }[]>`
      SELECT split_part("action", '.', 1) AS prefix, COUNT(*)::int AS count
      FROM "AuditLog" GROUP BY 1 ORDER BY count DESC LIMIT 20`,
  ])

  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][])
  const hrefFor = (next: number) => {
    const clone = new URLSearchParams(query)
    clone.set('page', String(next))
    return `/admin/audit?${clone}`
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only. Every admin write, every sign-in, and every failed sign-in attempt."
      />

      <Panel bodyClassName="p-0">
        <FilterBar action="/admin/audit">
          <SearchInput name="actor" defaultValue={params.actor ?? ''} label="Actor" placeholder="Email" />
          <FilterSelect
            name="action"
            label="Area"
            value={params.action}
            options={[{ value: '', label: 'Everything' }, ...actions.map((row) => ({ value: row.prefix, label: `${row.prefix} (${row.count})` }))]}
          />
        </FilterBar>

        {entries.length === 0 ? (
          <EmptyState title="Nothing logged" description="Actions appear here as staff make changes." />
        ) : (
          <div className="admin-scroll">
            <table className="admin-table w-full min-w-[48rem]">
              <thead className="border-b border-[var(--admin-line)]">
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target</th>
                  <th scope="col">Detail</th>
                  <th scope="col">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-line)]">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap text-xs text-[var(--admin-muted)]">{formatDateTime(entry.createdAt)}</td>
                    <td className="max-w-48 truncate">{entry.actor}</td>
                    <td>
                      <Badge tone={entry.action.includes('delete') || entry.action.includes('failed') ? 'danger' : 'neutral'}>
                        {entry.action}
                      </Badge>
                    </td>
                    <td className="max-w-40 truncate text-xs text-[var(--admin-muted)]">{entry.target ?? '—'}</td>
                    <td className="max-w-64 truncate text-xs text-[var(--admin-muted)]">
                      {entry.meta ? JSON.stringify(entry.meta) : '—'}
                    </td>
                    <td className="text-xs text-[var(--admin-muted)]">{entry.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} pages={pageCount(total, PER_PAGE)} hrefFor={hrefFor} total={total} noun="entries" />
      </Panel>
    </>
  )
}
