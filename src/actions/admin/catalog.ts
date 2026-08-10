'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { auditData } from '@/lib/rbac'
import { sanitizeHtml, stripHtml } from '@/lib/html'
import { run } from '@/server/guard'
import { toBool, toCents, toDateOrNull, toInt, toList, toStringOrNull, slugify, type ActionState } from '@/lib/form'

// Products, categories, and collections. Anything that changes what a shopper
// sees revalidates the storefront paths it touches — an editor should never
// have to guess whether a change is live.

function revalidateStorefront(slug?: string | null) {
  revalidatePath('/shop', 'layout')
  revalidatePath('/')
  if (slug) revalidatePath(`/product/${slug}`)
}

/**
 * `active` is derived, never typed. A scheduled product is inactive until its
 * time passes; `runDueTransitions()` flips it. This is the only definition.
 */
function deriveActive(status: string, publishAt: Date | null): boolean {
  if (status === 'PUBLISHED') return true
  if (status === 'SCHEDULED') return Boolean(publishAt && publishAt <= new Date())
  return false
}

const mediaSchema = z.array(
  z.object({ url: z.string().min(1), altText: z.string().default(''), width: z.number().nullish(), height: z.number().nullish() }),
)

const variantSchema = z.array(
  z.object({
    id: z.string().optional(),
    optionName: z.string().min(1),
    optionValue: z.string().min(1),
    sku: z.string().min(1),
    priceDelta: z.number().int(),
    inventory: z.number().int().min(0),
  }),
)

const attributeSchema = z.array(z.object({ label: z.string().min(1), value: z.string().default('') }))

function parseJsonField<T>(form: FormData, field: string, schema: z.ZodType<T>, fallback: T): T {
  const raw = form.get(field)
  if (raw == null || raw === '') return fallback
  const parsed = schema.safeParse(JSON.parse(String(raw)))
  if (!parsed.success) throw parsed.error
  return parsed.data
}

const productSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  slug: z.string().min(2, 'Slug is required'),
  summary: z.string().min(2, 'Summary is required'),
  description: z.string().default(''),
  priceCents: z.number().int().min(0).max(5_000_00),
  comparePrice: z.number().int().min(0).max(5_000_00).nullable(),
  sku: z.string().min(1, 'SKU is required'),
  categoryId: z.string().min(1, 'Pick a category'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']),
})

function productFields(form: FormData) {
  const base = productSchema.parse({
    name: String(form.get('name') ?? '').trim(),
    slug: slugify(String(form.get('slug') ?? '') || String(form.get('name') ?? '')),
    summary: String(form.get('summary') ?? '').trim(),
    description: sanitizeHtml(String(form.get('description') ?? '')),
    priceCents: toCents(form.get('price')),
    comparePrice: form.get('comparePrice') ? toCents(form.get('comparePrice')) : null,
    sku: String(form.get('sku') ?? '').trim(),
    categoryId: String(form.get('categoryId') ?? ''),
    status: String(form.get('status') ?? 'DRAFT'),
  })

  const publishAt = toDateOrNull(form.get('publishAt'))

  return {
    ...base,
    publishAt,
    active: deriveActive(base.status, publishAt),
    archivedAt: base.status === 'ARCHIVED' ? new Date() : null,
    brandId: toStringOrNull(form.get('brandId')),
    featured: toBool(form.get('featured')),
    tags: toList(form.get('tags')),
    lowStockAt: toInt(form.get('lowStockAt'), 5),
    weightGrams: form.get('weightGrams') ? toInt(form.get('weightGrams')) : null,
    shippingClass: toStringOrNull(form.get('shippingClass')),
    attributes: parseJsonField(form, 'attributes', attributeSchema, []),
    relatedIds: form.getAll('relatedIds').map(String).filter(Boolean),
    boughtTogetherIds: form.getAll('boughtTogetherIds').map(String).filter(Boolean),
    seoTitle: toStringOrNull(form.get('seoTitle')),
    seoDesc: toStringOrNull(form.get('seoDesc')) ?? stripHtml(base.summary, 155),
    canonicalUrl: toStringOrNull(form.get('canonicalUrl')),
    ogImage: toStringOrNull(form.get('ogImage')),
    robots: toStringOrNull(form.get('robots')),
  }
}

