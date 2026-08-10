import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { currentAdmin, can, ADMIN_IDLE_TIMEOUT_SECONDS } from '@/lib/rbac'
import { sessionAgeSeconds } from '@/lib/auth'
import { ADMIN_NAV } from '@/config/admin-nav'
import { navBadges } from '@/server/admin'
import { AdminShell } from '@/components/admin/Shell'
import { Breadcrumbs } from '@/components/admin/Breadcrumbs'

export const dynamic = 'force-dynamic'

// The admin must never be indexed, linked, or previewed anywhere.
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Intimate Bunnie Admin' },
  robots: { index: false, follow: false, nocache: true },
}

// Set before paint so the dark theme never flashes light on load. Inline
// because a stylesheet cannot read localStorage and React runs too late.
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('ib_admin_theme');if(!t||t==='system'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-admin-theme',t)}catch(e){}})()`

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Authorization is server-side and happens before any admin data is read.
  // There is no client-side admin check anywhere to bypass.
  const admin = await currentAdmin()
  if (!admin) redirect('/account/login?next=/admin')

  const age = await sessionAgeSeconds()
  if (age === null || age > ADMIN_IDLE_TIMEOUT_SECONDS) redirect('/account/login?next=/admin&timeout=1')

  // A section nobody can open is never rendered. The permission check on each
  // page is still the real gate — this only stops the nav lying.
  const nav = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(admin.permissions, item.permission)),
  })).filter((group) => group.items.length > 0)

  const [badges, notifications] = await Promise.all([
    navBadges(),
    db.adminNotification.findMany({
      where: { readAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, title: true, body: true, link: true, level: true, createdAt: true },
    }),
  ])

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      <AdminShell
        nav={nav}
        badges={badges}
        actor={{ name: admin.name, email: admin.email, roleName: admin.roleName }}
        notifications={notifications.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
      >
        <Breadcrumbs />
        {children}
      </AdminShell>
    </>
  )
}
