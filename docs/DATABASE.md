# Database

PostgreSQL via Prisma, reached through `@prisma/adapter-pg`. Neon-compatible
with no Neon-specific packages.

## Models

| Model | Purpose |
| --- | --- |
| `Category` | Self-referencing tree (`parentId`). Two levels are used. |
| `Brand` | Optional product attribution. |
| `Collection` | Many-to-many merchandising groups. |
| `Product` | Catalog item. Prices in integer cents. |
| `Variant` | One option axis per product (Size **or** Color), with its own SKU, stock, and `priceDelta`. |
| `ProductMedia` | Image URLs plus provenance: `sourceUrl`, `sourceType`, `licenseStatus`, `hash`. |
| `Review` | Moderated (`approved` defaults to false). |
| `User` | `CUSTOMER`, `STAFF`, `ADMIN`, or `SUPER_ADMIN`. PBKDF2 password hash. Carries staff fields (`adminRoleId`, `status`, `lastLoginAt`) and CRM fields (`tags`, `segment`, `notes`, `marketingOptIn`). |
| `AdminRole` | A named permission set with a single inheritance parent. `system` roles cannot be deleted or renamed. |
| `Address` | U.S. address book. |
| `WishlistItem` | Server copy of a signed-in shopper's localStorage wishlist, so support can see it. |
| `StoreCredit` | Append-only ledger. The balance is the sum of its rows — no row is ever edited to "fix" a balance. |
| `Order` / `OrderItem` | Line items denormalize name, variant, and unit price so history survives catalog edits. `refundedCents`, `fraudFlag`, and tracking live on the order. |
| `OrderEvent` | The order timeline: status changes, staff notes, payments, refunds, shipping, fraud, returns. |
| `Return` / `ReturnItem` | RMA against an order. `refundCents` is computed from the returned lines on approval, never entered by hand. |
| `Coupon` | Every promotion kind: coupon code, automatic discount, flash sale, bundle, gift card, referral. |
| `InventoryAdjustment` | Every stock movement, with the resulting level captured at write time. |
| `MediaAsset` | The uploaded media library. `ProductMedia` stays as one product's ordered gallery. |
| `ContentEntry` | Pages, policies, FAQs, announcements, banners, and blog posts, discriminated by `type`. |
| `MenuItem` | Header and footer navigation, one level of nesting. |
| `Redirect` | Managed 301/302 rules, applied in middleware. |
| `Setting` | JSON key/value per settings group. Shapes and defaults live in `src/config/settings.ts`. |
| `AdminNotification` | Orders, low stock, refunds, failed payments, registrations, system alerts. |
| `AuditLog` | Every admin mutation and every sign-in attempt, with actor, IP, user agent, and a JSON detail blob. |

### Why some tables are wider than they look

`ContentEntry` and `Coupon` each replace what would otherwise be five or six
near-identical tables. A page, an FAQ answer, and a blog post differ by which
columns they use, not by what they are; the same is true of a coupon, a flash
sale, and a gift card. `type` / `kind` carries the difference, and the admin
shows only the fields that matter for the value chosen.

## Money

All prices are `Int` cents. No `Float`, no `Decimal`, no rounding surprises at
the tax line.

## Indexes

- `Product`: `[categoryId, active]`, `[featured, active]`, `[priceCents]`, `[status, updatedAt]`, `[inventory]`
- `Category`: `[parentId, position]`
- `Order`: `[userId, createdAt]`, `[status, createdAt]`, `[email]`
- `OrderEvent`: `[orderId, createdAt]`
- `ProductMedia`: `[productId, position]`
- `Review`: `[productId, approved]`
- `User`: `[role, createdAt]`, `[status]`
- `ContentEntry`: unique `[type, slug]`, plus `[type, status, publishAt]`
- `InventoryAdjustment`: `[productId, createdAt]`, `[createdAt]`
- `AuditLog`: `[createdAt]`, `[actorId, createdAt]`, `[action, createdAt]`
- `AdminNotification`: `[readAt, createdAt]`
- `Coupon`: `[active, expiresAt]`, `[kind]`

These match the actual query shapes in `src/server/catalog.ts` (category
listings, featured rails, price sorting, order history) and `src/server/admin.ts`
(admin lists, dashboard aggregates, unread badges).

### Two column comparisons that Prisma cannot express

Low stock is `inventory <= lowStockAt` — two columns, which `where` has no
syntax for. The inventory screen and the dashboard resolve those ids with
`$queryRaw` **before** paging, so page two cannot silently drop rows. Daily and
monthly aggregates use `date_trunc` for the same reason: grouping by day in
JavaScript would mean reading every order into memory.

## Migrations

```bash
npx prisma migrate dev --name <change>   # development
npx prisma migrate deploy                # production
npx prisma validate                      # schema check
```

`npm run db:push` is fine for the first local setup; use migrations once there
is data worth keeping.

## Seed

`npm run db:seed` clears the catalog and inserts 6 top-level categories, 15
subcategories, and 38 products — 73 variants, 114 media rows, and approved
reviews.

`npm run db:seed:admin` is **additive** — it never deletes catalog data, so it is
safe to re-run against a store with products. It creates the built-in roles, a
super administrator, three staff accounts, twelve customers with addresses, sixty
orders with timelines and returns, stock history, media, content, blog posts,
menus, promotions, redirects, settings, and notifications. Every person, address,
and order in it is fictional, and its randomness is seeded so re-runs produce the
same demo store.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before running it, or accept the printed
defaults and change the password immediately.

```bash
npm run db:seed && npm run db:seed:admin
```

Product images are `picsum.photos` placeholders, recorded with
`licenseStatus: "development-placeholder"`. Replace them before launch — the
field exists so you can find them with one query:

```sql
SELECT DISTINCT "productId" FROM "ProductMedia"
WHERE "licenseStatus" = 'development-placeholder';
```

## Search

Postgres `contains` with `mode: 'insensitive'` across name, summary, and tags.
Adequate to low tens of thousands of products. When it stops being adequate, the
upgrade is a `tsvector` column with a GIN index before it is a search service —
`listProducts` is the only function that would change.
