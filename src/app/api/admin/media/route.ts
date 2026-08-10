import { db } from '@/lib/db'
import { currentAdmin, can } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

/** Backs the media picker's "Browse library" modal. */
export async function GET(request: Request) {
  const admin = await currentAdmin()
  if (!admin || !can(admin.permissions, 'media.read')) return Response.json({ assets: [] }, { status: 403 })

  const params = new URL(request.url).searchParams
  const query = params.get('q')?.trim() ?? ''
  const folder = params.get('folder')?.trim() ?? ''

  const assets = await db.mediaAsset.findMany({
    where: {
      ...(folder ? { folder } : {}),
      ...(query
        ? { OR: [{ filename: { contains: query, mode: 'insensitive' } }, { altText: { contains: query, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { id: true, url: true, filename: true, altText: true, folder: true, kind: true },
  })

  return Response.json({ assets })
}
