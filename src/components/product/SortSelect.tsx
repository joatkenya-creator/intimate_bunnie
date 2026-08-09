'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function SortSelect({ options, value }: { options: { value: string; label: string }[]; value: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="eyebrow">
        Sort
      </label>
      <select
        id="sort"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString())
          next.set('sort', e.target.value)
          next.delete('page')
          router.push(`${pathname}?${next.toString()}`, { scroll: false })
        }}
        className="border border-line bg-white px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