export async function saveProduct(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('products.write', async (admin) => {
    const id = toStringOrNull(form.get('id'))
    const fields = productFields(form)
    const media = parseJsonField(form, 'media', mediaSchema, [])
    const variants = parseJsonField(form, 'variants', variantSchema, [])
    const collectionIds = form.getAll('collectionIds').map(String).filter(Boolean)
    const inventory = toInt(form.get('inventory'))

    const relations = {
      collections: { set: collectionIds.map((collectionId) => ({ id: collectionId })) },
      // Gallery order is the array order. Replacing wholesale is simpler than
      // diffing, and a product has a handful of images, not thousands.
      media: {
        deleteMany: {},
        create: media.map((item, index) => ({
          url: item.url,
          altText: item.altText || fields.name,
          width: item.width ?? null,
          height: item.height ?? null,
          position: index,
          licenseStatus: 'admin-upload',
        })),
      },
      variants: {
        deleteMany: {},
        create: variants.map((variant, index) => ({ ...variant, position: index })),
      },
    }

    if (id) {
      const before = await db.product.findUnique({ where: { id }, select: { slug: true, inventory: true } })
      const product = await db.product.update({
        where: { id },
        data: { ...fields, inventory, ...relations },
        select: { id: true, slug: true, name: true },
      })

      // A stock change made from the editor is still a stock movement.
      if (before && before.inventory !== inventory) {
        await db.inventoryAdjustment.create({
          data: {
            productId: id,
            delta: inventory - before.inventory,
            resulting: inventory,
            reason: 'CORRECTION',
            note: 'Set from the product editor',
            actor: admin.email,
          },
        })
      }

      await db.auditLog.create({ data: auditData(admin, 'product.update', product.id, { name: product.name }) })
      revalidateStorefront(product.slug)
      if (before && before.slug !== product.slug) revalidateStorefront(before.slug)
      revalidatePath('/admin/products')
      return { ok: 'Product saved' }
    }

    const product = await db.product.create({
      data: { ...fields, inventory, ...relations, collections: { connect: collectionIds.map((cid) => ({ id: cid })) } },
      select: { id: true, slug: true, name: true },
    })
    await db.auditLog.create({ data: auditData(admin, 'product.create', product.id, { name: product.name }) })
    revalidateStorefront(product.slug)
    revalidatePath('/admin/products')
    return { ok: 'Product created', createdId: product.id }
  })
}

export async function duplicateProduct(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('products.write', async (admin) => {
    const id = String(form.get('id'))
    const source = await db.product.findUniqueOrThrow({
      where: { id },
      include: { media: true, variants: true, collections: { select: { id: true } } },
    })

    // A copy is always a draft. Duplicating a live product straight into the
    // catalog is how two products end up sharing a canonical URL.
    const suffix = Date.now().toString(36).slice(-4)
    const copy = await db.product.create({
      data: {
        name: `${source.name} (copy)`,
        slug: `${source.slug}-copy-${suffix}`,
        sku: `${source.sku}-C${suffix.toUpperCase()}`,
        summary: source.summary,
        description: source.description,
        priceCents: source.priceCents,
        comparePrice: source.comparePrice,
        inventory: 0,
        status: 'DRAFT',
        active: false,
        featured: false,
        tags: source.tags,
        categoryId: source.categoryId,
        brandId: source.brandId,
        lowStockAt: source.lowStockAt,
        weightGrams: source.weightGrams,
        shippingClass: source.shippingClass,
        attributes: source.attributes ?? undefined,
        seoTitle: source.seoTitle,
        seoDesc: source.seoDesc,
        collections: { connect: source.collections.map((collection) => ({ id: collection.id })) },
        media: {
          create: source.media.map((item) => ({
            url: item.url,
            altText: item.altText,
            width: item.width,
            height: item.height,
            position: item.position,
            licenseStatus: item.licenseStatus,
          })),
        },
        variants: {
          create: source.variants.map((variant) => ({
            optionName: variant.optionName,
            optionValue: variant.optionValue,
            sku: `${variant.sku}-C${suffix.toUpperCase()}`,
            priceDelta: variant.priceDelta,
            inventory: 0,
            position: variant.position,
          })),
        },
      },
      select: { id: true },
    })

    await db.auditLog.create({ data: auditData(admin, 'product.duplicate', copy.id, { from: id }) })
    revalidatePath('/admin/products')
    return { ok: 'Duplicated as a draft', createdId: copy.id }
  })
}

export async function deleteProduct(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('products.delete', async (admin) => {
    const id = String(form.get('id'))
    // An ordered product is never deleted — the order line points at it, and a
    // customer's history must not develop a hole. Archive instead.
    const ordered = await db.orderItem.count({ where: { productId: id } })
    if (ordered > 0) {
      await db.product.update({ where: { id }, data: { status: 'ARCHIVED', active: false, archivedAt: new Date() } })
      await db.auditLog.create({ data: auditData(admin, 'product.archive', id, { reason: 'has orders' }) })
      revalidatePath('/admin/products')
      return { ok: 'This product has orders, so it was archived rather than deleted.' }
    }

    await db.product.delete({ where: { id } })
    await db.auditLog.create({ data: auditData(admin, 'product.delete', id) })
    revalidateStorefront()
    revalidatePath('/admin/products')
    return { ok: 'Product deleted' }
  })
}

