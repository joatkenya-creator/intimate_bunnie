import 'server-only'
import { neon } from '@neondatabase/serverless'

// Postgres over Neon's HTTP endpoint. One `fetch` per query, no WebSocket, and
// crucially **no WASM**.
//
// That last point is the whole reason this file exists. Prisma's workerd client
// ships a ~2 MB WASM engine, and instantiating it on a cold isolate blows the
// free plan's 10 ms CPU budget — the Worker returns 503 before it ever reaches
// the database. `wrangler tail` called it exactly: "Worker exceeded CPU time
// limit" on every route that touched Prisma, and never on the ones that did not.
//
// The trade is real: no generated types, no query builder. Every query here is
// SQL, and every value crosses as a bound parameter — never string interpolation.

let client: ReturnType<typeof neon> | null = null

function connection() {
  if (!client) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    // The HTTP client holds no socket, so one module-level instance is safe in
    // workerd — unlike a pooled driver, which cannot cross request boundaries.
    client = neon(url)
  }
  return client
}

/** Runs SQL with bound parameters and returns typed rows. */
export async function query<T>(text: string, values: unknown[] = []): Promise<T[]> {
  return (await connection().query(text, values)) as T[]
}

/** The first row, or null. For lookups that expect at most one. */
export async function queryOne<T>(text: string, values: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, values)
  return rows[0] ?? null
}

/**
 * Collects bound values and hands back their `$n` placeholders, so a filter can
 * be assembled conditionally without ever concatenating a value into SQL.
 *
 *   const p = binder()
 *   const where = ['"active" = true']
 *   if (slug) where.push(`"slug" = ${p.add(slug)}`)
 *   await query(`SELECT … WHERE ${where.join(' AND ')}`, p.values)
 */
export function binder() {
  const values: unknown[] = []
  return {
    values,
    add(value: unknown): string {
      values.push(value)
      return `$${values.length}`
    },
  }
}

/**
 * Several statements in one transaction and one round trip.
 *
 * Neon's HTTP transactions are non-interactive: every statement is sent
 * together, so nothing can branch on an earlier result. Where that matters —
 * checkout re-pricing, for instance — read first, then send the writes as one
 * batch.
 */
export async function transaction(statements: { text: string; values?: unknown[] }[]): Promise<void> {
  if (statements.length === 0) return
  const sql = connection()
  await sql.transaction(statements.map((statement) => sql.query(statement.text, statement.values ?? [])))
}

/** `LIMIT`/`OFFSET` are structural, not values — bounded here rather than bound. */
export function limitOffset(take: number, skip = 0): string {
  return `LIMIT ${Math.max(0, Math.trunc(take))} OFFSET ${Math.max(0, Math.trunc(skip))}`
}
