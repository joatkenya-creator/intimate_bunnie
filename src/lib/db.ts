import 'server-only'
import { cache } from 'react'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// Neon's serverless driver, not node-postgres: workerd has no complete node:tls,
// so pg's TLS handshake to Neon hangs until the runtime kills the request. The
// Neon driver tunnels Postgres over WebSockets. Its Pool supports transactions,
// which checkout depends on.
//
// The client must be created PER REQUEST. Workers refuse to let one request use
// an I/O object opened by another — a module-level singleton fails the second
// request with "Cannot perform I/O on behalf of a different request".
// React's cache() scopes one client to one request; outside a request scope it
// simply builds a fresh client, which is correct if slower.

const getClient = cache((): PrismaClient => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
})

// A proxy so call sites stay `db.product.findMany(...)` while the client behind
// them is resolved per request.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(getClient(), property, receiver)
  },
})
