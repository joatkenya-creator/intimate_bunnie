// Media boundary. Product imagery lives on remote hosts; every URL that reaches
// a page goes through imageUrl() so the platform's own optimiser can resize it
// and negotiate AVIF/WebP. Nothing bundles image bytes into the deployment.

export type ImageTransform = { width?: number; height?: number; quality?: number }

// The only widths Next's optimiser will serve — the union of `deviceSizes` and
// `imageSizes`. A width outside this set is rejected with a 400, so requested
// widths snap up to the next allowed one rather than being passed through.
const ALLOWED_WIDTHS = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]

function snapWidth(width: number): number {
  return ALLOWED_WIDTHS.find((w) => w >= width) ?? ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1]
}

/** Data URIs and already-optimised URLs must not be re-proxied. */
function optimisable(url: string): boolean {
  return Boolean(url) && !url.startsWith('data:') && !url.startsWith('/_next/image')
}

/**
 * A single optimised source. Without a width the URL is returned untouched —
 * the optimiser needs a width, and guessing one would ship a larger file than
 * the original on a small element.
 */
export function imageUrl(url: string, options: ImageTransform = {}): string {
  if (!optimisable(url) || !options.width) return url
  const q = Math.min(100, Math.max(1, Math.trunc(options.quality ?? 72)))
  return `/_next/image?url=${encodeURIComponent(url)}&w=${snapWidth(options.width)}&q=${q}`
}

/**
 * `srcset` for the same image at several widths, so a phone never downloads the
 * desktop rendition. Returns undefined when the URL cannot be optimised, which
 * is exactly when the attribute should be omitted.
 */
export function imageSrcSet(url: string, widths: number[], quality?: number): string | undefined {
  if (!optimisable(url)) return undefined
  const snapped = [...new Set(widths.map(snapWidth))].sort((a, b) => a - b)
  return snapped.map((w) => `${imageUrl(url, { width: w, quality })} ${w}w`).join(', ')
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
