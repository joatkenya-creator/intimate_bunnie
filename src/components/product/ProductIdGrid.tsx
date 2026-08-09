'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatUSD } from '@/lib/money'
import { imageUrl, PLACEHOLDER_IMAGE } from '@/services/media'

export type FetchedCard = {
  id: string
  slug: string
  name: string
  priceCents: number
  category: { name: string }
  media: { url: string }[]
}

/**
 * Renders products from a list of IDs held in localStorage. Client-side by
 * necessity — the server can't read localStorage — but the payload is a single
 * POST for at most 12 cards.
 */
export function ProductIdGrid({ ids, emptyMessage }: { ids: string[]; emptyMessage: string }) {
  const [products, setProducts] = useState<FetchedCard[] | null>(null)

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([])
      return
    }
    const controller = new AbortController()
    fetch('/api/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ids.slice(0, 12) }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((data: { products: FetchedCard[] }) => {
        // Preserve the caller's ordering (most recent first).
        const order = new Map(ids.map((id, i) => [id, i]))
        setProducts(data.products.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)))
      })
      .catch(() => setProducts([]))
    return () => controller.abort()
  }, [ids])

  if (products === null) {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[4/5] bg-shell" />
            <div className="mt-3 h-3 w-2/3 bg-shell" />
            <div className="mt-2 h-3 w-1/3 bg-shell" />
          </div>
        ))}
      </div>
    )
  }

  if (products.length === 0) return <p className="text-sm text-plum-500">{emptyMessage}</p>

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 lg:grid-cols-4">
      {products.map((p) => (
        <article key={p.id} className="group relative">
          <div className="aspect-[4/5] overflow-hidden bg-shell">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.media[0] ? imageUrl(p.media[0].url, { width: 640 }) : PLACEHOLDER_IMAGE}
              alt=""
              width={640}
              height={800}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="eyebrow mt-3">{p.category.name}</p>
          <h3 className="mt-1 text-[0.9375rem] font-medium leading-snug">
            <Link href={`/product/${p.slug}`} className="after:absolute after:inset-0 hover:text-rose-500">
              {p.name}
            </Link>
          </h3>
          <p className="mt-1.5 text-sm font-medium">{formatUSD(p.priceCents)}</p>
        </article>
      ))}
    </div>
  )
}
