'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

// Cart lives in localStorage. Guest and signed-in carts are the same object;
// the server re-prices every line at checkout, so a tampered cart cannot
// change what a customer is charged.

export type CartLine = {
  productId: string
  variantId?: string
  slug: string
  name: string
  variantName?: string
  unitCents: number
  image: string
  quantity: number
}

type CartContext = {
  lines: CartLine[]
  count: number
  subtotalCents: number
  isOpen: boolean
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void
  setQuantity: (key: string, quantity: number) => void
  remove: (key: string) => void
  clear: () => void
  setOpen: (open: boolean) => void
}

const STORAGE_KEY = 'ib_cart_v1'
const Ctx = createContext<CartContext | null>(null)

export const lineKey = (line: Pick<CartLine, 'productId' | 'variantId'>) =>
  `${line.productId}:${line.variantId ?? ''}`

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [isOpen, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setLines(JSON.parse(raw) as CartLine[])
    } catch {
      // Corrupt payload — start empty rather than trapping the customer.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines, hydrated])

  const value = useMemo<CartContext>(() => {
    const add: CartContext['add'] = (line, quantity = 1) => {
      setLines((prev) => {
        const key = lineKey(line)
        const existing = prev.find((l) => lineKey(l) === key)
        if (existing) {
          return prev.map((l) => (lineKey(l) === key ? { ...l, quantity: l.quantity + quantity } : l))
        }
        return [...prev, { ...line, quantity }]
      })
      setOpen(true)
    }

    return {
      lines,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotalCents: lines.reduce((n, l) => n + l.unitCents * l.quantity, 0),
      isOpen,
      add,
      setQuantity: (key, quantity) =>
        setLines((prev) =>
          quantity <= 0
            ? prev.filter((l) => lineKey(l) !== key)
            : prev.map((l) => (lineKey(l) === key ? { ...l, quantity: Math.min(quantity, 99) } : l)),
        ),
      remove: (key) => setLines((prev) => prev.filter((l) => lineKey(l) !== key)),
      clear: () => setLines([]),
      setOpen,
    }
  }, [lines, isOpen])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart(): CartContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
