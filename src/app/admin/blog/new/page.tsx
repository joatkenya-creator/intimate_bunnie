import { requirePagePermission } from '@/lib/rbac'
import { contentAuthors } from '@/server/content'
import { PageHeader } from '@/components/admin/ui'
import { ContentEditor } from '@/components/admin/ContentEditor'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New post' }

export default async function NewPostPage() {
  await requirePagePermission('blog.write')
  const authors = await contentAuthors()

  return (
    <>
      <PageHeader title="New post" description="Saves as a draft until you set the status." />
      <ContentEditor entry={null} type="POST" authors={authors} backHref="/admin/blog" />
    </>
  )
}
