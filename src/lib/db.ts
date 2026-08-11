import 'server-only'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

// Neon's serverless driver, not node-postgres: it tunnels Postgres over
// WebSockets, and its Pool supports the interactive transactions checkout
// depends on.
//
// One client for the process. Serverless instances are reused across requests,
// so a module-level singleton reuses the connection — a per-request client
// would open a fresh WebSocket on every request and never close it, leaking
// against the Neon connection limit.

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

// `next dev` re-evaluates modules on every edit; without the global the client
// count climbs until Neon refuses new connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
