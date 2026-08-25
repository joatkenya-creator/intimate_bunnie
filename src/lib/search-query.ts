// Query normalisation, kept out of server/search.ts so it can be tested
// directly — that module is `server-only` and Node cannot load it. Same split
// as lib/permissions.ts against lib/rbac.ts.

/**
 * Cleans a raw search box value before it becomes an ILIKE pattern.
 *
 * `%` and `_` are ILIKE wildcards. They are replaced rather than escaped: a
 * shopper never means them literally, and a lone `%` would match the entire
 * catalog. Quotes and semicolons pass through untouched — they are bound as a
 * parameter, and stripping them would only disguise where the safety comes from.
 */
export function normaliseQuery(raw: string): string {
  // Trim last, not first: replacing the wildcards leaves whitespace behind, and
  // a query of "%" would otherwise normalise to " " — length 1, which slips
  // past an emptiness check and turns into `ILIKE '% %'`, matching every
  // product whose name contains a space.
  return raw
    .replace(/[%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}
