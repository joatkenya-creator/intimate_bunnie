# Deployment — Cloudflare Workers

## Configuration

`wrangler.jsonc`

```jsonc
{
  "name": "intimate-bunnie",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-09-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "observability": { "enabled": true }
}
```

No KV, R2, D1, Durable Object, or Queue bindings — nothing in the current
implementation needs one, and each unused binding is infrastructure to maintain.

`open-next.config.ts` calls `defineCloudflareConfig()` with no cache overrides,
for the same reason.

`nodejs_compat` is required by `pg`, which `@prisma/adapter-pg` uses to reach
Postgres.

## First deploy

```bash
npx wrangler login
npx wrangler secret put DATABASE_URL     # pooled Postgres connection string
npx wrangler secret put AUTH_SECRET      # openssl rand -base64 32
npm run cf:deploy
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled Postgres connection string |
| `AUTH_SECRET` | yes | HMAC key for sessions and emailed links; 32+ characters |
| `NEXT_PUBLIC_SITE_URL` | yes at build | Canonical URLs, sitemap, OG tags — inlined at build time |
| `ADMIN_SESSION_TIMEOUT_MINUTES` | no (60) | Admin idle timeout |
| `RESEND_API_KEY` | no | Without it, mail is logged instead of sent |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | no | Envelope sender and reply routing |
| `MEDIA_PUBLIC_BASE` | no | Public base URL for the R2 bucket; uploads are disabled without it |
| `CRON_SECRET` | no | Bearer token for `POST /api/admin/cron` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | seed only | Credentials the admin seed creates |
| `PAYMENT_PROVIDER` | no (`dev`) | Reported on the dashboard health panel |

## Optional bindings

Media uploads need an R2 bucket. Without one the admin still works — "Add by
URL" is the path, and the upload endpoint returns a 501 with an actionable
message rather than a stack trace.

```jsonc
// wrangler.jsonc
"r2_buckets": [
  { "binding": "MEDIA_BUCKET", "bucket_name": "intimate-bunnie-media" }
]
```

Scheduled publishing already runs on middleware's once-a-minute redirect poll. For
exact timing and the low-stock sweep, add a cron trigger pointed at
`POST /api/admin/cron` with an `authorization: Bearer $CRON_SECRET` header.

Set `NEXT_PUBLIC_SITE_URL` to the production origin **before** building —
`NEXT_PUBLIC_*` values are inlined at build time, and canonical URLs, the
sitemap, and OG tags all read from it.

## Database

Use a **pooled** connection string. Workers open a fresh isolate per request
burst; a direct Postgres connection string will exhaust connections. On Neon,
that is the `-pooler` host.

Run migrations from your machine, not from the Worker:

```bash
npx prisma migrate deploy
```

## Checking bundle size

```bash
npm run cf:size
```

Read the `gzip` figure from `Total Upload: … / gzip: …`. That number is the one
Cloudflare enforces.

| Band | gzip |
| --- | --- |
| Green | ≤ 2.0 MiB |
| Warning | 2.0 – 2.5 MiB |
| Fail | > 2.5 MiB |
| Hard failure | ≥ 3.0 MiB |

Last measured: **1256.46 KiB gzip** (6213.81 KiB raw).

## Troubleshooting

**`next build` fails with `ECONNREFUSED` on a Prisma call.** A route is being
prerendered without a database. Either mark it `force-dynamic` or make the query
non-fatal, as `Header` does for the nav.

**Worker throws on a Node API.** Workers do not provide `fs`, `child_process`,
`net`, or native binaries. Use Web APIs; `crypto.subtle` covers hashing and
signing, which is why there is no auth dependency here.

**Bundle grew.** Run `npm run cf:size` and check what changed in
`.open-next/server-functions/default`. The usual causes are a new dependency
pulled into a client component, or a server-only package leaking across the
`'use client'` boundary.
