import Link from 'next/link'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { markNotifications } from '@/actions/admin/notifications'
import { paging, pageCount } from '@/server/admin'
import { PageHeader, Panel, Badge, toneFor, Pagination, EmptyState, Tabs, timeAgo } from '@/components/admin/ui'
import { BulkForm, BulkButton } from '@/components/admin/BulkForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notifications' }

const PER_PAGE = 40
const TYPES = ['ORDER', 'LOW_STOCK', 'REFUND', 'PAYMENT_FAILED', 'CUSTOMER', 'SYSTEM'] as const

export default async function AdminNotifications({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; type?: string; page?: string }>
}) {
  await requirePagePermission('notifications.read')
  const params = await searchParams
  const { page, skip, take } = paging(params.page, PER_PAGE)
  const mayWrite = await hasPermission('notifications.write')

  const where = {
    ...(params.filter === 'unread' ? { readAt: null } : {}),
    ...(params.type && TYPES.includes(params.type as (typeof TYPES)[number]) ? { type: params.type as (typeof TYPES)[number] } : {}),
  }

  const [notifications, total, unread] = await Promise.all([
    db.adminNotification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    db.adminNotification.count({ where }),
    db.adminNotification.count({ where: { readAt: null } }),
  ])

  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][])
  const hrefFor = (next: number) => {
    const clone = new URLSearchParams(query)
    clone.set('page', String(next))
    return `/admin/notifications?${clone}`
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Raised by the store itself: new orders, stock crossing a threshold, refund requests, and system checks."
      />

      <Tabs
        current={params.filter === 'unread' ? '/admin/notifications?filter=unread' : '/admin/notifications'}
        tabs={[
          { href: '/admin/notifications', label: 'All' },
          { href: '/admin/notifications?filter=unread', label: 'Unread', count: unread },
          ...TYPES.map((type) => ({ href: `/admin/notifications?type=${type}`, label: type.replace('_', ' ').toLowerCase() })),
        ]}
      />

      <Panel className="mt-3" bodyClassName="p-0">
        {notifications.length === 0 ? (
          <EmptyState title="Nothing here" description="Notifications appear as the store generates them." />
        ) : (
          <BulkForm
            action={markNotifications}
            noun="notifications"
            actions={
              mayWrite ? (
                <>
                  <BulkButton op="read">Mark read</BulkButton>
                  <BulkButton op="unread">Mark unread</BulkButton>
                  <BulkButton op="all">Mark everything read</BulkButton>
                  <BulkButton op="delete" variant="danger" confirm="Delete the selected notifications?">
                    Delete
                  </BulkButton>
                </>
              ) : (
                <span className="text-xs text-[var(--admin-muted)]">Read-only access</span>
              )
            }
          >
            <ul className="divide-y divide-[var(--admin-line)]">
              {notifications.map((notification) => (
                <li key={notification.id} className={`flex items-start gap-3 px-4 py-3 ${notification.readAt ? 'opacity-60' : ''}`}>
                  <input type="checkbox" name="ids" value={notification.id} aria-label={`Select ${notification.title}`} className="mt-1 size-4 accent-[var(--color-rose-500)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {notification.link ? (
                        <Link href={notification.link} className="hover:text-[var(--admin-accent)]">
                          {notification.title}
                        </Link>
                      ) : (
                        notification.title
                      )}
                    </p>
                    {notification.body && <p className="text-sm text-[var(--admin-muted)]">{notification.body}</p>}
                    <p className="mt-0.5 text-xs text-[var(--admin-faint)]">
                      {notification.type.replace('_', ' ').toLowerCase()} · {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                  <Badge tone={toneFor(notification.level)}>{notification.level}</Badge>
                </li>
              ))}
            </ul>
          </BulkForm>
        )}

        <Pagination page={page} pages={pageCount(total, PER_PAGE)} hrefFor={hrefFor} total={total} noun="notifications" />
      </Panel>
    </>
  )
}
