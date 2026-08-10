'use client'

/** The whole PDF story: the browser already has one. */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="admin-btn admin-btn-primary">
      {label}
    </button>
  )
}
