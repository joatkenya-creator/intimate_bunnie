# Security

## Authentication

Sessions and password hashing run on Web Crypto — no auth dependency to keep
patched, and nothing to swap if the runtime changes again.

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

Admin sessions time out after `ADMIN_SESSION_TIMEOUT_MINUTES` (default 60) of
inactivity, separately from the 30-day storefront cookie. It is a sliding window:
middleware re-issues the cookie with a fresh `iat` on any `/admin` request past
the halfway mark, so activity extends the session and idleness ends it.

Three properties keep that from weakening the control:

- Middleware only extends; `requirePermission()` is still the gate, checked
  server-side on every page and every action.
- A session already past the window is never refreshed, so the timeout is always
  reachable.
- A session with no `iat` claim reads as unknown age, is never refreshed, and is
  asked to sign in again — backfilling one would resurrect a cookie of any age.

Storefront requests do not extend it; the window exists to cover an unattended
admin screen.

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

Order creation and stock decrements share one transaction, so an oversell cannot
slip between the stock check and the write. It is a Neon HTTP transaction: every
statement is sent as one batch, which suits checkout because the pricing read
already happened and the writes are fully determined by it.

## SQL injection

Two access paths, both parameterised.

The admin uses Prisma. Its handful of `$queryRaw` calls in `src/server/admin.ts`
and `reports.ts` use tagged templates, so every interpolation is a bound
parameter — they exist because Postgres can compare two columns and truncate
dates where Prisma's `where` cannot.

Everything a customer touches is hand-written SQL over `src/lib/sql.ts`. Values
are **never** interpolated: `query(text, values)` binds them, and the `binder()`
helper hands back `$n` placeholders so a conditional filter still cannot
concatenate a value into the statement. The only strings ever interpolated into
SQL there are column and sort fragments chosen from fixed maps in the module —
`ORDER_BY` in `server/catalog.ts` is the example, and an unrecognised sort key
falls back to a known one rather than reaching the query.

Identifiers that collide with reserved words are quoted (`AS "order"`), and
`limitOffset()` coerces its arguments with `Math.trunc` rather than binding them,
because `LIMIT`/`OFFSET` are structural.

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

It is a regex pass, not a DOM parse — the server runtime has no `DOMParser` and a parser
dependency is 40 kB. It fails closed. If the admin ever accepts HTML from
someone who is not staff, replace it with a real parser.

## Headers

Set in `next.config.ts` for every route: `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` denying camera/microphone/geolocation, and HSTS with
preload. `poweredByHeader` is off.

## Secrets

Nothing is hardcoded. `DATABASE_URL` and `AUTH_SECRET` are Vercel environment
variables in production, and `.env` is gitignored. `lib/db.ts` and `lib/auth.ts` are
`server-only`, so importing either from a client component is a build error
rather than a leak.

## Bot protection

Vercel BotID (invisible challenge, no visible CAPTCHA). Three parts, and all
three must agree or the check fails closed:

1. `withBotId()` in `next.config.ts` — serves the challenge from our own origin,
   so an ad-blocker cannot drop it.
2. `src/instrumentation-client.ts` — the list of protected paths. Server Actions
   post to the path of the page that invoked them, so these are page routes.
3. `checkBotId()` in the action itself.

| Path | Action | On detection |
| --- | --- | --- |
| `/checkout` | `placeOrder` | Refuses with a retry message |
| `/account/login` | `login` | "Incorrect email or password" — same as a wrong password |
| `/account/register` | `register` | Refuses with a retry message |
| `/account/forgot` | `requestPasswordReset` | Answers `sent`, mails nothing |

Each check runs **after** the rate-limit counter: the counter is free and local,
`checkBotId()` is billed per call once Deep Analysis is on.

Basic checks are free on every plan and are active as soon as this is deployed.
**Deep Analysis** is the dashboard half — Project → Firewall → Rules → *Vercel
BotID Deep Analysis* — and is billed per `checkBotId()` call on Pro.

Local development always returns `isBot: false`, so these paths behave normally
in `next dev`. Testing with `curl` against production will be blocked: the
challenge needs a real browser session.

## Rate limiting

`src/lib/security.ts` holds a fixed-window counter, applied to:

| Surface | Limit |
| --- | --- |
| `/admin`, `/api/admin` (middleware, per IP) | 240 / minute |
| Login (per **account**, not per IP) | 8 / 15 minutes |
| Registration (per IP) | 10 / hour |
| Password reset (per **address**) | 3 / hour |
| Password reset (per IP) | 10 / hour |
| Profile change (per account) | 5 / hour |
| Checkout (per IP) | 10 / 10 minutes |
| Admin global search | 60 / minute |
| Media upload | 60 / minute |
| Report export | 20 / minute |
| Wishlist sync | 60 / minute |

Login is throttled per account because credential stuffing rotates addresses far
more cheaply than it rotates targets.

The window lives in instance memory, so each serverless instance counts separately and
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
- **Rate-limit state is per instance** — see above. A firewall rule on
  `/account/login` and `/admin` is still the cheapest hard cover.
- **No 2FA.** For a store with a handful of staff, the idle timeout plus login
  throttling plus failed-attempt logging is the proportionate set. TOTP belongs
  next to `signToken()` if it is ever needed.
- **`MEDIA_BUCKET` uploads are trusted by MIME type and size only.** No content
  sniffing or re-encode. The bucket should be served from a separate hostname so
  an uploaded file can never run as same-origin script.