const BULK_OPS = ['publish', 'draft', 'archive', 'restore', 'delete', 'feature', 'unfeature', 'category', 'price', 'tag'] as const

export async function bulkProducts(_prev: ActionState, form: FormData): Promise<ActionState> {
  const op = String(form.get('op') ?? '')
  const permission = op === 'delete' ? 'products.delete' : 'products.write'

  return run(permission, async (admin) => {
    const ids = form.getAll('ids').map(String).filter(Boolean)
    if (ids.length === 0) return { error: 'Nothing selected' }
    if (!BULK_OPS.includes(op as (typeof BULK_OPS)[number])) return { error: 'Unknown bulk action' }

    const where = { id: { in: ids } }
    let message = ''

    switch (op) {
      case 'publish':
        await db.product.updateMany({ where, data: { status: 'PUBLISHED', active: true, archivedAt: null } })
        message = `${ids.length} published`
        break
      case 'draft':
        await db.product.updateMany({ where, data: { status: 'DRAFT', active: false } })
        message = `${ids.length} moved to draft`
        break
      case 'archive':
        await db.product.updateMany({ where, data: { status: 'ARCHIVED', active: false, archivedAt: new Date() } })
        message = `${ids.length} archived`
        break
      case 'restore':
        await db.product.updateMany({ where, data: { status: 'DRAFT', active: false, archivedAt: null } })
        message = `${ids.length} restored as drafts`
        break
      case 'feature':
      case 'unfeature':
        await db.product.updateMany({ where, data: { featured: op === 'feature' } })
        message = `${ids.length} updated`
        break
      case 'category': {
        const categoryId = String(form.get('categoryId') ?? '')
        if (!categoryId) return { error: 'Pick a category first' }
        await db.product.updateMany({ where, data: { categoryId } })
        message = `${ids.length} moved`
        break
      }
      case 'tag': {
        const tags = toList(form.get('bulkTags'))
        if (tags.length === 0) return { error: 'Enter at least one tag' }
        // updateMany cannot append to a scalar list, so this is the one bulk op
        // that touches rows individually.
        const rows = await db.product.findMany({ where, select: { id: true, tags: true } })
        await db.$transaction(
          rows.map((row) => db.product.update({ where: { id: row.id }, data: { tags: [...new Set([...row.tags, ...tags])] } })),
        )
        message = `Tagged ${ids.length}`
        break
      }
      case 'price': {
        const mode = String(form.get('priceMode') ?? 'percent')
        const amount = Number(form.get('priceAmount') ?? 0)
        if (!Number.isFinite(amount) || amount === 0) return { error: 'Enter an amount' }
        const rows = await db.product.findMany({ where, select: { id: true, priceCents: true } })
        await db.$transaction(
          rows.map((row) => {
            const next =
              mode === 'percent'
                ? Math.round(row.priceCents * (1 + amount / 100))
                : row.priceCents + Math.round(amount * 100)
            return db.product.update({ where: { id: row.id }, data: { priceCents: Math.max(0, next) } })
          }),
        )
        message = `Repriced ${ids.length}`
        break
      }
      case 'delete': {
        const ordered = await db.orderItem.findMany({ where: { productId: { in: ids } }, select: { productId: true }, distinct: ['productId'] })
        const protectedIds = new Set(ordered.map((row) => row.productId))
        const deletable = ids.filter((id) => !protectedIds.has(id))
        if (protectedIds.size > 0) {
          await db.product.updateMany({
            where: { id: { in: [...protectedIds] } },
            data: { status: 'ARCHIVED', active: false, archivedAt: new Date() },
          })
        }
        if (deletable.length > 0) await db.product.deleteMany({ where: { id: { in: deletable } } })
        message = `${deletable.length} deleted, ${protectedIds.size} archived (they have orders)`
        break
      }
    }

    await db.auditLog.create({ data: auditData(admin, `product.bulk.${op}`, null, { count: ids.length, ids: ids.slice(0, 50) }) })
    revalidateStorefront()
    revalidatePath('/admin/products')
    return { ok: message }
  })
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function saveCategory(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('categories.write', async (admin) => {
    const id = toStringOrNull(form.get('id'))
    const name = String(form.get('name') ?? '').trim()
    if (name.length < 2) return { error: 'Name is required', fieldErrors: { name: 'Name is required' } }

    const parentId = toStringOrNull(form.get('parentId'))
    if (parentId && parentId === id) return { error: 'A category cannot be its own parent.' }

    const data = {
      name,
      slug: slugify(String(form.get('slug') ?? '') || name),
      description: toStringOrNull(form.get('description')),
      heroImage: toStringOrNull(form.get('heroImage')),
      parentId,
      position: toInt(form.get('position')),
      visible: toBool(form.get('visible')),
      featured: toBool(form.get('featured')),
      seoTitle: toStringOrNull(form.get('seoTitle')),
      seoDesc: toStringOrNull(form.get('seoDesc')),
    }

    const category = id
      ? await db.category.update({ where: { id }, data, select: { id: true, slug: true } })
      : await db.category.create({ data, select: { id: true, slug: true } })

    await db.auditLog.create({ data: auditData(admin, id ? 'category.update' : 'category.create', category.id, { name }) })
    revalidatePath('/admin/categories')
    revalidatePath(`/shop/${category.slug}`)
    revalidateStorefront()
    return { ok: 'Category saved', createdId: category.id }
  })
}

export async function deleteCategory(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('categories.delete', async (admin) => {
    const id = String(form.get('id'))
    const [products, children] = await Promise.all([
      db.product.count({ where: { categoryId: id } }),
      db.category.count({ where: { parentId: id } }),
    ])
    if (products > 0) return { error: `${products} products still use this category. Move them first.` }
    if (children > 0) return { error: `${children} subcategories sit under this one. Move them first.` }

    await db.category.delete({ where: { id } })
    await db.auditLog.create({ data: auditData(admin, 'category.delete', id) })
    revalidatePath('/admin/categories')
    revalidateStorefront()
    return { ok: 'Category deleted' }
  })
}

export async function reorderCategories(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('categories.write', async (admin) => {
    // One field per row: `position:<id>`. A single form saves the whole tree.
    const updates = [...form.entries()]
      .filter(([key]) => key.startsWith('position:'))
      .map(([key, value]) => db.category.update({ where: { id: key.slice(9) }, data: { position: toInt(value) } }))

    if (updates.length === 0) return { error: 'Nothing to reorder' }
    await db.$transaction(updates)
    await db.auditLog.create({ data: auditData(admin, 'category.reorder', null, { count: updates.length }) })
    revalidatePath('/admin/categories')
    revalidateStorefront()
    return { ok: 'Order saved' }
  })
}

// ── Collections ─────────────────────────────────────────────────────────────

const ruleSchema = z.object({
  match: z.enum(['all', 'any']).default('all'),
  conditions: z
    .array(
      z.object({
        field: z.enum(['tag', 'category', 'price', 'featured']),
        operator: z.enum(['is', 'is_not', 'gt', 'lt']),
        value: z.string(),
      }),
    )
    .default([]),
})

export async function saveCollection(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('collections.write', async (admin) => {
    const id = toStringOrNull(form.get('id'))
    const name = String(form.get('name') ?? '').trim()
    if (name.length < 2) return { error: 'Name is required', fieldErrors: { name: 'Name is required' } }

    const automatic = toBool(form.get('automatic'))
    const rules = automatic ? parseJsonField(form, 'rules', ruleSchema, { match: 'all', conditions: [] }) : null

    const data = {
      name,
      slug: slugify(String(form.get('slug') ?? '') || name),
      description: toStringOrNull(form.get('description')),
      heroImage: toStringOrNull(form.get('heroImage')),
      featured: toBool(form.get('featured')),
      position: toInt(form.get('position')),
      automatic,
      rules: rules ?? undefined,
      startsAt: toDateOrNull(form.get('startsAt')),
      endsAt: toDateOrNull(form.get('endsAt')),
      seoTitle: toStringOrNull(form.get('seoTitle')),
      seoDesc: toStringOrNull(form.get('seoDesc')),
    }

    const productIds = form.getAll('productIds').map(String).filter(Boolean)
    const members = automatic ? undefined : { set: productIds.map((productId) => ({ id: productId })) }

    const collection = id
      ? await db.collection.update({ where: { id }, data: { ...data, products: members }, select: { id: true } })
      : await db.collection.create({
          data: { ...data, products: members ? { connect: productIds.map((pid) => ({ id: pid })) } : undefined },
          select: { id: true },
        })

    await db.auditLog.create({ data: auditData(admin, id ? 'collection.update' : 'collection.create', collection.id, { name }) })
    revalidatePath('/admin/collections')
    revalidateStorefront()
    return { ok: 'Collection saved', createdId: collection.id }
  })
}

export async function deleteCollection(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run('collections.delete', async (admin) => {
    const id = String(form.get('id'))
    await db.collection.delete({ where: { id } })
    await db.auditLog.create({ data: auditData(admin, 'collection.delete', id) })
    revalidatePath('/admin/collections')
    revalidateStorefront()
    return { ok: 'Collection deleted' }
  })
}
