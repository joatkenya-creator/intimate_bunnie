# Admin

The store's back office lives at `/admin`. It is a separate product on the same
origin: its own root shell, its own design tokens, its own permission model, and
no storefront chrome.

## Getting in

```bash
npm run db:seed          # catalog (destructive — clears products)
npm run db:seed:admin    # roles, staff, customers, orders, content, settings (additive)
npm run dev
```

Then sign in at `/account/login` with the address the admin seed printed
(`owner@intimatebunnie.test` unless you set `ADMIN_EMAIL`) and open `/admin`.

To promote an existing account by hand:

```sql
UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'you@example.com';
```

## Access control

Two things gate the admin, and they are deliberately different:

| Layer | What it decides | Where |
| --- | --- | --- |
| **Access level** (`User.role`) | Whether the admin door opens at all | `CUSTOMER` · `STAFF` · `ADMIN` · `SUPER_ADMIN` |
| **Role** (`AdminRole`) | What is behind the door | A named permission set, assignable and inheritable |

A permission is `resource.action` — `products.write`, `orders.read`. Two wildcard
forms exist and no more: `orders.*` for every action on a resource, and `*` for
everything. `src/lib/permissions.ts` is the vocabulary; a permission that is not
listed there cannot be granted, because the role editor drops unknown strings on
save.

**A `SUPER_ADMIN` holds `*` unconditionally, with no role row.** Without that,
editing the role that grants `staff.write` could lock the store out of its own
admin.

Inheritance is a single parent chain (`AdminRole.inheritsId`), resolved in one
pass and bounded at eight hops, so a cycle introduced by a bad edit costs a stack
of eight rather than a hang. Loops are also refused at save time.

Built-in roles, created by the seed and re-asserted on every run:

| Role | Grants |
| --- | --- |
| Super Administrator | `*` |
| Administrator | Everything except `staff`, `settings`, and `audit` |
| Merchandiser | Catalog, media, content, SEO — inherits Customer Support |
| Customer Support | Orders, returns, customers, notifications; read-only catalog |

### Three enforcement points

1. **Middleware** bounces `/admin` requests with no session cookie before
   anything renders. It saves work; it is not the gate.
2. **`requirePagePermission()`** in every page. Redirects rather than throwing —
   an operator who lacks a permission lands on the dashboard, not an error
   boundary.
3. **`run(permission, …)`** in `src/server/guard.ts`, wrapping every server
   action. A server action is a public HTTP endpoint, so the page check protects
   the page and this protects the mutation. Both are needed.

The sidebar filters itself by permission, so a section nobody can open is never
advertised — but that is cosmetics, not security.

### Session timeout

Admin sessions expire on idle after `ADMIN_SESSION_TIMEOUT_MINUTES` (default 60),
independently of the 30-day storefront cookie. The threat is a shared laptop in a
stockroom, not a stolen cookie. Sessions minted before `iat` existed read as
"unknown age" and are asked to sign in again — safe by default.

## Layout

`src/app/admin/layout.tsx` renders `AdminShell`, which owns everything stateful:

- Collapsible sidebar (persisted in `localStorage`), mobile drawer
- Top bar: global search, notification bell, user menu, theme toggle
- Command palette on <kbd>⌘K</kbd> / <kbd>Ctrl-K</kbd> — routes, quick actions,
  and a debounced records search across products, orders, customers, and content
- `g` then `d p o c i m r s` jumps to dashboard, products, orders, customers,
  inventory, media, reports, settings
- Breadcrumbs derived from the URL, never threaded through as props

Every page below the shell is a Server Component.

The storefront's header, footer, cart, and age gate are skipped for `/admin`
because middleware sets `x-pathname` and the root layout reads it. The
alternative was moving twenty storefront routes into a route group purely so the
admin could have its own root.

## Modules

