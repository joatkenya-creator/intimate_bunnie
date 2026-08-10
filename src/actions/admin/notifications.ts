'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { run } from '@/server/guard'
import type { ActionState } from '@/lib/form'

export async function markNotifications(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('notifications.write', async () => {
    const op = String(form.get('op') ?? 'read')
    const ids = form.getAll('ids').map(String).filter(Boolean)

    if (op === 'all') {
      const { count } = await db.adminNotification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } })
      revalidatePath('/admin', 'layout')
      return { ok: `${count} marked as read` }
    }

    if (ids.length === 0) return { error: 'Nothing selected' }

    if (op === 'delete') {
      await db.adminNotification.deleteMany({ where: { id: { in: ids } } })
    } else {
      await db.adminNotification.updateMany({
        where: { id: { in: ids } },
        data: { readAt: op === 'unread' ? null : new Date() },
      })
    }

    // The unread badge lives in the layout, so the whole admin segment refreshes.
    revalidatePath('/admin', 'layout')
    return { ok: `${ids.length} updated` }
  })
}
