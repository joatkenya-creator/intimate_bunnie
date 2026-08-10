import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { logout } from '@/actions/auth'
import { db } from '@/lib/db'
import { formatUSD } from '@/lib/money'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = pageMetadata({
  title: 'Your account',
  description: 'Manage your Intimate Bunnie orders and details.',
  path: '/account',
  noindex: true,
})

export default async function AccountPage() {
  const user = await currentUser().catch(() => null)
  if (!user) redirect('/account/login')

  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { number: true, status: true, totalCents: true, createdAt: true },
  })

  return (
    <div className="container-ib max-w-3xl py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Your account</p>
          <h1 className="mt-2 text-3xl">Hello{user.name ? `, ${user.name}` : ''}</h1>
          <p className="mt-1.5 text-sm text-plum-500">{user.email}</p>
        </div>
        <form action={logout}>
          <button type="submit" className="btn btn-outline">
            Sign out
          </button>
        </form>
      </div>

      {user.role === 'ADMIN' && (
        <Link href="/admin" className="mt-8 block border border-line bg-peach-50 px-5 py-4 hover:border-peach-400">
          <p className="text-sm font-medium">Admin dashboard →</p>
          <p className="mt-0.5 text-xs text-plum-500">Products, orders, and inventory.</p>
        </Link>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between border-b border-line pb-3">
          <h2 className="text-xl">Recent orders</h2>
          <Link href="/account/orders" className="text-xs uppercase tracking-[0.1em] link-underline">
            All orders
          </Link>
        </div>

        {orders.length === 0 ? (
          <p className="py-8 text-sm text-plum-500">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((order) => (
              <li key={order.number} className="flex items-center justify-between gap-4 py-4 text-sm">
                <div>
                  <p className="font-medium">{order.number}</p>
                  <p className="text-xs text-plum-500">{order.createdAt.toLocaleDateString('en-US')}</p>
                </div>
                <span className="text-xs uppercase tracking-wider text-plum-500">{order.status}</span>
                <span>{formatUSD(order.totalCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <Link href="/account/settings" className="border border-line px-5 py-4 hover:border-peach-400">
          <p className="text-sm font-medium">Your details</p>
          <p className="mt-0.5 text-xs text-plum-500">Name, email, and password.</p>
        </Link>
        <Link href="/wishlist" className="border border-line px-5 py-4 hover:border-peach-400">
          <p className="text-sm font-medium">Wishlist</p>
          <p className="mt-0.5 text-xs text-plum-500">Pieces you saved for later.</p>
        </Link>
        <Link href="/shop" className="border border-line px-5 py-4 hover:border-peach-400">
          <p className="text-sm font-medium">Keep shopping</p>
          <p className="mt-0.5 text-xs text-plum-500">New arrivals every week.</p>
        </Link>
      </section>
    </div>
  )
}
