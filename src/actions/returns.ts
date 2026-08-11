'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { queryOne, transaction } from '@/lib/sql'
import { requireAdmin, requireUser } from '@/lib/auth'
import { reference, newId } from '@/lib/ids'
import { isReturnable, RETURN_INSTRUCTIONS } from '@/lib/returns'
import { sendReturnApproved, sendReturnReceived } from '@/services/email'
import { notify } from '@/server/notifications'

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

  const order = await queryOne<{
    id: string
    number: string
    email: string
    userId: string | null
    status: string
    createdAt: Date
    items: { id: string; name: string; variantName: string | null; quantity: number }[]
  }>(
    `SELECT o."id", o."number", o."email", o."userId", o."status", o."createdAt",
       COALESCE((
         SELECT json_agg(json_build_object('id', i."id", 'name', i."name",
                                           'variantName', i."variantName", 'quantity', i."quantity"))
         FROM "OrderItem" i WHERE i."orderId" = o."id"
       ), '[]'::json) AS items
     FROM "Order" o WHERE o."number" = $1`,
    [parsed.data.number],
  )

  // Same answer for someone else's order as for one that does not exist —
  // an order number must not be a way to probe the database.
  if (!order || order.userId !== user.id) return { error: 'We could not find that order' }
  if (!isReturnable(order)) return { error: 'That order is outside the 30-day return window' }

  const chosen = order.items.filter((item) => parsed.data.orderItemIds.includes(item.id))
  if (chosen.length !== parsed.data.orderItemIds.length) return { error: 'We could not find those items on that order' }

  // An item already under review or already approved cannot be sent back twice.
  const pending = await queryOne<{ id: string }>(
    `SELECT ri."id" FROM "ReturnItem" ri
     JOIN "Return" r ON r."id" = ri."returnId"
     WHERE ri."orderItemId" = ANY($1) AND r."status" IN ('REQUESTED', 'APPROVED') LIMIT 1`,
    [chosen.map((item) => item.id)],
  )
  if (pending) return { error: 'One of those items is already part of an open return' }

  const rma = reference('RMA')
  const returnId = newId()
  await transaction([
    {
      text: 'INSERT INTO "Return" ("id", "number", "orderId", "reason") VALUES ($1,$2,$3,$4)',
      values: [returnId, rma, order.id, parsed.data.reason],
    },
    // ponytail: whole lines only, no partial quantities. Add a quantity input
    // here and to the form if customers actually ask to split a line.
    ...chosen.map((item) => ({
      text: 'INSERT INTO "ReturnItem" ("id", "returnId", "orderItemId", "quantity") VALUES ($1,$2,$3,$4)',
      values: [newId(), returnId, item.id, item.quantity],
    })),
  ])

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

  const request = await queryOne<{
    id: string
    number: string
    status: string
    order: { id: string; number: string; email: string }
    items: { quantity: number; orderItem: { unitCents: number } }[]
  }>(
    `SELECT r."id", r."number", r."status",
       json_build_object('id', o."id", 'number', o."number", 'email', o."email") AS "order",
       COALESCE((
         SELECT json_agg(json_build_object('quantity', ri."quantity",
                                           'orderItem', json_build_object('unitCents', oi."unitCents")))
         FROM "ReturnItem" ri JOIN "OrderItem" oi ON oi."id" = ri."orderItemId"
         WHERE ri."returnId" = r."id"
       ), '[]'::json) AS items
     FROM "Return" r JOIN "Order" o ON o."id" = r."orderId"
     WHERE r."number" = $1`,
    [parsed.data.number],
  )
  if (!request) return { error: 'No such return' }
  // Resolving twice would mail a second approval for a refund already promised.
  if (request.status !== 'REQUESTED') return { error: `That return is already ${request.status.toLowerCase()}` }

  const approved = parsed.data.decision === 'APPROVED'
  // Priced from the order lines, never from the form — the refund is not an input.
  const refundCents = approved
    ? request.items.reduce((sum, item) => sum + item.orderItem.unitCents * item.quantity, 0)
    : 0

  await transaction([
    {
      text: `UPDATE "Return" SET "status" = $1::"ReturnStatus", "refundCents" = $2,
               "resolutionNote" = $3, "resolvedAt" = now() WHERE "id" = $4`,
      values: [parsed.data.decision, refundCents, parsed.data.note ?? null, request.id],
    },
    {
      text: 'INSERT INTO "AuditLog" ("id", "actor", "action", "target") VALUES ($1,$2,$3,$4)',
      values: [newId(), admin.email, `return.${parsed.data.decision.toLowerCase()}`, request.number],
    },
    // The order timeline is the one place staff look for "what happened here",
    // so a return decision has to land on it too.
    {
      text: `INSERT INTO "OrderEvent" ("id", "orderId", "actor", "type", "message", "visibleToCustomer")
             VALUES ($1,$2,$3,'RETURN',$4,true)`,
      values: [
        newId(),
        request.order.id,
        admin.email,
        approved
          ? `Return ${request.number} approved for a $${(refundCents / 100).toFixed(2)} refund.`
          : `Return ${request.number} denied.${parsed.data.note ? ` ${parsed.data.note}` : ''}`,
      ],
    },
    ...(approved
      ? [{
          text: 'UPDATE "Order" SET "refundedCents" = "refundedCents" + $1 WHERE "id" = $2',
          values: [refundCents, request.order.id],
        }]
      : []),
  ])

  if (approved) {
    await sendReturnApproved(request.order.email, request.order.number, refundCents, RETURN_INSTRUCTIONS)
  }

  revalidatePath('/admin/returns')
  revalidatePath('/account/orders')
  return { saved: true }
}
