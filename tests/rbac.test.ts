import { test } from 'node:test'
import assert from 'node:assert/strict'
import { can, ALL_PERMISSIONS, SYSTEM_ROLES, isStaffRole } from '../src/lib/permissions.ts'

// The permission check is the gate in front of every admin write. A wrong
// answer here is either a locked-out owner or an open door.

// Widening the Role enum once left a `role === 'ADMIN'` check behind, which
// silently hid the admin link from the one account that most needed it.
test('every access level above customer counts as staff', () => {
  assert.equal(isStaffRole('STAFF'), true)
  assert.equal(isStaffRole('ADMIN'), true)
  assert.equal(isStaffRole('SUPER_ADMIN'), true)
  assert.equal(isStaffRole('CUSTOMER'), false)
  assert.equal(isStaffRole(null), false)
  assert.equal(isStaffRole(undefined), false)
})

test('an exact grant matches only itself', () => {
  assert.equal(can(['products.write'], 'products.write'), true)
  assert.equal(can(['products.write'], 'products.delete'), false)
  assert.equal(can(['products.write'], 'orders.write'), false)
})

test('a resource wildcard covers every action on that resource only', () => {
  assert.equal(can(['orders.*'], 'orders.read'), true)
  assert.equal(can(['orders.*'], 'orders.delete'), true)
  assert.equal(can(['orders.*'], 'products.read'), false)
})

test('the global wildcard covers everything', () => {
  for (const permission of ALL_PERMISSIONS) assert.equal(can(['*'], permission), true)
})

test('an empty permission set grants nothing', () => {
  assert.equal(can([], 'dashboard.read'), false)
})

test('a resource whose name prefixes another does not leak', () => {
  // "products" must not satisfy a permission on a hypothetical "products-beta".
  assert.equal(can(['products.*'], 'productsbeta.read' as never), false)
})

test('the built-in administrator role cannot reach staff, settings, or the audit log', () => {
  const administrator = SYSTEM_ROLES.find((role) => role.slug === 'administrator')!
  assert.equal(can(administrator.permissions, 'products.write'), true)
  assert.equal(can(administrator.permissions, 'orders.write'), true)
  assert.equal(can(administrator.permissions, 'staff.write'), false)
  assert.equal(can(administrator.permissions, 'settings.write'), false)
  assert.equal(can(administrator.permissions, 'audit.read'), false)
})

test('support can work orders but not edit the catalog', () => {
  const support = SYSTEM_ROLES.find((role) => role.slug === 'support')!
  assert.equal(can(support.permissions, 'orders.write'), true)
  assert.equal(can(support.permissions, 'returns.write'), true)
  assert.equal(can(support.permissions, 'products.read'), true)
  assert.equal(can(support.permissions, 'products.write'), false)
  assert.equal(can(support.permissions, 'promotions.write'), false)
})

test('every system role only grants permissions that exist', () => {
  const known = new Set<string>([...ALL_PERMISSIONS, '*', ...ALL_PERMISSIONS.map((p) => `${p.split('.')[0]}.*`)])
  for (const role of SYSTEM_ROLES) {
    for (const permission of role.permissions) {
      assert.ok(known.has(permission), `${role.slug} grants unknown permission "${permission}"`)
    }
  }
})

test('every inherits target names a real role', () => {
  const slugs = new Set(SYSTEM_ROLES.map((role) => role.slug))
  for (const role of SYSTEM_ROLES) {
    if (role.inherits) assert.ok(slugs.has(role.inherits), `${role.slug} inherits from missing "${role.inherits}"`)
  }
})
