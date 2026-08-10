'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { saveContent } from '@/actions/admin/content'
import type { ActionState } from '@/lib/form'
import { RichText } from './RichText'
import { FormMessage, SubmitButton, TextField, TextArea, SelectField } from './forms'

// Pages, blog posts, FAQs, announcements, banners, and policies are one record
// type, so they get one editor. `type` decides which fieldsets appear rather
// than which component renders.

export type EditorEntry = {
  id: string
  type: string
  title: string
  slug: string
  excerpt: string | null
  body: string
  status: string
  publishAt: string | null
  heroImage: string | null
  category: string | null
  tags: string[]
  position: number
  linkUrl: string | null
  seoTitle: string | null
  seoDesc: string | null
  canonicalUrl: string | null
  ogImage: string | null
  robots: string | null
  authorId: string | null
}

const TYPES = [
  { value: 'PAGE', label: 'Page' },
  { value: 'POLICY', label: 'Policy' },
  { value: 'FAQ', label: 'FAQ entry' },
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
  { value: 'BANNER', label: 'Homepage banner' },
]

export function ContentEditor({
  entry,
  type,
  authors,
  backHref,
}: {
  entry: EditorEntry | null
  /** Fixed for the blog editor; selectable for everything else. */
  type: string
  authors: { id: string; label: string }[]
  backHref: string
}) {
  const router = useRouter()
  const [state, action] = useActionState<ActionState, FormData>(saveContent, {})
  const isPost = type === 'POST'

  useEffect(() => {
    if (state.createdId) router.replace(`${backHref}/${state.createdId}`)
  }, [state.createdId, router, backHref])

  return (
    <form action={action} className="space-y-4">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      {isPost && <input type="hidden" name="type" value="POST" />}

      <div className="admin-panel sticky top-14 z-20 flex flex-wrap items-center gap-3 p-3">
        <SubmitButton>{entry ? 'Save changes' : 'Create'}</SubmitButton>
        <Link href={backHref} className="admin-btn admin-btn-ghost">
          Back
        </Link>
        <FormMessage state={state} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="admin-panel space-y-4 p-4">
          <TextField label="Title" name="title" defaultValue={entry?.title} required error={state.fieldErrors?.title} />
          <TextField label="Slug" name="slug" defaultValue={entry?.slug} hint="Leave blank to generate from the title." />
          <TextArea label="Excerpt" name="excerpt" rows={2} defaultValue={entry?.excerpt} hint="Used on listings and as the meta description fallback." />
          <RichText name="body" label={type === 'FAQ' ? 'Answer' : 'Body'} defaultValue={entry?.body ?? ''} />
        </div>

        <div className="space-y-3">
          <div className="admin-panel space-y-4 p-4">
            {!isPost && <SelectField label="Type" name="type" defaultValue={entry?.type ?? type} options={TYPES} />}
            <SelectField
              label="Status"
              name="status"
              defaultValue={entry?.status ?? 'DRAFT'}
              options={[
                { value: 'DRAFT', label: 'Draft' },
                { value: 'PUBLISHED', label: 'Published' },
                { value: 'SCHEDULED', label: 'Scheduled' },
              ]}
            />
            <TextField label="Publish at" name="publishAt" type="datetime-local" defaultValue={entry?.publishAt ?? ''} hint="Required when scheduled." />
            {isPost && (
              <>
                <SelectField
                  label="Author"
                  name="authorId"
                  defaultValue={entry?.authorId ?? ''}
                  options={[{ value: '', label: 'You' }, ...authors.map((author) => ({ value: author.id, label: author.label }))]}
                />
                <TextField label="Category" name="category" defaultValue={entry?.category ?? ''} hint="One label, e.g. Guides." />
              </>
            )}
            <TextField label="Tags" name="tags" defaultValue={entry?.tags.join(', ')} hint="Comma separated." />
            <TextField label="Featured image URL" name="heroImage" defaultValue={entry?.heroImage ?? ''} />
            {(type === 'BANNER' || type === 'ANNOUNCEMENT') && (
              <>
                <TextField label="Link URL" name="linkUrl" defaultValue={entry?.linkUrl ?? ''} hint="Where the banner sends people." />
                <TextField label="Position" name="position" type="number" defaultValue={entry?.position ?? 0} hint="Lower shows first." />
              </>
            )}
            {type === 'FAQ' && <TextField label="Position" name="position" type="number" defaultValue={entry?.position ?? 0} />}
          </div>

          <div className="admin-panel space-y-4 p-4">
            <p className="text-sm font-semibold">SEO</p>
            <TextField label="Meta title" name="seoTitle" defaultValue={entry?.seoTitle ?? ''} />
            <TextArea label="Meta description" name="seoDesc" rows={2} defaultValue={entry?.seoDesc ?? ''} />
            <TextField label="Canonical URL" name="canonicalUrl" defaultValue={entry?.canonicalUrl ?? ''} />
            <TextField label="Open Graph image" name="ogImage" defaultValue={entry?.ogImage ?? ''} />
            <SelectField
              label="Robots"
              name="robots"
              defaultValue={entry?.robots ?? ''}
              options={[
                { value: '', label: 'Default (index, follow)' },
                { value: 'noindex,follow', label: 'noindex, follow' },
                { value: 'noindex,nofollow', label: 'noindex, nofollow' },
              ]}
            />
          </div>
        </div>
      </div>
    </form>
  )
}
