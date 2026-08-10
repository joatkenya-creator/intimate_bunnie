import 'server-only'
import { db } from '@/lib/db'
import type { EditorEntry } from '@/components/admin/ContentEditor'

/** `datetime-local` needs local wall-clock time, not UTC. */
function toLocalInput(date: Date | null): string | null {
  if (!date) return null
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export async function loadContentEntry(id: string): Promise<EditorEntry | null> {
  const entry = await db.contentEntry.findUnique({ where: { id } })
  if (!entry) return null
  return { ...entry, publishAt: toLocalInput(entry.publishAt) }
}

/** Staff who can be credited as an author. */
export async function contentAuthors() {
  const users = await db.user.findMany({
    where: { role: { in: ['STAFF', 'ADMIN', 'SUPER_ADMIN'] } },
    orderBy: { email: 'asc' },
    select: { id: true, name: true, email: true },
  })
  return users.map((user) => ({ id: user.id, label: user.name ?? user.email }))
}
