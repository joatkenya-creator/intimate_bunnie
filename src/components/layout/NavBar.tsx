'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useCart } from '@/components/cart/CartProvider'
import { SearchSuggest } from '@/components/product/SearchSuggest'
import { BagIcon, BunnieMark, CloseIcon, HeartIcon, MenuIcon, SearchIcon, UserIcon } from '@/components/ui/icons'

export type NavCategory = { slug: string; name: string; children: { slug: string; name: string }[] }

export function NavBar({ categories, signedIn }: { categories: NavCategory[]; signedIn: boolean }) {
  const { count, setOpen } = useCart()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <div className="flex h-16 items-center justify-between gap-6 lg:h-20">
        <button
          onClick={() => setMenuOpen(true)}
          className="p-1 text-plum-700 lg:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          <MenuIcon className="h-6 w-6" />
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2 lg:min-w-56" aria-label="Intimate Bunnie home">
          <BunnieMark priority className="h-11 w-11 lg:h-14 lg:w-14" />
          <span className="font-display whitespace-nowrap text-2xl tracking-tight lg:text-3xl">
            Intimate <span className="text-rose-500">Bunnie</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center justify-center gap-7 lg:flex">
          {categories.map((cat) => (
            <div key={cat.slug} className="group relative">
              <Link
                href={`/shop/${cat.slug}`}
                className="py-6 text-[0.8125rem] uppercase tracking-[0.08em] text-plum-700 hover:text-rose-500"
              >
                {cat.name}
              </Link>
              {cat.children.length > 0 && (
                <div className="invisible absolute left-1/2 top-full z-40 w-56 -translate-x-1/2 border border-line bg-white py-2 opacity-0 shadow-sm transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  {cat.children.map((child) => (
                    <Link
                      key={child.slug}
                      href={`/shop/${child.slug}`}
                      className="block px-4 py-2 text-sm text-plum-700 hover:bg-peach-50 hover:text-rose-500"
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-1 lg:w-56 lg:justify-end">
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="p-2 text-plum-700 hover:text-rose-500"
            aria-label="Search"
            aria-expanded={searchOpen}
          >
            <SearchIcon className="h-5 w-5" />
          </button>
          <Link href="/wishlist" className="hidden p-2 text-plum-700 hover:text-rose-500 sm:block" aria-label="Wishlist">
            <HeartIcon className="h-5 w-5" />
          </Link>
          <Link
            href={signedIn ? '/account' : '/account/login'}
            className="p-2 text-plum-700 hover:text-rose-500"
            aria-label={signedIn ? 'Your account' : 'Sign in'}
          >
            <UserIcon className="h-5 w-5" />
          </Link>
          <button
            onClick={() => setOpen(true)}
            className="relative p-2 text-plum-700 hover:text-rose-500"
            aria-label={`Bag, ${count} item${count === 1 ? '' : 's'}`}
          >
            <BagIcon className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute right-0 top-0 min-w-4 rounded-full bg-rose-500 px-1 text-[0.625rem] font-medium leading-4 text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-line py-3">
          <SearchSuggest
            autoFocus
            placeholder="Search lingerie, vibrators, oils…"
            onNavigate={() => {
              setSearchOpen(false)
              setMenuOpen(false)
            }}
          />
        </div>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-plum-900/40" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[80%] max-w-xs overflow-y-auto bg-cream">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <span className="font-display text-lg">Menu</span>
              <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-1 text-plum-500">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Mobile" className="px-5 py-4">
              <Link href="/shop" onClick={() => setMenuOpen(false)} className="block py-2 text-sm uppercase tracking-wide">
                Shop all
              </Link>
              {categories.map((cat) => (
                <div key={cat.slug} className="border-t border-line py-2">
                  <Link
                    href={`/shop/${cat.slug}`}
                    onClick={() => setMenuOpen(false)}
                    className="block py-1 text-sm uppercase tracking-wide"
                  >
                    {cat.name}
                  </Link>
                  {cat.children.map((child) => (
                    <Link
                      key={child.slug}
                      href={`/shop/${child.slug}`}
                      onClick={() => setMenuOpen(false)}
                      className="block py-1.5 pl-3 text-sm text-plum-500"
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              ))}
              <Link
                href="/wishlist"
                onClick={() => setMenuOpen(false)}
                className="mt-2 block border-t border-line py-3 text-sm uppercase tracking-wide"
              >
                Wishlist
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
