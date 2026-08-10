'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { login, register, type AuthState } from '@/actions/auth'

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full">
      {pending ? 'One moment…' : label}
    </button>
  )
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const [state, action] = useActionState<AuthState, FormData>(isRegister ? register : login, {})
  // Set when a guard bounced someone here — admin routes send ?next=/admin.
  const params = useSearchParams()
  const next = params.get('next') ?? ''

  return (
    <form action={action} className="mt-8 space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      {params.get('timeout') && (
        <p role="status" className="border border-peach-300 bg-peach-50 px-3 py-2 text-sm text-plum-700">
          Your admin session timed out. Sign in again to continue.
        </p>
      )}

      {isRegister && (
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm">
            Name <span className="text-plum-300">(optional)</span>
          </label>
          <input id="name" name="name" autoComplete="name" className="field" />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm">
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          className="field"
        />
        {isRegister ? (
          <p className="mt-1.5 text-xs text-plum-500">At least 8 characters.</p>
        ) : (
          <p className="mt-1.5 text-xs">
            <Link href="/account/forgot" className="link-underline text-plum-500">
              Forgot your password?
            </Link>
          </p>
        )}
      </div>

      {state.error && (
        <p role="alert" className="border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      )}

      <Submit label={isRegister ? 'Create account' : 'Sign in'} />

      <p className="text-center text-sm text-plum-500">
        {isRegister ? (
          <>
            Already have an account?{' '}
            <Link href="/account/login" className="link-underline text-plum-900">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/account/register" className="link-underline text-plum-900">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  )
}
