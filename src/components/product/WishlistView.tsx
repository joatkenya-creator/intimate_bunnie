'use client'

import { useIdList } from '@/hooks/useIdList'
import { ProductIdGrid } from './ProductIdGrid'
import { WISHLIST_KEY } from './WishlistButton'

export function WishlistView() {
  const { ids, ready } = useIdList(WISHLIST_KEY)
  if (!ready) return <p className="text-sm text-plum-500">Loading…</p>
  return <ProductIdGrid ids={ids} emptyMessage="Nothing saved yet. Tap the heart on any product to keep it here." />
}
