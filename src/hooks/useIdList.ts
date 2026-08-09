'use client'

import { useCallback, useEffect, useState } from 'react'

// Wishlist and recently-viewed are both "a capped list of product IDs in
// localStorage", so they share one hook instead of two near-identical stores.
export function useIdList(key: string, cap = 60) {
  const [ids, setIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)

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
    },
    [key, cap],
  )

  const toggle = useCallback((id: string) => setIds((prev) => {
    const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
    const capped = next.slice(0, cap)
    localStorage.setItem(key, JSON.stringify(capped))
    return capped
  }), [key, cap])

  /** Most-recent-first, no duplicates. */
  const push = useCallback((id: string) => setIds((prev) => {
    const next = [id, ...prev.filter((x) => x !== id)].slice(0, cap)
    localStorage.setItem(key, JSON.stringify(next))
    return next
  }), [key, cap])

  return { ids, ready, toggle, push, write }
}
