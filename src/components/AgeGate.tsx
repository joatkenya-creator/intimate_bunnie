'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

const KEY = 'ib_age_ok'

// Adult retail requires an age affirmation before content is shown. Rendered
// client-side after mount so the page itself stays static and cacheable.
export function AgeGate() {
  const [confirmed, setConfirmed] = useState(true)

  useEffect(() => {
    setConfirmed(localStorage.getItem(KEY) === '1')
  }, [])

  useEffect(() => {
    document.body.style.overflow = confirmed ? '' : 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [confirmed])

  if (confirmed) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-plum-900/80 px-5" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="w-full max-w-md overflow-hidden bg-cream px-7 py-9 text-center">
        <Image
          src="/brand-banner.webp"
          alt=""
          width={1600}
          height={900}
          className="-mx-7 -mt-9 w-[calc(100%+3.5rem)] max-w-none"
        />
        <h1 id="age-gate-title" className="mt-6 text-2xl">
          Are you 18 or older?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-plum-500">
          Intimate Bunnie sells intimate products intended for adults. Please confirm your age to continue.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <button
            className="btn btn-primary"
            onClick={() => {
              localStorage.setItem(KEY, '1')
              setConfirmed(true)
            }}
          >
            Yes, I&apos;m 18 or older
          </button>
          <a href="https://www.google.com" className="btn btn-outline">
            No, take me away
          </a>
        </div>
        <p className="mt-6 text-xs text-plum-300">Every order ships in unbranded packaging.</p>
      </div>
    </div>
  )
}
