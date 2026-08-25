# Deployment — Vercel

## Hosting

The store runs on Vercel. It ran on Cloudflare Workers via OpenNext until the
free plan's **10 ms CPU per request** proved too small to render a Next.js page:
route handlers fit, page renders did not, and cold isolates returned 503 while
warm ones served fine. That constraint does not exist here.

Nothing in `src/` is host-specific. There is no adapter, no `wrangler.jsonc`, and
no `open-next.config.ts` — Vercel builds `next build` output directly.

## Deploying

Pushing to `main` deploys. To ship from a terminal instead:

```bash
npx vercel --prod
```

`postinstall` runs `prisma generate`, so the client is built on Vercel before
`next build` — the generated client is gitignored and must never be committed.

## Environment variables

Set these in **Project → Settings → Environment Variables**, for Production and
Preview both. `NEXT_PUBLIC_*` values are inlined at build time, so changing one
needs a redeploy, not just a restart.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled Postgres connection string |
| `AUTH_SECRET` | yes | HMAC key for sessions and emailed links; 32+ characters |
| `NEXT_PUBLIC_SITE_URL` | yes at build | Canonical URLs, sitemap, OG tags |
| `ADMIN_SESSION_TIMEOUT_MINUTES` | no (60) | Admin idle timeout |
| `RESEND_API_KEY` | no | Without it, mail is logged instead of sent |
| `EMAIL_FROM`, `EMAIL_REPLY_TO` | no | Envelope sender and reply routing |
| `CRON_SECRET` | no | Bearer token for `POST /api/admin/cron` |
| `MEDIA_PUBLIC_BASE` | no | Public base URL for uploaded media |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | seed only | Credentials the admin seed creates |
| `PAYMENT_PROVIDER` | no (`dev`) | Reported on the dashboard health panel |

## DNS

Vercel's Domains tab shows the exact records for this project. Take them from
there rather than from memory — Vercel is expanding its IP range and the legacy
apex A record is being retired.

Two things that cost a live outage once and are worth writing down:

- **Disable the proxy.** With DNS behind Cloudflare, the records must be
  *DNS only* (grey cloud). Proxied, Vercel cannot complete its TLS certificate
  challenge.
- **The legacy apex IP is not reliable.** `76.76.21.21` is documented as still
  working; in practice it stopped answering entirely — no ping, no port 80, no
  port 443 — and the site went dark with connection timeouts rather than an error
  page. Use the CNAME target the dashboard gives you.

## Scheduled work

`vercel.json` runs `/api/admin/cron` daily:

```jsonc
{ "crons": [{ "path": "/api/admin/cron", "schedule": "0 3 * * *" }] }
```

That sweeps low stock and publishes anything scheduled. Between runs, scheduled
publishing still happens on its own: middleware polls `/api/redirects` once a
minute per instance for the redirect map, and that request also calls
`runDueTransitions()`. See `src/server/scheduler.ts`.

Guard the endpoint with `CRON_SECRET`; it checks `authorization: Bearer …`.

## Database

Use a **pooled** connection string — the `-pooler` host on Neon. Serverless
functions open connections per invocation and a direct string will exhaust them.

Run migrations from your machine, not from a deployment:

```bash
npx prisma migrate deploy
```

## Troubleshooting

**A page 500s but route handlers work.** Check the function logs in the Vercel
dashboard. Server Components swallow the message into a digest; the log has the
real error.

**`next build` fails with a database connection error.** A route is being
prerendered without a database. Mark it `force-dynamic`, or make the query
non-fatal the way `Header` does for the nav.

**Stale `NEXT_PUBLIC_*` value.** Those are compiled in. Redeploy after changing
one.
