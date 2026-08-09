import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const nav = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Authorization lives on the server. There is no client-side admin check to
  // bypass, and no admin data is fetched before this gate.
  const user = await currentUser().catch(() => null)
  if (!user) redirect('/account/login')
  if (user.role !== 'ADMIN') redirect('/')

  return (
    <div className="container-ib grid gap-10 py-10 lg:grid-cols-[12rem_1fr]">
      <aside>
        <p className="eyebrow mb-3">Admin</p>
        <nav aria-label="Admin" className="space-y-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="block py-1.5 text-sm text-plum-700 hover:text-rose-500">
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-8 text-xs text-plum-300">Signed in as {user.email}</p>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
