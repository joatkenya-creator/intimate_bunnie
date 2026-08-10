import { formatUSD } from '@/lib/money'
import { formatDate } from './ui'
import { PrintButton } from './PrintButton'

// Invoice and packing slip are the same document with different columns: one
// shows money, the other shows where each item lives in the stockroom. Printing
// is the browser's own dialog, which is also how these become PDFs — a PDF
// library would be 300 kB to reproduce what Ctrl-P already does.

type DocumentOrder = {
  number: string
  createdAt: Date
  email: string
  status: string
  subtotalCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
  refundedCents: number
  shipName: string
  shipLine1: string
  shipLine2: string | null
  shipCity: string
  shipState: string
  shipZip: string
  carrier: string | null
  trackingNumber: string | null
  items: { id: string; name: string; variantName: string | null; unitCents: number; quantity: number; product: { sku: string } }[]
}

export function OrderDocument({
  order,
  variant,
  store,
}: {
  order: DocumentOrder
  variant: 'invoice' | 'packing-slip'
  store: { name: string; email: string; address: string; businessName: string }
}) {
  const invoice = variant === 'invoice'

  return (
    <div className="admin-panel mx-auto max-w-3xl p-8 print:border-0 print:p-0">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton label={invoice ? 'Print invoice' : 'Print packing slip'} />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-[var(--admin-line)] pb-5">
        <div>
          <h1 className="text-xl font-semibold">{invoice ? 'Invoice' : 'Packing slip'}</h1>
          <p className="mt-1 text-sm text-[var(--admin-muted)]">
            {order.number} · {formatDate(order.createdAt)}
          </p>
          {invoice && <p className="text-sm text-[var(--admin-muted)]">Status: {order.status}</p>}
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{store.businessName || store.name}</p>
          {store.address && <p className="whitespace-pre-line text-[var(--admin-muted)]">{store.address}</p>}
          <p className="text-[var(--admin-muted)]">{store.email}</p>
        </div>
      </header>

      <section className="grid gap-6 py-5 sm:grid-cols-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">Ship to</h2>
          <address className="mt-1 text-sm not-italic leading-relaxed">
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
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted)]">
            {invoice ? 'Billed to' : 'Shipment'}
          </h2>
          <p className="mt-1 text-sm">
            {invoice ? order.email : `${order.carrier ?? 'Carrier not set'} · ${order.trackingNumber ?? 'No tracking yet'}`}
          </p>
        </div>
      </section>

      <table className="w-full border-t border-[var(--admin-line)] text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-[var(--admin-muted)]">
            <th scope="col" className="py-2">
              Item
            </th>
            <th scope="col" className="py-2">
              SKU
            </th>
            <th scope="col" className="py-2 text-right">
              Qty
            </th>
            {invoice && (
              <>
                <th scope="col" className="py-2 text-right">
                  Unit
                </th>
                <th scope="col" className="py-2 text-right">
                  Amount
                </th>
              </>
            )}
            {!invoice && (
              <th scope="col" className="py-2 text-right">
                Picked
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--admin-line)]">
          {order.items.map((item) => (
            <tr key={item.id}>
              <td className="py-2">
                {item.name}
                {item.variantName && <span className="block text-xs text-[var(--admin-muted)]">{item.variantName}</span>}
              </td>
              <td className="py-2 text-xs text-[var(--admin-muted)]">{item.product.sku}</td>
              <td className="py-2 text-right tabular-nums">{item.quantity}</td>
              {invoice && (
                <>
                  <td className="py-2 text-right tabular-nums">{formatUSD(item.unitCents)}</td>
                  <td className="py-2 text-right tabular-nums">{formatUSD(item.unitCents * item.quantity)}</td>
                </>
              )}
              {/* A real box on a real bench needs somewhere to tick. */}
              {!invoice && <td className="py-2 text-right text-[var(--admin-faint)]">☐</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {invoice && (
        <div className="ml-auto mt-5 max-w-xs space-y-1 text-sm">
          <Row label="Subtotal" value={formatUSD(order.subtotalCents)} />
          <Row label="Shipping" value={formatUSD(order.shippingCents)} />
          <Row label="Tax" value={formatUSD(order.taxCents)} />
          {order.refundedCents > 0 && <Row label="Refunded" value={`−${formatUSD(order.refundedCents)}`} />}
          <div className="border-t border-[var(--admin-line)] pt-1 font-semibold">
            <Row label="Total" value={formatUSD(order.totalCents - order.refundedCents)} />
          </div>
        </div>
      )}

      <footer className="mt-8 border-t border-[var(--admin-line)] pt-4 text-xs text-[var(--admin-muted)]">
        {invoice
          ? `Questions about this invoice? Reply to ${store.email}.`
          : 'Packed with care. Plain packaging, no branding, nothing on the outside naming the contents.'}
      </footer>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
