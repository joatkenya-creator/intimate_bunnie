import type { Permission } from '@/lib/permissions'

// One list drives the sidebar, the breadcrumb labels, and the command palette.
// A section nobody can see is filtered out server-side by its permission — the
// nav never advertises a route that would then bounce.

export type AdminNavItem = {
  href: string
  label: string
  permission: Permission
  /** Matched with startsWith for highlighting nested routes. */
  match?: string
  badge?: 'orders' | 'returns' | 'lowStock' | 'notifications'
}

export type AdminNavGroup = {
  label: string
  icon: string
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: 'Overview',
    icon: 'grid',
    items: [
      { href: '/admin', label: 'Dashboard', permission: 'dashboard.read' },
      { href: '/admin/reports', label: 'Reports', permission: 'reports.read', match: '/admin/reports' },
      {
        href: '/admin/notifications',
        label: 'Notifications',
        permission: 'notifications.read',
        badge: 'notifications',
      },
    ],
  },
  {
    label: 'Catalog',
    icon: 'tag',
    items: [
      { href: '/admin/products', label: 'Products', permission: 'products.read', match: '/admin/products' },
      { href: '/admin/categories', label: 'Categories', permission: 'categories.read' },
      { href: '/admin/collections', label: 'Collections', permission: 'collections.read' },
      { href: '/admin/inventory', label: 'Inventory', permission: 'inventory.read', badge: 'lowStock' },
      { href: '/admin/media', label: 'Media library', permission: 'media.read' },
    ],
  },
  {
    label: 'Sales',
    icon: 'bag',
    items: [
      { href: '/admin/orders', label: 'Orders', permission: 'orders.read', match: '/admin/orders', badge: 'orders' },
      { href: '/admin/returns', label: 'Returns', permission: 'returns.read', badge: 'returns' },
      { href: '/admin/customers', label: 'Customers', permission: 'customers.read', match: '/admin/customers' },
      { href: '/admin/promotions', label: 'Promotions', permission: 'promotions.read', match: '/admin/promotions' },
    ],
  },
  {
    label: 'Content',
    icon: 'doc',
    items: [
      { href: '/admin/content', label: 'Pages & blocks', permission: 'content.read', match: '/admin/content' },
      { href: '/admin/blog', label: 'Blog', permission: 'blog.read', match: '/admin/blog' },
      { href: '/admin/menus', label: 'Navigation', permission: 'menus.read' },
      { href: '/admin/seo', label: 'SEO & redirects', permission: 'seo.read', match: '/admin/seo' },
    ],
  },
  {
    label: 'System',
    icon: 'cog',
    items: [
      { href: '/admin/settings', label: 'Settings', permission: 'settings.read', match: '/admin/settings' },
      { href: '/admin/staff', label: 'Staff & roles', permission: 'staff.read', match: '/admin/staff' },
      { href: '/admin/audit', label: 'Audit log', permission: 'audit.read' },
    ],
  },
]

/** Human label for a URL segment, for breadcrumbs that are not just slugs. */
export const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  products: 'Products',
  new: 'New',
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
  redirects: 'Redirects',
  reports: 'Reports',
  notifications: 'Notifications',
  settings: 'Settings',
  staff: 'Staff',
  roles: 'Roles',
  audit: 'Audit log',
  invoice: 'Invoice',
  'packing-slip': 'Packing slip',
}
