// Managed-redirect resolution. Pure, and deliberately free of Next imports so
// it can be tested without a request — a loop here takes the whole site down.

export type RedirectRule = { destination: string; statusCode: number }
export type RedirectMap = Record<string, RedirectRule>

const MAX_HOPS = 8

/**
 * Follows a redirect to its final destination so a chain costs one response.
 *
 * Editors add rules one at a time, so A→B and later B→C is the normal way a
 * chain appears — and every extra hop is a real round trip for the visitor and
 * a diluted signal for a crawler.
 *
 * Returns null when there is no rule, when a rule points at its own source, or
 * when the chain cycles. Null means "serve the page": a redirect loop is a dead
 * site, and no redirect at all is always the safer failure.
 */
export function resolveRedirect(map: RedirectMap, pathname: string): RedirectRule | null {
  const first = map[pathname]
  if (!first) return null

  const seen = new Set([pathname])
  let { destination, statusCode } = first

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (seen.has(destination)) return null
    seen.add(destination)
    const next = map[destination]
    if (!next) return { destination, statusCode }
    destination = next.destination
    statusCode = next.statusCode
  }

  // Longer than MAX_HOPS without terminating: treat as unresolvable.
  return null
}
