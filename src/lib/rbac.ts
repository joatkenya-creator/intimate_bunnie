import 'server-only'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { db } from './db'
import { currentUser, sessionAgeSeconds } from './auth'
import { can, type Permission } from './permissions'

export * from './permissions'

// Admin sessions expire on idle far sooner than the 30-day storefront cookie.
// A shared laptop in a stockroom is the threat, not a stolen cookie.
export const ADMIN_IDLE_TIMEOUT_SECONDS = Number(process.env.ADMIN_SESSION_TIMEOUT_MINUTES ?? 60) * 60

export type AdminActor = {
  id: string
  email: string
  name: string | null
  role: 'STAFF' | 'ADMIN' | 'SUPER_ADMIN'
  roleName: string
  permissions: string[]
}

export class AdminAuthError extends Error {
  constructor(readonly kind: 'UNAUTHENTICATED' | 'EXPIRED' | 'FORBIDDEN') {
    super(kind)
  }
}

/**
 * Walks the inheritance chain and unions the permission sets. Bounded at 8
 * hops so a cycle introduced by a bad edit costs a stack of eight, not a hang.
 */
async function resolvePermissions(roleId: string): Promise<{ name: string; permissions: string[] }> {
  const permissions = new Set<string>()
  let name = ''
  let next: string | null = roleId

  for (let hop = 0; next && hop < 8; hop++) {
    const role: { name: string; permissions: string[]; inheritsId: string | null } | null = await db.adminRole.findUnique(
      { where: { id: next }, select: { name: true, permissions: true, inheritsId: true } },
    )
    if (!role) break
    if (hop === 0) name = role.name
    for (const permission of role.permissions) permissions.add(permission)
    next = role.inheritsId
  }

  return { name, permissions: [...permissions] }
}

/**
 * The signed-in staff member and everything they are allowed to do. Cached per
 * request: the layout, the nav, and each guarded action all ask for it.
 */
export const currentAdmin = cache(async (): Promise<AdminActor | null> => {
  const user = await currentUser().catch(() => null)
  if (!user) return null
  if (user.role === 'CUSTOMER') return null

  const staff = await db.user.findUnique({
    where: { id: user.id },
    select: { adminRoleId: true, status: true },
  })
  if (!staff || staff.status !== 'ACTIVE') return null

  // A super administrator holds the wildcard unconditionally. Without that the
  // store could lock itself out by editing the role that grants staff.write.
  if (user.role === 'SUPER_ADMIN') {
    return { ...user, role: 'SUPER_ADMIN', roleName: 'Super Administrator', permissions: ['*'] }
  }

  const resolved = staff.adminRoleId
    ? await resolvePermissions(staff.adminRoleId)
    : { name: 'No role assigned', permissions: [] as string[] }

  return { ...user, role: user.role as 'STAFF' | 'ADMIN', roleName: resolved.name, permissions: resolved.permissions }
})

/** True when the actor may do this. Use for hiding UI; never as the only gate. */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const admin = await currentAdmin()
  return Boolean(admin && can(admin.permissions, permission))
}

/**
 * The gate. Every admin page, action, and API route calls this before it reads
 * or writes anything — the guard is the first statement, not a wrapper someone
 * can forget to apply.
 */
export async function requirePermission(permission: Permission): Promise<AdminActor> {
  const admin = await currentAdmin()
  if (!admin) throw new AdminAuthError('UNAUTHENTICATED')

  const age = await sessionAgeSeconds()
  if (age === null || age > ADMIN_IDLE_TIMEOUT_SECONDS) throw new AdminAuthError('EXPIRED')

  if (!can(admin.permissions, permission)) throw new AdminAuthError('FORBIDDEN')
  return admin
}

/**
 * The page-level gate. Same check as `requirePermission`, but a page needs a
 * redirect rather than an exception — an operator who lacks a permission should
 * land somewhere useful, not on an error boundary.
 */
export async function requirePagePermission(permission: Permission): Promise<AdminActor> {
  try {
    return await requirePermission(permission)
  } catch (error) {
    if (error instanceof AdminAuthError && error.kind === 'FORBIDDEN') {
      redirect(`/admin?denied=${encodeURIComponent(permission)}`)
    }
    redirect('/account/login?next=/admin&timeout=1')
  }
}

/**
 * Append-only record of who did what. Called inside the same transaction as the
 * write wherever the write is transactional, so the log cannot drift from it.
 */
export async function audit(
  actor: Pick<AdminActor, 'id' | 'email'>,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  const head = await headers().catch(() => null)
  await db.auditLog.create({
    data: {
      actor: actor.email,
      actorId: actor.id,
      action,
      target: target ?? null,
      meta: meta ? JSON.parse(JSON.stringify(meta)) : undefined,
      ip: head?.get('cf-connecting-ip') ?? head?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: head?.get('user-agent')?.slice(0, 300) ?? null,
    },
  })
}

/** Data for `db.auditLog.create` inside a caller's `$transaction`. */
export function auditData(
  actor: Pick<AdminActor, 'id' | 'email'>,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown>,
) {
  return {
    actor: actor.email,
    actorId: actor.id,
    action,
    target: target ?? null,
    meta: meta ? (JSON.parse(JSON.stringify(meta)) as object) : undefined,
  }
}
