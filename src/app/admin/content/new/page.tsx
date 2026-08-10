import { requirePagePermission } from '@/lib/rbac'
import { contentAuthors } from '@/server/content'
import { PageHeader } from '@/components/admin/ui'
import { ContentEditor } from '@/components/admin/ContentEditor'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New entry' }

export default async function NewContentPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requirePagePermission('content.write')
  const { type } = await searchParams
  const authors = await contentAuthors()

  return (
    <>
      <PageHeader title="New content entry" description="Choose the type on the right — it decides which fields matter." />
      <ContentEditor entry={null} type={type ?? 'PAGE'} authors={authors} backHref="/admin/content" />
    </>
  )
}
