import Link from 'next/link'
import Image from 'next/image'
import { db } from '@/lib/db'
import { requirePagePermission } from '@/lib/rbac'
import { formatUSD } from '@/lib/money'
import { paging, pageCount, PER_PAGE } from '@/server/admin'
import { bulkProducts } from '@/actions/admin/catalog'
import { PageHeader, Panel, Badge, toneFor, Pagination, FilterBar, SearchInput, FilterSelect, EmptyState, formatDate } from '@/components/admin/ui'
import { BulkForm, BulkButton } from '@/components/admin/BulkForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Products' }

const STATUSES = ['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'] as const

type Search = {
  q?: string
  status?: string
  category?: string
  stock?: string
  sort?: string
  page?: string
}

const SORTS: Record<string, { updatedAt?: 'desc'; priceCents?: 'asc' | 'desc'; inventory?: 'asc'; name?: 'asc' }> = {
  recent: { updatedAt: 'desc' },
  name: { name: 'asc' },
  'price-high': { priceCents: 'desc' },
  'price-low': { priceCents: 'asc' },
  stock: { inventory: 'asc' },
}

export default async function AdminProducts({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission('products.read')
  const params = await searchParams
  const { page, skip, take } = paging(params.page)

  // Filtering, sorting, and paging all happen in Postgres. The browser never
  // receives a row it is not about to show.
  const where = {
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' as const } },
            { sku: { contains: params.q, mode: 'insensitive' as const } },
            { slug: { contains: params.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(params.status && STATUSES.includes(params.status as (typeof STATUSES)[number])
      ? { status: params.status as (typeof STATUSES)[number] }
      : {}),
    ...(params.category ? { categoryId: params.category } : {}),
    ...(params.stock === 'out' ? { inventory: 0 } : params.stock === 'low' ? { inventory: { gt: 0, lte: 5 } } : {}),
  }

  const [products, total, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: SORTS[params.sort ?? 'recent'] ?? SORTS.recent,
      skip,
      take,
      select: {
        id: true,
        slug: true,
        name: true,
        sku: true,
        priceCents: true,
        comparePrice: true,
        inventory: true,
        reservedStock: true,
        lowStockAt: true,
        status: true,
        featured: true,
        updatedAt: true,
        category: { select: { name: true } },
        media: { orderBy: { position: 'asc' }, take: 1, select: { url: true, altText: true } },
        _count: { select: { variants: true } },
      },
    }),
    db.product.count({ where }),
    db.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][])
  const hrefFor = (next: number) => {
    const clone = new URLSearchParams(query)
    clone.set('page', String(next))
    return `/admin/products?${clone}`
  }

  return (
    <>
      <PageHeader
        title="Products"
        description={`${total} in the catalog`}
        actions={
          <>
            <Link href="/admin/inventory" className="admin-btn admin-btn-ghost">
              Inventory
            </Link>
            <Link href="/admin/products/new" className="admin-btn admin-btn-primary">
              New product
            </Link>
          </>
        }
      />

      <Panel bodyClassName="p-0">
        <FilterBar action="/admin/products">
          <SearchInput defaultValue={params.q ?? ''} label="Search" placeholder="Name, SKU, or slug" />
          <FilterSelect
            name="status"
            label="Status"
            value={params.status}
            options={[{ value: '', label: 'Any status' }, ...STATUSES.map((status) => ({ value: status, label: status }))]}
          />
          <FilterSelect
            name="category"
            label="Category"
            value={params.category}
            options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <FilterSelect
            name="stock"
            label="Stock"
            value={params.stock}
            options={[
              { value: '', label: 'Any level' },
              { value: 'low', label: 'Low (1–5)' },
              { value: 'out', label: 'Out of stock' },
            ]}
          />
          <FilterSelect
            name="sort"
            label="Sort"
            value={params.sort}
            options={[
              { value: 'recent', label: 'Recently updated' },
              { value: 'name', label: 'Name A–Z' },
              { value: 'price-high', label: 'Price high → low' },
              { value: 'price-low', label: 'Price low → high' },
              { value: 'stock', label: 'Stock low → high' },
            ]}
          />
        </FilterBar>

        {products.length === 0 ? (
          <EmptyState
            title="No products match those filters"
            description="Clear the filters, or add the first product in this segment."
            action={
              <Link href="/admin/products/new" className="admin-btn admin-btn-primary">
                New product
              </Link>
            }
          />
        ) : (
          <BulkForm
            action={bulkProducts}
            noun="products"
            actions={
              <>
                <BulkButton op="publish">Publish</BulkButton>
                <BulkButton op="draft">Draft</BulkButton>
                <BulkButton op="feature">Feature</BulkButton>
                <BulkButton op="archive" confirm="Archive the selected products?">
                  Archive
                </BulkButton>
                <BulkButton op="restore">Restore</BulkButton>
                <BulkButton op="delete" variant="danger" confirm="Delete the selected products? Ones with orders are archived instead.">
                  Delete
                </BulkButton>
              </>
            }
          >
            {/* Bulk edit inputs travel with the same form, so "apply 10% off to
                these 40 products" is one submit rather than forty. */}
            <div className="admin-scroll flex flex-wrap items-end gap-2 border-b border-[var(--admin-line)] px-4 py-2 text-xs">
              <label className="flex items-center gap-1.5">
                <span className="text-[var(--admin-muted)]">Move to</span>
                <select name="categoryId" className="admin-field w-40 py-1 text-xs" defaultValue="">
                  <option value="">Category…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <BulkButton op="category">Apply</BulkButton>
              </label>

              <label className="flex items-center gap-1.5">
                <span className="text-[var(--admin-muted)]">Price</span>
                <select name="priceMode" className="admin-field w-28 py-1 text-xs" defaultValue="percent">
                  <option value="percent">% change</option>
                  <option value="fixed">$ change</option>
                </select>
                <input name="priceAmount" type="number" step="0.01" placeholder="-10" className="admin-field w-20 py-1 text-xs" />
                <BulkButton op="price">Apply</BulkButton>
              </label>

              <label className="flex items-center gap-1.5">
                <span className="text-[var(--admin-muted)]">Tags</span>
                <input name="bulkTags" placeholder="sale, clearance" className="admin-field w-36 py-1 text-xs" />
                <BulkButton op="tag">Add</BulkButton>
              </label>
            </div>

            <div className="admin-scroll">
              <table className="admin-table w-full min-w-[56rem]">
                <thead className="border-b border-[var(--admin-line)]">
                  <tr>
                    <th scope="col" className="w-8">
                      <span className="sr-only">Select</span>
                    </th>
                    <th scope="col">Product</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">
                      Price
                    </th>
                    <th scope="col" className="text-right">
                      Stock
                    </th>
                    <th scope="col">Updated</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-line)]">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <input
                          type="checkbox"
                          name="ids"
                          value={product.id}
                          aria-label={`Select ${product.name}`}
                          className="size-4 accent-[var(--color-rose-500)]"
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="relative size-9 shrink-0 overflow-hidden rounded bg-[var(--admin-raised)]">
                            {product.media[0] && (
                              <Image src={product.media[0].url} alt="" fill sizes="36px" className="object-cover" unoptimized />
                            )}
                          </span>
                          <span className="min-w-0">
                            <Link href={`/admin/products/${product.id}`} className="block truncate font-medium hover:text-[var(--admin-accent)]">
                              {product.name}
                            </Link>
                            <span className="block text-xs text-[var(--admin-muted)]">
                              {product.sku}
                              {product._count.variants > 0 && ` · ${product._count.variants} variants`}
                              {product.featured && ' · featured'}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="text-[var(--admin-muted)]">{product.category.name}</td>
                      <td>
                        <Badge tone={toneFor(product.status)}>{product.status}</Badge>
                      </td>
                      <td className="text-right tabular-nums">
                        {formatUSD(product.priceCents)}
                        {product.comparePrice && (
                          <span className="block text-xs text-[var(--admin-muted)] line-through">{formatUSD(product.comparePrice)}</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        <span className={product.inventory === 0 ? 'text-[var(--color-danger)]' : product.inventory <= product.lowStockAt ? 'text-[var(--color-warn)]' : ''}>
                          {product.inventory}
                        </span>
                        {product.reservedStock > 0 && (
                          <span className="block text-xs text-[var(--admin-muted)]">{product.reservedStock} to ship</span>
                        )}
                      </td>
                      <td className="text-xs text-[var(--admin-muted)]">{formatDate(product.updatedAt)}</td>
                      <td className="text-right">
                        <Link href={`/product/${product.slug}`} target="_blank" className="text-xs text-[var(--admin-accent)]">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BulkForm>
        )}

        <Pagination page={page} pages={pageCount(total, PER_PAGE)} hrefFor={hrefFor} total={total} noun="products" />
      </Panel>
    </>
  )
}
