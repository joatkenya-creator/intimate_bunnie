# Security

## Authentication

Sessions and password hashing run on Web Crypto, which exists in both Node and
workerd — no auth dependency, no Node-only shim in the Worker.

- **Passwords**: PBKDF2-SHA256, 100,000 iterations, 16-byte random salt, stored
  as `pbkdf2$iterations$salt$hash`.
- **Sessions**: a JSON payload (`uid`, `exp`) signed with HMAC-SHA256 using
  `AUTH_SECRET`, in an `httpOnly`, `sameSite=lax`, `secure`-in-production cookie
  with a 30-day expiry.
- Signature and hash comparisons are constant-time.
- Login returns one message for both "no such user" and "wrong password", so the
  form cannot be used to enumerate accounts.

## Authorization

Role-based, with three enforcement points. Full model in [ADMIN.md](ADMIN.md).

1. **Middleware** — bounces `/admin` with no session cookie, and rate-limits
   `/admin` and `/api/admin`. Work saved, not a gate.
2. **`requirePagePermission(permission)`** — in every admin page, before any
   admin data is read. Redirects rather than throwing.
3. **`run(permission, …)`** — wraps every admin server action, and
   `currentAdmin()` + `can()` guards every `/api/admin` route handler.

A server action is a public HTTP endpoint, so the page check protects the page
and the action check protects the mutation. Both are needed, and both exist.

A `SUPER_ADMIN` holds the `*` permission unconditionally, with no role row —
otherwise editing the role that grants `staff.write` could lock the store out of
its own admin. Staff cannot demote, block, or revoke themselves, and only a
super administrator can grant or revoke that level.

Admin sessions time out on idle after `ADMIN_SESSION_TIMEOUT_MINUTES` (default
60), separately from the 30-day storefront cookie. A session with no `iat` claim
reads as unknown age and is asked to sign in again.

Customer routes call `currentUser()` server-side and redirect. No client-side
route guard is load-bearing anywhere.

## Input validation

Every server action and route handler parses its input with Zod before touching
the database:

- `actions/checkout.ts` — email, U.S. address, ZIP format, per-line quantity caps
- `actions/auth.ts` — email format, 8-character password minimum
- `actions/admin/*.ts` — price and stock bounds, enum-checked statuses, JSON
  payloads (media, variants, specifications, collection rules) parsed with a Zod
  schema so a crafted field cannot invent a column
- `api/products/route.ts` — at most 12 IDs, each length-bounded
- `api/wishlist/route.ts` — capped at 60 ids, and only ids that resolve to a real
  product are stored
- `api/admin/media/upload/route.ts` — 8 MB cap, MIME allow-list, generated
  storage key so one filename cannot overwrite another

## Money integrity

Checkout ignores prices from the browser. It re-reads every product and variant
from the database, recomputes the subtotal, shipping, and tax, and only then
creates the order. Editing localStorage changes nothing.

Order creation and stock decrements share one `$transaction`, so an oversell
cannot slip between the stock check and the write.

## SQL injection

All access goes through Prisma. The handful of `$queryRaw` calls in
`src/server/admin.ts`, `reports.ts`, and `scheduler.ts` use tagged templates, so
every interpolation is a bound parameter — never string concatenation. They exist
because Postgres can compare two columns and truncate dates and Prisma's `where`
cannot.

## XSS

React escapes by default. There are exactly three `dangerouslySetInnerHTML`
call sites:

1. JSON-LD from `jsonLd()`, which stringifies and escapes `<`.
2. The admin theme bootstrap — a fixed string constant, no interpolation.
3. CMS page bodies on `/pages/[slug]`.

The third is the one that matters. Editor HTML is sanitised **on write**, in
`sanitizeHtml()`, with an allow-list of tags and per-tag attributes: scripts,
styles, iframes, objects, embeds, forms, comments, event handlers, and
`javascript:`/`data:` URLs are removed, unknown tags are dropped entirely rather
than unwrapped, and any `target="_blank"` gains `rel="noopener noreferrer"`.
`tests/html.test.ts` covers each of those. Sanitising on write rather than on
read means the stored value is the safe value.

It is a regex pass, not a DOM parse — workerd has no `DOMParser` and a parser
dependency is 40 kB. It fails closed. If the admin ever accepts HTML from
someone who is not staff, replace it with a real parser.

## Headers

Set in `next.config.ts` for every route: `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` denying camera/microphone/geolocation, and HSTS with
preload. `poweredByHeader` is off.

## Secrets

Nothing is hardcoded. `DATABASE_URL` and `AUTH_SECRET` are Wrangler secrets in
production, and `.env` is gitignored. `lib/db.ts` and `lib/auth.ts` are
`server-only`, so importing either from a client component is a build error
rather than a leak.

## Rate limiting

`src/lib/security.ts` holds a fixed-window counter, applied to:

| Surface | Limit |
| --- | --- |
| `/admin`, `/api/admin` (middleware, per IP) | 240 / minute |
| Login (per **account**, not per IP) | 8 / 15 minutes |
| Admin global search | 60 / minute |
| Media upload | 60 / minute |
| Report export | 20 / minute |
| Wishlist sync | 60 / minute |

Login is throttled per account because credential stuffing rotates addresses far
more cheaply than it rotates targets.

The window lives in isolate memory, so each Worker isolate counts separately and
a burst spread across isolates gets a proportionally larger allowance. That is
enough to stop a script hammering `/admin`; move the counter to a Durable Object
or Upstash before relying on it for anything billable.

## CSRF

Next verifies Origin against Host for server actions, and the session cookie is
`sameSite=lax`. Route handlers get **no** such check from the framework and are
cookie-authenticated, so `isSameOrigin()` guards every state-changing
`/api/admin` handler — a missing `Origin` on a POST is treated as hostile rather
than assumed friendly. Sign-out is POST-only, because a GET sign-out link is one
`<img>` tag away from being a prank.

`/api/wishlist` is the deliberate exception: `navigator.sendBeacon` cannot set
`Origin` on every browser. It only ever replaces the caller's own rows and never
reads anything back, so there is nothing for a cross-site post to steal.

## Audit logging

`AuditLog` records every admin mutation with the actor's email and id, the target,
a JSON detail blob, the client IP, and the user agent. Where the mutation is
transactional, the log row shares its `$transaction`, so the log cannot drift
from the change.

Sign-ins and **failed** sign-in attempts are logged too — the failures are the
interesting half. `/admin/staff` surfaces them as login history; `/admin/audit`
filters the whole log by actor and subject area.

## Known gaps

- **Order lookup**: `/checkout/confirmation?order=IB-XXXXXX` shows order details
  to anyone with the number. The number is 6 characters from a 28-symbol
  alphabet (~482M combinations). Acceptable for a confirmation link; move to a
  signed token if it ever needs to be durable.
- **Payments** run through the dev provider. No card data touches this
  application, and none should when Klarna is added. Refunds recorded in the
  admin write a ledger row and a timeline event; they do not move money until a
  gateway is connected behind `PaymentProvider`.
- **Rate-limit state is per isolate** — see above. A Cloudflare WAF rule on
  `/account/login` and `/admin` is still the cheapest hard cover.
- **No 2FA.** For a store with a handful of staff, the idle timeout plus login
  throttling plus failed-attempt logging is the proportionate set. TOTP belongs
  next to `signToken()` if it is ever needed.
- **`MEDIA_BUCKET` uploads are trusted by MIME type and size only.** No content
  sniffing or re-encode. The bucket should be served from a separate hostname so
  an uploaded file can never run as same-origin script.
