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
