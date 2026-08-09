import Link from 'next/link'
import { db } from '@/lib/db'
import { formatUSD } from '@/lib/money'
import { OrderStatusForm } from '@/components/admin/OrderStatusForm'

export const dynamic = 'force-dynamic'

const PER_PAGE = 25
const STATUSES = ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED'] as const

export default async function AdminOrders({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const { status, page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  const where = STATUSES.includes(status as (typeof STATUSES)[number])
    ? { status: status as (typeof STATUSES)[number] }
    : {}

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        number: true,
        email: true,
        status: true,
        totalCents: true,
        createdAt: true,
        shipCity: true,
        shipState: true,
        _count: { select: { items: true } },
      },
    }),
    db.order.count({ where }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <>
      <h1 className="text-2xl">Orders</h1>

      <nav aria-label="Filter by status" className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-wider">
        <Link href="/admin/orders" className={!where.status ? 'text-rose-500' : 'text-plum-500 hover:text-rose-500'}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={where.status === s ? 'text-rose-500' : 'text-plum-500 hover:text-rose-500'}
          >
            {s}
          </Link>
        ))}
      </nav>

      <p className="mt-3 text-sm text-plum-500">{total} orders</p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-plum-500">
              <th scope="col" className="py-2 font-normal">Order</th>
              <th scope="col" className="py-2 font-normal">Customer</th>
              <th scope="col" className="py-2 font-normal">Ships to</th>
              <th scope="col" className="py-2 font-normal">Items</th>
              <th scope="col" className="py-2 font-normal">Total</th>
              <th scope="col" className="py-2 font-normal">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {orders.map((order) => (
              <tr key={order.number}>
                <td className="py-2.5 pr-4">
                  <p className="font-medium">{order.number}</p>
                  <p className="text-xs text-plum-300">{order.createdAt.toLocaleDateString('en-US')}</p>
                </td>
                <td className="max-w-[13rem] truncate py-2.5 pr-4 text-plum-500">{order.email}</td>
                <td className="py-2.5 pr-4 text-plum-500">
                  {order.shipCity}, {order.shipState}
                </td>
                <td className="py-2.5 pr-4">{order._count.items}</td>
                <td className="py-2.5 pr-4">{formatUSD(order.totalCents)}</td>
                <td className="py-2.5">
                  <OrderStatusForm number={order.number} status={order.status} statuses={[...STATUSES]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {orders.length === 0 && <p className="py-10 text-center text-sm text-plum-500">No orders here.</p>}

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/admin/orders?page=${page - 1}`} className="link-underline">
              Previous
            </Link>
          )}
          <span className="text-plum-500">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Link href={`/admin/orders?page=${page + 1}`} className="link-underline">
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  )
}
