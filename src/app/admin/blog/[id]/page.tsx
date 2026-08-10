import { notFound } from 'next/navigation'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { loadContentEntry, contentAuthors } from '@/server/content'
import { deleteContent } from '@/actions/admin/content'
import { PageHeader } from '@/components/admin/ui'
import { ContentEditor } from '@/components/admin/ContentEditor'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('blog.write')
  const { id } = await params

  const [entry, authors, mayDelete] = await Promise.all([loadContentEntry(id), contentAuthors(), hasPermission('blog.delete')])
  if (!entry) notFound()

  return (
    <>
      <PageHeader
        title={entry.title}
        description={`/${entry.slug}${entry.category ? ` · ${entry.category}` : ''}`}
        actions={mayDelete ? <RowAction action={deleteContent} id={entry.id} label="Delete" variant="danger" confirm="Delete this post?" extra={{ type: 'POST' }} /> : undefined}
      />
      <ContentEditor entry={entry} type="POST" authors={authors} backHref="/admin/blog" />
    </>
  )
}
