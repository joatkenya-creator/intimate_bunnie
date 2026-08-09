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
| `User` | `CUSTOMER` or `ADMIN`. PBKDF2 password hash. |
| `Address` | U.S. address book. |
| `Order` / `OrderItem` | Line items denormalize name, variant, and unit price so history survives catalog edits. |
| `Coupon` | Percent or fixed-amount discount. |
| `AuditLog` | Every admin mutation. |

## Money

All prices are `Int` cents. No `Float`, no `Decimal`, no rounding surprises at
the tax line.

## Indexes

- `Product`: `[categoryId, active]`, `[featured, active]`, `[priceCents]`
- `Category`: `[parentId, position]`
- `Order`: `[userId, createdAt]`, `[status, createdAt]`
- `ProductMedia`: `[productId, position]`
- `Review`: `[productId, approved]`

These match the actual query shapes in `src/server/catalog.ts` — category
listings, featured rails, price sorting, and order history.

## Migrations

```bash
npx prisma migrate dev --name <change>   # development
npx prisma migrate deploy                # production
npx prisma validate                      # schema check
```

`npm run db:push` is fine for the first local setup; use migrations once there
is data worth keeping.

## Seed

`npm run db:seed` clears the catalog and inserts 6 top-level categories, 13
subcategories, and 40 products with variants, media, and approved reviews.

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
