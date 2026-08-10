# Performance

## Worker bundle budget

| Band | gzip |
| --- | --- |
| Green | ≤ 2.0 MiB |
| Warning | 2.0 – 2.5 MiB |
| Fail | > 2.5 MiB |
| Hard failure | ≥ 3.0 MiB |

**Measured: 2879.52 KiB gzip** (12115.95 KiB raw) — over the 2.5 MiB target, with
191 KiB under the 3.0 MiB hard ceiling. Watch it on every server-side change.

Was 2993.23 KiB with 7 KiB of headroom until the client switched to
`engineType = "client"`.

Measure with `npm run cf:size` and read the `gzip` figure from `Total Upload`.
That is the number Cloudflare enforces.

### Where it went

The 1256.46 KiB figure this file used to quote was measured at `6a8eb25`, when
the schema had no `runtime = "workerd"` — before the WASM query engine existed in
the build at all. `37cf3e9` introduced it to fix a production outage
(`fs.readdir is not implemented` in workerd), and nobody re-measured.

Splitting the number by where the bytes actually are:

| | gzip |
| --- | --- |
| Prisma WASM, ×2 | 1459.8 KiB |
| Everything else — Next runtime, React, app code | 1419.7 KiB |

Against 1256.5 KiB total at `6a8eb25`, application code is a small share of the
growth. **The increase is the WASM, not the storefront or the admin.**

### What `engineType = "client"` changed

The generator now emits `query_compiler_bg.wasm` (1904.6 KiB raw / 729.9 KiB
gzip) instead of `query_engine_bg.wasm` (2243.8 KiB / 864.2 KiB): Prisma calls
compile to SQL and go to the driver adapter, with no Rust query engine. It is not
a preview feature — `queryCompiler` and `driverAdapters` are *deprecated as
preview flags* in 6.19.3 because the functionality graduated.

It saved 113.7 KiB gzip, less than 2 × 134.3 because the compiler path carries
more JavaScript. It does **not** fix the duplication; it makes the duplicated
thing smaller.

### Why it is duplicated

`src/generated/prisma/internal/class.ts` reaches it through a relative dynamic
import:

```ts
const { default: module } = await import('./query_engine_bg.wasm?module')
```

Turbopack builds the RSC layer and the route-handler layer as separate module
graphs, so each emits its own copy — `chunks/ssr/…wasm` and `chunks/…wasm`,
byte-identical, same content hash. `serverExternalPackages` cannot help: it
applies to node_modules packages, and this is generated into our own source tree.

Confining Prisma to one layer would fix it, but four handlers genuinely need both
a route handler and the database: `/api/redirects` (middleware fetches it),
`/api/wishlist` (a `sendBeacon` target), `/api/admin/export` (needs
`content-disposition`), and `/api/admin/cron` (called by an external scheduler).

Switching to the query compiler shrank each copy but left the duplication in
place. Removing it outright needs either Turbopack to share assets across module
layers, or the WASM to be uploaded once as a Cloudflare module binding and
instantiated at runtime instead of imported — which means patching generated
code that `prisma generate` overwrites.

Until then this is a watch item, not a solved one. `npm run cf:size` before any
server-side change, and re-measure after every Prisma upgrade: a larger compiler
would eat the remaining 191 KiB without a line of application code changing.

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
