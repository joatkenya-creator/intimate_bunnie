# Performance

## Server bundle

There is no hard bundle ceiling any more. On Cloudflare Workers the Worker had to
fit under 3.0 MiB gzip, and it came within 7 KiB of that — most of it two copies
of Prisma's WASM engine, one per Turbopack module layer. Vercel imposes no
equivalent limit, so that budget, the `cf:size` check, and the whole
deduplication hunt are gone.

Bundle size still matters for cold-start time, just not as a pass/fail gate. Two
things keep it down and are worth preserving:

- The customer-facing paths do not load Prisma at all. They query Postgres over
  Neon's HTTP endpoint (`src/lib/sql.ts`), so no ORM or engine is instantiated on
  a request a visitor makes. The admin still uses Prisma, where a query builder
  earns its cost.
- `engineType = "client"` on both generators uses Prisma's query compiler rather
  than the Rust query engine.

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

Database-backed routes are `force-dynamic`. Switching the catalog pages to
`revalidate` is the single largest remaining win and is now a per-route change —
Vercel backs ISR out of the box, which the previous host could not.

Static content routes are prerendered. `loading.tsx` provides a skeleton so
navigation feels immediate.

## CSS

Tailwind v4 with design tokens in `@theme`. One stylesheet, purged to what the
markup uses. Animations are CSS transitions only, and all of them are disabled
under `prefers-reduced-motion`.

## If cold starts get slow

1. Check the function duration in the Vercel dashboard, cold vs warm.
2. Usual causes: a dependency pulled into a client component, a server package
   crossing a `'use client'` boundary, a large JSON file imported into source, or
   Prisma reaching a route a customer hits.
3. Fix the cause. Do not delete features to hit a number.
