'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { auditData } from '@/lib/rbac'
import { run } from '@/server/guard'
import { reference } from '@/lib/ids'
import { toBool, toCents, toDateOrNull, toInt, toStringOrNull, type ActionState } from '@/lib/form'

const KINDS = ['CODE', 'AUTOMATIC', 'FLASH_SALE', 'BUNDLE', 'GIFT_CARD', 'REFERRAL'] as const
type Kind = (typeof KINDS)[number]

export async function savePromotion(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('promotions.write', async (admin) => {
    const id = toStringOrNull(form.get('id'))
    const kind = (KINDS.includes(String(form.get('kind')) as Kind) ? String(form.get('kind')) : 'CODE') as Kind
    const name = String(form.get('name') ?? '').trim()
    if (name.length < 2) return { error: 'Give the promotion a name', fieldErrors: { name: 'Required' } }

    const percentOff = form.get('percentOff') ? toInt(form.get('percentOff')) : null
    const amountOffCents = form.get('amountOff') ? toCents(form.get('amountOff')) : null

    // A gift card carries a balance instead of a discount; everything else must
    // discount by exactly one of percent or amount.
    if (kind !== 'GIFT_CARD') {
      if (percentOff === null && amountOffCents === null) return { error: 'Set either a percentage or an amount off.' }
      if (percentOff !== null && amountOffCents !== null) return { error: 'Use a percentage or an amount, not both.' }
      if (percentOff !== null && (percentOff < 1 || percentOff > 90)) return { error: 'Percentage must be between 1 and 90.' }
    }

    const startsAt = toDateOrNull(form.get('startsAt'))
    const expiresAt = toDateOrNull(form.get('expiresAt'))
    if (startsAt && expiresAt && expiresAt <= startsAt) return { error: 'The end date must come after the start date.' }

    // An automatic discount has no code to type, but the column is unique and
    // required — a generated reference keeps the constraint honest.
    const codeInput = String(form.get('code') ?? '').trim().toUpperCase().replace(/\s+/g, '')
    const code = codeInput || reference(kind === 'GIFT_CARD' ? 'GC' : 'AUTO')

    const appliesToIds = form.getAll('categoryIds').map(String).filter(Boolean)

    const data = {
      code,
      name,
      description: toStringOrNull(form.get('description')),
      kind,
      percentOff,
      amountOffCents,
      active: toBool(form.get('active')),
      startsAt,
      expiresAt,
      minSpendCents: form.get('minSpend') ? toCents(form.get('minSpend')) : null,
      usageLimit: form.get('usageLimit') ? toInt(form.get('usageLimit')) : null,
      perCustomerLimit: form.get('perCustomerLimit') ? toInt(form.get('perCustomerLimit')) : null,
      balanceCents: kind === 'GIFT_CARD' ? toCents(form.get('balance')) : null,
      appliesTo: appliesToIds.length > 0 ? { categoryIds: appliesToIds } : undefined,
    }

    const promotion = id
      ? await db.coupon.update({ where: { id }, data, select: { id: true, code: true } })
      : await db.coupon.create({ data, select: { id: true, code: true } })

    await db.auditLog.create({ data: auditData(admin, id ? 'promotion.update' : 'promotion.create', promotion.id, { code: promotion.code, kind }) })
    revalidatePath('/admin/promotions')
    return { ok: `Saved ${promotion.code}`, createdId: promotion.id }
  })
}

export async function togglePromotion(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('promotions.write', async (admin) => {
    const id = String(form.get('id'))
    const promotion = await db.coupon.findUniqueOrThrow({ where: { id }, select: { active: true, code: true } })
    await db.coupon.update({ where: { id }, data: { active: !promotion.active } })
    await db.auditLog.create({ data: auditData(admin, 'promotion.toggle', id, { active: !promotion.active }) })
    revalidatePath('/admin/promotions')
    return { ok: `${promotion.code} ${promotion.active ? 'paused' : 'activated'}` }
  })
}

export async function deletePromotion(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('promotions.delete', async (admin) => {
    const id = String(form.get('id'))
    const promotion = await db.coupon.findUniqueOrThrow({ where: { id }, select: { usedCount: true, code: true } })

    // A code customers have redeemed is history, not a row to remove.
    if (promotion.usedCount > 0) {
      await db.coupon.update({ where: { id }, data: { active: false } })
      await db.auditLog.create({ data: auditData(admin, 'promotion.retire', id) })
      revalidatePath('/admin/promotions')
      return { ok: `${promotion.code} has been redeemed ${promotion.usedCount} times, so it was deactivated instead.` }
    }

    await db.coupon.delete({ where: { id } })
    await db.auditLog.create({ data: auditData(admin, 'promotion.delete', id, { code: promotion.code }) })
    revalidatePath('/admin/promotions')
    return { ok: 'Promotion deleted' }
  })
}
