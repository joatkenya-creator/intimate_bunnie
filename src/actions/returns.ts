'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin, requireUser } from '@/lib/auth'
import { reference } from '@/lib/ids'
import { isReturnable, RETURN_INSTRUCTIONS } from '@/lib/returns'
import { sendReturnApproved, sendReturnReceived } from '@/services/email'
import { notify } from '@/server/admin'

export type ReturnState = { error?: string; saved?: boolean; rma?: string }

const requestSchema = z.object({
  number: z.string().min(1),
  reason: z.string().min(10, 'Tell us briefly what is wrong — at least 10 characters').max(1000),
  orderItemIds: z.array(z.string().min(1)).min(1, 'Choose at least one item'),
})

export async function requestReturn(_prev: ReturnState, formData: FormData): Promise<ReturnState> {
  let user
  try {
    user = await requireUser()
  } catch {
    return { error: 'Sign in to request a return' }
  }

  const parsed = requestSchema.safeParse({
    number: formData.get('number'),
    reason: formData.get('reason'),
    orderItemIds: formData.getAll('orderItemId').map(String),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const order = await db.order.findUnique({
    where: { number: parsed.data.number },
    select: {
      id: true,
      number: true,
      email: true,
      userId: true,
      status: true,
      createdAt: true,
      items: { select: { id: true, name: true, variantName: true, quantity: true } },
    },
  })

  // Same answer for someone else's order as for one that does not exist —
  // an order number must not be a way to probe the database.
  if (!order || order.userId !== user.id) return { error: 'We could not find that order' }
  if (!isReturnable(order)) return { error: 'That order is outside the 30-day return window' }

  const chosen = order.items.filter((item) => parsed.data.orderItemIds.includes(item.id))
  if (chosen.length !== parsed.data.orderItemIds.length) return { error: 'We could not find those items on that order' }

  // An item already under review or already approved cannot be sent back twice.
  const pending = await db.returnItem.findFirst({
    where: { orderItemId: { in: chosen.map((item) => item.id) }, return: { status: { in: ['REQUESTED', 'APPROVED'] } } },
    select: { id: true },
  })
  if (pending) return { error: 'One of those items is already part of an open return' }

  const rma = reference('RMA')
  await db.return.create({
    data: {
      number: rma,
      orderId: order.id,
      reason: parsed.data.reason,
      // ponytail: whole lines only, no partial quantities. Add a quantity input
      // here and to the form if customers actually ask to split a line.
      items: { create: chosen.map((item) => ({ orderItemId: item.id, quantity: item.quantity })) },
    },
  })

  await sendReturnReceived(
    order.email,
    order.number,
    chosen.map((item) => `${item.name}${item.variantName ? ` — ${item.variantName}` : ''} × ${item.quantity}`),
  )
  await notify({
    type: 'REFUND',
    level: 'WARNING',
    title: `Return requested on ${order.number}`,
    body: parsed.data.reason.slice(0, 160),
    link: '/admin/returns',
  })

  revalidatePath('/account/orders')
  return { saved: true, rma }
}

const resolveSchema = z.object({
  number: z.string().min(1),
  decision: z.enum(['APPROVED', 'DENIED']),
  note: z.string().max(500).optional(),
})

export async function resolveReturn(_prev: ReturnState, formData: FormData): Promise<ReturnState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch {
    return { error: 'Not authorized' }
  }

  const parsed = resolveSchema.safeParse({
    number: formData.get('number'),
    decision: formData.get('decision'),
    note: (formData.get('note') as string) || undefined,
  })
  if (!parsed.success) return { error: 'Invalid decision' }

  const request = await db.return.findUnique({
    where: { number: parsed.data.number },
    select: {
      id: true,
      number: true,
      status: true,
      order: { select: { id: true, number: true, email: true } },
      items: { select: { quantity: true, orderItem: { select: { unitCents: true } } } },
    },
  })
  if (!request) return { error: 'No such return' }
  // Resolving twice would mail a second approval for a refund already promised.
  if (request.status !== 'REQUESTED') return { error: `That return is already ${request.status.toLowerCase()}` }

  const approved = parsed.data.decision === 'APPROVED'
  // Priced from the order lines, never from the form — the refund is not an input.
  const refundCents = approved
    ? request.items.reduce((sum, item) => sum + item.orderItem.unitCents * item.quantity, 0)
    : 0

  await db.$transaction([
    db.return.update({
      where: { id: request.id },
      data: {
        status: parsed.data.decision,
        refundCents,
        resolutionNote: parsed.data.note ?? null,
        resolvedAt: new Date(),
      },
    }),
    db.auditLog.create({
      data: { actor: admin.email, action: `return.${parsed.data.decision.toLowerCase()}`, target: request.number },
    }),
    // The order timeline is the one place staff look for "what happened here",
    // so a return decision has to land on it too.
    db.orderEvent.create({
      data: {
        orderId: request.order.id,
        actor: admin.email,
        type: 'RETURN',
        message: approved
          ? `Return ${request.number} approved for a $${(refundCents / 100).toFixed(2)} refund.`
          : `Return ${request.number} denied.${parsed.data.note ? ` ${parsed.data.note}` : ''}`,
        visibleToCustomer: true,
      },
    }),
    ...(approved
      ? [db.order.update({ where: { id: request.order.id }, data: { refundedCents: { increment: refundCents } } })]
      : []),
  ])

  if (approved) {
    await sendReturnApproved(request.order.email, request.order.number, refundCents, RETURN_INSTRUCTIONS)
  }

  revalidatePath('/admin/returns')
  revalidatePath('/account/orders')
  return { saved: true }
}
