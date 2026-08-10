'use client'

import { useCallback, useEffect, useState } from 'react'

// Wishlist and recently-viewed are both "a capped list of product IDs in
// localStorage", so they share one hook instead of two near-identical stores.
//
// `syncUrl` mirrors the list to the server for signed-in shoppers, which is what
// lets support see a customer's wishlist. It is a beacon, not a fetch: it must
// never delay the click or fail it, and a signed-out visitor's post is simply
// ignored by the route.
export function useIdList(key: string, cap = 60, syncUrl?: string) {
  const [ids, setIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  const sync = useCallback(
    (next: string[]) => {
      if (!syncUrl) return
      try {
        navigator.sendBeacon(syncUrl, new Blob([JSON.stringify({ ids: next })], { type: 'application/json' }))
      } catch {
        /* sync is best effort — localStorage is the source of truth */
      }
    },
    [syncUrl],
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setIds(JSON.parse(raw) as string[])
    } catch {
      /* ignore corrupt payload */
    }
    setReady(true)
  }, [key])

  const write = useCallback(
    (next: string[]) => {
      const capped = next.slice(0, cap)
      setIds(capped)
      localStorage.setItem(key, JSON.stringify(capped))
      sync(capped)
    },
    [key, cap, sync],
  )

  const toggle = useCallback((id: string) => setIds((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
    const capped = next.slice(0, cap)
    localStorage.setItem(key, JSON.stringify(capped))
    sync(capped)
    return capped
  }), [key, cap, sync])

  /** Most-recent-first, no duplicates. */
  const push = useCallback((id: string) => setIds((prev) => {
    const next = [id, ...prev.filter((x) => x !== id)].slice(0, cap)
    localStorage.setItem(key, JSON.stringify(next))
    return next
  }), [key, cap])

  return { ids, ready, toggle, push, write }
}
