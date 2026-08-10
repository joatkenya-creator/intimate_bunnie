'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

// The reusable media control. Products, categories, collections, banners, and
// blog posts all mount this — nothing else in the admin knows how an upload
// works.
//
// The gallery serialises to one hidden input as JSON. A server action gets the
// whole ordered list in one field instead of a dozen indexed ones.

export type MediaEntry = { url: string; altText: string; width?: number | null; height?: number | null }

type Asset = { id: string; url: string; filename: string; altText: string; folder: string; kind: string }

export function MediaPicker({
  name,
  initial = [],
  multiple = true,
  label = 'Media',
}: {
  name: string
  initial?: MediaEntry[]
  multiple?: boolean
  label?: string
}) {
  const [items, setItems] = useState<MediaEntry[]>(initial)
  const [browsing, setBrowsing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = useCallback(
    (entries: MediaEntry[]) => {
      setItems((previous) => {
        const merged = multiple ? [...previous, ...entries] : entries.slice(0, 1)
        // Same file picked twice is a mis-click, not an intent to duplicate.
        return merged.filter((entry, index, all) => all.findIndex((other) => other.url === entry.url) === index)
      })
    },
    [multiple],
  )

  async function upload(files: FileList | File[]) {
    setBusy(true)
    setError('')
    try {
      const uploaded: MediaEntry[] = []
      for (const file of Array.from(files)) {
        const body = new FormData()
        body.set('file', file)
        const response = await fetch('/api/admin/media/upload', { method: 'POST', body })
        const data = (await response.json()) as { url?: string; error?: string }
        if (!response.ok || !data.url) throw new Error(data.error ?? 'Upload failed')
        uploaded.push({ url: data.url, altText: '' })
      }
      add(uploaded)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  function move(index: number, direction: -1 | 1) {
    setItems((previous) => {
      const next = [...previous]
      const target = index + direction
      if (target < 0 || target >= next.length) return previous
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  return (
    <div>
      <p className="admin-label">{label}</p>
      <input type="hidden" name={name} value={JSON.stringify(items)} />

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          if (event.dataTransfer.files.length) void upload(event.dataTransfer.files)
        }}
        className="rounded-lg border border-dashed border-[var(--admin-line)] p-3"
      >
        {items.length > 0 && (
          <ul className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item, index) => (
              <li key={item.url} className="admin-panel overflow-hidden">
                <div className="relative aspect-4/5 bg-[var(--admin-raised)]">
                  <Image src={item.url} alt="" fill sizes="200px" className="object-cover" unoptimized />
                  {index === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-[var(--color-rose-500)] px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">
                      Primary
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 p-2">
                  <label className="sr-only" htmlFor={`${name}-alt-${index}`}>
                    Alt text for image {index + 1}
                  </label>
                  <input
                    id={`${name}-alt-${index}`}
                    className="admin-field text-xs"
                    placeholder="Alt text (required for accessibility)"
                    value={item.altText}
                    onChange={(event) =>
                      setItems((previous) =>
                        previous.map((entry, i) => (i === index ? { ...entry, altText: event.target.value } : entry)),
                      )
                    }
                  />
                  <div className="flex items-center gap-1">
                    <button type="button" className="admin-btn admin-btn-ghost px-2 py-1" onClick={() => move(index, -1)} aria-label={`Move image ${index + 1} earlier`}>
                      ←
                    </button>
                    <button type="button" className="admin-btn admin-btn-ghost px-2 py-1" onClick={() => move(index, 1)} aria-label={`Move image ${index + 1} later`}>
                      →
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-danger ml-auto px-2 py-1"
                      onClick={() => setItems((previous) => previous.filter((_, i) => i !== index))}
                      aria-label={`Remove image ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="admin-btn admin-btn-ghost cursor-pointer">
            {busy ? 'Uploading…' : 'Upload'}
            <input
              type="file"
              accept="image/*,video/mp4"
              multiple={multiple}
              className="sr-only"
              onChange={(event) => event.target.files && upload(event.target.files)}
            />
          </label>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setBrowsing(true)}>
            Browse library
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              const url = window.prompt('Image URL')
              if (url) add([{ url, altText: '' }])
            }}
          >
            Add by URL
          </button>
          <p className="text-xs text-[var(--admin-muted)]">or drop files here</p>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>

      {browsing && <LibraryModal onClose={() => setBrowsing(false)} onPick={(assets) => add(assets.map((asset) => ({ url: asset.url, altText: asset.altText })))} />}
    </div>
  )
}

function LibraryModal({ onClose, onPick }: { onClose: () => void; onPick: (assets: Asset[]) => void }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Set<string>>(new Set())

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/admin/media?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { assets: [] }))
        .then((data: { assets: Asset[] }) => setAssets(data.assets ?? []))
        .catch(() => undefined)
    }, 160)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Media library">
      <div className="admin-panel flex max-h-[80vh] w-full max-w-3xl flex-col">
        <div className="flex items-center gap-2 border-b border-[var(--admin-line)] p-3">
          <label className="sr-only" htmlFor="library-search">
            Search media
          </label>
          <input id="library-search" className="admin-field" placeholder="Search filenames and alt text…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <ul className="grid flex-1 grid-cols-3 gap-2 overflow-y-auto p-3 sm:grid-cols-5">
          {assets.map((asset) => {
            const picked = chosen.has(asset.id)
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  aria-pressed={picked}
                  onClick={() =>
                    setChosen((previous) => {
                      const next = new Set(previous)
                      if (next.has(asset.id)) next.delete(asset.id)
                      else next.add(asset.id)
                      return next
                    })
                  }
                  className={`relative block aspect-square w-full overflow-hidden rounded border-2 ${picked ? 'border-[var(--color-rose-500)]' : 'border-transparent'}`}
                >
                  <Image src={asset.url} alt={asset.altText || asset.filename} fill sizes="150px" className="object-cover" unoptimized />
                </button>
              </li>
            )
          })}
          {assets.length === 0 && <li className="col-span-full py-10 text-center text-sm text-[var(--admin-muted)]">No media found.</li>}
        </ul>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--admin-line)] p-3">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => {
              onPick(assets.filter((asset) => chosen.has(asset.id)))
              onClose()
            }}
          >
            Add {chosen.size > 0 ? chosen.size : ''} selected
          </button>
        </div>
      </div>
    </div>
  )
}
