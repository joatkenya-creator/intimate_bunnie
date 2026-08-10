// Transactional email copy. Pure functions — no database, no server-only, no
// provider: unit testable, and the copy is reviewable without sending anything.
//
// Every template is built from the same small block list and rendered twice,
// HTML and plain text, so the two versions can never drift apart.

// Relative, with extensions: node --experimental-strip-types runs this file
// directly from tests/ and resolves neither the @/ alias nor a bare specifier.
import { site } from '../../config/site.ts'
import { formatUSD } from '../../lib/money.ts'

export type Mail = { subject: string; html: string; text: string }

type Block =
  | { type: 'p'; text: string }
  | { type: 'button'; url: string; label: string }
  | { type: 'rows'; rows: [string, string][] }
  | { type: 'note'; text: string }

const P = (text: string): Block => ({ type: 'p', text })
const Button = (url: string, label: string): Block => ({ type: 'button', url, label })
const Rows = (rows: [string, string][]): Block => ({ type: 'rows', rows })
const Note = (text: string): Block => ({ type: 'note', text })

/** Names, product titles and addresses reach these templates from user input. */
export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const ink = '#2b1a22'
const muted = '#7a6069'
const line = '#f0ddd4'
const accent = '#e91e63'

function renderBlockHtml(block: Block): string {
  switch (block.type) {
    case 'p':
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${ink}">${esc(block.text)}</p>`
    case 'button':
      return `<p style="margin:24px 0"><a href="${esc(block.url)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:13px 24px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase">${esc(block.label)}</a></p>`
    case 'rows':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse">${block.rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:7px 0;border-bottom:1px solid ${line};font-size:14px;color:${ink}">${esc(label)}</td><td align="right" style="padding:7px 0;border-bottom:1px solid ${line};font-size:14px;color:${ink};white-space:nowrap">${esc(value)}</td></tr>`,
        )
        .join('')}</table>`
    case 'note':
      return `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:${muted}">${esc(block.text)}</p>`
  }
}

function renderBlockText(block: Block): string {
  switch (block.type) {
    case 'p':
    case 'note':
      return block.text
    case 'button':
      return `${block.label}: ${block.url}`
    case 'rows':
      return block.rows.map(([label, value]) => `${label}: ${value}`).join('\n')
  }
}

function render(subject: string, heading: string, blocks: Block[]): Mail {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#fffaf7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffaf7">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid ${line}">
<tr><td style="padding:32px 32px 8px">
<p style="margin:0 0 20px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${muted}">${esc(site.name)}</p>
<h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;line-height:1.25;color:${ink}">${esc(heading)}</h1>
${blocks.map(renderBlockHtml).join('\n')}
</td></tr>
<tr><td style="padding:8px 32px 28px;border-top:1px solid ${line}">
<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${muted}">Questions? Reply to this email or write to <a href="mailto:${site.email}" style="color:${muted}">${site.email}</a>.<br>Shipped discreetly, in plain packaging, always.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`

  const text = [
    site.name.toUpperCase(),
    '',
    heading,
    '',
    ...blocks.map(renderBlockText),
    '',
    '—',
    `Questions? Reply to this email or write to ${site.email}.`,
  ].join('\n\n')

  return { subject, html, text }
}

// ── The eight transactional emails ──────────────────────────────────────────

export function welcome(input: { name?: string | null; shopUrl: string }): Mail {
  return render(`Welcome to ${site.name}`, input.name ? `Hello, ${input.name}` : 'Hello', [
    P('Your account is ready. Everything you order ships in plain packaging with a discreet billing descriptor — no branding, no judgment.'),
    P('Save the pieces you like to your wishlist, and your order history stays in one place.'),
    Button(input.shopUrl, 'Start shopping'),
  ])
}

export function verifyEmail(input: { url: string; expiresInHours: number }): Mail {
  return render('Confirm your email address', 'Confirm your email', [
    P('Tap below to confirm this address so we can send your order updates here.'),
    Button(input.url, 'Confirm email'),
    Note(`This link expires in ${input.expiresInHours} hours. If you did not create an account, ignore this email.`),
  ])
}

