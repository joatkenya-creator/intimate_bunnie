import { db } from '@/lib/db'
import { currentAdmin, can } from '@/lib/rbac'
import { isSameOrigin, forbidden, rateLimit, clientIp, tooManyRequests } from '@/lib/security'
import { getMediaStorage, storageKey, MediaStorageUnconfigured } from '@/services/media'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4'])

export async function POST(request: Request) {
  // Route handlers do not get Next's built-in Server Action origin check, and
  // this one is cookie-authenticated — so it does its own.
  if (!isSameOrigin(request)) return forbidden('Cross-origin upload refused')

  const admin = await currentAdmin()
  if (!admin || !can(admin.permissions, 'media.write')) return forbidden()
  if (!rateLimit(`upload:${clientIp(request)}`, 60, 60_000)) return tooManyRequests()

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return Response.json({ error: 'No file received' }, { status: 400 })

  // Both checks matter: the type decides what a browser will execute, the size
  // decides whether the Worker survives the request.
  if (!ALLOWED.has(file.type)) return Response.json({ error: `${file.type || 'That file type'} is not allowed` }, { status: 415 })
  if (file.size > MAX_BYTES) return Response.json({ error: 'Files must be 8 MB or smaller' }, { status: 413 })

  const folder = String(form.get('folder') ?? 'uploads')

  try {
    const storage = await getMediaStorage()
    const url = await storage.put(storageKey(folder, file.name), file)

    const asset = await db.mediaAsset.create({
      data: {
        url,
        filename: file.name,
        kind: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
        folder,
        mimeType: file.type,
        bytes: file.size,
        createdBy: admin.email,
      },
      select: { id: true, url: true },
    })

    return Response.json(asset, { status: 201 })
  } catch (error) {
    if (error instanceof MediaStorageUnconfigured) return Response.json({ error: error.message }, { status: 501 })
    console.error('[media] upload failed:', error)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}
