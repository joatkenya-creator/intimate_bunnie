'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[admin]', error)
  }, [error])

  return (
    <div className="admin-panel mx-auto max-w-lg p-6 text-center">
      <h1 className="text-lg font-semibold">That screen failed to load</h1>
      <p className="mt-2 text-sm text-[var(--admin-muted)]">
        The error was logged. Nothing was saved, so retrying is safe.
        {error.digest && <span className="mt-1 block text-xs">Reference: {error.digest}</span>}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button type="button" onClick={reset} className="admin-btn admin-btn-primary">
          Try again
        </button>
        <Link href="/admin" className="admin-btn admin-btn-ghost">
          Back to the dashboard
        </Link>
      </div>
    </div>
  )
}
