'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Library-page uploader. The picker inside a product editor is MediaPicker. */
export function MediaUploader() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [folder, setFolder] = useState('uploads')

  async function upload(files: FileList | File[]) {
    setBusy(true)
    setMessage('')
    let done = 0

    for (const file of Array.from(files)) {
      const body = new FormData()
      body.set('file', file)
      body.set('folder', folder)
      const response = await fetch('/api/admin/media/upload', { method: 'POST', body })
      if (response.ok) done += 1
      else {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setMessage(data.error ?? `${file.name} failed to upload`)
        break
      }
    }

    setBusy(false)
    if (done > 0) {
      setMessage((previous) => previous || `${done} uploaded`)
      // The grid is a Server Component; refresh re-runs its query.
      router.refresh()
    }
  }

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        if (event.dataTransfer.files.length) void upload(event.dataTransfer.files)
      }}
      className="rounded-lg border border-dashed border-[var(--admin-line)] p-4 text-center"
    >
      <label htmlFor="upload-folder" className="admin-label text-left">
        Folder
      </label>
      <input id="upload-folder" value={folder} onChange={(event) => setFolder(event.target.value)} className="admin-field mb-3" />

      <label className="admin-btn admin-btn-primary cursor-pointer">
        {busy ? 'Uploading…' : 'Choose files'}
        <input
          type="file"
          accept="image/*,video/mp4"
          multiple
          className="sr-only"
          onChange={(event) => event.target.files && upload(event.target.files)}
        />
      </label>
      <p className="mt-2 text-xs text-[var(--admin-muted)]">or drop them here</p>

      {message && (
        <p role="status" className="mt-2 text-xs text-[var(--admin-muted)]">
          {message}
        </p>
      )}
    </div>
  )
}
