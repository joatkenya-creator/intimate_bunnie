import { query } from '@/lib/sql'
import { currentUser } from '@/lib/auth'
import { getSettings } from '@/server/settings'
import { NavBar, type NavCategory } from './NavBar'

async function getNav(): Promise<NavCategory[]> {
  // The header renders on every route, including /_not-found, which Next
  // prerenders at build time when no database is reachable. A missing nav
  // degrades the chrome; it should never take a page down.
  try {
    // Hidden categories keep their URL but leave the nav — that is what the
    // visibility toggle in the admin means. Children arrive as JSON so the
    // whole nav is one round trip.
    return await query<NavCategory>(
      `SELECT c."slug", c."name",
         COALESCE((
           SELECT json_agg(json_build_object('slug', ch."slug", 'name', ch."name") ORDER BY ch."position")
           FROM "Category" ch WHERE ch."parentId" = c."id" AND ch."visible" = true
         ), '[]'::json) AS children
       FROM "Category" c
       WHERE c."parentId" IS NULL AND c."visible" = true
       ORDER BY c."position" ASC`,
    )
  } catch {
    return []
  }
}

export async function Header() {
  // Read the session first. It touches cookies(), which opts every route into
  // dynamic rendering — so the nav query below never runs during the build,
  // when there is no database to reach.
  const user = await currentUser().catch(() => null)
  const categories = await getNav()
  // Editable from Settings → Branding; falls back to the default copy.
  const branding = await getSettings('branding').catch(() => null)

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur-sm">
      {(branding?.announcementActive ?? true) && (
        <div className="bg-plum-900 py-2 text-center text-[0.6875rem] uppercase tracking-[0.14em] text-peach-100">
          {branding?.announcement || 'Discreet plain packaging · Free U.S. shipping over $59'}
        </div>
      )}
      <div className="container-ib">
        <NavBar categories={categories} signedIn={Boolean(user)} />
      </div>
    </header>
  )
}
