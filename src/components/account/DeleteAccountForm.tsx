'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { deleteAccount, type DeleteState } from '@/actions/account'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn btn-outline w-full border-rose-300 text-rose-700">
      {pending ? 'Deleting…' : 'Delete my account'}
    </button>
  )
}

/**
 * Folded into a `<details>` — native disclosure, no state, and the destructive
 * button is never the thing your thumb lands on while editing your name.
 */
export function DeleteAccountForm() {
  const [state, action] = useActionState<DeleteState, FormData>(deleteAccount, {})

  return (
    <details className="mt-10 border-t border-line pt-6">
      <summary className="cursor-pointer text-sm text-plum-500">Delete your account</summary>

      <form action={action} className="mt-5 space-y-5">
        <p className="border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          This removes your account, saved addresses, wishlist, and any store credit. It cannot be undone. Past orders
          are kept for our records with your account detached from them.
        </p>

        <div>
          <label htmlFor="delete-password" className="mb-1.5 block text-sm">
            Your password
          </label>
          <input
            id="delete-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="delete-confirm" className="mb-1.5 block text-sm">
            Type DELETE to confirm
          </label>
          <input id="delete-confirm" name="confirm" required autoComplete="off" className="field" />
        </div>

        {state.error && (
          <p role="alert" className="border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {state.error}
          </p>
        )}

        <Submit />
      </form>
    </details>
  )
}
