import 'server-only'
import { z } from 'zod'
import { AdminAuthError, requirePermission, type AdminActor, type Permission } from '@/lib/rbac'
import type { ActionState } from '@/lib/form'

// Every admin mutation goes through `run`. It is the single place the
// permission check happens and the single place an error becomes a message, so
// no action can forget the guard or leak a stack trace into the UI.

export type { AdminActor }

export async function run(
  permission: Permission,
  handler: (admin: AdminActor) => Promise<ActionState | void>,
): Promise<ActionState> {
  let admin: AdminActor
  try {
    admin = await requirePermission(permission)
  } catch (error) {
    if (error instanceof AdminAuthError) {
      if (error.kind === 'EXPIRED') return { error: 'Your admin session timed out. Sign in again.' }
      if (error.kind === 'FORBIDDEN') return { error: `You do not have the "${permission}" permission.` }
    }
    return { error: 'Not authorized.' }
  }

  try {
    return (await handler(admin)) ?? { ok: 'Saved' }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of error.issues) fieldErrors[issue.path.join('.') || 'form'] = issue.message
      return { error: error.issues[0]?.message ?? 'Check the highlighted fields.', fieldErrors }
    }
    // Prisma surfaces a unique-constraint breach as P2002 with the field names.
    const code = (error as { code?: string }).code
    if (code === 'P2002') {
      const target = ((error as { meta?: { target?: string[] } }).meta?.target ?? []).join(', ')
      return { error: `That ${target || 'value'} is already taken.` }
    }
    if (code === 'P2003') return { error: 'Something still references this record, so it cannot be removed.' }
    if (code === 'P2025') return { error: 'That record no longer exists.' }

    console.error(`[admin] ${permission} failed:`, error)
    return { error: 'Something went wrong. The error was logged.' }
  }
}
