'use client'

import { useIdList } from '@/hooks/useIdList'
import { HeartIcon } from '@/components/ui/icons'

export const WISHLIST_KEY = 'ib_wishlist'

export function WishlistButton({ productId, productName }: { productId: string; productName: string }) {
  // Mirrored to the account when signed in, so support can see what a customer
  // saved. Signed-out shoppers keep a purely local wishlist, as before.
  const { ids, ready, toggle } = useIdList(WISHLIST_KEY, 60, '/api/wishlist')
  const saved = ready && ids.includes(productId)

  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`}
      className="absolute right-2 top-2 z-10 bg-cream/85 p-2 text-plum-700 transition-colors hover:text-rose-500"
    >
      <HeartIcon className="h-4 w-4" filled={saved} />
    </button>
  )
}
