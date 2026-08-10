import Link from 'next/link'
import Image from 'next/image'
import { db } from '@/lib/db'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { paging, pageCount } from '@/server/admin'
import { bulkMedia, updateAsset } from '@/actions/admin/media'
import { PageHeader, Panel, Pagination, FilterBar, SearchInput, FilterSelect, EmptyState, formatDate } from '@/components/admin/ui'
import { BulkForm, BulkButton } from '@/components/admin/BulkForm'
import { AdminForm, TextField } from '@/components/admin/forms'
import { MediaUploader } from '@/components/admin/MediaUploader'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Media library' }

const PER_PAGE = 48

type Search = { q?: string; folder?: string; kind?: string; edit?: string; page?: string }

export default async function AdminMedia({ searchParams }: { searchParams: Promise<Search> }) {
  await requirePagePermission('media.read')
  const params = await searchParams
  const { page, skip, take } = paging(params.page, PER_PAGE)
  const mayWrite = await hasPermission('media.write')

  const where = {
    ...(params.folder ? { folder: params.folder } : {}),
    ...(params.kind ? { kind: params.kind as 'IMAGE' | 'VIDEO' | 'DOCUMENT' } : {}),
    ...(params.q
      ? {
          OR: [
            { filename: { contains: params.q, mode: 'insensitive' as const } },
            { altText: { contains: params.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [assets, total, folders, editing] = await Promise.all([
    db.mediaAsset.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    db.mediaAsset.count({ where }),
    db.mediaAsset.groupBy({ by: ['folder'], _count: true, orderBy: { folder: 'asc' } }),
    params.edit ? db.mediaAsset.findUnique({ where: { id: params.edit } }) : null,
  ])

  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][])
  const hrefFor = (next: number) => {
    const clone = new URLSearchParams(query)
    clone.set('page', String(next))
    return `/admin/media?${clone}`
  }

  return (
    <>
      <PageHeader
        title="Media library"
        description="Everything uploaded once, reusable everywhere. Alt text is required before an image reaches the storefront."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <Panel bodyClassName="p-0">
          <FilterBar action="/admin/media">
            <SearchInput defaultValue={params.q ?? ''} label="Search" placeholder="Filename or alt text" />
            <FilterSelect
              name="folder"
              label="Folder"
              value={params.folder}
              options={[
                { value: '', label: 'All folders' },
                ...folders.map((folder) => ({ value: folder.folder, label: `${folder.folder} (${folder._count})` })),
              ]}
            />
            <FilterSelect
              name="kind"
              label="Type"
              value={params.kind}
              options={[
                { value: '', label: 'All types' },
                { value: 'IMAGE', label: 'Images' },
                { value: 'VIDEO', label: 'Video' },
              ]}
            />
          </FilterBar>

          {assets.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              description="Upload on the right, or add images by URL from any product editor."
            />
          ) : (
            <BulkForm
              action={bulkMedia}
              noun="files"
              actions={
                mayWrite ? (
                  <>
                    <input name="folder" placeholder="Move to folder…" aria-label="Destination folder" className="admin-field w-40 py-1 text-xs" />
                    <BulkButton op="move" variant="ghost">
                      <span>Move</span>
                    </BulkButton>
                    <BulkButton op="delete" variant="danger" confirm="Delete the selected files? Files still attached to a product are skipped.">
                      Delete
                    </BulkButton>
                  </>
                ) : (
                  <span className="text-xs text-[var(--admin-muted)]">Read-only access</span>
                )
              }
            >
              <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 xl:grid-cols-5">
                {assets.map((asset) => (
                  <li key={asset.id} className="admin-panel overflow-hidden">
                    <div className="relative aspect-square bg-[var(--admin-raised)]">
                      {asset.kind === 'IMAGE' ? (
                        <Image src={asset.url} alt={asset.altText || asset.filename} fill sizes="200px" className="object-cover" unoptimized />
                      ) : (
                        <span className="grid size-full place-items-center text-xs text-[var(--admin-muted)]">{asset.kind}</span>
                      )}
                      <label className="absolute left-1.5 top-1.5 rounded bg-[var(--admin-panel)]/90 p-1">
                        <input type="checkbox" name="ids" value={asset.id} className="size-4 accent-[var(--color-rose-500)]" />
                        <span className="sr-only">Select {asset.filename}</span>
                      </label>
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-medium">{asset.filename}</p>
                      <p className="truncate text-[0.6875rem] text-[var(--admin-muted)]">
                        {asset.altText || <span className="text-[var(--color-warn)]">No alt text</span>}
                      </p>
                      <p className="text-[0.6875rem] text-[var(--admin-faint)]">
                        {asset.folder} · {formatDate(asset.createdAt)}
                      </p>
                      <Link href={`/admin/media?edit=${asset.id}`} className="text-[0.6875rem] text-[var(--admin-accent)]">
                        Edit details
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </BulkForm>
          )}

          <Pagination page={page} pages={pageCount(total, PER_PAGE)} hrefFor={hrefFor} total={total} noun="files" />
        </Panel>

        <div className="space-y-3">
          {mayWrite && (
            <Panel title="Upload" description="Drop files or pick them — 8 MB each">
              <MediaUploader />
            </Panel>
          )}

          {editing && mayWrite && (
            <Panel title="File details">
              <AdminForm action={updateAsset} key={editing.id}>
                <input type="hidden" name="id" value={editing.id} />
                <TextField label="Alt text" name="altText" defaultValue={editing.altText} hint="Describe the image for someone who cannot see it." />
                <TextField label="Folder" name="folder" defaultValue={editing.folder} />
                <TextField label="Tags" name="tags" defaultValue={editing.tags.join(', ')} hint="Comma separated." />
                <p className="break-all text-xs text-[var(--admin-muted)]">{editing.url}</p>
              </AdminForm>
            </Panel>
          )}

          <Panel title="Image cropping">
            <p className="text-sm text-[var(--admin-muted)]">
              Not built. Cropping belongs in the transform layer, not in stored bytes — the boundary is{' '}
              <code className="text-xs">ImageStorageProvider</code> in <code className="text-xs">services/media.ts</code>, and a
              Cloudinary or Cloudflare Images implementation adds crop parameters to the URL without any page changing.
            </p>
          </Panel>
        </div>
      </div>
    </>
  )
}
