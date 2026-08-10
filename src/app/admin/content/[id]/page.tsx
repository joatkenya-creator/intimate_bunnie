import { notFound } from 'next/navigation'
import { requirePagePermission, hasPermission } from '@/lib/rbac'
import { loadContentEntry, contentAuthors } from '@/server/content'
import { deleteContent } from '@/actions/admin/content'
import { PageHeader } from '@/components/admin/ui'
import { ContentEditor } from '@/components/admin/ContentEditor'
import { RowAction } from '@/components/admin/RowAction'

export const dynamic = 'force-dynamic'

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('content.write')
  const { id } = await params

  const [entry, authors, mayDelete] = await Promise.all([loadContentEntry(id), contentAuthors(), hasPermission('content.delete')])
  if (!entry) notFound()

  return (
    <>
      <PageHeader
        title={entry.title}
        description={`${entry.type} · /${entry.slug}`}
        actions={mayDelete ? <RowAction action={deleteContent} id={entry.id} label="Delete" variant="danger" confirm="Delete this entry?" extra={{ type: entry.type }} /> : undefined}
      />
      <ContentEditor entry={entry} type={entry.type} authors={authors} backHref="/admin/content" />
    </>
  )
}
