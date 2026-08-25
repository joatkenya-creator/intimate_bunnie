'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

const KEY = 'ib_age_ok'

// Adult retail requires an age affirmation before content is shown. Rendered
// client-side after mount so the page itself stays static and cacheable.
//
// It is a native <dialog> opened with showModal(), which is where the
// accessibility comes from: the browser moves focus in, traps it, marks the
// rest of the page inert, and puts the element in the top layer. The
// hand-rolled overlay it replaces did none of that — a keyboard or screen
// reader user could tab straight past the gate into the store behind it.
//
// onCancel is preventDefault()ed on purpose: Escape must not dismiss an age
// gate. Affirming is the only way out.
export function AgeGate() {
  const [confirmed, setConfirmed] = useState(true)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    setConfirmed(localStorage.getItem(KEY) === '1')
  }, [])

  useEffect(() => {
    const el = dialog.current
    if (!el || confirmed) return

    if (!el.open) el.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [confirmed])

  if (confirmed) return null

  return (
    <dialog
      ref={dialog}
      aria-labelledby="age-gate-title"
      onCancel={(event) => event.preventDefault()}
      // `m-auto` is not decoration: Tailwind's preflight zeroes every margin,
      // including the `margin: auto` a UA stylesheet uses to centre an open
      // dialog — without it the gate pins itself to the top-left corner.
      className="m-auto max-h-[90vh] w-full max-w-md overflow-y-auto bg-cream p-0 text-plum-900 backdrop:bg-plum-900/80"
    >
      <div className="overflow-hidden px-7 py-9 text-center">
        <Image
          src="/brand-banner.webp"
          alt=""
          width={1600}
          height={900}
          className="-mx-7 -mt-9 w-[calc(100%+3.5rem)] max-w-none"
        />
        <h2 id="age-gate-title" className="mt-6 font-display text-2xl">
          Are you 18 or older?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-plum-500">
          Intimate Bunnie sells intimate products intended for adults. Please confirm your age to continue.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <button
            type="button"
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
    </dialog>
  )
}
