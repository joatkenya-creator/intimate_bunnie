// Pure parse/normalize helpers. No database, no server-only — unit testable.
import { z } from 'zod'

export type RawRecord = Record<string, string | number | undefined>

export interface ProductSource {
  readonly id: string
  fetch(): Promise<RawRecord[]>
}

export const normalizedProduct = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(2).max(200),
  summary: z.string().min(10).max(400),
  description: z.string().min(10),
  priceCents: z.number().int().positive(),
  comparePrice: z.number().int().positive().optional(),
  sku: z.string().min(1).max(60),
  inventory: z.number().int().min(0),
  categorySlug: z.string().min(1),
  tags: z.array(z.string()).default([]),
  media: z
    .array(z.object({ url: z.string().url(), altText: z.string().min(1), sourceUrl: z.string().url().optional() }))
    .default([]),
})

export type NormalizedProduct = z.infer<typeof normalizedProduct>

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)

/** Accepts dollars ("$24.99") or cents (2499) and always returns cents. */
export function toCents(value: string | number | undefined): number {
  if (typeof value === 'number') return Number.isInteger(value) && value > 1000 ? value : Math.round(value * 100)
  if (!value) return 0
  const cleaned = value.replace(/[^0-9.]/g, '')
  return Math.round(Number(cleaned) * 100) || 0
}

export function normalize(record: RawRecord): NormalizedProduct | null {
  const name = String(record.name ?? record.title ?? '').trim()
  if (!name) return null

  const candidate = {
    slug: slugify(String(record.slug ?? name)),
    name,
    summary: String(record.summary ?? record.short_description ?? name).slice(0, 400),
    description: String(record.description ?? record.summary ?? name),
    priceCents: toCents(record.price ?? record.priceCents),
    comparePrice: record.compare_at_price ? toCents(record.compare_at_price) : undefined,
    sku: String(record.sku ?? slugify(name)).toUpperCase(),
    inventory: Number(record.inventory ?? record.stock ?? 0) || 0,
    categorySlug: slugify(String(record.category ?? 'uncategorized')),
    tags: String(record.tags ?? '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
    media: String(record.images ?? record.image ?? '')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean)
      .map((url) => ({ url, altText: name, sourceUrl: url })),
  }

  const parsed = normalizedProduct.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

/** Minimal RFC-4180 parser: quoted fields, escaped quotes, embedded commas. */
export function parseCsv(text: string): RawRecord[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (field || row.length) {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
      if (char === '\r' && text[i + 1] === '\n') i++
    } else field += char
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }

  const [header, ...body] = rows
  if (!header) return []
  return body.map((cells) => Object.fromEntries(header.map((key, i) => [key.trim(), cells[i] ?? ''])))
}
