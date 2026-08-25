'use client'

import Link from 'next/link'

// Customers see a message, never a stack trace. The digest is enough to find
// the real error in the deployment's runtime logs.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-ib flex flex-col items-center py-28 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-2 text-3xl">We hit a snag</h1>
      <p className="mt-3 max-w-sm text-sm text-plum-500">
        Nothing was charged. Try again in a moment, or head back to the shop.
      </p>
      <div className="mt-8 flex gap-3">
        <button onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/shop" className="btn btn-outline">
          Back to shop
        </Link>
      </div>
      {error.digest && <p className="mt-8 text-xs text-plum-300">Reference: {error.digest}</p>}
    </div>
  )
}
