'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { formatUSD } from '@/lib/money'
import type { Suggestion } from '@/server/search'

// A search box that suggests as you type. Built as an ARIA combobox rather than
// a div with a list under it, so a screen reader announces the option count and
// the active option, and arrow keys behave the way they do everywhere else.

export function SearchSuggest({
  defaultValue = '',
  placeholder = 'Search lingerie, vibrators, oils…',
  autoFocus = false,
  className = '',
  onNavigate,
}: {
  defaultValue?: string
  placeholder?: string
  autoFocus?: boolean
  className?: string
  /** Fired when the shopper leaves for a product or the results page — lets a
      containing panel, like the mobile nav, close itself. */
  onNavigate?: () => void
}) {
  const router = useRouter()
  // Ids are generated: the nav search and the one on /search can both be in the
  // document at once, and two elements sharing an id breaks label association.
  const listId = useId()
  const inputId = useId()
  const [term, setTerm] = useState(defaultValue)
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const box = useRef<HTMLDivElement>(null)
  // Only the latest response may render: a slow request for "vib" must not
  // overwrite the results for "vibrator" typed three keystrokes later.
  const latest = useRef(0)

  useEffect(() => {
    const trimmed = term.trim()
    if (trimmed.length < 2) {
      setItems([])
      setOpen(false)
      return
    }

    const ticket = ++latest.current
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { suggestions: [] }))
        .then((data: { suggestions: Suggestion[] }) => {
          if (ticket !== latest.current) return
          setItems(data.suggestions ?? [])
          setOpen((data.suggestions ?? []).length > 0)
          setCursor(-1)
        })
        .catch(() => undefined)
    }, 150)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [term])

  // A click anywhere else closes the list. Pointerdown, not click, so it fires
  // before a link inside the list would be cancelled.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function go(to: string) {
    setOpen(false)
    onNavigate?.()
    router.push(to)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || items.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((c) => (c + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((c) => (c <= 0 ? items.length - 1 : c - 1))
    } else if (event.key === 'Enter' && cursor >= 0) {
      // Only intercept Enter when an option is highlighted; otherwise the form
      // submits and the shopper gets the full results page, as they asked.
      event.preventDefault()
      go(`/product/${items[cursor].slug}`)
    }
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <form
        action="/search"
        role="search"
        onSubmit={() => {
          setOpen(false)
          onNavigate?.()
        }}
        className="flex gap-2"
      >
        <label htmlFor={inputId} className="sr-only">
          Search products
        </label>
        <input
          id={inputId}
          name="q"
          type="search"
          autoFocus={autoFocus}
          autoComplete="off"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(items.length > 0)}
          placeholder={placeholder}
          className="field"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={cursor >= 0 ? `${listId}-${cursor}` : undefined}
        />
        <button type="submit" className="btn btn-primary shrink-0">
          Search
        </button>
      </form>

      {/* Announced politely so a screen reader hears the count without the list
          stealing focus on every keystroke. */}
      <p className="sr-only" role="status" aria-live="polite">
        {open && items.length > 0 ? `${items.length} suggestions available.` : ''}
      </p>

      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Product suggestions"
          className="absolute z-50 mt-1 w-full overflow-hidden border border-line bg-cream shadow-lg"
        >
          {items.map((item, index) => (
            <li
              key={item.slug}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === cursor}
              onMouseEnter={() => setCursor(index)}
              onClick={() => go(`/product/${item.slug}`)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                index === cursor ? 'bg-peach-50' : ''
              }`}
            >
              <span className="size-10 shrink-0 overflow-hidden bg-shell">
                {item.image && (
                  // Plain img: these are thumbnails from a remote host, swapped
                  // on every keystroke, and never the LCP element.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" width={40} height={40} className="size-full object-cover" loading="lazy" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{item.name}</span>
                <span className="block truncate text-xs text-plum-500">{item.categoryName}</span>
              </span>
              <span className="shrink-0 text-sm tabular-nums">{formatUSD(item.priceCents)}</span>
            </li>
          ))}
          <li className="border-t border-line">
            <button
              type="button"
              onClick={() => go(`/search?q=${encodeURIComponent(term.trim())}`)}
              className="w-full px-3 py-2 text-left text-xs uppercase tracking-[0.1em] text-plum-500 hover:text-rose-500"
            >
              See all results for “{term.trim()}”
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
