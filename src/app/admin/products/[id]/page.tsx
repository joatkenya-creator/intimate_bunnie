import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { formatUSD } from '@/lib/money'
import { editorOptions, loadEditorProduct } from '@/server/product-editor'
import { duplicateProduct, deleteProduct } from '@/actions/admin/catalog'
import { PageHeader, Panel, Badge, toneFor, timeAgo } from '@/components/admin/ui'
import { ProductEditor } from '@/components/admin/ProductEditor'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('products.write')
  const { id } = await params

  const [product, options] = await Promise.all([loadEditorProduct(id), editorOptions()])
  if (!product) notFound()

  const [stats, history, mayDelete] = await Promise.all([
    db.orderItem.aggregate({
      where: { productId: id, order: { status: { in: ['PAID', 'FULFILLED'] } } },
      _sum: { quantity: true },
      _count: true,
    }),
    db.inventoryAdjustment.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, delta: true, resulting: true, reason: true, actor: true, createdAt: true },
    }),
    hasPermission('products.delete'),
  ])

  return (
    <>
      <PageHeader
        title={product.name}
        description={`${product.sku} · ${formatUSD(product.priceCents)} · ${stats._sum.quantity ?? 0} sold across ${stats._count} order lines`}
        actions={
          <>
            <Badge tone={toneFor(product.status)}>{product.status}</Badge>
            <RowAction action={duplicateProduct} id={product.id} label="Duplicate" />
            {mayDelete && (
              <RowAction
                action={deleteProduct}
                id={product.id}
                label="Delete"
                variant="danger"
                confirm="Delete this product? If it has orders it will be archived instead."
              />
            )}
            <Link href="/admin/products" className="admin-btn admin-btn-ghost">
              Back to products
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <ProductEditor product={product} {...options} />
        </div>

        <aside className="space-y-3">
          <Panel title="Stock history" description="Every movement, newest first">
            {history.length === 0 ? (
              <p className="text-sm text-[var(--admin-muted)]">No adjustments recorded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <span className={entry.delta < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-ok)]'}>
                      {entry.delta > 0 ? '+' : ''}
                      {entry.delta}
                    </span>{' '}
                    <span className="text-[var(--admin-muted)]">→ {entry.resulting}</span>
                    <span className="block text-xs text-[var(--admin-muted)]">
                      {entry.reason.toLowerCase()} · {entry.actor} · {timeAgo(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/admin/inventory?product=${product.id}`} className="mt-3 block text-xs text-[var(--admin-accent)]">
              Adjust stock →
            </Link>
          </Panel>

          <Panel title="Storefront">
            <p className="text-sm text-[var(--admin-muted)]">/product/{product.slug}</p>
            <Link href={`/product/${product.slug}`} target="_blank" className="admin-btn admin-btn-ghost mt-3">
              Open live page
            </Link>
          </Panel>
        </aside>
      </div>
    </>
  )
}
