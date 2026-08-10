// The permission vocabulary. Shared by server guards, the nav, and the role
// editor, so a permission that exists is a permission you can actually grant.
//
// A permission is `resource.action`. `*` grants everything; `orders.*` grants
// every action on orders. That is the whole grammar — two wildcard shapes, no
// policy engine.

export const RESOURCES = [
  'dashboard',
  'products',
  'categories',
  'collections',
  'inventory',
  'media',
  'orders',
  'returns',
  'customers',
  'promotions',
  'content',
  'blog',
  'menus',
  'seo',
  'reports',
  'notifications',
  'settings',
  'staff',
  'audit',
] as const

export type Resource = (typeof RESOURCES)[number]

export const ACTIONS = ['read', 'write', 'delete'] as const
export type Action = (typeof ACTIONS)[number]

export type Permission = `${Resource}.${Action}` | `${Resource}.*` | '*'

/** Every concrete permission, for the role editor's checkbox grid. */
export const ALL_PERMISSIONS: Permission[] = RESOURCES.flatMap((resource) =>
  ACTIONS.map((action) => `${resource}.${action}` as Permission),
)

export const RESOURCE_LABELS: Record<Resource, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  categories: 'Categories',
  collections: 'Collections',
  inventory: 'Inventory',
  media: 'Media library',
  orders: 'Orders',
  returns: 'Returns',
  customers: 'Customers',
  promotions: 'Promotions',
  content: 'Content',
  blog: 'Blog',
  menus: 'Navigation',
  seo: 'SEO',
  reports: 'Reports',
  notifications: 'Notifications',
  settings: 'Settings',
  staff: 'Staff & roles',
  audit: 'Audit log',
}

/**
 * The access levels that can open the admin at all. Kept here rather than
 * spelled out at each call site: widening the `Role` enum once already left a
 * `role === 'ADMIN'` check behind that silently hid the admin link from Super
 * Administrators.
 */
export const STAFF_ROLES = ['STAFF', 'ADMIN', 'SUPER_ADMIN'] as const

export function isStaffRole(role: string | null | undefined): boolean {
  return STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])
}

/**
 * Does this permission set satisfy `needed`? Checks the three grants that can
 * cover it — the exact one, the resource wildcard, and the global wildcard.
 */
export function can(granted: readonly string[], needed: Permission): boolean {
  if (granted.includes('*')) return true
  if (granted.includes(needed)) return true
  const resource = needed.split('.')[0]
  return granted.includes(`${resource}.*`)
}

/** Built-in roles, created by the seed and re-asserted on every seed run. */
export const SYSTEM_ROLES: {
  slug: string
  name: string
  description: string
  permissions: Permission[]
  inherits?: string
}[] = [
  {
    slug: 'super-administrator',
    name: 'Super Administrator',
    description: 'Unrestricted. Can manage staff, roles, and store settings.',
    permissions: ['*'],
  },
  {
    slug: 'administrator',
    name: 'Administrator',
    description: 'Runs the store day to day. Everything except staff, roles, and settings.',
    permissions: RESOURCES.filter((r) => r !== 'staff' && r !== 'settings' && r !== 'audit').map(
      (r) => `${r}.*` as Permission,
    ),
  },
  {
    slug: 'merchandiser',
    name: 'Merchandiser',
    description: 'Catalog, media, and content. No access to orders or customers.',
    inherits: 'support',
    permissions: [
      'products.*',
      'categories.*',
      'collections.*',
      'inventory.*',
      'media.*',
      'content.*',
      'blog.*',
      'seo.*',
    ],
  },
  {
    slug: 'support',
    name: 'Customer Support',
    description: 'Reads the catalog, works orders, returns, and customer records.',
    permissions: [
      'dashboard.read',
      'products.read',
      'inventory.read',
      'orders.read',
      'orders.write',
      'returns.*',
      'customers.read',
      'customers.write',
      'notifications.*',
    ],
  },
]
