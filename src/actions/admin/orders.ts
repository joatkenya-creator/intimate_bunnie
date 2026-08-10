'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { auditData } from '@/lib/rbac'
import { run } from '@/server/guard'
import { notify } from '@/server/admin'
import { toBool, toCents, toInt, toStringOrNull, type ActionState } from '@/lib/form'

const STATUSES = ['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED'] as const

/** One place an order changes state, so the timeline can never miss an event. */
async function record(
  orderId: string,
  actor: string,
  type: 'STATUS' | 'NOTE' | 'PAYMENT' | 'REFUND' | 'SHIPPING' | 'FRAUD' | 'RETURN',
  message: string,
  options: { visibleToCustomer?: boolean; meta?: Record<string, unknown> } = {},
) {
  await db.orderEvent.create({
    data: {
      orderId,
      actor,
      type,
      message,
      visibleToCustomer: options.visibleToCustomer ?? false,
      meta: options.meta ? JSON.parse(JSON.stringify(options.meta)) : undefined,
    },
  })
}

export async function updateOrderStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('orders.write', async (admin) => {
    const parsed = z
      .object({ number: z.string().min(1), status: z.enum(STATUSES) })
      .parse({ number: form.get('number'), status: form.get('status') })

    const order = await db.order.findUniqueOrThrow({
      where: { number: parsed.number },
      select: { id: true, status: true, items: { select: { productId: true, quantity: true } } },
    })
    if (order.status === parsed.status) return { ok: 'No change' }

    // Reserved stock is held from checkout until the order leaves or dies.
    // Releasing it on the wrong transition is how a warehouse ends up selling
    // the same unit twice.
    const releases = parsed.status === 'FULFILLED' || parsed.status === 'CANCELLED' || parsed.status === 'REFUNDED'
    const wasHeld = order.status === 'PENDING' || order.status === 'PAID'

    await db.$transaction([
      db.order.update({
        where: { id: order.id },
        data: { status: parsed.status, ...(parsed.status === 'FULFILLED' ? { shippedAt: new Date() } : {}) },
      }),
      db.auditLog.create({ data: auditData(admin, `order.${parsed.status.toLowerCase()}`, parsed.number) }),
      ...(releases && wasHeld
        ? order.items.map((item) =>
            db.product.update({
              where: { id: item.productId },
              data: { reservedStock: { decrement: item.quantity } },
            }),
          )
        : []),
      // Cancelling an unshipped order puts the units back on the shelf.
      ...(parsed.status === 'CANCELLED' && wasHeld
        ? order.items.map((item) =>
            db.product.update({ where: { id: item.productId }, data: { inventory: { increment: item.quantity } } }),
          )
        : []),
    ])

    await record(order.id, admin.email, 'STATUS', `Status changed from ${order.status} to ${parsed.status}.`, {
      visibleToCustomer: true,
    })

    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${parsed.number}`)
    revalidatePath('/account/orders')
    return { ok: `Order ${parsed.status.toLowerCase()}` }
  })
}

export async function addOrderNote(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('orders.write', async (admin) => {
    const number = String(form.get('number'))
    const message = String(form.get('message') ?? '').trim()
    if (message.length < 2) return { error: 'Write a note first' }

    const order = await db.order.findUniqueOrThrow({ where: { number }, select: { id: true } })
    await record(order.id, admin.email, 'NOTE', message, { visibleToCustomer: toBool(form.get('visibleToCustomer')) })
    revalidatePath(`/admin/orders/${number}`)
    return { ok: 'Note added' }
  })
}

export async function refundOrder(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('orders.write', async (admin) => {
    const number = String(form.get('number'))
    const amountCents = toCents(form.get('amount'))
    const reason = String(form.get('reason') ?? '').trim() || 'No reason given'

    const order = await db.order.findUniqueOrThrow({
      where: { number },
      select: { id: true, totalCents: true, refundedCents: true, email: true },
    })

    const remaining = order.totalCents - order.refundedCents
    if (amountCents <= 0) return { error: 'Enter an amount above zero' }
    if (amountCents > remaining) return { error: `Only ${(remaining / 100).toFixed(2)} is left to refund on this order.` }

    const fullyRefunded = order.refundedCents + amountCents >= order.totalCents

    await db.$transaction([
      db.order.update({
        where: { id: order.id },
        data: {
          refundedCents: { increment: amountCents },
          ...(fullyRefunded ? { status: 'REFUNDED' as const } : {}),
        },
      }),
      db.auditLog.create({ data: auditData(admin, 'order.refund', number, { amountCents, reason }) }),
    ])

    await record(order.id, admin.email, 'REFUND', `Refunded $${(amountCents / 100).toFixed(2)} — ${reason}`, {
      visibleToCustomer: true,
      meta: { amountCents },
    })
    // ponytail: this records the refund, it does not move money. The gateway
    // call belongs in services/payment.ts behind the PaymentProvider interface
    // the moment a real gateway is connected.
    await notify({ type: 'REFUND', level: 'INFO', title: `Refund issued on ${number}`, body: reason, link: `/admin/orders/${number}` })

    revalidatePath(`/admin/orders/${number}`)
    revalidatePath('/admin/orders')
    return { ok: 'Refund recorded' }
  })
}

export async function updateShipping(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('orders.write', async (admin) => {
    const number = String(form.get('number'))
    const carrier = toStringOrNull(form.get('carrier'))
    const trackingNumber = toStringOrNull(form.get('trackingNumber'))

    const order = await db.order.findUniqueOrThrow({ where: { number }, select: { id: true } })
    await db.order.update({ where: { id: order.id }, data: { carrier, trackingNumber } })
    await record(order.id, admin.email, 'SHIPPING', `Tracking set: ${carrier ?? 'carrier unset'} ${trackingNumber ?? ''}`.trim(), {
      visibleToCustomer: true,
    })
    await db.auditLog.create({ data: auditData(admin, 'order.shipping', number, { carrier, trackingNumber }) })

    revalidatePath(`/admin/orders/${number}`)
    return { ok: 'Shipping updated' }
  })
}

export async function flagOrder(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('orders.write', async (admin) => {
    const number = String(form.get('number'))
    const flag = toStringOrNull(form.get('fraudFlag'))
    const score = form.get('fraudScore') ? Math.min(100, Math.max(0, toInt(form.get('fraudScore')))) : null

    const order = await db.order.findUniqueOrThrow({ where: { number }, select: { id: true } })
    await db.order.update({ where: { id: order.id }, data: { fraudFlag: flag, fraudScore: score } })
    await record(order.id, admin.email, 'FRAUD', flag ? `Flagged: ${flag} (score ${score ?? '—'})` : 'Fraud flag cleared')
    await db.auditLog.create({ data: auditData(admin, 'order.fraud', number, { flag, score }) })

    revalidatePath(`/admin/orders/${number}`)
    return { ok: flag ? 'Order flagged' : 'Flag cleared' }
  })
}
