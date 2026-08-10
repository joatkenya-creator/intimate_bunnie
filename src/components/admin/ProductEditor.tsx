'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'
import { saveProduct } from '@/actions/admin/catalog'
import type { ActionState } from '@/lib/form'
import { MediaPicker, type MediaEntry } from './MediaPicker'
import { RichText } from './RichText'
import { FormMessage, SubmitButton, TextField, TextArea, SelectField, Toggle } from './forms'

// One form, several panes. The panes are hidden with CSS rather than
// unmounted — a tab that unmounts drops its inputs from the submission, and
// "my SEO description vanished" is a bug nobody enjoys tracing.

export type EditorProduct = {
  id: string
  name: string
  slug: string
  sku: string
  summary: string
  description: string
  priceCents: number
  comparePrice: number | null
  inventory: number
  lowStockAt: number
  status: string
  publishAt: string | null
  featured: boolean
  tags: string[]
  categoryId: string
  brandId: string | null
  weightGrams: number | null
  shippingClass: string | null
  seoTitle: string | null
  seoDesc: string | null
  canonicalUrl: string | null
  ogImage: string | null
  robots: string | null
  relatedIds: string[]
  boughtTogetherIds: string[]
  attributes: { label: string; value: string }[]
  media: MediaEntry[]
  variants: { id?: string; optionName: string; optionValue: string; sku: string; priceDelta: number; inventory: number }[]
  collectionIds: string[]
}

type Option = { id: string; name: string }

const TABS = [
  'General',
  'Media',
  'Pricing & stock',
  'Variants',
  'Organisation',
  'Shipping',
  'Specifications',
  'Related',
  'SEO',
  'Publishing',
] as const

