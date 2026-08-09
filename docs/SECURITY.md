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

`requireAdmin()` runs in the admin layout and again inside every admin server
action. A server action is a public HTTP endpoint — the layout check protects
the page, not the mutation, so both are needed.

Customer routes call `currentUser()` server-side and redirect. No client-side
route guard is load-bearing.

## Input validation

Every server action and route handler parses its input with Zod before touching
the database:

- `actions/checkout.ts` — email, U.S. address, ZIP format, per-line quantity caps
- `actions/auth.ts` — email format, 8-character password minimum
- `actions/admin.ts` — price and inventory bounds, enum-checked order status
- `api/products/route.ts` — at most 12 IDs, each length-bounded

## Money integrity

Checkout ignores prices from the browser. It re-reads every product and variant
from the database, recomputes the subtotal, shipping, and tax, and only then
creates the order. Editing localStorage changes nothing.

Order creation and stock decrements share one `$transaction`, so an oversell
cannot slip between the stock check and the write.

## SQL injection

All access goes through Prisma's parameterized query builder. There is no raw
SQL in the application.

## XSS

React escapes by default. The only `dangerouslySetInnerHTML` calls render
JSON-LD produced by `jsonLd()`, which stringifies and escapes `<`.

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

## Audit logging

Admin product updates and order status changes write an `AuditLog` row with the
actor's email, in the same transaction as the mutation.

## Known gaps

- **Rate limiting** is not implemented. Login and checkout are the endpoints
  that need it. This is the Upstash Redis boundary; until then, a Cloudflare WAF
  rate-limiting rule on `/account/login` is the cheapest cover.
- **CSRF**: Next.js server actions verify Origin against Host, and the session
  cookie is `sameSite=lax`. No additional token is layered on top.
- **Email verification** and password reset do not exist — both need an email
  provider, which is not yet chosen.
- **Order lookup**: `/checkout/confirmation?order=IB-XXXXXX` shows order details
  to anyone with the number. The number is 6 characters from a 28-symbol
  alphabet (~482M combinations). Acceptable for a confirmation link; move to a
  signed token if it ever needs to be durable.
- **Payments** run through the dev provider. No card data touches this
  application, and none should when Klarna is added.
