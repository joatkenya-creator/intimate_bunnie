'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { requestPasswordReset, resetPassword, type AuthState } from '@/actions/auth'

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full">
      {pending ? 'One moment…' : label}
    </button>
  )
}

function Error({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {message}
    </p>
  )
}

export function ForgotForm() {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, {})

  // Confirmed the same way whether or not that address has an account.
  if (state.sent) {
    return (
      <div className="mt-8 border border-line bg-peach-50 px-5 py-4">
        <p className="text-sm">If that address has an account, a reset link is on its way.</p>
        <p className="mt-1.5 text-xs text-plum-500">It expires in an hour. Check spam if it has not arrived.</p>
      </div>
    )
  }

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>

      <Error message={state.error} />
      <Submit label="Send reset link" />

      <p className="text-center text-sm text-plum-500">
        <Link href="/account/login" className="link-underline text-plum-900">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<AuthState, FormData>(resetPassword, {})

  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="field"
        />
        <p className="mt-1.5 text-xs text-plum-500">At least 8 characters.</p>
      </div>

      <Error message={state.error} />
      <Submit label="Save new password" />

      <p className="text-center text-sm text-plum-500">
        <Link href="/account/forgot" className="link-underline text-plum-900">
          Request a new link
        </Link>
      </p>
    </form>
  )
}
