'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { auditData } from '@/lib/rbac'
import { run } from '@/server/guard'
import { toBool, toStringOrNull, type ActionState } from '@/lib/form'

function normalisePath(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withSlash = trimmed.startsWith('/') || /^https?:\/\//.test(trimmed) ? trimmed : `/${trimmed}`
  // Trailing slashes make two URLs out of one page, which is the whole reason
  // the redirect table exists.
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash
}

export async function saveRedirect(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('seo.write', async (admin) => {
    const id = toStringOrNull(form.get('id'))
    const source = normalisePath(String(form.get('source') ?? ''))
    const destination = normalisePath(String(form.get('destination') ?? ''))
    const statusCode = String(form.get('statusCode')) === '302' ? 302 : 301

    if (!source.startsWith('/')) return { error: 'The source must be a path on this site, starting with /.' }
    if (!destination) return { error: 'A destination is required.' }
    if (source === destination) return { error: 'That redirect points at itself.' }

    // One hop only. A → B where B → C already exists would send a crawler in a
    // chain; catching it here is cheaper than debugging it in Search Console.
    const onward = await db.redirect.findUnique({ where: { source: destination }, select: { destination: true } })
    if (onward) return { error: `${destination} already redirects to ${onward.destination}. Point this straight there instead.` }

    const data = { source, destination, statusCode, active: toBool(form.get('active')), note: toStringOrNull(form.get('note')) }
    const redirect = id
      ? await db.redirect.update({ where: { id }, data, select: { id: true } })
      : await db.redirect.create({ data, select: { id: true } })

    await db.auditLog.create({ data: auditData(admin, id ? 'redirect.update' : 'redirect.create', redirect.id, { source, destination }) })
    revalidatePath('/admin/seo/redirects')
    return { ok: `${source} → ${destination}` }
  })
}

export async function deleteRedirect(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('seo.delete', async (admin) => {
    const id = String(form.get('id'))
    await db.redirect.delete({ where: { id } })
    await db.auditLog.create({ data: auditData(admin, 'redirect.delete', id) })
    revalidatePath('/admin/seo/redirects')
    return { ok: 'Redirect removed' }
  })
}

/** Bulk SEO editing from the audit table, without opening each product. */
export async function saveSeoOverride(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('seo.write', async (admin) => {
    const kind = String(form.get('kind'))
    const id = String(form.get('id'))
    const data = {
      seoTitle: toStringOrNull(form.get('seoTitle')),
      seoDesc: toStringOrNull(form.get('seoDesc')),
    }

    if (kind === 'product') {
      await db.product.update({
        where: { id },
        data: { ...data, canonicalUrl: toStringOrNull(form.get('canonicalUrl')), robots: toStringOrNull(form.get('robots')) },
      })
    } else if (kind === 'category') {
      await db.category.update({ where: { id }, data })
    } else if (kind === 'content') {
      await db.contentEntry.update({
        where: { id },
        data: { ...data, canonicalUrl: toStringOrNull(form.get('canonicalUrl')), robots: toStringOrNull(form.get('robots')) },
      })
    } else {
      return { error: 'Unknown record type' }
    }

    await db.auditLog.create({ data: auditData(admin, 'seo.update', id, { kind }) })
    revalidatePath('/admin/seo')
    return { ok: 'SEO saved' }
  })
}
