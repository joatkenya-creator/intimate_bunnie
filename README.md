# Intimate Bunnie

A U.S. adult ecommerce storefront built on Next.js (App Router) and PostgreSQL,
deployed to Cloudflare Workers through OpenNext.

**Worker bundle: 1256 KiB gzip** against a 2.5 MiB target and a 3.0 MiB hard
limit. See [PERFORMANCE.md](docs/PERFORMANCE.md) for the budget.

## Requirements

- Node 22.9+ (the seed script uses `--experimental-strip-types` and `--env-file-if-exists`)
- A PostgreSQL 14+ database (Neon works as-is)

## Setup

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL and AUTH_SECRET
npx prisma generate
npm run db:push             # create tables
npm run db:seed             # 38 products across 6 top-level categories
npm run db:seed:admin       # roles, staff, orders, customers, content, settings
npm run dev
```

Generate an `AUTH_SECRET` with `openssl rand -base64 32`.

The admin seed prints the credentials it created (`owner@intimatebunnie.test`
unless you set `ADMIN_EMAIL` / `ADMIN_PASSWORD`). Sign in at `/account/login`,
then open `/admin`. To promote an existing account instead:

```sql
UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'you@example.com';
```

The back office covers products, inventory, orders, returns, customers,
promotions, content, blog, SEO, reports, settings, and staff roles — see
[ADMIN.md](docs/ADMIN.md).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Next production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (`node --test`, no framework) |
| `npm run db:push` | Push the Prisma schema to the database |
| `npm run db:seed` | Reset and seed the catalog (destructive) |
| `npm run db:seed:admin` | Seed admin data — additive, safe to re-run |
| `npm run cf:build` | Build the Cloudflare Worker |
| `npm run cf:size` | Build, then print the gzip Worker size |
| `npm run cf:deploy` | Build and deploy to Cloudflare |

## Verification chain

```bash
npm run lint && npm run typecheck && npm test && npm run build
npx prisma validate
npm run cf:size          # Total Upload / gzip must stay under 2.5 MiB
```

## Docs

- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [ADMIN.md](docs/ADMIN.md)
- [DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [DATABASE.md](docs/DATABASE.md)
- [SECURITY.md](docs/SECURITY.md)
- [SEO.md](docs/SEO.md)
- [PERFORMANCE.md](docs/PERFORMANCE.md)
- [IMPORTS.md](docs/IMPORTS.md)

## Deferred integrations

Cloudinary, Klarna, Firecrawl, and Upstash Redis are **not** installed. Each has
an interface boundary waiting for it — see ARCHITECTURE.md.
