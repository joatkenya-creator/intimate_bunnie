import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { formatUSD } from '@/lib/money'
import { paging, pageCount, PER_PAGE } from '@/server/admin'
import { PageHeader, Panel, Badge, toneFor, Pagination, FilterBar, SearchInput, FilterSelect, EmptyState, formatDate } from '@/components/admin/ui'
import { OrderStatusForm } from '@/components/admin/OrderStatusForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Orders' }

const STATUSES = ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED'] as const

type Search = { q?: string; status?: string; flagged?: string; page?: string }

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission('orders.read')
  const params = await searchParams
  const { page, skip, take } = paging(params.page)
  const mayWrite = await hasPermission('orders.write')

  const where = {
    ...(params.status && STATUSES.includes(params.status as (typeof STATUSES)[number])
      ? { status: params.status as (typeof STATUSES)[number] }
      : {}),
    ...(params.flagged === '1' ? { fraudFlag: { not: null } } : {}),
    ...(params.q
      ? {
          OR: [
            { number: { contains: params.q, mode: 'insensitive' as const } },
            { email: { contains: params.q, mode: 'insensitive' as const } },
            { shipName: { contains: params.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [orders, total, statusCounts] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        number: true,
        email: true,
        status: true,
        totalCents: true,
        refundedCents: true,
        createdAt: true,
        shipCity: true,
        shipState: true,
        fraudFlag: true,
        trackingNumber: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
    db.order.groupBy({ by: ['status'], _count: true }),
  ])

  const counts = Object.fromEntries(statusCounts.map((row) => [row.status, row._count]))
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][])
  const hrefFor = (next: number) => {
    const clone = new URLSearchParams(query)
    clone.set('page', String(next))
    return `/admin/orders?${clone}`
  }

  return (
    <>
      <PageHeader title="Orders" description={`${total} matching orders`} />

      <nav aria-label="Filter by status" className="admin-scroll mb-3 flex gap-1.5 text-xs">
        <Link href="/admin/orders" className={`admin-btn ${!params.status ? 'admin-btn-primary' : 'admin-btn-ghost'}`}>
          All
        </Link>
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={`/admin/orders?status=${status}`}
            className={`admin-btn ${params.status === status ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
          >
            {status} {counts[status] ? `(${counts[status]})` : ''}
          </Link>
        ))}
        <Link href="/admin/orders?flagged=1" className={`admin-btn ${params.flagged ? 'admin-btn-primary' : 'admin-btn-ghost'}`}>
          Flagged
        </Link>
      </nav>

      <Panel bodyClassName="p-0">
        <FilterBar action="/admin/orders">
          <SearchInput defaultValue={params.q ?? ''} label="Search" placeholder="Order number, email, name" />
          <FilterSelect
            name="status"
            label="Status"
            value={params.status}
            options={[{ value: '', label: 'Any status' }, ...STATUSES.map((status) => ({ value: status, label: status }))]}
          />
        </FilterBar>

        {orders.length === 0 ? (
          <EmptyState title="No orders here" description="Try a different filter or search." />
        ) : (
          <div className="admin-scroll">
            <table className="admin-table w-full min-w-[52rem]">
              <thead className="border-b border-[var(--admin-line)]">
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Ships to</th>
                  <th scope="col" className="text-right">
                    Items
                  </th>
                  <th scope="col" className="text-right">
                    Total
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Change status</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-line)]">
                {orders.map((order) => (
                  <tr key={order.number}>
                    <td>
                      <Link href={`/admin/orders/${order.number}`} className="font-medium hover:text-[var(--admin-accent)]">
                        {order.number}
                      </Link>
                      <span className="block text-xs text-[var(--admin-muted)]">{formatDate(order.createdAt)}</span>
                      {order.fraudFlag && (
                        <Badge tone="danger">
                          <span title={order.fraudFlag}>Flagged</span>
                        </Badge>
                      )}
                    </td>
                    <td className="max-w-48 truncate text-[var(--admin-muted)]">{order.email}</td>
                    <td className="text-[var(--admin-muted)]">
                      {order.shipCity}, {order.shipState}
                      {order.trackingNumber && <span className="block text-xs">Tracked</span>}
                    </td>
                    <td className="text-right tabular-nums">{order._count.items}</td>
                    <td className="text-right tabular-nums">
                      {formatUSD(order.totalCents)}
                      {order.refundedCents > 0 && (
                        <span className="block text-xs text-[var(--color-danger)]">−{formatUSD(order.refundedCents)}</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={toneFor(order.status)}>{order.status}</Badge>
                    </td>
                    <td>{mayWrite && <OrderStatusForm number={order.number} status={order.status} statuses={[...STATUSES]} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} pages={pageCount(total, PER_PAGE)} hrefFor={hrefFor} total={total} noun="orders" />
      </Panel>
    </>
  )
}