export function ProductEditor({
  product,
  categories,
  collections,
  brands,
  products,
}: {
  product: EditorProduct | null
  categories: Option[]
  collections: Option[]
  brands: Option[]
  products: Option[]
}) {
  const router = useRouter()
  const [state, action] = useActionState<ActionState, FormData>(saveProduct, {})
  const [tab, setTab] = useState<(typeof TABS)[number]>('General')
  const [variants, setVariants] = useState(product?.variants ?? [])
  const [attributes, setAttributes] = useState(product?.attributes ?? [])

  // A create action returns the new id; the editor then becomes an edit page so
  // a second save updates rather than creating a duplicate.
  useEffect(() => {
    if (state.createdId) router.replace(`/admin/products/${state.createdId}`)
  }, [state.createdId, router])

  const errors = state.fieldErrors ?? {}

  return (
    <form action={action} className="space-y-4">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />
      <input type="hidden" name="attributes" value={JSON.stringify(attributes)} />

      <div className="admin-panel sticky top-14 z-20 flex flex-wrap items-center gap-3 p-3">
        <SubmitButton>{product ? 'Save changes' : 'Create product'}</SubmitButton>
        {product && (
          <Link href={`/product/${product.slug}`} target="_blank" className="admin-btn admin-btn-ghost">
            Preview
          </Link>
        )}
        <FormMessage state={state} />
      </div>

      <div className="admin-scroll -mb-px flex gap-1 border-b border-[var(--admin-line)]" role="tablist" aria-label="Product sections">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              tab === name ? 'border-[var(--admin-accent)]' : 'border-transparent text-[var(--admin-muted)] hover:text-[var(--admin-ink)]'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <Pane active={tab === 'General'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField label="Name" name="name" defaultValue={product?.name} required error={errors.name} />
          <TextField label="URL slug" name="slug" defaultValue={product?.slug} hint="Leave blank to generate from the name." error={errors.slug} />
        </div>
        <TextArea label="Summary" name="summary" rows={2} defaultValue={product?.summary} required hint="One line, used on cards and in meta descriptions." error={errors.summary} />
        <RichText name="description" label="Description" defaultValue={product?.description ?? ''} />
      </Pane>

      <Pane active={tab === 'Media'}>
        <MediaPicker name="media" initial={product?.media ?? []} label="Gallery — the first image is the primary" />
      </Pane>

      <Pane active={tab === 'Pricing & stock'}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField label="Price (USD)" name="price" type="number" step="0.01" min="0" required defaultValue={product ? (product.priceCents / 100).toFixed(2) : ''} error={errors.priceCents} />
          <TextField label="Compare-at price" name="comparePrice" type="number" step="0.01" min="0" defaultValue={product?.comparePrice ? (product.comparePrice / 100).toFixed(2) : ''} hint="Shows as a strike-through." />
          <TextField label="SKU" name="sku" defaultValue={product?.sku} required error={errors.sku} />
          <TextField label="Stock on hand" name="inventory" type="number" min="0" defaultValue={product?.inventory ?? 0} hint="Adjustments here are logged to stock history." />
        </div>
        <TextField label="Low-stock threshold" name="lowStockAt" type="number" min="0" defaultValue={product?.lowStockAt ?? 5} hint="Raises a notification at or below this level." />
      </Pane>

      <Pane active={tab === 'Variants'}>
        <RepeatableRows
          rows={variants}
          onChange={setVariants}
          addLabel="Add variant"
          blank={{ optionName: 'Size', optionValue: '', sku: '', priceDelta: 0, inventory: 0 }}
          columns={[
            { key: 'optionName', label: 'Option', placeholder: 'Size' },
            { key: 'optionValue', label: 'Value', placeholder: 'Medium' },
            { key: 'sku', label: 'SKU', placeholder: 'IB-0001-M' },
            { key: 'priceDelta', label: 'Price delta (cents)', type: 'number' },
            { key: 'inventory', label: 'Stock', type: 'number' },
          ]}
          empty="No variants — this product sells as a single item."
        />
      </Pane>

      <Pane active={tab === 'Organisation'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <SelectField
            label="Category"
            name="categoryId"
            required
            defaultValue={product?.categoryId}
            options={[{ value: '', label: 'Choose a category…' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            error={errors.categoryId}
          />
          <SelectField
            label="Brand"
            name="brandId"
            defaultValue={product?.brandId ?? ''}
            options={[{ value: '', label: 'No brand' }, ...brands.map((b) => ({ value: b.id, label: b.name }))]}
          />
        </div>

        <fieldset>
          <legend className="admin-label">Collections</legend>
          <div className="grid gap-1.5 sm:grid-cols-3">
            {collections.map((collection) => (
              <label key={collection.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="collectionIds" value={collection.id} defaultChecked={product?.collectionIds.includes(collection.id)} className="size-4 accent-[var(--color-rose-500)]" />
                <span className="truncate">{collection.name}</span>
              </label>
            ))}
            {collections.length === 0 && <p className="text-sm text-[var(--admin-muted)]">No collections yet.</p>}
          </div>
        </fieldset>

        <TextField label="Tags" name="tags" defaultValue={product?.tags.join(', ')} hint="Comma separated. Used by automatic collections and search." />
        <Toggle label="Featured" name="featured" defaultChecked={product?.featured} hint="Surfaces on the homepage rail." />
      </Pane>

      <Pane active={tab === 'Shipping'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField label="Weight (grams)" name="weightGrams" type="number" min="0" defaultValue={product?.weightGrams ?? ''} />
          <TextField label="Shipping class" name="shippingClass" defaultValue={product?.shippingClass ?? ''} hint="Free text for now — rate tables read it later." />
        </div>
      </Pane>

      <Pane active={tab === 'Specifications'}>
        <RepeatableRows
          rows={attributes}
          onChange={setAttributes}
          addLabel="Add specification"
          blank={{ label: '', value: '' }}
          columns={[
            { key: 'label', label: 'Label', placeholder: 'Material' },
            { key: 'value', label: 'Value', placeholder: 'Platinum-cured silicone' },
          ]}
          empty="No specifications yet."
        />
      </Pane>

      <Pane active={tab === 'Related'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <ProductMultiSelect name="relatedIds" label="Related products" products={products} selected={product?.relatedIds ?? []} hint="Shown as “You may also like”." />
          <ProductMultiSelect name="boughtTogetherIds" label="Frequently bought together" products={products} selected={product?.boughtTogetherIds ?? []} hint="Shown as a bundle on the product page." />
        </div>
      </Pane>

      <Pane active={tab === 'SEO'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField label="Meta title" name="seoTitle" defaultValue={product?.seoTitle ?? ''} hint="Around 60 characters." />
          <TextField label="Canonical URL" name="canonicalUrl" defaultValue={product?.canonicalUrl ?? ''} hint="Only when this page duplicates another." />
        </div>
        <TextArea label="Meta description" name="seoDesc" rows={2} defaultValue={product?.seoDesc ?? ''} hint="Around 155 characters. Falls back to the summary." />
        <div className="grid gap-4 lg:grid-cols-2">
          <TextField label="Open Graph / Twitter image" name="ogImage" defaultValue={product?.ogImage ?? ''} hint="Defaults to the primary gallery image." />
          <SelectField
            label="Robots"
            name="robots"
            defaultValue={product?.robots ?? ''}
            options={[
              { value: '', label: 'Default (index, follow)' },
              { value: 'noindex,follow', label: 'noindex, follow' },
              { value: 'noindex,nofollow', label: 'noindex, nofollow' },
            ]}
          />
        </div>
      </Pane>

      <Pane active={tab === 'Publishing'}>
        <div className="grid gap-4 lg:grid-cols-2">
          <SelectField
            label="Status"
            name="status"
            defaultValue={product?.status ?? 'DRAFT'}
            options={[
              { value: 'DRAFT', label: 'Draft — invisible to shoppers' },
              { value: 'PUBLISHED', label: 'Published — live now' },
              { value: 'SCHEDULED', label: 'Scheduled — goes live at a set time' },
              { value: 'ARCHIVED', label: 'Archived — hidden, kept for history' },
            ]}
          />
          <TextField label="Publish at" name="publishAt" type="datetime-local" defaultValue={product?.publishAt ?? ''} hint="Only used when the status is Scheduled." />
        </div>
        <p className="text-xs text-[var(--admin-muted)]">
          A scheduled product flips to published within a minute of its publish time.
        </p>
      </Pane>
    </form>
  )
}

function Pane({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div role="tabpanel" hidden={!active} className={active ? 'admin-panel space-y-4 p-4' : 'hidden'}>
      {children}
    </div>
  )
}

function ProductMultiSelect({
  name,
  label,
  products,
  selected,
  hint,
}: {
  name: string
  label: string
  products: Option[]
  selected: string[]
  hint?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="admin-label">
        {label}
      </label>
      <select id={name} name={name} multiple size={8} defaultValue={selected} className="admin-field">
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-[var(--admin-muted)]">{hint} Ctrl/⌘-click to select several.</p>}
    </div>
  )
}

type Column<T> = { key: keyof T & string; label: string; placeholder?: string; type?: string }

/**
 * Variants and specifications are the same shape of problem: an editable list
 * of small records serialised into one hidden field. One component, two uses.
 */
function RepeatableRows<T extends Record<string, string | number>>({
  rows,
  onChange,
  columns,
  blank,
  addLabel,
  empty,
}: {
  rows: T[]
  onChange: (rows: T[]) => void
  columns: Column<T>[]
  blank: T
  addLabel: string
  empty: string
}) {
  return (
    <div>
      {rows.length === 0 && <p className="mb-3 text-sm text-[var(--admin-muted)]">{empty}</p>}

      <ul className="space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="flex flex-wrap items-end gap-2">
            {columns.map((column) => (
              <div key={column.key} className="min-w-32 flex-1">
                <label htmlFor={`${column.key}-${index}`} className="admin-label">
                  {column.label}
                </label>
                <input
                  id={`${column.key}-${index}`}
                  type={column.type ?? 'text'}
                  placeholder={column.placeholder}
                  value={String(row[column.key] ?? '')}
                  onChange={(event) =>
                    onChange(
                      rows.map((current, i) =>
                        i === index
                          ? { ...current, [column.key]: column.type === 'number' ? Number(event.target.value) || 0 : event.target.value }
                          : current,
                      ),
                    )
                  }
                  className="admin-field"
                />
              </div>
            ))}
            <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))} className="admin-btn admin-btn-danger">
              Remove
            </button>
          </li>
        ))}
      </ul>

      <button type="button" onClick={() => onChange([...rows, { ...blank }])} className="admin-btn admin-btn-ghost mt-3">
        {addLabel}
      </button>
    </div>
  )
}
