'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { deleteCustomerAccounts } from '@/lib/auth'
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

/**
 * Hard delete. `customers.delete` alone is not the gate: the Administrator role
 * holds `customers.*`, and erasing a person is not a day-to-day operation — so
 * the coarse role is checked on top of the permission.
 *
 * `redirect` throws NEXT_REDIRECT, which `run`'s catch would turn into "Something
 * went wrong". It goes outside, after the state comes back.
 */
export async function deleteCustomer(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await run('customers.delete', async (admin) => {
    if (admin.role !== 'SUPER_ADMIN') return { error: 'Only a super administrator can delete an account.' }

    const id = String(form.get('id'))
    const [email] = await deleteCustomerAccounts([id])
    if (!email) return { error: 'Only customer accounts can be deleted here — staff go through Staff & roles.' }

    await db.auditLog.create({ data: auditData(admin, 'customer.delete', id, { email }) })
    revalidatePath('/admin/customers')
    return { ok: `Deleted ${email}` }
  })

  // The detail page it was called from now 404s, so leave it.
  if (state.ok) redirect('/admin/customers')
  return state
}

export async function bulkCustomers(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('customers.write', async (admin) => {
    const ids = form.getAll('ids').map(String).filter(Boolean)
    const op = String(form.get('op') ?? '')
    if (ids.length === 0) return { error: 'Nothing selected' }

    // Same super-administrator gate as the single delete, for the same reason:
    // `customers.*` covers `customers.delete`, and this button reaches a whole
    // page of accounts at once.
    if (op === 'delete') {
      if (admin.role !== 'SUPER_ADMIN') return { error: 'Only a super administrator can delete accounts.' }

      const emails = await deleteCustomerAccounts(ids)
      // Short of `ids` means some were staff rows the delete declined to touch.
      const skipped = ids.length - emails.length
      await db.auditLog.create({ data: auditData(admin, 'customer.bulk.delete', null, { emails }) })
      revalidatePath('/admin/customers')
      return {
        ok: `Deleted ${emails.length} customers${skipped > 0 ? ` — ${skipped} skipped, not customer accounts` : ''}`,
      }
    }

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
