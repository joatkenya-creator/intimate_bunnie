import Link from 'next/link'
import { db } from '@/lib/db'
import { formatUSD } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const [productCount, lowStock, orderCount, revenue, recent] = await Promise.all([
    db.product.count({ where: { active: true } }),
    db.product.count({ where: { active: true, inventory: { lte: 5 } } }),
    db.order.count(),
    db.order.aggregate({ _sum: { totalCents: true }, where: { status: { in: ['PAID', 'FULFILLED'] } } }),
    db.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { number: true, email: true, status: true, totalCents: true, createdAt: true },
    }),
  ])

  const stats = [
    { label: 'Active products', value: String(productCount) },
    { label: 'Low stock (≤5)', value: String(lowStock) },
    { label: 'Orders', value: String(orderCount) },
    { label: 'Revenue', value: formatUSD(revenue._sum.totalCents ?? 0) },
  ]

  return (
    <>
      <h1 className="text-2xl">Dashboard</h1>

      <dl className="mt-6 grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white px-5 py-4">
            <dt className="text-xs uppercase tracking-[0.1em] text-plum-500">{stat.label}</dt>
            <dd className="mt-1.5 font-display text-2xl">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10">
        <div className="mb-3 flex items-end justify-between border-b border-line pb-2">
          <h2 className="text-lg">Recent orders</h2>
          <Link href="/admin/orders" className="text-xs uppercase tracking-[0.1em] link-underline">
            All orders
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-6 text-sm text-plum-500">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-plum-500">
                <th scope="col" className="py-2 font-normal">Order</th>
                <th scope="col" className="py-2 font-normal">Email</th>
                <th scope="col" className="py-2 font-normal">Status</th>
                <th scope="col" className="py-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((order) => (
                <tr key={order.number}>
                  <td className="py-2.5">{order.number}</td>
                  <td className="max-w-[14rem] truncate py-2.5 text-plum-500">{order.email}</td>
                  <td className="py-2.5 text-xs uppercase tracking-wider text-plum-500">{order.status}</td>
                  <td className="py-2.5 text-right">{formatUSD(order.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