| Route | What it does |
| --- | --- |
| `/admin` | Revenue, orders, customers, alerts, top products and categories, activity, system health, quick actions |
| `/admin/products` | Filter, sort, page; bulk publish / draft / feature / archive / restore / delete / recategorise / reprice / tag |
| `/admin/products/[id]` | Ten-pane editor: general, media, pricing, variants, organisation, shipping, specs, related, SEO, publishing |
| `/admin/categories` | Nested tree, reordering, visibility, featured flags, SEO |
| `/admin/collections` | Manual membership or automatic rules, scheduling, featured, live member count |
| `/admin/inventory` | On-hand, awaiting shipment, incoming, thresholds, adjustments, full movement history |
| `/admin/media` | Upload, drag-and-drop, folders, search, alt text, bulk move and delete |
| `/admin/orders` | Filters, inline status, flags; detail view with timeline, refunds, fulfilment, fraud, notes |
| `/admin/orders/[number]/invoice`, `/packing-slip` | Print documents (print-to-PDF) |
| `/admin/returns` | Queue with the refund each request would cost, approve/deny with a customer-visible note |
| `/admin/customers` | Segments, tags, blocking, lifetime value; detail with orders, wishlist, store credit, addresses |
| `/admin/promotions` | Coupons, automatic discounts, flash sales, bundles, gift cards, referral campaigns |
| `/admin/content` | Pages, policies, FAQs, announcements, banners |
| `/admin/blog` | Posts with author, category, tags, scheduling |
| `/admin/menus` | Header and footer navigation, one level of nesting |
| `/admin/seo` | Metadata audit across products, categories, content; `/redirects` for 301/302 |
| `/admin/reports` | Sales, revenue, products, customers, coupons, inventory, returns, traffic |
| `/admin/notifications` | Orders, low stock, refunds, failed payments, registrations, system |
| `/admin/settings` | General, branding, currency, tax, shipping, email, gateways, legal, feature flags |
| `/admin/staff`, `/staff/roles` | Invite and promote staff, login history, role editor |
| `/admin/audit` | Every admin write and every sign-in attempt |

## Design decisions worth knowing

**`Product.active` is derived, never typed.** The editor sets `status`; `active`
follows from it. One definition, in `deriveActive()` — the catalog cannot
disagree with the editor.

**Scheduling needs no cron.** Middleware polls `/api/redirects` once a minute per
isolate for the redirect map, and that request also runs `runDueTransitions()`,
flipping scheduled products and posts to published. Point a Cloudflare cron
trigger at `POST /api/admin/cron` (guarded by `CRON_SECRET`) when minute
granularity or the low-stock sweep matters.

**One table for all editable copy.** `ContentEntry` carries a `type` — pages,
policies, FAQs, announcements, banners, and blog posts differ by which fields
they use, not by what they are. Six tables would have been six copies of the same
ten columns.

**One table for all promotions.** Same reasoning: a coupon, a flash sale, a
bundle, and a gift card are "a discount, under conditions, within a window".

**Reserved stock means "sold, not yet shipped".** Checkout decrements on-hand
immediately, so on-hand is already available stock. `reservedStock` is a picking
figure, released on fulfilment or cancellation.

**Deleting a product with orders archives it instead.** An order line points at
the product; a customer's history must not develop a hole.

**Charts are inline SVG.** One axis per chart — revenue and order count are two
small multiples, never two y-scales on one plot. Each has a `<title>` per mark
for native hover and a `<details>` table for anyone who wanted the numbers.

**Tables virtualise with `content-visibility: auto`.** That is the browser's own
row skipping; a windowing library would be 15 kB to do less.

**PDF is the browser's print dialog.** Excel opens the CSV once it carries a BOM.
A real `.xlsx` writer is a 400 kB dependency for a file Excel already reads.

## Media uploads

`services/media.ts` gained an upload boundary next to the existing transform one.
`getMediaStorage()` returns an R2-backed provider when the Worker has a
`MEDIA_BUCKET` binding and `MEDIA_PUBLIC_BASE` is set; otherwise it returns a
provider that fails with a sentence an operator can act on. Until a bucket
exists, "Add by URL" in the media picker is the working path.

```jsonc
// wrangler.jsonc
"r2_buckets": [{ "binding": "MEDIA_BUCKET", "bucket_name": "intimate-bunnie-media" }]
```

Uploads are capped at 8 MB and restricted to JPEG, PNG, WebP, AVIF, GIF, and MP4.

## Not built, and why

| Gap | Where it belongs |
| --- | --- |
| Shipping labels | A carrier provider beside `services/payment.ts`. Tracking numbers entered by hand already reach the customer timeline. |
| Image cropping | The `ImageStorageProvider` transform layer — crop parameters on the URL, not new stored bytes. |
| Gift card redemption | Checkout. The records, balances, and admin exist; nothing spends them yet. |
| Coupon redemption counting | Checkout. `usedCount` stays at zero until a code is applied there. |
| Multi-warehouse | `InventoryAdjustment.location` is `"main"` on every row, ready for a second value. |
| A `/blog` storefront route | A storefront change, deliberately out of scope. Posts are stored and ready. |
| Real traffic analytics | The traffic report is explicitly labelled placeholder. Wire an analytics source before quoting it. |
