'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { auditData } from '@/lib/rbac'
import { sanitizeHtml, stripHtml } from '@/lib/html'
import { run } from '@/server/guard'
import { toBool, toDateOrNull, toInt, toList, toStringOrNull, slugify, type ActionState } from '@/lib/form'

const TYPES = ['PAGE', 'POST', 'FAQ', 'ANNOUNCEMENT', 'BANNER', 'POLICY'] as const
type ContentType = (typeof TYPES)[number]

/** Blog entries answer to `blog.*`; everything else to `content.*`. */
function permissionFor(type: ContentType) {
  return type === 'POST' ? ('blog.write' as const) : ('content.write' as const)
}

export async function saveContent(_prev: ActionState, form: FormData): Promise<ActionState> {
  const type = (TYPES.includes(String(form.get('type')) as ContentType) ? String(form.get('type')) : 'PAGE') as ContentType

  return run(permissionFor(type), async (admin) => {
    const id = toStringOrNull(form.get('id'))
    const title = String(form.get('title') ?? '').trim()
    if (title.length < 2) return { error: 'Title is required', fieldErrors: { title: 'Title is required' } }

    const body = sanitizeHtml(String(form.get('body') ?? ''))
    const status = String(form.get('status') ?? 'DRAFT')
    if (!['DRAFT', 'PUBLISHED', 'SCHEDULED'].includes(status)) return { error: 'Unknown status' }

    const publishAt = toDateOrNull(form.get('publishAt'))
    if (status === 'SCHEDULED' && !publishAt) return { error: 'A scheduled entry needs a publish date.' }

    const data = {
      type,
      title,
      slug: slugify(String(form.get('slug') ?? '') || title),
      excerpt: toStringOrNull(form.get('excerpt')) ?? (stripHtml(body, 180) || null),
      body,
      status: status as 'DRAFT' | 'PUBLISHED' | 'SCHEDULED',
      publishAt: status === 'PUBLISHED' ? (publishAt ?? new Date()) : publishAt,
      heroImage: toStringOrNull(form.get('heroImage')),
      category: toStringOrNull(form.get('category')),
      tags: toList(form.get('tags')),
      authorId: toStringOrNull(form.get('authorId')) ?? admin.id,
      position: toInt(form.get('position')),
      linkUrl: toStringOrNull(form.get('linkUrl')),
      seoTitle: toStringOrNull(form.get('seoTitle')),
      seoDesc: toStringOrNull(form.get('seoDesc')),
      canonicalUrl: toStringOrNull(form.get('canonicalUrl')),
      ogImage: toStringOrNull(form.get('ogImage')),
      robots: toStringOrNull(form.get('robots')),
    }

    const entry = id
      ? await db.contentEntry.update({ where: { id }, data, select: { id: true, slug: true, type: true } })
      : await db.contentEntry.create({ data, select: { id: true, slug: true, type: true } })

    await db.auditLog.create({ data: auditData(admin, id ? 'content.update' : 'content.create', entry.id, { type, title }) })

    revalidatePath(type === 'POST' ? '/admin/blog' : '/admin/content')
    revalidatePath('/')
    if (type === 'PAGE' || type === 'POLICY') revalidatePath(`/pages/${entry.slug}`)
    return { ok: 'Saved', createdId: entry.id }
  })
}

export async function deleteContent(_prev: ActionState, form: FormData): Promise<ActionState> {
  const type = String(form.get('type') ?? 'PAGE') as ContentType
  const permission = type === 'POST' ? ('blog.delete' as const) : ('content.delete' as const)

  return run(permission, async (admin) => {
    const id = String(form.get('id'))
    await db.contentEntry.delete({ where: { id } })
    await db.auditLog.create({ data: auditData(admin, 'content.delete', id, { type }) })
    revalidatePath(type === 'POST' ? '/admin/blog' : '/admin/content')
    revalidatePath('/')
    return { ok: 'Deleted' }
  })
}

export async function bulkContent(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('content.write', async (admin) => {
    const ids = form.getAll('ids').map(String).filter(Boolean)
    const op = String(form.get('op') ?? '')
    if (ids.length === 0) return { error: 'Nothing selected' }

    if (op === 'publish') {
      await db.contentEntry.updateMany({ where: { id: { in: ids } }, data: { status: 'PUBLISHED', publishAt: new Date() } })
    } else if (op === 'draft') {
      await db.contentEntry.updateMany({ where: { id: { in: ids } }, data: { status: 'DRAFT' } })
    } else if (op === 'delete') {
      await db.contentEntry.deleteMany({ where: { id: { in: ids } } })
    } else {
      return { error: 'Unknown bulk action' }
    }

    await db.auditLog.create({ data: auditData(admin, `content.bulk.${op}`, null, { count: ids.length }) })
    revalidatePath('/admin/content')
    revalidatePath('/admin/blog')
    return { ok: `${ids.length} updated` }
  })
}

// ── Navigation menus ────────────────────────────────────────────────────────

export async function saveMenuItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('menus.write', async (admin) => {
    const id = toStringOrNull(form.get('id'))
    const menu = String(form.get('menu') ?? 'HEADER')
    if (menu !== 'HEADER' && menu !== 'FOOTER') return { error: 'Unknown menu' }

    const label = String(form.get('label') ?? '').trim()
    const url = String(form.get('url') ?? '').trim()
    if (!label || !url) return { error: 'Label and URL are both required.' }
    // Only site-relative or fully qualified http(s) links — `javascript:` in a
    // nav item would run for every visitor.
    if (!/^(\/|https?:\/\/)/.test(url)) return { error: 'URL must start with / or http.' }

    const parentId = toStringOrNull(form.get('parentId'))
    if (parentId && parentId === id) return { error: 'An item cannot nest inside itself.' }

    const data = {
      menu: menu as 'HEADER' | 'FOOTER',
      label,
      url,
      parentId,
      position: toInt(form.get('position')),
      visible: toBool(form.get('visible')),
    }
    const item = id
      ? await db.menuItem.update({ where: { id }, data, select: { id: true } })
      : await db.menuItem.create({ data, select: { id: true } })

    await db.auditLog.create({ data: auditData(admin, id ? 'menu.update' : 'menu.create', item.id, { menu, label }) })
    revalidatePath('/admin/menus')
    revalidatePath('/', 'layout')
    return { ok: 'Menu saved' }
  })
}

export async function deleteMenuItem(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('menus.delete', async (admin) => {
    const id = String(form.get('id'))
    await db.menuItem.delete({ where: { id } })
    await db.auditLog.create({ data: auditData(admin, 'menu.delete', id) })
    revalidatePath('/admin/menus')
    revalidatePath('/', 'layout')
    return { ok: 'Removed' }
  })
}

export async function reorderMenu(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('menus.write', async (admin) => {
    const updates = [...form.entries()]
      .filter(([key]) => key.startsWith('position:'))
      .map(([key, value]) => db.menuItem.update({ where: { id: key.slice(9) }, data: { position: toInt(value) } }))

    if (updates.length === 0) return { error: 'Nothing to reorder' }
    await db.$transaction(updates)
    await db.auditLog.create({ data: auditData(admin, 'menu.reorder', null, { count: updates.length }) })
    revalidatePath('/admin/menus')
    revalidatePath('/', 'layout')
    return { ok: 'Order saved' }
  })
}
