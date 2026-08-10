'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { auditData } from '@/lib/rbac'
import { run } from '@/server/guard'
import { toBool, toCents, toList, toStringOrNull, type ActionState } from '@/lib/form'

export async function updateCustomer(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('customers.write', async (admin) => {
    const id = String(form.get('id'))
    const status = String(form.get('status') ?? 'ACTIVE')
    if (!['ACTIVE', 'BLOCKED', 'INVITED'].includes(status)) return { error: 'Unknown account status' }

    await db.user.update({
      where: { id },
      data: {
        name: toStringOrNull(form.get('name')),
        phone: toStringOrNull(form.get('phone')),
        status: status as 'ACTIVE' | 'BLOCKED' | 'INVITED',
        tags: toList(form.get('tags')),
        segment: toStringOrNull(form.get('segment')),
        notes: toStringOrNull(form.get('notes')),
        marketingOptIn: toBool(form.get('marketingOptIn')),
      },
    })

    await db.auditLog.create({ data: auditData(admin, 'customer.update', id, { status }) })
    revalidatePath(`/admin/customers/${id}`)
    revalidatePath('/admin/customers')
    return { ok: 'Customer saved' }
  })
}

/**
 * Store credit is an append-only ledger. Issuing and spending are both rows;
 * the balance is their sum, so no correction ever rewrites history.
 */
export async function addStoreCredit(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('customers.write', async (admin) => {
    const userId = String(form.get('userId'))
    const cents = toCents(form.get('amount'))
    const reason = String(form.get('reason') ?? '').trim()

    if (cents === 0) return { error: 'Enter an amount other than zero' }
    if (reason.length < 3) return { error: 'Give a reason — it shows on the ledger' }

    const balance = await db.storeCredit.aggregate({ _sum: { cents: true }, where: { userId } })
    if (cents < 0 && (balance._sum.cents ?? 0) + cents < 0) return { error: 'That would take the balance below zero.' }

    await db.storeCredit.create({ data: { userId, cents, reason, actor: admin.email } })
    await db.auditLog.create({ data: auditData(admin, 'customer.credit', userId, { cents, reason }) })
    revalidatePath(`/admin/customers/${userId}`)
    return { ok: `${cents > 0 ? 'Issued' : 'Deducted'} $${Math.abs(cents / 100).toFixed(2)}` }
  })
}

export async function bulkCustomers(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('customers.write', async (admin) => {
    const ids = form.getAll('ids').map(String).filter(Boolean)
    const op = String(form.get('op') ?? '')
    if (ids.length === 0) return { error: 'Nothing selected' }

    if (op === 'block' || op === 'unblock') {
      await db.user.updateMany({ where: { id: { in: ids } }, data: { status: op === 'block' ? 'BLOCKED' : 'ACTIVE' } })
    } else if (op === 'segment') {
      const segment = toStringOrNull(form.get('segment'))
      await db.user.updateMany({ where: { id: { in: ids } }, data: { segment } })
    } else if (op === 'tag') {
      const tags = toList(form.get('bulkTags'))
      if (tags.length === 0) return { error: 'Enter at least one tag' }
      const rows = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, tags: true } })
      await db.$transaction(
        rows.map((row) => db.user.update({ where: { id: row.id }, data: { tags: [...new Set([...row.tags, ...tags])] } })),
      )
    } else {
      return { error: 'Unknown bulk action' }
    }

    await db.auditLog.create({ data: auditData(admin, `customer.bulk.${op}`, null, { count: ids.length }) })
    revalidatePath('/admin/customers')
    return { ok: `${ids.length} customers updated` }
  })
}
