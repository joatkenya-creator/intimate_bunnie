# Product ingestion

```
source → parse → normalize → validate → dedupe → database → media
```

`src/services/import/normalize.ts` holds the pure half (no database, unit
tested). `src/services/import/index.ts` holds the database half.

## Pieces

| Piece | Export | Notes |
| --- | --- | --- |
| Source | `ProductSource` | `{ id, fetch(): Promise<RawRecord[]> }` |
| Parser | `parseCsv` | RFC-4180: quoted fields, escaped quotes, embedded commas, CRLF |
| Normalizer | `normalize` | Loose record → canonical shape |
| Validator | `normalizedProduct` | Zod schema; invalid records are skipped, not guessed at |
| Deduper | in `importProducts` | By SKU, within a run and against the database |
| Writer | `importProducts` | Upserts by SKU and returns a report |

## Field mapping

`normalize` accepts the common aliases feeds actually use:

| Canonical | Accepted keys |
| --- | --- |
| `name` | `name`, `title` |
| `summary` | `summary`, `short_description` |
| `priceCents` | `price`, `priceCents` — `"$24.99"`, `24.99`, and `2499` all work |
| `comparePrice` | `compare_at_price` |
| `inventory` | `inventory`, `stock` |
| `categorySlug` | `category` (slugified) |
| `tags` | `tags` (comma-separated) |
| `media` | `images`, `image` (comma-separated URLs) |

`slug` and `sku` are derived from the name when absent.

## Running an import

```ts
import { parseCsv, importProducts } from '@/services/import'

const report = await importProducts(parseCsv(csvText))
// { created, updated, skipped, errors }
```

Re-running the same feed updates rather than duplicating — the upsert key is
SKU. A record whose category slug does not exist is reported in `errors` rather
than silently creating a category, because a typo in a feed should not spawn a
new storefront section.

## Media provenance

Imported media is written with `sourceUrl`, `sourceType: "import"`, and
`licenseStatus: "unverified"`. Nothing promotes media to verified
automatically — set it deliberately once you have confirmed the source permits
commercial reuse.

Seeded placeholder images carry `licenseStatus: "development-placeholder"` so
they are trivially findable before launch.

## Adding a source

Implement `ProductSource` and pipe its output through the same functions:

```ts
const supplier: ProductSource = {
  id: 'acme-feed',
  async fetch() {
    const res = await fetch('https://supplier.example/feed.csv')
    return parseCsv(await res.text())
  },
}

await importProducts(await supplier.fetch())
```

Firecrawl, when it is added, is exactly this — one more `ProductSource`. Nothing
downstream changes, and it is not installed today.

Only ingest sources that permit commercial reuse of their data and imagery.
