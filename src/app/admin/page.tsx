import Link from 'next/link'
import { requirePagePermission } from '@/lib/rbac'
import { dashboardData, salesSeries, systemHealth } from '@/server/admin'
import { formatUSD } from '@/lib/money'
import { PageHeader, Panel, StatCard, Badge, toneFor, timeAgo, formatDate } from '@/components/admin/ui'
import { TrendChart, BarList } from '@/components/admin/charts'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard' }

const QUICK_ACTIONS = [
  { href: '/admin/products/new', label: 'New product', hint: 'Add something to the catalog' },
  { href: '/admin/orders?status=PENDING', label: 'Work pending orders', hint: 'Everything awaiting payment' },
  { href: '/admin/promotions/new', label: 'New promotion', hint: 'Coupon, sale, or automatic discount' },
  { href: '/admin/blog/new', label: 'Write a post', hint: 'Blog entry with SEO metadata' },
]

export default async function AdminDashboard() {
  const admin = await requirePagePermission('dashboard.read')
  const [data, series, health] = await Promise.all([dashboardData(), salesSeries(30), systemHealth()])

  const firstName = admin.name?.split(' ')[0] ?? 'there'

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="Everything below covers the last 30 days unless it says otherwise."
        actions={
          <Link href="/admin/reports" className="admin-btn admin-btn-ghost">
            Reports
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue (30 days)"
          value={formatUSD(data.revenue30Cents)}
          change={data.revenueChangePercent}
          hint="vs previous 30"
        />
        <StatCard label="Orders today" value={String(data.ordersToday)} hint={formatUSD(data.revenueTodayCents)} href="/admin/orders" />
        <StatCard label="Customers" value={String(data.customers)} hint={`${data.newCustomers30} new`} href="/admin/customers" />
        <StatCard
          label="Lifetime revenue"
          value={formatUSD(data.revenueAllCents)}
          hint={`${data.orders30} orders in 30 days`}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Revenue trend" description="Paid and fulfilled orders, by day" className="lg:col-span-2">
          <TrendChart
            points={series.map((point) => ({ label: point.day.slice(5), value: point.revenueCents }))}
            format={formatUSD}
            valueLabel="Revenue"
          />
        </Panel>

        <Panel title="Orders per day" description="Same window, counted rather than valued">
          <TrendChart
            points={series.map((point) => ({ label: point.day.slice(5), value: point.orders }))}
            format={(value) => String(value)}
            valueLabel="Orders"
            height={120}
          />
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Needs attention">
          <ul className="space-y-2 text-sm">
            <AttentionRow label="Pending orders" count={data.pendingOrders} href="/admin/orders?status=PENDING" tone="warn" />
            <AttentionRow label="Refund requests" count={data.refundRequests} href="/admin/returns" tone="warn" />
            <AttentionRow label="Low stock" count={data.lowStock} href="/admin/inventory?filter=low" tone="warn" />
            <AttentionRow label="Out of stock" count={data.outOfStock} href="/admin/inventory?filter=out" tone="danger" />
          </ul>
        </Panel>

        <Panel title="Top products" description="By revenue, last 30 days">
          <BarList
            items={data.topProducts.map((product) => ({
              label: product.name,
              value: product.revenue,
              href: `/admin/products/${product.id}`,
              meta: `${product.units} sold`,
            }))}
            format={formatUSD}
            emptyLabel="No sales in this window yet."
          />
        </Panel>

        <Panel title="Top categories" description="By revenue, last 30 days">
          <BarList
            items={data.topCategories.map((category) => ({ label: category.name, value: category.revenue }))}
            format={formatUSD}
            emptyLabel="No sales in this window yet."
          />
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel
          title="Recent orders"
          className="lg:col-span-2"
          bodyClassName="p-0"
          actions={
            <Link href="/admin/orders" className="text-xs text-[var(--admin-accent)]">
              All orders →
            </Link>
          }
        >
          {data.recentOrders.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--admin-muted)]">No orders yet.</p>
          ) : (
            <table className="admin-table w-full">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Placed</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-line)]">
                {data.recentOrders.map((order) => (
                  <tr key={order.number}>
                    <td>
                      <Link href={`/admin/orders/${order.number}`} className="font-medium hover:text-[var(--admin-accent)]">
                        {order.number}
                      </Link>
                    </td>
                    <td className="max-w-48 truncate text-[var(--admin-muted)]">{order.email}</td>
                    <td className="text-[var(--admin-muted)]">{formatDate(order.createdAt)}</td>
                    <td>
                      <Badge tone={toneFor(order.status)}>{order.status}</Badge>
                    </td>
                    <td className="text-right tabular-nums">{formatUSD(order.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="space-y-3">
          <Panel title="Quick actions">
            <ul className="space-y-1.5">
              {QUICK_ACTIONS.map((action) => (
                <li key={action.href}>
                  <Link href={action.href} className="block rounded px-2 py-1.5 hover:bg-[var(--admin-raised)]">
                    <span className="text-sm font-medium">{action.label}</span>
                    <span className="block text-xs text-[var(--admin-muted)]">{action.hint}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="System health">
            <ul className="space-y-2 text-sm">
              {health.map((check) => (
                <li key={check.label} className="flex items-center justify-between gap-2">
                  <span>{check.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="max-w-40 truncate text-xs text-[var(--admin-muted)]">{check.detail}</span>
                    <Badge tone={toneFor(check.status)}>{check.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Recent activity" description="Every admin write lands in the audit log" className="mt-3">
        {data.recentActivity.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--admin-muted)]">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--admin-line)] text-sm">
            {data.recentActivity.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{entry.actor}</span>{' '}
                  <span className="text-[var(--admin-muted)]">{entry.action}</span>{' '}
                  {entry.target && <code className="text-xs text-[var(--admin-faint)]">{entry.target}</code>}
                </span>
                <span className="text-xs text-[var(--admin-muted)]">{timeAgo(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

function AttentionRow({ label, count, href, tone }: { label: string; count: number; href: string; tone: 'warn' | 'danger' }) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-[var(--admin-raised)]">
        <span>{label}</span>
        {count > 0 ? <Badge tone={tone}>{count}</Badge> : <span className="text-xs text-[var(--admin-muted)]">Clear</span>}
      </Link>
    </li>
  )
}
