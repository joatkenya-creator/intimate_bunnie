import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { formatUSD } from '@/lib/money'
import { paging, pageCount, PER_PAGE } from '@/server/admin'
import { bulkCustomers } from '@/actions/admin/customers'
import { PageHeader, Panel, Badge, toneFor, Pagination, FilterBar, SearchInput, FilterSelect, EmptyState, formatDate } from '@/components/admin/ui'
import { BulkForm, BulkButton } from '@/components/admin/BulkForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Customers' }

type Search = { q?: string; status?: string; segment?: string; page?: string }

export default async function AdminCustomers({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission('customers.read')
  const params = await searchParams
  const { page, skip, take } = paging(params.page)
  const mayWrite = await hasPermission('customers.write')

  const where = {
    role: 'CUSTOMER' as const,
    ...(params.status ? { status: params.status as 'ACTIVE' | 'BLOCKED' | 'INVITED' } : {}),
    ...(params.segment ? { segment: params.segment } : {}),
    ...(params.q
      ? {
          OR: [
            { email: { contains: params.q, mode: 'insensitive' as const } },
            { name: { contains: params.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [customers, total, segments] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        tags: true,
        segment: true,
        createdAt: true,
        lastLoginAt: true,
        marketingOptIn: true,
        _count: { select: { orders: true, wishlist: true } },
      },
    }),
    db.user.count({ where }),
    db.user.groupBy({ by: ['segment'], where: { role: 'CUSTOMER', segment: { not: null } }, _count: true }),
  ])

  // Lifetime value comes from the order table, not a denormalised column that
  // would need maintaining on every refund.
  const spend = await db.order.groupBy({
    by: ['userId'],
    where: { userId: { in: customers.map((customer) => customer.id) }, status: { in: ['PAID', 'FULFILLED'] } },
    _sum: { totalCents: true },
  })
  const lifetime = new Map(spend.map((row) => [row.userId, row._sum.totalCents ?? 0]))

  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][])
  const hrefFor = (next: number) => {
    const clone = new URLSearchParams(query)
    clone.set('page', String(next))
    return `/admin/customers?${clone}`
  }

  return (
    <>
      <PageHeader title="Customers" description={`${total} accounts`} />

      <Panel bodyClassName="p-0">
        <FilterBar action="/admin/customers">
          <SearchInput defaultValue={params.q ?? ''} label="Search" placeholder="Email or name" />
          <FilterSelect
            name="status"
            label="Status"
            value={params.status}
            options={[
              { value: '', label: 'Any status' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'BLOCKED', label: 'Blocked' },
              { value: 'INVITED', label: 'Invited' },
            ]}
          />
          <FilterSelect
            name="segment"
            label="Segment"
            value={params.segment}
            options={[
              { value: '', label: 'All segments' },
              ...segments.map((row) => ({ value: row.segment ?? '', label: `${row.segment} (${row._count})` })),
            ]}
          />
        </FilterBar>

        {customers.length === 0 ? (
          <EmptyState title="No customers match" description="Adjust the filters above." />
        ) : (
          <BulkForm
            action={bulkCustomers}
            noun="customers"
            actions={
              mayWrite ? (
                <>
                  <input name="segment" placeholder="Segment…" aria-label="Segment name" className="admin-field w-32 py-1 text-xs" />
                  <BulkButton op="segment">Set segment</BulkButton>
                  <input name="bulkTags" placeholder="vip, wholesale" aria-label="Tags to add" className="admin-field w-36 py-1 text-xs" />
                  <BulkButton op="tag">Add tags</BulkButton>
                  <BulkButton op="block" variant="danger" confirm="Block the selected accounts?">
                    Block
                  </BulkButton>
                  <BulkButton op="unblock">Unblock</BulkButton>
                </>
              ) : (
                <span className="text-xs text-[var(--admin-muted)]">Read-only access</span>
              )
            }
          >
            <div className="admin-scroll">
              <table className="admin-table w-full min-w-[52rem]">
                <thead className="border-b border-[var(--admin-line)]">
                  <tr>
                    <th scope="col" className="w-8">
                      <span className="sr-only">Select</span>
                    </th>
                    <th scope="col">Customer</th>
                    <th scope="col">Segment</th>
                    <th scope="col" className="text-right">
                      Orders
                    </th>
                    <th scope="col" className="text-right">
                      Lifetime value
                    </th>
                    <th scope="col" className="text-right">
                      Wishlist
                    </th>
                    <th scope="col">Joined</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-line)]">
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <input type="checkbox" name="ids" value={customer.id} aria-label={`Select ${customer.email}`} className="size-4 accent-[var(--color-rose-500)]" />
                      </td>
                      <td>
                        <Link href={`/admin/customers/${customer.id}`} className="font-medium hover:text-[var(--admin-accent)]">
                          {customer.name ?? customer.email}
                        </Link>
                        <span className="block text-xs text-[var(--admin-muted)]">
                          {customer.email}
                          {customer.marketingOptIn && ' · subscribed'}
                        </span>
                        {customer.tags.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {customer.tags.map((tag) => (
                              <Badge key={tag} tone="neutral">
                                {tag}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="text-[var(--admin-muted)]">{customer.segment ?? '—'}</td>
                      <td className="text-right tabular-nums">{customer._count.orders}</td>
                      <td className="text-right tabular-nums">{formatUSD(lifetime.get(customer.id) ?? 0)}</td>
                      <td className="text-right tabular-nums text-[var(--admin-muted)]">{customer._count.wishlist}</td>
                      <td className="text-xs text-[var(--admin-muted)]">{formatDate(customer.createdAt)}</td>
                      <td>
                        <Badge tone={toneFor(customer.status)}>{customer.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BulkForm>
        )}

        <Pagination page={page} pages={pageCount(total, PER_PAGE)} hrefFor={hrefFor} total={total} noun="customers" />
      </Panel>
    </>
  )
}
