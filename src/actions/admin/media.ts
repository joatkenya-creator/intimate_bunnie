'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { auditData } from '@/lib/rbac'
import { run } from '@/server/guard'
import { toList, toStringOrNull, type ActionState } from '@/lib/form'

export async function updateAsset(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('media.write', async (admin) => {
    const id = String(form.get('id'))
    await db.mediaAsset.update({
      where: { id },
      data: {
        altText: String(form.get('altText') ?? '').slice(0, 300),
        folder: folderName(form.get('folder')),
        tags: toList(form.get('tags')),
      },
    })
    await db.auditLog.create({ data: auditData(admin, 'media.update', id) })
    revalidatePath('/admin/media')
    return { ok: 'Saved' }
  })
}

function folderName(value: FormDataEntryValue | null): string {
  return (toStringOrNull(value) ?? 'uploads').replace(/[^a-z0-9/_-]/gi, '').slice(0, 60) || 'uploads'
}

/** One action for the library's bulk bar; `op` says which button was pressed. */
export async function bulkMedia(_prev: ActionState, form: FormData): Promise<ActionState> {
  const op = String(form.get('op') ?? '')

  return run(op === 'delete' ? 'media.delete' : 'media.write', async (admin) => {
    const ids = form.getAll('ids').map(String).filter(Boolean)
    if (ids.length === 0) return { error: 'Nothing selected' }

    if (op === 'move') {
      const folder = folderName(form.get('folder'))
      await db.mediaAsset.updateMany({ where: { id: { in: ids } }, data: { folder } })
      await db.auditLog.create({ data: auditData(admin, 'media.move', null, { count: ids.length, folder }) })
      revalidatePath('/admin/media')
      return { ok: `Moved ${ids.length} to ${folder}` }
    }

    if (op !== 'delete') return { error: 'Unknown bulk action' }

    // A URL still on a product would 404 the storefront. Skip those and say so
    // — the editor decides, not the delete button.
    const assets = await db.mediaAsset.findMany({ where: { id: { in: ids } }, select: { id: true, url: true } })
    const inUse = await db.productMedia.findMany({
      where: { url: { in: assets.map((asset) => asset.url) } },
      select: { url: true },
      distinct: ['url'],
    })
    const usedUrls = new Set(inUse.map((row) => row.url))
    const deletable = assets.filter((asset) => !usedUrls.has(asset.url))

    if (deletable.length > 0) await db.mediaAsset.deleteMany({ where: { id: { in: deletable.map((asset) => asset.id) } } })
    await db.auditLog.create({ data: auditData(admin, 'media.delete', null, { count: deletable.length }) })
    revalidatePath('/admin/media')

    return usedUrls.size > 0
      ? { ok: `${deletable.length} deleted. ${usedUrls.size} skipped — still attached to a product.` }
      : { ok: `${deletable.length} deleted` }
  })
}
