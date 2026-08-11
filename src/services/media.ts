// Media boundary. Today images are remote URLs served as-is; Cloudinary will
// implement transform() later without any page needing to change.

export type ImageTransform = { width?: number; height?: number; quality?: number }

export interface ImageStorageProvider {
  readonly id: string
  transform(url: string, options: ImageTransform): string
}

const passthrough: ImageStorageProvider = {
  id: 'remote',
  transform: (url) => url,
}

export function imageUrl(url: string, options: ImageTransform = {}): string {
  return passthrough.transform(url, options)
}

export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="4" height="5"><rect width="4" height="5" fill="%23fdf1ea"/></svg>'

// ── Upload boundary ─────────────────────────────────────────────────────────
// The admin media library needs somewhere to put bytes. Same shape as the
// transform boundary above: one interface, one implementation today, and the
// call site never learns which one it got.

export class MediaStorageUnconfigured extends Error {
  constructor() {
    super('No media store is configured. Connect a Vercel Blob store, or add media by URL.')
  }
}

export interface MediaStorageProvider {
  readonly id: string
  put(key: string, file: File): Promise<string>
}

/** Same filename twice must not overwrite the first upload. */
export function storageKey(folder: string, filename: string): string {
  const safe = filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(-80)
  const stamp = crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
  return `${folder.replace(/^\/+|\/+$/g, '') || 'uploads'}/${stamp}-${safe}`
}

/**
 * Vercel Blob. Credentials are injected by the store integration, so their
 * absence is how an unconfigured deployment is detected — and it fails with a
 * sentence an operator can act on instead of a type error.
 *
 * Two credential shapes exist and the SDK accepts either: OIDC (`BLOB_STORE_ID`
 * plus a runtime-injected `VERCEL_OIDC_TOKEN`) or a static read-write token.
 * Gate on both, or a store connected the OIDC way reads as unconfigured.
 */
export async function getMediaStorage(): Promise<MediaStorageProvider> {
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob')
    return {
      id: 'vercel-blob',
      async put(key, file) {
        // storageKey() already carries a random stamp; a second suffix would
        // make the returned URL unguessable from the key we just built.
        const { url } = await put(key, file, { access: 'public', addRandomSuffix: false })
        return url
      },
    }
  }

  return {
    id: 'unconfigured',
    async put() {
      throw new MediaStorageUnconfigured()
    },
  }
}
