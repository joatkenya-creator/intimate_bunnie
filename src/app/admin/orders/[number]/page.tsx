import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { formatUSD } from '@/lib/money'
import { addOrderNote, refundOrder, updateShipping, flagOrder, updateOrderStatus } from '@/actions/admin/orders'
import { PageHeader, Panel, Badge, toneFor, DefinitionList, formatDateTime, timeAgo } from '@/components/admin/ui'
import { AdminForm, TextField, TextArea, SelectField, Toggle, SubmitButton } from '@/components/admin/forms'

export const dynamic = 'force-dynamic'

const STATUSES = ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED']

export default async function OrderDetail({ params }: { params: Promise<{ number: string }> }) {
  await requirePagePermission('orders.read')
  const { number } = await params
  const mayWrite = await hasPermission('orders.write')

  const order = await db.order.findUnique({
    where: { number },
    include: {
      items: { include: { product: { select: { id: true, slug: true, sku: true } } } },
      events: { orderBy: { createdAt: 'desc' } },
      returns: { select: { number: true, status: true, refundCents: true, createdAt: true } },
      user: { select: { id: true, email: true, name: true, tags: true } },
    },
  })
  if (!order) notFound()

  const refundable = order.totalCents - order.refundedCents

  return (
    <>
      <PageHeader
        title={`Order ${order.number}`}
        description={`Placed ${formatDateTime(order.createdAt)} · ${order.email}`}
        actions={
          <>
            <Badge tone={toneFor(order.status)}>{order.status}</Badge>
            {order.fraudFlag && <Badge tone="danger">{order.fraudFlag}</Badge>}
            <Link href={`/admin/orders/${order.number}/invoice`} className="admin-btn admin-btn-ghost">
              Invoice
            </Link>
            <Link href={`/admin/orders/${order.number}/packing-slip`} className="admin-btn admin-btn-ghost">
              Packing slip
            </Link>
            <Link href="/admin/orders" className="admin-btn admin-btn-ghost">
              All orders
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Panel title="Items" bodyClassName="p-0">
            <table className="admin-table w-full">
              <thead className="border-b border-[var(--admin-line)]">
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="text-right">
                    Unit
                  </th>
                  <th scope="col" className="text-right">
                    Qty
                  </th>
                  <th scope="col" className="text-right">
                    Line
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-line)]">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link href={`/admin/products/${item.productId}`} className="font-medium hover:text-[var(--admin-accent)]">
                        {item.name}
                      </Link>
                      <span className="block text-xs text-[var(--admin-muted)]">
                        {item.product.sku}
                        {item.variantName && ` · ${item.variantName}`}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{formatUSD(item.unitCents)}</td>
                    <td className="text-right tabular-nums">{item.quantity}</td>
                    <td className="text-right tabular-nums">{formatUSD(item.unitCents * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-[var(--admin-line)] px-4 py-3">
              <DefinitionList
                rows={[
                  { label: 'Subtotal', value: formatUSD(order.subtotalCents) },
                  { label: 'Shipping', value: formatUSD(order.shippingCents) },
                  { label: 'Tax', value: formatUSD(order.taxCents) },
                  ...(order.refundedCents > 0 ? [{ label: 'Refunded', value: `−${formatUSD(order.refundedCents)}` }] : []),
                  { label: 'Total', value: <strong>{formatUSD(order.totalCents)}</strong> },
                ]}
              />
            </div>
          </Panel>

          <Panel title="Timeline" description="Status changes, notes, payments, and returns">
            {order.events.length === 0 ? (
              <p className="text-sm text-[var(--admin-muted)]">Nothing recorded yet.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {order.events.map((event) => (
                  <li key={event.id} className="border-l-2 border-[var(--admin-line)] pl-3">
                    <p>
                      <Badge tone={event.type === 'FRAUD' ? 'danger' : event.type === 'NOTE' ? 'neutral' : 'info'}>{event.type}</Badge>{' '}
                      {event.message}
                    </p>
                    <p className="text-xs text-[var(--admin-muted)]">
                      {event.actor} · {timeAgo(event.createdAt)}
                      {event.visibleToCustomer ? ' · visible to customer' : ' · internal'}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {mayWrite && (
            <Panel title="Add a note">
              <AdminForm action={addOrderNote}>
                <input type="hidden" name="number" value={order.number} />
                <TextArea label="Note" name="message" rows={3} required />
                <Toggle label="Show this to the customer" name="visibleToCustomer" hint="Off by default — staff notes stay internal." />
              </AdminForm>
            </Panel>
          )}
        </div>

        <div className="space-y-3">
          <Panel title="Customer">
            <DefinitionList
              rows={[
                {
                  label: 'Account',
                  value: order.user ? (
                    <Link href={`/admin/customers/${order.user.id}`} className="text-[var(--admin-accent)]">
                      {order.user.name ?? order.user.email}
                    </Link>
                  ) : (
                    'Guest checkout'
                  ),
                },
                { label: 'Email', value: order.email },
                { label: 'Payment', value: `${order.paymentProvider}${order.paymentReference ? ` · ${order.paymentReference}` : ''}` },
              ]}
            />
          </Panel>

          <Panel title="Shipping address">
            <address className="text-sm not-italic leading-relaxed text-[var(--admin-muted)]">
              {order.shipName}
              <br />
              {order.shipLine1}
              {order.shipLine2 && (
                <>
                  <br />
                  {order.shipLine2}
                </>
              )}
              <br />
              {order.shipCity}, {order.shipState} {order.shipZip}
            </address>
          </Panel>

          {mayWrite && (
            <>
              <Panel title="Status">
                <AdminForm action={updateOrderStatus} footer={<SubmitButton>Update status</SubmitButton>}>
                  <input type="hidden" name="number" value={order.number} />
                  <SelectField label="Status" name="status" defaultValue={order.status} options={STATUSES.map((status) => ({ value: status, label: status }))} />
                </AdminForm>
              </Panel>

              <Panel title="Fulfilment">
                <AdminForm action={updateShipping}>
                  <input type="hidden" name="number" value={order.number} />
                  <TextField label="Carrier" name="carrier" defaultValue={order.carrier ?? ''} placeholder="USPS" />
                  <TextField label="Tracking number" name="trackingNumber" defaultValue={order.trackingNumber ?? ''} />
                </AdminForm>
                <p className="mt-3 text-xs text-[var(--admin-muted)]">
                  Label printing is not built. It belongs behind a carrier provider next to{' '}
                  <code>services/payment.ts</code>; tracking numbers entered here already reach the customer timeline.
                </p>
              </Panel>

              <Panel title="Refund">
                {refundable <= 0 ? (
                  <p className="text-sm text-[var(--admin-muted)]">This order is fully refunded.</p>
                ) : (
                  <AdminForm action={refundOrder} footer={<SubmitButton variant="danger">Record refund</SubmitButton>}>
                    <input type="hidden" name="number" value={order.number} />
                    <TextField
                      label="Amount (USD)"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      hint={`${formatUSD(refundable)} still refundable.`}
                    />
                    <TextField label="Reason" name="reason" required />
                  </AdminForm>
                )}
              </Panel>

              <Panel title="Fraud review">
                <AdminForm action={flagOrder}>
                  <input type="hidden" name="number" value={order.number} />
                  <TextField label="Flag" name="fraudFlag" defaultValue={order.fraudFlag ?? ''} hint="Clear the field to remove the flag." />
                  <TextField label="Score (0–100)" name="fraudScore" type="number" min="0" max="100" defaultValue={order.fraudScore ?? ''} />
                </AdminForm>
              </Panel>
            </>
          )}

          {order.returns.length > 0 && (
            <Panel title="Returns">
              <ul className="space-y-2 text-sm">
                {order.returns.map((request) => (
                  <li key={request.number} className="flex items-center justify-between gap-2">
                    <Link href="/admin/returns" className="text-[var(--admin-accent)]">
                      {request.number}
                    </Link>
                    <Badge tone={toneFor(request.status)}>{request.status}</Badge>
                    <span className="tabular-nums">{formatUSD(request.refundCents)}</span>
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
