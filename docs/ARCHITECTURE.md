# Architecture

## Shape

```
src/
  app/              routes (App Router)
  actions/          server actions — checkout, auth, admin mutations
  components/       ui, layout, product, cart, account, admin
  config/           site constants
  hooks/            client hooks
  lib/              db, auth, money, seo
  server/           query layer (server-only)
  services/         provider boundaries: payment, media, import
prisma/             schema + seed
tests/              node:test unit tests
docs/
```

## Server by default

Every component is a Server Component unless it needs state, events, or browser
APIs. The client bundle is 103 kB shared across all routes.

The client components, and why each one is client-side:

| Component | Reason |
| --- | --- |
| `CartProvider` / `CartDrawer` / `CartPageClient` | localStorage cart, open/close state |
| `AddToCart` | variant + quantity selection |
| `NavBar` | mobile menu, search toggle, cart badge |
| `Gallery` | active-image state |
| `SortSelect` | pushes a new URL on change |
| `WishlistButton` / `WishlistView` / `RecentlyViewed` | localStorage-backed |
| `AuthForm` / `ProductRow` / `OrderStatusForm` | `useActionState` form state |
| `AgeGate` | localStorage affirmation |
| `CheckoutForm` | form state and the server-action call |

Notably **not** client-side: product cards, grids, category pages, filters, and
pagination. Filters and paging are plain `<a>` links, so they are crawlable and
cost zero JavaScript.

## Data access

`src/server/catalog.ts` is the only place storefront queries live. Every query
uses an explicit `select` — there is no `SELECT *`, and card queries never pull
`description`. List queries are paginated at 24 (storefront) and 25 (admin).

`src/lib/db.ts` is `server-only` and caches one `PrismaClient` per isolate.
Prisma reaches Postgres through `@prisma/adapter-pg`.

## Rendering

Routes that read the database are `force-dynamic`. The free-plan Worker has no
KV binding, so OpenNext cannot back ISR; adding one is the single change needed
to switch pages to `revalidate`. Static-content routes (`/pages/[slug]`) are
prerendered via `generateStaticParams`.

The header reads `cookies()` before it queries, which opts routes into dynamic
rendering before any database call — that is what keeps `next build` working
without a reachable database.

## Provider boundaries (deferred integrations)

| Boundary | File | Today | Later |
| --- | --- | --- | --- |
| `PaymentProvider` | `services/payment.ts` | dev provider, records intents | Klarna |
| `ImageStorageProvider` | `services/media.ts` | passthrough remote URLs | Cloudinary |
| `ProductSource` | `services/import/normalize.ts` | CSV / JSON | Firecrawl, supplier APIs |
| Rate limiting | not implemented | — | Upstash Redis |

None of these packages are installed, and none of them are imported. Adding one
is a second implementation of an existing interface, not a rewrite.

## Money

Integer USD cents everywhere — schema, cart, actions, and display. `formatUSD`
wraps `Intl.NumberFormat`; there is no money library. Checkout re-prices every
line from the database, so a tampered localStorage cart cannot change a charge.

## URLs

- `/shop`, `/shop/[category]` — listings; a parent category also matches its children
- `/product/[slug]` — one canonical URL per product

Product URLs are flat rather than `/shop/[category]/[slug]`. A product reachable
under several categories would otherwise produce duplicate URLs competing for
the same canonical, which is the failure mode the nested form invites.
