'use client'

import { useEffect, useState } from 'react'

// Shown once, straight after register() redirects to /account?registered=1.
// It is the only thing telling a new account to go and click the confirmation
// link, so it does not time out — it waits to be dismissed.
export function RegisteredNotice() {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    // Drop the flag so a refresh, a back-navigation or a shared URL does not
    // announce the signup a second time.
    window.history.replaceState(null, '', window.location.pathname)

    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 max-w-sm border border-line bg-white p-5 shadow-[0_4px_24px_rgba(43,26,34,0.16)] sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-rose-700">Account created!</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Dismiss notification"
          className="-mt-1 -mr-1 px-1 text-lg leading-none text-plum-300 hover:text-plum-900"
        >
          &times;
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-plum-700">
        Check your email and click the confirmation link to activate your account.
      </p>
      <p className="mt-2 text-xs text-plum-500">Didn&rsquo;t receive it? Check your spam folder.</p>
    </div>
  )
}
