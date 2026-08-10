# Performance

## Worker bundle budget

| Band | gzip |
| --- | --- |
| Green | ≤ 2.0 MiB |
| Warning | 2.0 – 2.5 MiB |
| Fail | > 2.5 MiB |
| Hard failure | ≥ 3.0 MiB |

**Measured: 2993.23 KiB gzip** (12368.12 KiB raw) after the admin shipped —
**Fail band, and 7 KiB under the 3.0 MiB hard ceiling.** It deploys today. The
next non-trivial addition may not.

Previously 1256.46 KiB gzip (6213.81 KiB raw), before the admin.

Measure with `npm run cf:size` and read the `gzip` figure from `Total Upload`.
That is the number Cloudflare enforces.

### The first thing to look at

The Prisma WASM query engine is in the bundle **twice**, 2243.8 KiB each:

```
.open-next/server-functions/default/.next/server/chunks/ssr/…query_engine_bg…wasm
.open-next/server-functions/default/.next/server/chunks/…query_engine_bg…wasm
```

WASM barely compresses, so that duplication is a large share of the total. One
copy served from a shared chunk is the single biggest available win — worth
confirming before shaving anything else, because everything else is Next's own
runtime.

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

Storefront routes land at **124–127 kB** first load. Admin routes run 129–141 kB;
the product editor is the heaviest at 141 kB, and it is the one screen where a
rich client is the point.

Kept there by defaulting to Server Components. Product cards, grids, category
pages, filters, and pagination are all server-rendered — filters and paging are
plain links, so a 24-product grid ships one client component: the wishlist heart.
Every admin *page* is a Server Component too; only the shell and form plumbing
are client-side.

The admin costs the storefront one thing: its `.admin-*` component classes sit in
the same `globals.css`, so storefront visitors download roughly 3 kB of CSS they
never use. Splitting it out would not help much — Tailwind emits every utility
into the file that holds `@import 'tailwindcss'`, so only the hand-written
component layer could move.

### Admin-specific choices

- **No chart library.** Charts are inline SVG rendered on the server; a charting
  package is 40–120 kB of client JavaScript to draw shapes React can describe.
- **No windowing library.** Long tables use `content-visibility: auto` with
  `contain-intrinsic-size`, which is the browser's own row skipping.
- **No rich-text package.** `contenteditable` plus `document.execCommand` in
  ~90 lines, against 100–300 kB for an editor.
- **No PDF or XLSX writer.** Print-to-PDF is the browser's; Excel opens a CSV
  with a BOM.
- **Bulk selection lives in the DOM**, not React state, so ticking a box in a
  500-row table is one re-render rather than five hundred.

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

Admin aggregates (daily revenue, top products, top categories, stock value,
low-stock counts) are computed in Postgres with `date_trunc` and filtered
aggregates, not by reading rows into JavaScript. The dashboard issues its
fourteen queries in one `Promise.all`.

Global search only queries above two characters, debounced at 180 ms, and skips
each record type the caller has no permission to read.

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