export function passwordReset(input: { url: string; expiresInMinutes: number }): Mail {
  return render('Reset your password', 'Reset your password', [
    P('Tap below to choose a new password.'),
    Button(input.url, 'Choose a new password'),
    Note(
      `This link expires in ${input.expiresInMinutes} minutes and stops working once your password changes. If you did not ask for this, nothing has happened to your account — you can ignore this email.`,
    ),
  ])
}

export function passwordChanged(input: { changedAt: Date }): Mail {
  return render('Your password was changed', 'Your password was changed', [
    P(`The password on your ${site.name} account was changed on ${formatWhen(input.changedAt)}.`),
    P(`If that was not you, reply to this email or write to ${site.email} straight away — we will lock the account.`),
  ])
}

export function profileUpdated(input: { changes: string[] }): Mail {
  return render('Your details were updated', 'Your details were updated', [
    P('These changes were just saved to your account:'),
    Rows(input.changes.map((change) => [change, 'updated'])),
    Note(`If you did not make this change, write to ${site.email}.`),
  ])
}

export function preferencesUpdated(input: { preferences: [string, string][] }): Mail {
  return render('Your preferences were updated', 'Your preferences were updated', [
    P('Here is what your account is set to now:'),
    Rows(input.preferences),
    Note('You can change these any time from your account.'),
  ])
}

export type OrderMail = {
  number: string
  items: { name: string; variantName?: string | null; quantity: number; unitCents: number }[]
  subtotalCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
  shipName: string
  shipLine1: string
  shipLine2?: string | null
  shipCity: string
  shipState: string
  shipZip: string
  orderUrl: string
}

export function orderPlaced(order: OrderMail): Mail {
  return render(`Order ${order.number} confirmed`, 'Thank you — your order is confirmed', [
    P(`Order ${order.number}. We will email you again the moment it ships.`),
    Rows([
      ...order.items.map(
        (item): [string, string] => [
          `${item.name}${item.variantName ? ` — ${item.variantName}` : ''} × ${item.quantity}`,
          formatUSD(item.unitCents * item.quantity),
        ],
      ),
      ['Subtotal', formatUSD(order.subtotalCents)],
      ['Shipping', order.shippingCents === 0 ? 'Free' : formatUSD(order.shippingCents)],
      ['Tax', formatUSD(order.taxCents)],
      ['Total', formatUSD(order.totalCents)],
    ]),
    P(
      `Shipping to ${order.shipName}, ${order.shipLine1}${order.shipLine2 ? `, ${order.shipLine2}` : ''}, ${order.shipCity} ${order.shipState} ${order.shipZip}.`,
    ),
    Button(order.orderUrl, 'View your order'),
    Note('Plain outer packaging, no product names on the label.'),
  ])
}

export function returnReceived(input: { number: string; items: string[] }): Mail {
  return render(`We received your return request for ${input.number}`, 'Your return request is in', [
    P(`We have your request for order ${input.number} and are reviewing it now — expect an answer within two business days.`),
    Rows(input.items.map((item) => [item, 'return requested'])),
    Note('For hygiene reasons some intimate items cannot be returned once opened. If yours is one of them we will tell you plainly and suggest what we can do instead.'),
  ])
}

export function returnApproved(input: { number: string; refundCents: number; instructions: string }): Mail {
  return render(`Your return for ${input.number} is approved`, 'Your return is approved', [
    P(`Your return for order ${input.number} is approved. Once the parcel reaches us, ${formatUSD(input.refundCents)} goes back to your original payment method — most banks show it within five business days.`),
    P(input.instructions),
    Rows([['Refund amount', formatUSD(input.refundCents)]]),
  ])
}

/** en-US, UTC — a fixed string, so an email reads the same wherever it is opened. */
function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)
}
