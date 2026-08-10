import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { formatUSD } from '@/lib/money'
import { savePromotion, togglePromotion, deletePromotion } from '@/actions/admin/promotions'
import { PageHeader, Panel, Badge, EmptyState, StatCard, formatDate } from '@/components/admin/ui'
import { AdminForm, TextField, TextArea, SelectField, Toggle, CheckboxList } from '@/components/admin/forms'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Promotions' }

const KINDS = [
  { value: 'CODE', label: 'Coupon code' },
  { value: 'AUTOMATIC', label: 'Automatic discount' },
  { value: 'FLASH_SALE', label: 'Flash sale' },
  { value: 'BUNDLE', label: 'Bundle' },
  { value: 'GIFT_CARD', label: 'Gift card' },
  { value: 'REFERRAL', label: 'Referral campaign' },
]

export default async function AdminPromotions({ searchParams }: { searchParams: Promise<{ edit?: string; kind?: string }> }) {
  await requirePagePermission('promotions.read')
  const params = await searchParams
  const mayWrite = await hasPermission('promotions.write')
  const mayDelete = await hasPermission('promotions.delete')

  const [promotions, categories] = await Promise.all([
    db.coupon.findMany({
      where: params.kind ? { kind: params.kind as 'CODE' } : {},
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    db.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const editing = params.edit ? promotions.find((promotion) => promotion.id === params.edit) : null
  const now = new Date()
  const live = promotions.filter(
    (promotion) => promotion.active && (!promotion.expiresAt || promotion.expiresAt > now) && (!promotion.startsAt || promotion.startsAt <= now),
  )
  const redeemed = promotions.reduce((sum, promotion) => sum + promotion.usedCount, 0)

  return (
    <>
      <PageHeader
        title="Promotions"
        description="Coupons, automatic discounts, flash sales, bundles, gift cards, and referral campaigns share one record type — they differ only in which fields they use."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Live right now" value={String(live.length)} />
        <StatCard label="Total defined" value={String(promotions.length)} />
        <StatCard label="Redemptions" value={String(redeemed)} />
      </div>

      <nav aria-label="Filter by kind" className="admin-scroll my-3 flex gap-1.5 text-xs">
        <Link href="/admin/promotions" className={`admin-btn ${!params.kind ? 'admin-btn-primary' : 'admin-btn-ghost'}`}>
          All
        </Link>
        {KINDS.map((kind) => (
          <Link
            key={kind.value}
            href={`/admin/promotions?kind=${kind.value}`}
            className={`admin-btn ${params.kind === kind.value ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
          >
            {kind.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Panel bodyClassName="p-0">
          {promotions.length === 0 ? (
            <EmptyState title="No promotions yet" description="Create the first one on the right." />
          ) : (
            <div className="admin-scroll">
              <table className="admin-table w-full min-w-[48rem]">
                <thead className="border-b border-[var(--admin-line)]">
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Kind</th>
                    <th scope="col">Discount</th>
                    <th scope="col">Window</th>
                    <th scope="col" className="text-right">
                      Used
                    </th>
                    <th scope="col">State</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-line)]">
                  {promotions.map((promotion) => {
                    const expired = promotion.expiresAt !== null && promotion.expiresAt <= now
                    const pending = promotion.startsAt !== null && promotion.startsAt > now
                    return (
                      <tr key={promotion.id}>
                        <td>
                          <code className="font-medium">{promotion.code}</code>
                          <span className="block text-xs text-[var(--admin-muted)]">{promotion.name}</span>
                        </td>
                        <td className="text-xs text-[var(--admin-muted)]">{promotion.kind.replace('_', ' ').toLowerCase()}</td>
                        <td className="tabular-nums">
                          {promotion.percentOff
                            ? `${promotion.percentOff}%`
                            : promotion.amountOffCents
                              ? formatUSD(promotion.amountOffCents)
                              : promotion.balanceCents
                                ? `${formatUSD(promotion.balanceCents)} balance`
                                : '—'}
                          {promotion.minSpendCents && (
                            <span className="block text-xs text-[var(--admin-muted)]">min {formatUSD(promotion.minSpendCents)}</span>
                          )}
                        </td>
                        <td className="text-xs text-[var(--admin-muted)]">
                          {promotion.startsAt || promotion.expiresAt
                            ? `${formatDate(promotion.startsAt)} → ${formatDate(promotion.expiresAt)}`
                            : 'No limit'}
                        </td>
                        <td className="text-right tabular-nums">
                          {promotion.usedCount}
                          {promotion.usageLimit ? ` / ${promotion.usageLimit}` : ''}
                        </td>
                        <td>
                          <Badge tone={!promotion.active ? 'neutral' : expired ? 'danger' : pending ? 'warn' : 'ok'}>
                            {!promotion.active ? 'Paused' : expired ? 'Expired' : pending ? 'Scheduled' : 'Live'}
                          </Badge>
                        </td>
                        <td className="space-x-2 whitespace-nowrap text-right text-xs">
                          <Link href={`/admin/promotions?edit=${promotion.id}`} className="text-[var(--admin-accent)]">
                            Edit
                          </Link>
                          {mayWrite && <RowAction action={togglePromotion} id={promotion.id} label={promotion.active ? 'Pause' : 'Resume'} />}
                          {mayDelete && (
                            <RowAction action={deletePromotion} id={promotion.id} label="Delete" variant="danger" confirm={`Delete ${promotion.code}?`} />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title={editing ? `Edit ${editing.code}` : 'New promotion'}>
          {mayWrite ? (
            <AdminForm action={savePromotion} key={editing?.id ?? 'new'}>
              {editing && <input type="hidden" name="id" value={editing.id} />}
              <TextField label="Name" name="name" defaultValue={editing?.name} required />
              <SelectField label="Kind" name="kind" defaultValue={editing?.kind ?? 'CODE'} options={KINDS} />
              <TextField label="Code" name="code" defaultValue={editing?.code} hint="Leave blank for automatic discounts and gift cards — one is generated." />
              <TextArea label="Description" name="description" rows={2} defaultValue={editing?.description} hint="Internal only." />

              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Percent off" name="percentOff" type="number" min="1" max="90" defaultValue={editing?.percentOff ?? ''} />
                <TextField label="Amount off (USD)" name="amountOff" type="number" step="0.01" min="0" defaultValue={editing?.amountOffCents ? (editing.amountOffCents / 100).toFixed(2) : ''} />
              </div>
              <p className="text-xs text-[var(--admin-muted)]">Set one of the two, not both.</p>

              <TextField label="Gift card balance (USD)" name="balance" type="number" step="0.01" min="0" defaultValue={editing?.balanceCents ? (editing.balanceCents / 100).toFixed(2) : ''} hint="Gift cards only." />

              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Starts at" name="startsAt" type="datetime-local" defaultValue={editing?.startsAt?.toISOString().slice(0, 16) ?? ''} />
                <TextField label="Expires at" name="expiresAt" type="datetime-local" defaultValue={editing?.expiresAt?.toISOString().slice(0, 16) ?? ''} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Minimum spend (USD)" name="minSpend" type="number" step="0.01" min="0" defaultValue={editing?.minSpendCents ? (editing.minSpendCents / 100).toFixed(2) : ''} />
                <TextField label="Total usage limit" name="usageLimit" type="number" min="1" defaultValue={editing?.usageLimit ?? ''} />
              </div>
              <TextField label="Per-customer limit" name="perCustomerLimit" type="number" min="1" defaultValue={editing?.perCustomerLimit ?? ''} />

              <CheckboxList
                legend="Restrict to categories (leave empty for the whole cart)"
                name="categoryIds"
                options={categories.map((category) => ({ value: category.id, label: category.name }))}
                selected={((editing?.appliesTo as { categoryIds?: string[] } | null)?.categoryIds ?? []) as string[]}
              />

              <Toggle label="Active" name="active" defaultChecked={editing ? editing.active : true} />
              {editing && (
                <Link href="/admin/promotions" className="block text-xs text-[var(--admin-accent)]">
                  Cancel and start a new one
                </Link>
              )}
            </AdminForm>
          ) : (
            <p className="text-sm text-[var(--admin-muted)]">You have read-only access to promotions.</p>
          )}
        </Panel>
      </div>

      <Panel title="Where these apply" className="mt-4">
        <p className="text-sm text-[var(--admin-muted)]">
          Checkout re-prices every line from the database, so a promotion only ever discounts what the catalog says it
          costs. Redemption counting lives in checkout — until a code is applied there, <code>usedCount</code> stays at
          zero and these records are definitions rather than history.
        </p>
      </Panel>
    </>
  )
}
