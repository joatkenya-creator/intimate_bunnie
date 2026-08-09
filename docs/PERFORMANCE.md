# Performance

## Worker bundle budget

| Band | gzip |
| --- | --- |
| Green | ≤ 2.0 MiB |
| Warning | 2.0 – 2.5 MiB |
| Fail | > 2.5 MiB |
| Hard failure | ≥ 3.0 MiB |

**Measured: 1256.46 KiB gzip** (6213.81 KiB raw) — Green, roughly half the
target with headroom for the deferred integrations.

Measure with `npm run cf:size` and read the `gzip` figure from `Total Upload`.
That is the number Cloudflare enforces.

### What is in it

Roughly, largest first: the Next.js server runtime and React server renderer,
the Prisma client and its query engine, `pg` with its `nodejs_compat` shims, the
OpenNext adapter, then application code — which is a small share of the total.

### Why it is small

- No UI framework, no icon library (icons are ~9 hand-written SVGs), no date
  library, no utility library, no animation library, no state manager.
- No auth dependency — Web Crypto does PBKDF2 and HMAC.
- No money library — `Intl.NumberFormat`.
- No CSV library — a 30-line RFC-4180 parser.
- Product data lives in Postgres, not in JavaScript source.
- Zod is the only runtime validation dependency, and it is server-side.

## Client JavaScript

103 kB shared across all routes; the heaviest page (product detail) adds 4.2 kB.

Kept there by defaulting to Server Components. Product cards, grids, category
pages, filters, and pagination are all server-rendered — filters and paging are
plain links, so a 24-product grid ships one client component: the wishlist heart.

## Images

Never bundled. All product media is remote URLs behind `services/media.ts`, so
Cloudinary can add transforms without any page changing.

Every image carries explicit `width`/`height` (no layout shift),
`loading="lazy"` below the fold, `fetchPriority="high"` on the LCP image, and
`decoding="async"`. Card hover-swap is CSS opacity, not JavaScript.

## Queries

Explicit `select` on every query, no `SELECT *`. Card queries omit
`description`. Pagination is 24 storefront / 25 admin, with `findMany` and
`count` issued concurrently. Related products and autocomplete are capped. The
admin filters and pages in Postgres — the browser never holds the catalog.

## Rendering

Database-backed routes are `force-dynamic` because the free-plan Worker has no
KV binding to back ISR. Adding one and switching those routes to `revalidate` is
the single largest remaining win, and it is a configuration change.

Static content routes are prerendered. `loading.tsx` provides a skeleton so
navigation feels immediate.

## CSS

Tailwind v4 with design tokens in `@theme`. One stylesheet, purged to what the
markup uses. Animations are CSS transitions only, and all of them are disabled
under `prefers-reduced-motion`.

## If the bundle grows

1. `npm run cf:size` to confirm.
2. Look at what changed in `.open-next/server-functions/default`.
3. Usual causes: a dependency pulled into a client component, a server package
   crossing a `'use client'` boundary, or a large JSON file imported into source.
4. Fix the cause. Do not delete features to hit the number.
