# Email

Two separate jobs share one address, `care@intimatebunnie.com`:

| Direction    | What                                     | Who does it                             |
| ------------ | ---------------------------------------- | --------------------------------------- |
| **Outbound** | Transactional mail the store sends        | Resend HTTP API, from the Worker         |
| **Inbound**  | Anything a customer sends or replies to  | Cloudflare Email Routing → `yowens@yoassoc.com` |
| **Replies**  | Staff answering *as* `care@`              | Gmail "Send mail as", relaying via Resend SMTP |

Cloudflare Email Routing **cannot send mail** — it only forwards. That is why the
third row needs an SMTP relay rather than being a Cloudflare setting.

---

## 1. What the store sends

`src/services/email/templates.ts` holds the copy (pure functions, unit tested in
`tests/email.test.ts`). `src/services/email/index.ts` delivers it.

| Email                | Trigger                                    | Wired |
| -------------------- | ------------------------------------------ | ----- |
| Welcome              | `register()` succeeds                       | ✅ |
| Verify email         | `register()` succeeds — link to `/account/verify`, 72 h | ✅ |
| Password reset       | `requestPasswordReset()` — link to `/account/reset`, 60 min | ✅ |
| Password changed     | `resetPassword()` succeeds                  | ✅ |
| Order confirmation   | `placeOrder()` after the transaction commits | ✅ |
| Profile updated      | `updateProfile()` — sent to the address on file *before* the change | ✅ |
| Return received      | `requestReturn()` from `/account/orders/[number]/return` | ✅ |
| Return approved      | `resolveReturn()` approving in `/admin/returns` | ✅ |
| Preferences updated  | a preferences action                        | ⬜ template ready, no trigger yet |

`sendPreferencesUpdated` is exported and unwired: `User` has no preferences to
change yet. Denying a return also sends nothing — the admin's note shows on the
customer's order history, and someone writes to them.

Changing an email address clears `emailVerifiedAt` and mails a fresh
verification link to the new address, while the "profile updated" notice goes to
the old one — if the change was not the account owner's, that is the only inbox
that will see it.

Delivery never throws. An order is already committed by the time its receipt is
sent — a mail outage must not turn a paid order into an error page. Failures land
in the Worker log (`wrangler tail`).

Without `RESEND_API_KEY` nothing is sent and each would-be send is logged, so
local development works with no provider account.

---

## 2. Outbound: verify the domain with Resend

1. Resend → **Domains** → add `intimatebunnie.com`.
2. It shows three DNS records. Add them in Cloudflare DNS, **DNS-only (grey
   cloud)**:
   - `MX` on `send.intimatebunnie.com` — this is a *subdomain*, so it does not
     collide with the root-domain MX that inbound routing adds in step 3.
   - `TXT` on `send.intimatebunnie.com` — SPF for the bounce path.
   - `TXT` on `resend._domainkey` — DKIM.
3. Wait for **Verified**.
4. Add DMARC once DKIM passes — start in monitor mode:
   `_dmarc` → `TXT` → `v=DMARC1; p=none; rua=mailto:care@intimatebunnie.com`
   Move to `p=quarantine` after a couple of weeks of clean reports.
5. Create an API key (sending permission only) and set the secrets:

```sh
wrangler secret put RESEND_API_KEY
wrangler secret put EMAIL_FROM       # Intimate Bunnie <care@intimatebunnie.com>
wrangler secret put EMAIL_REPLY_TO   # care@intimatebunnie.com
```

> **One SPF record per hostname.** If a name ever needs two `include:`s, merge
> them into a single `v=spf1 … ~all` TXT. Two SPF records on one name is a
> permanent SPF failure, not a fallback.

---

## 3. Inbound: `care@intimatebunnie.com` → `yowens@yoassoc.com`

Cloudflare dashboard → the `intimatebunnie.com` zone → **Email** → **Email
Routing**.

1. **Destination addresses** → add `yowens@yoassoc.com`. Cloudflare emails that
   address a verification link — it must be clicked before any rule works.
2. **Enable Email Routing.** Accept the MX + SPF records it offers to add for you
   (three `mx.cloudflare.net` hosts on the root domain). Do not type them by hand.
3. **Routing rules** → **Create address**:
   - Custom address: `care@intimatebunnie.com`
   - Action: **Send to an email** → `yowens@yoassoc.com`
4. Optional: set the catch-all to the same destination so `hello@`, `support@`,
   and typos are not silently dropped.

Forwarding rewrites the return-path (SRS), so forwarded mail still passes SPF at
the destination.

**Do this step before step 4** — Gmail's verification code for the send-as alias
is mailed to `care@`, and only this rule delivers it.

---

## 4. Sending *as* `care@` from `yowens@yoassoc.com`

In the mailbox for `yowens@yoassoc.com` (Gmail / Google Workspace):

**Settings → Accounts and Import → Send mail as → Add another email address**

| Field           | Value                                |
| --------------- | ------------------------------------ |
| Name            | Intimate Bunnie Care                 |
| Email address   | `care@intimatebunnie.com`            |
| Treat as alias  | leave checked                        |
| SMTP server     | `smtp.resend.com`                    |
| Port            | `465` (SSL) — use `587` (TLS) if 465 is blocked |
| Username        | `resend`                             |
| Password        | the Resend API key from step 2       |

Gmail mails a confirmation code to `care@intimatebunnie.com`; it arrives in
`yowens@yoassoc.com` via the rule from step 3. Enter it.

Then set **"When replying to a message: Reply from the same address the message
was sent to"** — otherwise replies to forwarded customer mail go out as
`yowens@yoassoc.com` and expose the internal address.

To make `care@` the default for new mail, click **make default** next to it.

---

## 5. Checking it works

```sh
# outbound, from the store
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" -H 'Content-Type: application/json' \
  -d '{"from":"Intimate Bunnie <care@intimatebunnie.com>","to":"yowens@yoassoc.com","subject":"delivery test","text":"ok"}'
```

- **Inbound:** mail `care@intimatebunnie.com` from an outside address; it should
  land in `yowens@yoassoc.com` within seconds.
- **Alignment:** send one to a Gmail address, open **Show original**, and confirm
  `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.
- **End to end:** register a test account on the live site and confirm the welcome
  and verification emails arrive and the verification link works.

## 6. Notes

- These are transactional emails: no unsubscribe link, and none of them may be
  used for marketing. The moment a campaign or newsletter is sent, CAN-SPAM
  requires a working unsubscribe and a physical postal address in the footer —
  keep that on a separate provider audience, not on this path.
- Subject lines and the `From` name deliberately do not name products. The
  discretion promised on the packaging applies to the inbox too.
