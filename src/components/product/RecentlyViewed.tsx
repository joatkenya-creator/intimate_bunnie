'use client'

import { useEffect } from 'react'
import { useIdList } from '@/hooks/useIdList'
import { ProductIdGrid } from './ProductIdGrid'
import { SectionHeading } from '@/components/ui/Section'

export const RECENT_KEY = 'ib_recent'

export function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const { ids, ready } = useIdList(RECENT_KEY, 12)
  const shown = ids.filter((id) => id !== excludeId).slice(0, 4)

  if (!ready || shown.length === 0) return null

  return (
    <section className="container-ib pb-16">
      <SectionHeading eyebrow="Pick up where you left off" title="Recently viewed" />
      <ProductIdGrid ids={shown} emptyMessage="Nothing here yet." />
    </section>
  )
}

/** Records a product view. Renders nothing. */
export function TrackView({ productId }: { productId: string }) {
  const { push, ready } = useIdList(RECENT_KEY, 12)
  useEffect(() => {
    if (ready) push(productId)
  }, [ready, productId, push])
  return null
}
