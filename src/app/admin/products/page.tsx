import Link from 'next/link'
import { db } from '@/lib/db'
import { ProductRow } from '@/components/admin/ProductRow'

export const dynamic = 'force-dynamic'

const PER_PAGE = 25

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)
  // Filtering and paging happen in Postgres — the browser never sees the
  // whole catalog.
  const where = q ? { name: { contains: q, mode: 'insensitive' as const } } : {}

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        slug: true,
        name: true,
        sku: true,
        priceCents: true,
        inventory: true,
        active: true,
        category: { select: { name: true } },
      },
    }),
    db.product.count({ where }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE))
  const linkTo = (n: number) => `/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl">Products</h1>
        <form action="/admin/products" className="flex gap-2">
          <label htmlFor="admin-q" className="sr-only">
            Search products
          </label>
          <input id="admin-q" name="q" defaultValue={q ?? ''} placeholder="Search by name" className="field max-w-56" />
          <button type="submit" className="btn btn-outline">
            Search
          </button>
        </form>
      </div>

      <p className="mt-3 text-sm text-plum-500">{total} products</p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-plum-500">
              <th scope="col" className="py-2 font-normal">Product</th>
              <th scope="col" className="py-2 font-normal">Category</th>
              <th scope="col" className="py-2 font-normal">Price</th>
              <th scope="col" className="py-2 font-normal">Stock</th>
              <th scope="col" className="py-2 font-normal">Live</th>
              <th scope="col" className="py-2 font-normal" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </tbody>
        </table>
      </div>

      {products.length === 0 && <p className="py-10 text-center text-sm text-plum-500">No products match that search.</p>}

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={linkTo(page - 1)} className="link-underline">
              Previous
            </Link>
          )}
          <span className="text-plum-500">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Link href={linkTo(page + 1)} className="link-underline">
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  )
}
