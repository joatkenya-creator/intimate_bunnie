'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

const updateSchema = z.object({
  id: z.string().min(1),
  priceCents: z.number().int().min(0).max(10_000_00),
  inventory: z.number().int().min(0).max(100_000),
  active: z.boolean(),
})

export type AdminState = { error?: string; saved?: boolean }

export async function updateProduct(_prev: AdminState, formData: FormData): Promise<AdminState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch {
    return { error: 'Not authorized' }
  }

  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    priceCents: Math.round(Number(formData.get('price')) * 100),
    inventory: Number(formData.get('inventory')),
    active: formData.get('active') === 'on',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { id, ...data } = parsed.data
  await db.$transaction([
    db.product.update({ where: { id }, data }),
    db.auditLog.create({ data: { actor: admin.email, action: 'product.update', target: id } }),
  ])

  revalidatePath('/admin/products')
  return { saved: true }
}

const statusSchema = z.object({
  number: z.string().min(1),
  status: z.enum(['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED']),
})

export async function updateOrderStatus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  let admin
  try {
    admin = await requireAdmin()
  } catch {
    return { error: 'Not authorized' }
  }

  const parsed = statusSchema.safeParse({ number: formData.get('number'), status: formData.get('status') })
  if (!parsed.success) return { error: 'Invalid status' }

  await db.$transaction([
    db.order.update({ where: { number: parsed.data.number }, data: { status: parsed.data.status } }),
    db.auditLog.create({
      data: { actor: admin.email, action: `order.${parsed.data.status.toLowerCase()}`, target: parsed.data.number },
    }),
  ])

  revalidatePath('/admin/orders')
  return { saved: true }
}
