# SEO

## Metadata

`src/lib/seo.ts` holds `pageMetadata()`, the single place a page's title,
description, canonical, Open Graph, and Twitter card are produced. Pages call it
and nothing else, so canonical and OG URLs cannot drift apart.

Unique metadata is generated for:

- every product (`seoTitle` / `seoDesc` columns, falling back to name and summary)
- every category (same pattern)
- every content page

`metadataBase` is set from `NEXT_PUBLIC_SITE_URL` in the root layout.

## Structured data

| Schema | Where |
| --- | --- |
| `OnlineStore` | root layout, every page |
| `Product` + `Offer` + `AggregateRating` | product pages |
| `BreadcrumbList` | shop, category, product |
| `FAQPage` | `/pages/faq` |

`Offer` carries `priceCurrency: USD`, the real price, live availability derived
from inventory, and `itemCondition`. `AggregateRating` is emitted only when the
product actually has reviews.

## Crawl control

`robots.ts` allows everything except `/admin`, `/account`, `/cart`, `/checkout`,
`/search`, and `/api/`. Search result pages are additionally `noindex` in their
metadata — filtered and paginated search URLs are an infinite surface with no
unique content to rank.

`sitemap.ts` emits the homepage, `/shop`, all content pages, every category, and
every active product with its `updatedAt` as `lastModified`.

## Internal linking

Category tiles on the homepage, a two-level nav with dropdowns, breadcrumbs on
category and product pages, subcategory links in the filter rail, a related
products rail scoped to the same category, and footer columns covering every
top-level category. Filters and pagination are `<a>` links, so a crawler walks
the whole catalog without executing JavaScript.

## U.S. conventions

USD via `Intl.NumberFormat('en-US')`, `lang="en"`, `locale: en_US`, U.S. spelling
in all copy, two-letter state codes with five-digit ZIP validation, and U.S.
shipping terminology.

## Copy

Product descriptions are written for a person deciding whether to buy — material,
dimensions, care, and what the thing actually does. No keyword stuffing. The FAQ
answers real pre-purchase questions (discretion, materials, returns, age), which
is what earns the `FAQPage` markup rather than gaming it.
