import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { formatUSD } from '@/lib/money'
import { PageHeader, Panel, Badge, toneFor, EmptyState, StatCard, formatDate } from '@/components/admin/ui'
import { ReturnDecisionForm } from '@/components/admin/ReturnDecisionForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Returns' }

export default async function AdminReturnsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePagePermission('returns.read')
  const { status } = await searchParams
  const mayWrite = await hasPermission('returns.write')

  const where = status && ['REQUESTED', 'APPROVED', 'DENIED'].includes(status)
    ? { status: status as 'REQUESTED' | 'APPROVED' | 'DENIED' }
    : {}

  const [returns, counts, refunded] = await Promise.all([
    db.return.findMany({
      where,
      // Open requests first, then the resolved ones for reference.
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: {
        number: true,
        status: true,
        reason: true,
        refundCents: true,
        resolutionNote: true,
        createdAt: true,
        resolvedAt: true,
        order: { select: { number: true, email: true } },
        items: { select: { id: true, quantity: true, orderItem: { select: { name: true, unitCents: true } } } },
      },
    }),
    db.return.groupBy({ by: ['status'], _count: true }),
    db.return.aggregate({ _sum: { refundCents: true }, where: { status: 'APPROVED' } }),
  ])

  const byStatus = Object.fromEntries(counts.map((row) => [row.status, row._count]))

  return (
    <>
      <PageHeader
        title="Returns"
        description="Approving emails the customer their refund amount. Denying does not — write to them yourself."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting a decision" value={String(byStatus.REQUESTED ?? 0)} href="/admin/returns?status=REQUESTED" />
        <StatCard label="Approved" value={String(byStatus.APPROVED ?? 0)} href="/admin/returns?status=APPROVED" />
        <StatCard label="Denied" value={String(byStatus.DENIED ?? 0)} href="/admin/returns?status=DENIED" />
        <StatCard label="Refunded to date" value={formatUSD(refunded._sum.refundCents ?? 0)} />
      </div>

      <nav aria-label="Filter by status" className="my-3 flex gap-1.5 text-xs">
        <Link href="/admin/returns" className={`admin-btn ${!status ? 'admin-btn-primary' : 'admin-btn-ghost'}`}>
          All
        </Link>
        {['REQUESTED', 'APPROVED', 'DENIED'].map((option) => (
          <Link
            key={option}
            href={`/admin/returns?status=${option}`}
            className={`admin-btn ${status === option ? 'admin-btn-primary' : 'admin-btn-ghost'}`}
          >
            {option}
          </Link>
        ))}
      </nav>

      {returns.length === 0 ? (
        <Panel>
          <EmptyState title="No return requests" description="Nothing to decide right now." />
        </Panel>
      ) : (
        <ul className="space-y-3">
          {returns.map((request) => {
            const requested = request.items.reduce((sum, item) => sum + item.orderItem.unitCents * item.quantity, 0)
            return (
              <li key={request.number}>
                <Panel
                  title={request.number}
                  description={`${request.order.email} · requested ${formatDate(request.createdAt)}`}
                  actions={
                    <>
                      <Badge tone={toneFor(request.status)}>{request.status}</Badge>
                      <Link href={`/admin/orders/${request.order.number}`} className="text-xs text-[var(--admin-accent)]">
                        {request.order.number}
                      </Link>
                    </>
                  }
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
                    <div>
                      <ul className="text-sm">
                        {request.items.map((item) => (
                          <li key={item.id} className="flex justify-between gap-3 py-0.5">
                            <span>
                              {item.orderItem.name} × {item.quantity}
                            </span>
                            <span className="tabular-nums text-[var(--admin-muted)]">
                              {formatUSD(item.orderItem.unitCents * item.quantity)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-sm text-[var(--admin-muted)]">{request.reason}</p>
                      {request.resolutionNote && (
                        <p className="mt-2 text-sm">
                          <span className="text-[var(--admin-muted)]">Resolution: </span>
                          {request.resolutionNote}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="text-[var(--admin-muted)]">
                          {request.status === 'REQUESTED' ? 'Would refund' : 'Refunded'}:{' '}
                        </span>
                        <strong className="tabular-nums">
                          {formatUSD(request.status === 'REQUESTED' ? requested : request.refundCents)}
                        </strong>
                      </p>
                      {request.status === 'REQUESTED' && mayWrite && <ReturnDecisionForm number={request.number} />}
                      {request.resolvedAt && (
                        <p className="text-xs text-[var(--admin-muted)]">Resolved {formatDate(request.resolvedAt)}</p>
                      )}
                    </div>
                  </div>
                </Panel>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
