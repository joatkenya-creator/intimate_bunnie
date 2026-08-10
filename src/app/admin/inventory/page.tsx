import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { formatUSD } from '@/lib/money'
import { paging, pageCount, PER_PAGE } from '@/server/admin'
import { adjustStock, setIncoming, setLowStockThreshold, releaseReserved } from '@/actions/admin/inventory'
import { PageHeader, Panel, StatCard, Badge, Pagination, FilterBar, SearchInput, FilterSelect, EmptyState, timeAgo } from '@/components/admin/ui'
import { AdminForm, TextField, SelectField, TextArea } from '@/components/admin/forms'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Inventory' }

type Search = { q?: string; filter?: string; product?: string; page?: string }

export default async function AdminInventory({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission('inventory.read')
  const params = await searchParams
  const { page, skip, take } = paging(params.page)
  const mayWrite = await hasPermission('inventory.write')

  // "Low" compares two columns, which Prisma's `where` cannot express — so the
  // ids come from SQL first and become an `in` filter. Done before paging, or
  // page 2 would silently drop rows.
  const lowStockIds =
    params.filter === 'low'
      ? (
          await db.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Product"
            WHERE "status" <> 'ARCHIVED' AND "inventory" > 0 AND "inventory" <= "lowStockAt"`
        ).map((row) => row.id)
      : null

  const where = {
    status: { not: 'ARCHIVED' as const },
    ...(lowStockIds ? { id: { in: lowStockIds } } : {}),
    ...(params.q
      ? { OR: [{ name: { contains: params.q, mode: 'insensitive' as const } }, { sku: { contains: params.q, mode: 'insensitive' as const } }] }
      : {}),
    ...(params.filter === 'out' ? { inventory: 0 } : {}),
    ...(params.filter === 'incoming' ? { incomingStock: { gt: 0 } } : {}),
    ...(params.filter === 'reserved' ? { reservedStock: { gt: 0 } } : {}),
  }

  const [products, total, counts, adjustments, selected] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { inventory: 'asc' },
      skip,
      take,
      select: {
        id: true,
        name: true,
        sku: true,
        inventory: true,
        reservedStock: true,
        incomingStock: true,
        lowStockAt: true,
        priceCents: true,
        variants: { select: { id: true, optionValue: true, sku: true, inventory: true } },
      },
    }),
    db.product.count({ where }),
    db.$queryRaw<{ low: number; out: number; value: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "inventory" > 0 AND "inventory" <= "lowStockAt")::int AS low,
        COUNT(*) FILTER (WHERE "inventory" = 0)::int AS out,
        COALESCE(SUM("inventory" * "priceCents"), 0)::int AS value
      FROM "Product" WHERE "status" <> 'ARCHIVED'`,
    db.inventoryAdjustment.findMany({
      where: params.product ? { productId: params.product } : {},
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, delta: true, resulting: true, reason: true, note: true, actor: true, createdAt: true, product: { select: { name: true } } },
    }),
    params.product
      ? db.product.findUnique({ where: { id: params.product }, select: { id: true, name: true, inventory: true, lowStockAt: true, incomingStock: true, reservedStock: true } })
      : null,
  ])

  const rows = products
  const summary = counts[0] ?? { low: 0, out: 0, value: 0 }

  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][])
  const hrefFor = (next: number) => {
    const clone = new URLSearchParams(query)
    clone.set('page', String(next))
    return `/admin/inventory?${clone}`
  }

  return (
    <>
      <PageHeader title="Inventory" description="On-hand levels, holds, and every movement that produced them." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stock value at retail" value={formatUSD(summary.value)} hint="On-hand × price" />
        <StatCard label="Low stock" value={String(summary.low)} hint="At or below threshold" href="/admin/inventory?filter=low" />
        <StatCard label="Out of stock" value={String(summary.out)} href="/admin/inventory?filter=out" />
        <StatCard label="SKUs tracked" value={String(total)} />
      </div>

      <div className="mt-3 grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Panel bodyClassName="p-0">
          <FilterBar action="/admin/inventory">
            <SearchInput defaultValue={params.q ?? ''} label="Search" placeholder="Name or SKU" />
            <FilterSelect
              name="filter"
              label="Show"
              value={params.filter}
              options={[
                { value: '', label: 'Everything' },
                { value: 'low', label: 'Low stock' },
                { value: 'out', label: 'Out of stock' },
                { value: 'reserved', label: 'Awaiting shipment' },
                { value: 'incoming', label: 'Incoming' },
              ]}
            />
          </FilterBar>

          {rows.length === 0 ? (
            <EmptyState title="Nothing matches" description="Try a different filter." />
          ) : (
            <div className="admin-scroll">
              <table className="admin-table w-full min-w-[46rem]">
                <thead className="border-b border-[var(--admin-line)]">
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="text-right">
                      On hand
                    </th>
                    <th scope="col" className="text-right">
                      To ship
                    </th>
                    <th scope="col" className="text-right">
                      Incoming
                    </th>
                    <th scope="col" className="text-right">
                      Threshold
                    </th>
                    <th scope="col">State</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-line)]">
                  {rows.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <Link href={`/admin/products/${product.id}`} className="font-medium hover:text-[var(--admin-accent)]">
                          {product.name}
                        </Link>
                        <span className="block text-xs text-[var(--admin-muted)]">
                          {product.sku}
                          {product.variants.length > 0 &&
                            ` · ${product.variants.map((variant) => `${variant.optionValue}: ${variant.inventory}`).join(', ')}`}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{product.inventory}</td>
                      <td className="text-right tabular-nums text-[var(--admin-muted)]">{product.reservedStock}</td>
                      <td className="text-right tabular-nums text-[var(--admin-muted)]">{product.incomingStock}</td>
                      <td className="text-right tabular-nums text-[var(--admin-muted)]">{product.lowStockAt}</td>
                      <td>
                        {product.inventory === 0 ? (
                          <Badge tone="danger">Out</Badge>
                        ) : product.inventory <= product.lowStockAt ? (
                          <Badge tone="warn">Low</Badge>
                        ) : (
                          <Badge tone="ok">OK</Badge>
                        )}
                      </td>
                      <td className="text-right text-xs">
                        <Link href={`/admin/inventory?product=${product.id}`} className="text-[var(--admin-accent)]">
                          Adjust
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} pages={pageCount(total, PER_PAGE)} hrefFor={hrefFor} total={total} noun="products" />
        </Panel>

        <div className="space-y-3">
          <Panel title={selected ? `Adjust ${selected.name}` : 'Adjust stock'}>
            {!mayWrite ? (
              <p className="text-sm text-[var(--admin-muted)]">You have read-only access to inventory.</p>
            ) : !selected ? (
              <p className="text-sm text-[var(--admin-muted)]">Pick a product from the table to adjust it.</p>
            ) : (
              <div className="space-y-4">
                <AdminForm action={adjustStock} key={`adjust-${selected.id}`}>
                  <input type="hidden" name="productId" value={selected.id} />
                  <SelectField
                    label="Mode"
                    name="mode"
                    defaultValue="delta"
                    options={[
                      { value: 'delta', label: 'Add or remove' },
                      { value: 'set', label: 'Set exact level' },
                    ]}
                  />
                  <TextField label="Amount" name="amount" type="number" required hint={`Currently ${selected.inventory} on hand.`} />
                  <SelectField
                    label="Reason"
                    name="reason"
                    defaultValue="MANUAL"
                    options={[
                      { value: 'MANUAL', label: 'Manual adjustment' },
                      { value: 'RECEIVED', label: 'Received from supplier' },
                      { value: 'DAMAGED', label: 'Damaged or lost' },
                      { value: 'RETURNED', label: 'Returned to stock' },
                      { value: 'CORRECTION', label: 'Count correction' },
                    ]}
                  />
                  <TextArea label="Note" name="note" rows={2} />
                </AdminForm>

                <div className="space-y-3 border-t border-[var(--admin-line)] pt-3">
                  <AdminForm action={setIncoming} key={`incoming-${selected.id}`}>
                    <input type="hidden" name="productId" value={selected.id} />
                    <TextField label="Incoming stock" name="incomingStock" type="number" min="0" defaultValue={selected.incomingStock} hint="Ordered from a supplier, not yet received." />
                  </AdminForm>

                  <AdminForm action={setLowStockThreshold} key={`threshold-${selected.id}`}>
                    <input type="hidden" name="productId" value={selected.id} />
                    <TextField label="Low-stock threshold" name="lowStockAt" type="number" min="0" defaultValue={selected.lowStockAt} />
                  </AdminForm>

                  {selected.reservedStock > 0 && (
                    <RowAction
                      action={releaseReserved}
                      id={selected.id}
                      idField="productId"
                      label={`Release ${selected.reservedStock} held units`}
                      confirm="Only do this if the orders holding these units are already settled."
                    />
                  )}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Stock history" description={selected ? selected.name : 'Across all products'}>
            {adjustments.length === 0 ? (
              <p className="text-sm text-[var(--admin-muted)]">No movements recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {adjustments.map((entry) => (
                  <li key={entry.id}>
                    <span className={entry.delta < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-ok)]'}>
                      {entry.delta > 0 ? '+' : ''}
                      {entry.delta}
                    </span>{' '}
                    <span className="text-[var(--admin-muted)]">→ {entry.resulting}</span>
                    {!params.product && entry.product && <span className="block text-xs">{entry.product.name}</span>}
                    <span className="block text-xs text-[var(--admin-muted)]">
                      {entry.reason.toLowerCase()} · {entry.actor} · {timeAgo(entry.createdAt)}
                      {entry.note && ` · ${entry.note}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
