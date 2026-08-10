'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AdminNavGroup } from '@/config/admin-nav'
import type { NavBadges } from '@/server/admin'

// The chrome. Everything stateful about the admin lives here — sidebar collapse,
// theme, the command palette, and the keyboard map — so every page below stays a
// Server Component.

const COLLAPSE_KEY = 'ib_admin_sidebar'
const THEME_KEY = 'ib_admin_theme'

type ShellProps = {
  nav: AdminNavGroup[]
  badges: NavBadges
  actor: { name: string | null; email: string; roleName: string }
  notifications: { id: string; title: string; body: string | null; link: string | null; level: string; createdAt: string }[]
  children: ReactNode
}

const ICONS: Record<string, string> = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  tag: 'M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9zM8 8h.01',
  bag: 'M4 7h16l-1.2 13.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8ZM9 10V6a3 3 0 0 1 6 0v4',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14V14a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.6 1.6 0 0 0-1.6 1Z',
}

function Icon({ path, className = 'size-4' }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={path} />
    </svg>
  )
}

export function AdminShell({ nav, badges, actor, notifications, children }: ShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [menu, setMenu] = useState<'none' | 'user' | 'bell'>('none')

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1')
    setTheme(document.documentElement.getAttribute('data-admin-theme') === 'dark' ? 'dark' : 'light')
  }, [])

  // Route change closes every transient surface. Without this the palette stays
  // open on top of the page it just navigated to.
  useEffect(() => {
    setMobileOpen(false)
    setPaletteOpen(false)
    setMenu('none')
  }, [pathname])

  const toggleCollapse = useCallback(() => {
    setCollapsed((previous) => {
      localStorage.setItem(COLLAPSE_KEY, previous ? '0' : '1')
      return !previous
    })
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((previous) => {
      const next = previous === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-admin-theme', next)
      localStorage.setItem(THEME_KEY, next)
      return next
    })
  }, [])

  // Shortcut map. `g` then a letter is the Gmail-style pair every operations
  // tool uses; the sequence buffer is a single ref, not a state machine.
  const chord = useRef<string>('')
  useEffect(() => {
    const shortcuts: Record<string, string> = {
      d: '/admin',
      p: '/admin/products',
      o: '/admin/orders',
      c: '/admin/customers',
      i: '/admin/inventory',
      m: '/admin/media',
      r: '/admin/reports',
      s: '/admin/settings',
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
        setMenu('none')
        return
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return

      if (chord.current === 'g' && shortcuts[event.key]) {
        event.preventDefault()
        router.push(shortcuts[event.key])
        chord.current = ''
        return
      }
      chord.current = event.key === 'g' ? 'g' : ''
      if (event.key === '?') setPaletteOpen(true)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [router])

  const unread = notifications.length

  return (
    <div className="admin min-h-screen">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-[var(--admin-ink)] focus:px-3 focus:py-2 focus:text-[var(--admin-bg)]">
        Skip to content
      </a>

      <div className="flex min-h-screen">
        <Sidebar
          nav={nav}
          badges={badges}
          pathname={pathname}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="no-print sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--admin-line)] bg-[var(--admin-panel)] px-3 py-2">
            <button type="button" onClick={() => setMobileOpen(true)} className="admin-btn admin-btn-ghost lg:hidden" aria-label="Open navigation">
              ☰
            </button>
            <button type="button" onClick={toggleCollapse} className="admin-btn admin-btn-ghost hidden lg:inline-flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={collapsed}>
              {collapsed ? '»' : '«'}
            </button>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="admin-field flex max-w-md flex-1 items-center gap-2 text-left text-[var(--admin-faint)]"
            >
              <span className="truncate">Search products, orders, customers…</span>
              <kbd className="ml-auto shrink-0 rounded border border-[var(--admin-line)] px-1.5 py-0.5 text-[0.625rem]">⌘K</kbd>
            </button>

            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={toggleTheme} className="admin-btn admin-btn-ghost" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
                {theme === 'dark' ? '☀' : '☾'}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenu((m) => (m === 'bell' ? 'none' : 'bell'))}
                  className="admin-btn admin-btn-ghost"
                  aria-expanded={menu === 'bell'}
                  aria-haspopup="menu"
                >
                  <span aria-hidden>🔔</span>
                  <span className="sr-only">Notifications</span>
                  {unread > 0 && (
                    <span className="rounded-full bg-[var(--color-rose-500)] px-1.5 text-[0.625rem] font-bold text-white">{unread}</span>
                  )}
                </button>
                {menu === 'bell' && (
                  <div role="menu" className="admin-panel absolute right-0 z-40 mt-1 w-80 p-2 shadow-lg">
                    {notifications.length === 0 ? (
                      <p className="px-2 py-6 text-center text-sm text-[var(--admin-muted)]">Nothing new.</p>
                    ) : (
                      <ul className="max-h-96 space-y-1 overflow-y-auto">
                        {notifications.map((item) => (
                          <li key={item.id}>
                            <Link href={item.link ?? '/admin/notifications'} className="block rounded px-2 py-1.5 hover:bg-[var(--admin-raised)]">
                              <p className="text-sm font-medium">{item.title}</p>
                              {item.body && <p className="truncate text-xs text-[var(--admin-muted)]">{item.body}</p>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link href="/admin/notifications" className="mt-1 block rounded px-2 py-1.5 text-xs text-[var(--admin-accent)] hover:bg-[var(--admin-raised)]">
                      All notifications →
                    </Link>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenu((m) => (m === 'user' ? 'none' : 'user'))}
                  className="admin-btn admin-btn-ghost"
                  aria-expanded={menu === 'user'}
                  aria-haspopup="menu"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-[var(--admin-accent-soft)] text-[0.625rem] font-bold text-[var(--color-rose-600)]">
                    {(actor.name ?? actor.email).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-32 truncate sm:inline">{actor.name ?? actor.email}</span>
                </button>
                {menu === 'user' && (
                  <div role="menu" className="admin-panel absolute right-0 z-40 mt-1 w-60 p-2 text-sm shadow-lg">
                    <p className="px-2 py-1 font-medium">{actor.email}</p>
                    <p className="px-2 pb-2 text-xs text-[var(--admin-muted)]">{actor.roleName}</p>
                    <Link href="/account/settings" className="block rounded px-2 py-1.5 hover:bg-[var(--admin-raised)]">
                      Account settings
                    </Link>
                    <Link href="/" className="block rounded px-2 py-1.5 hover:bg-[var(--admin-raised)]">
                      View storefront
                    </Link>
                    <button type="button" onClick={() => setPaletteOpen(true)} className="block w-full rounded px-2 py-1.5 text-left hover:bg-[var(--admin-raised)]">
                      Keyboard shortcuts
                    </button>
                    <form action="/api/admin/signout" method="post">
                      <button type="submit" className="block w-full rounded px-2 py-1.5 text-left text-[var(--color-danger)] hover:bg-[var(--admin-raised)]">
                        Sign out
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main id="admin-main" className="min-w-0 flex-1 p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>

      {paletteOpen && <CommandPalette nav={nav} onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}

function Sidebar({
  nav,
  badges,
  pathname,
  collapsed,
  mobileOpen,
  onClose,
}: {
  nav: AdminNavGroup[]
  badges: NavBadges
  pathname: string
  collapsed: boolean
  mobileOpen: boolean
  onClose: () => void
}) {
  return (
    <>
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-black/40 lg:hidden" aria-label="Close navigation" onClick={onClose} />}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-[var(--admin-line)] bg-[var(--admin-sidebar)] transition-[width,transform] lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'w-16' : 'w-60'}`}
      >
        <div className="flex h-12 items-center gap-2 border-b border-[var(--admin-line)] px-4">
          <span className="grid size-6 shrink-0 place-items-center rounded bg-[var(--color-rose-500)] text-xs font-bold text-white">IB</span>
          {!collapsed && <span className="truncate text-sm font-semibold">Intimate Bunnie</span>}
        </div>

        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2 py-3">
          {nav.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="px-2 pb-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--admin-faint)]">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.match ? pathname.startsWith(item.match) : pathname === item.href
                  const count = item.badge ? badges[item.badge] : 0
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                          active
                            ? 'bg-[var(--admin-accent-soft)] font-semibold text-[var(--color-rose-600)]'
                            : 'text-[var(--admin-muted)] hover:bg-[var(--admin-raised)] hover:text-[var(--admin-ink)]'
                        }`}
                      >
                        <Icon path={ICONS[group.icon]} className="size-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!collapsed && count > 0 && (
                          <span className="ml-auto rounded-full bg-[var(--admin-raised)] px-1.5 text-[0.625rem] font-semibold tabular-nums">
                            {count}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}

type SearchHit = { id: string; label: string; sublabel?: string; href: string; group: string }

function CommandPalette({ nav, onClose }: { nav: AdminNavGroup[]; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<SearchHit[]>([])
  const [cursor, setCursor] = useState(0)

  const routes: SearchHit[] = nav.flatMap((group) =>
    group.items.map((item) => ({ id: item.href, label: item.label, href: item.href, group: group.label })),
  )

  const QUICK: SearchHit[] = [
    { id: 'new-product', label: 'New product', href: '/admin/products/new', group: 'Quick actions' },
    { id: 'new-post', label: 'New blog post', href: '/admin/blog/new', group: 'Quick actions' },
    { id: 'new-page', label: 'New page', href: '/admin/content/new', group: 'Quick actions' },
    { id: 'new-promo', label: 'New promotion', href: '/admin/promotions/new', group: 'Quick actions' },
    { id: 'new-redirect', label: 'Add redirect', href: '/admin/seo/redirects', group: 'Quick actions' },
  ]

  const local = [...routes, ...QUICK].filter((hit) => hit.label.toLowerCase().includes(query.toLowerCase()))
  const results = query.length >= 2 ? [...local, ...remote] : local

  // Records search only above two characters: a one-letter query would ask the
  // database for a third of the catalog.
  useEffect(() => {
    if (query.trim().length < 2) {
      setRemote([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { results: [] }))
        .then((data: { results: SearchHit[] }) => setRemote(data.results ?? []))
        .catch(() => setRemote([]))
    }, 180)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  useEffect(() => setCursor(0), [query])

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (event.key === 'Enter' && results[cursor]) {
      event.preventDefault()
      router.push(results[cursor].href)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div className="admin-panel relative w-full max-w-xl overflow-hidden shadow-2xl">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Jump to a page, product, order, or customer…"
          aria-label="Search the admin"
          className="w-full border-b border-[var(--admin-line)] bg-transparent px-4 py-3 text-sm outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-1">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-[var(--admin-muted)]">No matches.</li>}
          {results.map((hit, index) => (
            <li key={`${hit.group}-${hit.id}`}>
              <Link
                href={hit.href}
                onClick={onClose}
                onMouseEnter={() => setCursor(index)}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm ${index === cursor ? 'bg-[var(--admin-raised)]' : ''}`}
              >
                <span className="truncate">{hit.label}</span>
                {hit.sublabel && <span className="truncate text-xs text-[var(--admin-muted)]">{hit.sublabel}</span>}
                <span className="ml-auto shrink-0 text-[0.625rem] uppercase tracking-wide text-[var(--admin-faint)]">{hit.group}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="border-t border-[var(--admin-line)] px-4 py-2 text-[0.6875rem] text-[var(--admin-muted)]">
          <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>↵</kbd> to open · <kbd>g</kbd> then <kbd>p</kbd>/<kbd>o</kbd>/<kbd>c</kbd>/<kbd>i</kbd>/<kbd>m</kbd>/<kbd>r</kbd>/<kbd>s</kbd> to jump · <kbd>esc</kbd> to close
        </p>
      </div>
    </div>
  )
}
