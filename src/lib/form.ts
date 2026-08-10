// The one shape every admin server action returns. Client form components read
// it without knowing which action produced it.

export type ActionState = {
  error?: string
  ok?: string
  /** Keyed by input name, so an invalid field can be marked in place. */
  fieldErrors?: Record<string, string>
  /** Id of the row a create action produced, for the client to redirect to. */
  createdId?: string
}

/** `"12.99"` → `1299`. Rounds once, at the boundary, never mid-calculation. */
export function toCents(value: FormDataEntryValue | null): number {
  return Math.round(Number(String(value ?? '0').replace(/[^0-9.-]/g, '')) * 100)
}

export function toInt(value: FormDataEntryValue | null, fallback = 0): number {
  const parsed = Number(String(value ?? ''))
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

export function toBool(value: FormDataEntryValue | null): boolean {
  return value === 'on' || value === 'true' || value === '1'
}

export function toStringOrNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

export function toDateOrNull(value: FormDataEntryValue | null): Date | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

/** `"lace, sheer , lace"` → `["lace","sheer"]`. */
export function toList(value: FormDataEntryValue | null): string[] {
  return [
    ...new Set(
      String(value ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ]
}

/** Lowercase, hyphenated, ASCII. The same rule everywhere a slug is generated. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
