'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { auditData, currentAdmin, ALL_PERMISSIONS } from '@/lib/rbac'
import { run } from '@/server/guard'
import { hashPassword } from '@/lib/auth'
import { toStringOrNull, slugify, type ActionState } from '@/lib/form'

const ROLE_LEVELS = ['CUSTOMER', 'STAFF', 'ADMIN', 'SUPER_ADMIN'] as const
type RoleLevel = (typeof ROLE_LEVELS)[number]

const allowed = new Set<string>([...ALL_PERMISSIONS, '*', ...ALL_PERMISSIONS.map((p) => `${p.split('.')[0]}.*`)])

export async function saveRole(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('staff.write', async (admin) => {
    const id = toStringOrNull(form.get('id'))
    const name = String(form.get('name') ?? '').trim()
    if (name.length < 2) return { error: 'Give the role a name', fieldErrors: { name: 'Required' } }

    // Unknown strings are dropped rather than stored: a typo'd permission is a
    // grant that silently never matches, which is worse than an error.
    const permissions = form.getAll('permissions').map(String).filter((permission) => allowed.has(permission))

    const inheritsId = toStringOrNull(form.get('inheritsId'))
    if (inheritsId && inheritsId === id) return { error: 'A role cannot inherit from itself.' }
    if (inheritsId && id && (await inherits(inheritsId, id))) {
      return { error: 'That would create a loop in the inheritance chain.' }
    }

    if (id) {
      const existing = await db.adminRole.findUniqueOrThrow({ where: { id }, select: { system: true, slug: true } })
      const role = await db.adminRole.update({
        where: { id },
        // A system role keeps its slug and name; only its permissions move.
        data: existing.system
          ? { permissions, inheritsId, description: toStringOrNull(form.get('description')) }
          : { name, slug: slugify(String(form.get('slug') ?? '') || name), permissions, inheritsId, description: toStringOrNull(form.get('description')) },
        select: { id: true },
      })
      await db.auditLog.create({ data: auditData(admin, 'role.update', role.id, { name, permissions }) })
      revalidatePath('/admin/staff/roles')
      return { ok: 'Role saved' }
    }

    const role = await db.adminRole.create({
      data: {
        name,
        slug: slugify(String(form.get('slug') ?? '') || name),
        description: toStringOrNull(form.get('description')),
        permissions,
        inheritsId,
      },
      select: { id: true },
    })
    await db.auditLog.create({ data: auditData(admin, 'role.create', role.id, { name, permissions }) })
    revalidatePath('/admin/staff/roles')
    return { ok: 'Role created', createdId: role.id }
  })
}

/** Walks up from `roleId` looking for `ancestorId`. Bounded like the resolver. */
async function inherits(roleId: string, ancestorId: string): Promise<boolean> {
  let next: string | null = roleId
  for (let hop = 0; next && hop < 8; hop++) {
    if (next === ancestorId) return true
    const role: { inheritsId: string | null } | null = await db.adminRole.findUnique({
      where: { id: next },
      select: { inheritsId: true },
    })
    next = role?.inheritsId ?? null
  }
  return false
}

export async function deleteRole(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('staff.delete', async (admin) => {
    const id = String(form.get('id'))
    const role = await db.adminRole.findUniqueOrThrow({
      where: { id },
      select: { system: true, name: true, _count: { select: { users: true, children: true } } },
    })

    if (role.system) return { error: 'Built-in roles cannot be deleted.' }
    if (role._count.users > 0) return { error: `${role._count.users} staff still hold this role. Reassign them first.` }
    if (role._count.children > 0) return { error: 'Another role inherits from this one. Detach it first.' }

    await db.adminRole.delete({ where: { id } })
    await db.auditLog.create({ data: auditData(admin, 'role.delete', id, { name: role.name }) })
    revalidatePath('/admin/staff/roles')
    return { ok: 'Role deleted' }
  })
}

export async function saveStaff(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('staff.write', async (admin) => {
    const id = toStringOrNull(form.get('id'))
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const level = String(form.get('role') ?? 'STAFF') as RoleLevel
    if (!ROLE_LEVELS.includes(level)) return { error: 'Unknown access level' }

    // Only a super administrator can mint another one, and only a super
    // administrator can hand out the level that bypasses role permissions.
    if (level === 'SUPER_ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return { error: 'Only a Super Administrator can grant that level.' }
    }

    const adminRoleId = toStringOrNull(form.get('adminRoleId'))
    const status = String(form.get('status') ?? 'ACTIVE')
    if (!['ACTIVE', 'BLOCKED', 'INVITED'].includes(status)) return { error: 'Unknown status' }

    if (id) {
      // Nobody demotes or blocks themselves — that is how a store loses its last
      // administrator on a Friday afternoon.
      if (id === admin.id && (level === 'CUSTOMER' || status === 'BLOCKED')) {
        return { error: 'You cannot remove your own access. Ask another Super Administrator.' }
      }

      await db.user.update({
        where: { id },
        data: {
          name: toStringOrNull(form.get('name')),
          role: level,
          adminRoleId,
          status: status as 'ACTIVE' | 'BLOCKED' | 'INVITED',
        },
      })
      await db.auditLog.create({ data: auditData(admin, 'staff.update', id, { level, adminRoleId, status }) })
      revalidatePath('/admin/staff')
      return { ok: 'Staff member updated' }
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email', fieldErrors: { email: 'Invalid' } }

    const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
    if (existing) {
      // Promoting an existing customer is the common case — do not ask for a
      // password they already have.
      await db.user.update({ where: { id: existing.id }, data: { role: level, adminRoleId, status: 'ACTIVE' } })
      await db.auditLog.create({ data: auditData(admin, 'staff.promote', existing.id, { email, level }) })
      revalidatePath('/admin/staff')
      return { ok: `${email} now has admin access` }
    }

    // An invited account gets a random password it can never guess; the person
    // sets a real one through the existing password-reset flow.
    const seed = crypto.randomUUID() + crypto.randomUUID()
    const user = await db.user.create({
      data: {
        email,
        name: toStringOrNull(form.get('name')),
        passwordHash: await hashPassword(seed),
        role: level,
        adminRoleId,
        status: 'INVITED',
      },
      select: { id: true },
    })

    await db.auditLog.create({ data: auditData(admin, 'staff.invite', user.id, { email, level }) })
    revalidatePath('/admin/staff')
    return { ok: `${email} invited — send them through "Forgot password" to set one.`, createdId: user.id }
  })
}

export async function revokeStaff(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('staff.delete', async (admin) => {
    const id = String(form.get('id'))
    if (id === admin.id) return { error: 'You cannot revoke your own access.' }

    const me = await currentAdmin()
    const target = await db.user.findUniqueOrThrow({ where: { id }, select: { role: true, email: true } })
    if (target.role === 'SUPER_ADMIN' && me?.role !== 'SUPER_ADMIN') {
      return { error: 'Only a Super Administrator can revoke another one.' }
    }

    // The account survives; only its access goes. Their order history is still
    // a customer's order history.
    await db.user.update({ where: { id }, data: { role: 'CUSTOMER', adminRoleId: null } })
    await db.auditLog.create({ data: auditData(admin, 'staff.revoke', id, { email: target.email }) })
    revalidatePath('/admin/staff')
    return { ok: `Admin access revoked for ${target.email}` }
  })
}
