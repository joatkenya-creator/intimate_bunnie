import { db } from '@/lib/db'
import { currentAdmin, can } from '@/lib/rbac'
import { rateLimit, clientIp, tooManyRequests } from '@/lib/security'

export const dynamic = 'force-dynamic'

// Global search behind the command palette. Each record type is only queried if
// the caller may read it, so search can never surface a customer's email to
// someone whose role stops at the catalog.

export async function GET(request: Request) {
  const admin = await currentAdmin()
  if (!admin) return Response.json({ results: [] }, { status: 401 })

  if (!rateLimit(`search:${clientIp(request)}`, 60, 60_000)) return tooManyRequests()

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) return Response.json({ results: [] })

  const like = { contains: query, mode: 'insensitive' as const }

  const [products, orders, customers, content] = await Promise.all([
    can(admin.permissions, 'products.read')
      ? db.product.findMany({
          where: { OR: [{ name: like }, { sku: like }, { slug: like }] },
          select: { id: true, name: true, sku: true },
          take: 5,
        })
      : [],
    can(admin.permissions, 'orders.read')
      ? db.order.findMany({
          where: { OR: [{ number: like }, { email: like }, { shipName: like }] },
          select: { number: true, email: true, totalCents: true },
          take: 5,
        })
      : [],
    can(admin.permissions, 'customers.read')
      ? db.user.findMany({
          where: { role: 'CUSTOMER', OR: [{ email: like }, { name: like }] },
          select: { id: true, email: true, name: true },
          take: 5,
        })
      : [],
    can(admin.permissions, 'content.read')
      ? db.contentEntry.findMany({ where: { title: like }, select: { id: true, title: true, type: true }, take: 5 })
      : [],
  ])

  return Response.json({
    results: [
      ...products.map((product) => ({ id: product.id, label: product.name, sublabel: product.sku, href: `/admin/products/${product.id}`, group: 'Products' })),
      ...orders.map((order) => ({ id: order.number, label: order.number, sublabel: order.email, href: `/admin/orders/${order.number}`, group: 'Orders' })),
      ...customers.map((customer) => ({ id: customer.id, label: customer.name ?? customer.email, sublabel: customer.email, href: `/admin/customers/${customer.id}`, group: 'Customers' })),
      ...content.map((entry) => ({ id: entry.id, label: entry.title, href: entry.type === 'POST' ? `/admin/blog/${entry.id}` : `/admin/content/${entry.id}`, group: 'Content' })),
    ],
  })
}
