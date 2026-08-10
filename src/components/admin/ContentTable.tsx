import Link from 'next/link'
import { bulkContent } from '@/actions/admin/content'
import { BulkForm, BulkButton } from './BulkForm'
import { Badge, toneFor, EmptyState, formatDate } from './ui'

// Shared by /admin/content and /admin/blog. The two lists differ by which
// columns matter, not by how selection or bulk publishing works.

type Row = {
  id: string
  title: string
  slug: string
  type: string
  status: string
  category: string | null
  tags: string[]
  publishAt: Date | null
  updatedAt: Date
  author: { name: string | null; email: string } | null
}

export function ContentTable({
  rows,
  basePath,
  showType,
  mayWrite,
}: {
  rows: Row[]
  basePath: string
  showType: boolean
  mayWrite: boolean
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        description="Create the first entry."
        action={
          mayWrite ? (
            <Link href={`${basePath}/new`} className="admin-btn admin-btn-primary">
              New entry
            </Link>
          ) : undefined
        }
      />
    )
  }

  return (
    <BulkForm
      action={bulkContent}
      noun="entries"
      actions={
        mayWrite ? (
          <>
            <BulkButton op="publish">Publish</BulkButton>
            <BulkButton op="draft">Move to draft</BulkButton>
            <BulkButton op="delete" variant="danger" confirm="Delete the selected entries?">
              Delete
            </BulkButton>
          </>
        ) : (
          <span className="text-xs text-[var(--admin-muted)]">Read-only access</span>
        )
      }
    >
      <div className="admin-scroll">
        <table className="admin-table w-full min-w-[44rem]">
          <thead className="border-b border-[var(--admin-line)]">
            <tr>
              <th scope="col" className="w-8">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col">Title</th>
              {showType && <th scope="col">Type</th>}
              <th scope="col">Status</th>
              <th scope="col">Author</th>
              <th scope="col">Publish</th>
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-line)]">
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input type="checkbox" name="ids" value={row.id} aria-label={`Select ${row.title}`} className="size-4 accent-[var(--color-rose-500)]" />
                </td>
                <td>
                  <Link href={`${basePath}/${row.id}`} className="font-medium hover:text-[var(--admin-accent)]">
                    {row.title}
                  </Link>
                  <span className="block text-xs text-[var(--admin-muted)]">
                    /{row.slug}
                    {row.category && ` · ${row.category}`}
                    {row.tags.length > 0 && ` · ${row.tags.join(', ')}`}
                  </span>
                </td>
                {showType && <td className="text-xs text-[var(--admin-muted)]">{row.type}</td>}
                <td>
                  <Badge tone={toneFor(row.status)}>{row.status}</Badge>
                </td>
                <td className="text-xs text-[var(--admin-muted)]">{row.author?.name ?? row.author?.email ?? '—'}</td>
                <td className="text-xs text-[var(--admin-muted)]">{formatDate(row.publishAt)}</td>
                <td className="text-xs text-[var(--admin-muted)]">{formatDate(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BulkForm>
  )
}
