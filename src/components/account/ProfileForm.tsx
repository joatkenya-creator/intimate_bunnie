'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { updateProfile, type ProfileState } from '@/actions/account'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending ? 'Saving…' : 'Save changes'}
    </button>
  )
}

export function ProfileForm({ name, email }: { name: string | null; email: string }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfile, {})

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm">
          Name <span className="text-plum-300">(optional)</span>
        </label>
        <input id="name" name="name" defaultValue={name ?? ''} autoComplete="name" className="field" />
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={email}
          autoComplete="email"
          className="field"
        />
        <p className="mt-1.5 text-xs text-plum-500">
          Change this and we will email the new address to confirm it. Order updates keep going to the old one until you
          do.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p role="status" className="border border-line bg-peach-50 px-3 py-2 text-sm">
          Saved. We emailed you a note about the change.
        </p>
      )}

      <Submit />
    </form>
  )
}
