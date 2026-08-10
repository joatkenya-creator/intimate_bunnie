import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requirePagePermission } from '@/lib/rbac'
import { getSettings } from '@/server/admin'
import { OrderDocument } from '@/components/admin/OrderDocument'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invoice' }

export default async function InvoicePage({ params }: { params: Promise<{ number: string }> }) {
  await requirePagePermission('orders.read')
  const { number } = await params

  const [order, general, legal] = await Promise.all([
    db.order.findUnique({ where: { number }, include: { items: { include: { product: { select: { sku: true } } } } } }),
    getSettings('general'),
    getSettings('legal'),
  ])
  if (!order) notFound()

  return (
    <OrderDocument
      order={order}
      variant="invoice"
      store={{ name: general.storeName, email: general.supportEmail, address: legal.address, businessName: legal.businessName }}
    />
  )
}
