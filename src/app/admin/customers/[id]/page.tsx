import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { formatUSD } from '@/lib/money'
import { updateCustomer, addStoreCredit, deleteCustomer } from '@/actions/admin/customers'
import { PageHeader, Panel, Badge, toneFor, StatCard, DefinitionList, EmptyState, formatDate, formatDateTime } from '@/components/admin/ui'
import { AdminForm, TextField, TextArea, SelectField, Toggle } from '@/components/admin/forms'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePagePermission('customers.read')
  const { id } = await params
  const mayWrite = await hasPermission('customers.write')

  const customer = await db.user.findUnique({
    where: { id },
    include: {
      addresses: true,
      wishlist: { include: { product: { select: { id: true, name: true, priceCents: true, inventory: true } } } },
      storeCredits: { orderBy: { createdAt: 'desc' } },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { number: true, status: true, totalCents: true, refundedCents: true, createdAt: true, _count: { select: { items: true } } },
      },
    },
  })
  if (!customer) notFound()

  const [lifetime, returns] = await Promise.all([
    db.order.aggregate({ where: { userId: id, status: { in: ['PAID', 'FULFILLED'] } }, _sum: { totalCents: true }, _count: true }),
    db.return.count({ where: { order: { userId: id } } }),
  ])

  const orders = lifetime._count
  const spent = lifetime._sum.totalCents ?? 0
  const creditBalance = customer.storeCredits.reduce((sum, entry) => sum + entry.cents, 0)

  return (
    <>
      <PageHeader
        title={customer.name ?? customer.email}
        description={`${customer.email} · joined ${formatDate(customer.createdAt)}`}
        actions={
          <>
            <Badge tone={toneFor(customer.status)}>{customer.status}</Badge>
            <Link href="/admin/customers" className="admin-btn admin-btn-ghost">
              All customers
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Lifetime value" value={formatUSD(spent)} hint={`${orders} paid orders`} />
        <StatCard label="Average order" value={formatUSD(orders ? Math.round(spent / orders) : 0)} />
        <StatCard label="Returns" value={String(returns)} />
        <StatCard label="Store credit" value={formatUSD(creditBalance)} />
      </div>

      <div className="mt-3 grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Panel title="Order history" bodyClassName="p-0">
            {customer.orders.length === 0 ? (
              <EmptyState title="No orders yet" />
            ) : (
              <table className="admin-table w-full">
                <thead className="border-b border-[var(--admin-line)]">
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Placed</th>
                    <th scope="col" className="text-right">
                      Items
                    </th>
                    <th scope="col" className="text-right">
                      Total
                    </th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-line)]">
                  {customer.orders.map((order) => (
                    <tr key={order.number}>
                      <td>
                        <Link href={`/admin/orders/${order.number}`} className="font-medium hover:text-[var(--admin-accent)]">
                          {order.number}
                        </Link>
                      </td>
                      <td className="text-[var(--admin-muted)]">{formatDate(order.createdAt)}</td>
                      <td className="text-right tabular-nums">{order._count.items}</td>
                      <td className="text-right tabular-nums">{formatUSD(order.totalCents)}</td>
                      <td>
                        <Badge tone={toneFor(order.status)}>{order.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Wishlist" description="Synced from the storefront when they are signed in">
            {customer.wishlist.length === 0 ? (
              <p className="text-sm text-[var(--admin-muted)]">Nothing saved.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {customer.wishlist.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3">
                    <Link href={`/admin/products/${entry.product.id}`} className="truncate hover:text-[var(--admin-accent)]">
                      {entry.product.name}
                    </Link>
                    <span className="shrink-0 tabular-nums text-[var(--admin-muted)]">
                      {formatUSD(entry.product.priceCents)}
                      {entry.product.inventory === 0 && ' · out of stock'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Store credit ledger" description="Append-only — the balance is the sum of these rows">
            {customer.storeCredits.length === 0 ? (
              <p className="text-sm text-[var(--admin-muted)]">No credit issued.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {customer.storeCredits.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-3">
                    <span>
                      {entry.reason}
                      <span className="block text-xs text-[var(--admin-muted)]">
                        {entry.actor} · {formatDateTime(entry.createdAt)}
                      </span>
                    </span>
                    <span className={`shrink-0 tabular-nums ${entry.cents < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-ok)]'}`}>
                      {entry.cents > 0 ? '+' : ''}
                      {formatUSD(entry.cents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {mayWrite && (
              <div className="mt-4 border-t border-[var(--admin-line)] pt-4">
                <AdminForm action={addStoreCredit}>
                  <input type="hidden" name="userId" value={customer.id} />
                  <TextField label="Amount (USD)" name="amount" type="number" step="0.01" required hint="Negative deducts." />
                  <TextField label="Reason" name="reason" required />
                </AdminForm>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="Profile">
            {mayWrite ? (
              <AdminForm action={updateCustomer}>
                <input type="hidden" name="id" value={customer.id} />
                <TextField label="Name" name="name" defaultValue={customer.name ?? ''} />
                <TextField label="Phone" name="phone" defaultValue={customer.phone ?? ''} />
                <SelectField
                  label="Account status"
                  name="status"
                  defaultValue={customer.status}
                  options={[
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'BLOCKED', label: 'Blocked — cannot sign in' },
                    { value: 'INVITED', label: 'Invited — has not set a password' },
                  ]}
                />
                <TextField label="Segment" name="segment" defaultValue={customer.segment ?? ''} hint="Free text, e.g. vip or wholesale." />
                <TextField label="Tags" name="tags" defaultValue={customer.tags.join(', ')} hint="Comma separated." />
                <TextArea label="Internal notes" name="notes" rows={4} defaultValue={customer.notes} hint="Never shown to the customer." />
                <Toggle label="Marketing opt-in" name="marketingOptIn" defaultChecked={customer.marketingOptIn} />
              </AdminForm>
            ) : (
              <DefinitionList
                rows={[
                  { label: 'Segment', value: customer.segment ?? '—' },
                  { label: 'Tags', value: customer.tags.join(', ') || '—' },
                  { label: 'Marketing', value: customer.marketingOptIn ? 'Subscribed' : 'Not subscribed' },
                ]}
              />
            )}
          </Panel>

          <Panel title="Account">
            <DefinitionList
              rows={[
                { label: 'Email verified', value: customer.emailVerifiedAt ? formatDate(customer.emailVerifiedAt) : 'Not verified' },
                { label: 'Last sign-in', value: customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : 'Never' },
                { label: 'Addresses', value: String(customer.addresses.length) },
              ]}
            />
          </Panel>

          {/* Super administrators only — the Administrator role holds
              `customers.*`, and this is not a day-to-day operation. */}
          {admin.role === 'SUPER_ADMIN' && customer.role === 'CUSTOMER' && (
            <Panel
              title="Danger zone"
              description="Removes the account, addresses, wishlist, and credit ledger. Past orders are kept, detached from the customer."
            >
              <RowAction
                action={deleteCustomer}
                id={customer.id}
                label="Delete account"
                pendingLabel="Deleting…"
                variant="danger"
                confirm={`Permanently delete ${customer.email}? This cannot be undone.`}
              />
            </Panel>
          )}

          {customer.addresses.length > 0 && (
            <Panel title="Addresses">
              <ul className="space-y-3 text-sm">
                {customer.addresses.map((address) => (
                  <li key={address.id}>
                    <address className="not-italic leading-relaxed text-[var(--admin-muted)]">
                      {address.fullName}
                      {address.isDefault && <Badge tone="accent">Default</Badge>}
                      <br />
                      {address.line1}
                      {address.line2 && (
                        <>
                          <br />
                          {address.line2}
                        </>
                      )}
                      <br />
                      {address.city}, {address.state} {address.zip}
                    </address>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}
