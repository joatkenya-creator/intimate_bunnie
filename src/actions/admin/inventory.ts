'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { auditData } from '@/lib/rbac'
import { run } from '@/server/guard'
import { notify } from '@/server/admin'
import { toInt, toStringOrNull, type ActionState } from '@/lib/form'

const REASONS = ['MANUAL', 'RECEIVED', 'SOLD', 'RETURNED', 'DAMAGED', 'CORRECTION', 'RESERVED', 'RELEASED'] as const
type Reason = (typeof REASONS)[number]

/**
 * Every stock change goes through here, so `InventoryAdjustment` is a complete
 * history rather than "the movements someone remembered to log". The write and
 * its history row share a transaction — a level that changed without a matching
 * row would be worse than no history at all.
 */
export async function adjustStock(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('inventory.write', async (admin) => {
    const productId = toStringOrNull(form.get('productId'))
    const variantId = toStringOrNull(form.get('variantId'))
    const mode = String(form.get('mode') ?? 'delta')
    const amount = toInt(form.get('amount'))
    const reason = (REASONS.includes(String(form.get('reason')) as Reason) ? String(form.get('reason')) : 'MANUAL') as Reason
    const note = toStringOrNull(form.get('note'))

    if (!productId && !variantId) return { error: 'Pick a product or variant' }
    if (mode === 'delta' && amount === 0) return { error: 'Enter an amount other than zero' }

    const current = variantId
      ? await db.variant.findUniqueOrThrow({ where: { id: variantId }, select: { inventory: true, productId: true, sku: true } })
      : await db.product.findUniqueOrThrow({ where: { id: productId! }, select: { inventory: true, sku: true, name: true, lowStockAt: true } })

    const resulting = mode === 'set' ? Math.max(0, amount) : Math.max(0, current.inventory + amount)
    const delta = resulting - current.inventory
    if (delta === 0) return { ok: 'Already at that level' }

    await db.$transaction([
      variantId
        ? db.variant.update({ where: { id: variantId }, data: { inventory: resulting } })
        : db.product.update({ where: { id: productId! }, data: { inventory: resulting } }),
      db.inventoryAdjustment.create({
        data: {
          productId: productId ?? ('productId' in current ? current.productId : null),
          variantId,
          delta,
          resulting,
          reason,
          note,
          actor: admin.email,
        },
      }),
      db.auditLog.create({ data: auditData(admin, 'inventory.adjust', productId ?? variantId, { delta, resulting, reason }) }),
    ])

    if (!variantId && 'lowStockAt' in current && resulting <= current.lowStockAt) {
      await notify({
        type: 'LOW_STOCK',
        level: resulting === 0 ? 'CRITICAL' : 'WARNING',
        title: resulting === 0 ? `Out of stock: ${current.name}` : `Low stock: ${current.name}`,
        body: `${resulting} on hand after a ${delta > 0 ? '+' : ''}${delta} adjustment.`,
        link: `/admin/inventory?product=${productId}`,
      })
    }

    revalidatePath('/admin/inventory')
    revalidatePath('/admin/products')
    return { ok: `Stock set to ${resulting}` }
  })
}

/** Incoming is a promise from a supplier, not stock you can sell. */
export async function setIncoming(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('inventory.write', async (admin) => {
    const productId = String(form.get('productId'))
    const incomingStock = Math.max(0, toInt(form.get('incomingStock')))
    await db.product.update({ where: { id: productId }, data: { incomingStock } })
    await db.auditLog.create({ data: auditData(admin, 'inventory.incoming', productId, { incomingStock }) })
    revalidatePath('/admin/inventory')
    return { ok: 'Incoming stock updated' }
  })
}

export async function setLowStockThreshold(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('inventory.write', async (admin) => {
    const productId = String(form.get('productId'))
    const lowStockAt = Math.max(0, toInt(form.get('lowStockAt'), 5))
    await db.product.update({ where: { id: productId }, data: { lowStockAt } })
    await db.auditLog.create({ data: auditData(admin, 'inventory.threshold', productId, { lowStockAt }) })
    revalidatePath('/admin/inventory')
    return { ok: 'Threshold updated' }
  })
}

/** Clears a hold that outlived its order — the manual escape hatch for a stuck count. */
export async function releaseReserved(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('inventory.write', async (admin) => {
    const productId = String(form.get('productId'))
    const product = await db.product.findUniqueOrThrow({ where: { id: productId }, select: { reservedStock: true, inventory: true } })
    if (product.reservedStock === 0) return { ok: 'Nothing reserved' }

    await db.$transaction([
      db.product.update({ where: { id: productId }, data: { reservedStock: 0 } }),
      db.inventoryAdjustment.create({
        data: {
          productId,
          delta: 0,
          resulting: product.inventory,
          reason: 'RELEASED',
          note: `Released ${product.reservedStock} reserved units`,
          actor: admin.email,
        },
      }),
      db.auditLog.create({ data: auditData(admin, 'inventory.release', productId, { released: product.reservedStock }) }),
    ])

    revalidatePath('/admin/inventory')
    return { ok: `Released ${product.reservedStock} units` }
  })
}
