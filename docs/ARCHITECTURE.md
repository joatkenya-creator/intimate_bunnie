# Architecture

## Shape

```
src/
  middleware.ts     pathname header, admin rate limit, managed redirects
  app/
    (storefront)    /, /shop, /product, /cart, /checkout, /account, /pages
    admin/          the back office — its own shell, 24 routes
    api/            /api/products, /api/redirects, /api/wishlist, /api/admin/*
  actions/          server actions
    admin/          catalog, orders, inventory, media, customers, promotions,
                    content, seo, settings, staff, notifications
  components/       ui, layout, product, cart, account, admin
  config/           site constants, settings shapes, admin navigation
  hooks/            client hooks
  lib/              db, auth, password, permissions, rbac, security, form, html,
                    money, seo, ids, returns
  server/           query layer (server-only): catalog, admin, reports,
                    scheduler, guard, content, product-editor
  services/         provider boundaries: payment, media, import
prisma/             schema + catalog seed + admin seed
tests/              node:test unit tests
docs/
```

`lib/` splits by trust boundary, not by topic: `permissions.ts` is pure data and
safe anywhere, `rbac.ts` is `server-only` and does the checking, `password.ts` is
neither (the Node seed script needs it).

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
| `AuthForm` / `OrderStatusForm` | `useActionState` form state |
| `AgeGate` | localStorage affirmation |
| `CheckoutForm` | form state and the server-action call |
| `AdminShell` | sidebar collapse, theme, command palette, keyboard map |
| `Breadcrumbs` | reads the pathname |
| `AdminForm` / `forms.tsx` / `RowAction` / `BulkForm` | `useActionState`, selection counting |
| `ProductEditor` / `ContentEditor` / `CollectionRules` | tab state and repeatable rows |
| `MediaPicker` / `MediaUploader` / `RichText` / `PrintButton` | file APIs, `contenteditable`, `window.print` |

Every admin **page** is a Server Component. The client components above are
chrome and form plumbing; none of them fetch or hold admin data.

Notably **not** client-side: product cards, grids, category pages, filters, and
pagination. Filters and paging are plain `<a>` links, so they are crawlable and
cost zero JavaScript.

## Data access

`src/server/catalog.ts` is the only place storefront queries live;
`src/server/admin.ts` and `src/server/reports.ts` are the equivalent for the back
office, and nothing in them is imported by a customer-facing page. Every query
uses an explicit `select` — there is no `SELECT *`, and card queries never pull
`description`. List queries are paginated at 24 (storefront), 25 (admin lists),
48 (media grid), and 50 (audit log).

`src/lib/db.ts` is `server-only` and builds one `PrismaClient` per request via
React's `cache()`. Prisma reaches Postgres through `@prisma/adapter-neon`.

## Middleware

`src/middleware.ts` is the only place that sees every request before routing, so
it carries the four things that must not be per-page opt-ins:

1. **`x-pathname`** — the root layout reads it to drop storefront chrome on
   `/admin`. A layout cannot read the URL, and the alternative was moving every
   storefront route into a group purely to give the admin its own root.
2. **Admin rate limiting** — 240 requests per IP per minute across `/admin` and
   `/api/admin`, plus a cheap bounce when there is no session cookie.
3. **Managed redirects** — middleware has no database client, so it fetches the
   active map from `/api/redirects` once per isolate per minute. That same
   request runs the scheduled-publish sweep, which is how scheduling works with
   no cron binding.
4. **Admin session refresh** — re-issues the session cookie past the halfway mark
   of the idle window, which turns a hard expiry into a sliding one. A Server
   Component cannot set a cookie, and the admin is nearly all pages, so this is
   the only layer that sees enough of the traffic to do it.

`src/lib/session.ts` exists for that last point: token signing and verification
with no `next/headers` import, so both `lib/auth.ts` (cookie jar) and middleware
(request/response cookies) share one implementation. A `server-only` module
cannot be imported into middleware.

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
| `ImageStorageProvider` | `services/media.ts` | passthrough remote URLs | Cloudinary (also where cropping lands) |
| `MediaStorageProvider` | `services/media.ts` | R2 when bound, otherwise a clear failure | R2 or S3 |
| `ProductSource` | `services/import/normalize.ts` | CSV / JSON | Firecrawl, supplier APIs |
| Rate limiting | `lib/security.ts` | per-isolate fixed window | Durable Object or Upstash |
| Scheduling | `server/scheduler.ts` | piggybacked on the redirect poll | Cloudflare cron → `/api/admin/cron` |

None of these packages are installed, and none of them are imported. Adding one
is a second implementation of an existing interface, not a rewrite.

## Money

Integer USD cents everywhere — schema, cart, actions, and display. `formatUSD`
wraps `Intl.NumberFormat`; there is no money library. Checkout re-prices every
line from the database, so a tampered localStorage cart cannot change a charge.

## URLs

- `/shop`, `/shop/[category]` — listings; a parent category also matches its children
- `/product/[slug]` — one canonical URL per product
- `/pages/[slug]` — a published CMS `Page` or `Policy` wins; the static documents
  in the route file remain the fallback, so a fresh database still serves every
  policy and removing a CMS entry cannot 404 a legal page
- `/admin/**` — `noindex, nofollow` at the layout level, never linked from the
  storefront

Product URLs are flat rather than `/shop/[category]/[slug]`. A product reachable
under several categories would otherwise produce duplicate URLs competing for
the same canonical, which is the failure mode the nested form invites.
