import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  esc,
  orderPlaced,
  passwordReset,
  preferencesUpdated,
  returnApproved,
  verifyEmail,
  welcome,
} from '../src/services/email/templates.ts'

const order = {
  number: 'IB-4F7K2Q',
  items: [{ name: 'Silk Slip', variantName: 'M', quantity: 2, unitCents: 4200 }],
  subtotalCents: 8400,
  shippingCents: 0,
  taxCents: 609,
  totalCents: 9009,
  shipName: 'Ada L',
  shipLine1: '1 Rose St',
  shipLine2: null,
  shipCity: 'Austin',
  shipState: 'TX',
  shipZip: '78701',
  orderUrl: 'https://intimatebunnie.com/checkout/confirmation?order=IB-4F7K2Q',
}

test('every template renders both an HTML and a plain-text body', () => {
  const mails = [
    welcome({ name: 'Ada', email: 'ada@example.com', role: 'CUSTOMER', createdAt: new Date('2026-08-11T09:00:00Z') }),
    verifyEmail({ url: 'https://intimatebunnie.com/account/verify?token=t', expiresInHours: 72 }),
    passwordReset({ url: 'https://intimatebunnie.com/account/reset?token=t', expiresInMinutes: 60 }),
    preferencesUpdated({ preferences: [['New arrivals', 'On']] }),
    orderPlaced(order),
    returnApproved({ number: 'IB-4F7K2Q', refundCents: 4200, instructions: 'Use the enclosed label.' }),
  ]

  for (const mail of mails) {
    assert.ok(mail.subject.length > 0 && mail.subject.length < 80, mail.subject)
    assert.match(mail.html, /^<!doctype html>/)
    assert.ok(mail.text.length > 0, 'plain-text body must not be empty')
    assert.doesNotMatch(mail.text, /</, 'plain-text body must not carry markup')
  }
})

test('links survive into the plain-text body', () => {
  const url = 'https://intimatebunnie.com/account/reset?token=abc.def'
  const mail = passwordReset({ url, expiresInMinutes: 60 })
  assert.ok(mail.text.includes(url), 'a text-only client must still be able to reach the link')
  assert.ok(mail.html.includes(`href="${url}"`))
})

test('order totals are rendered as money, and the maths shown adds up', () => {
  const mail = orderPlaced(order)
  assert.ok(mail.text.includes('Silk Slip — M × 2'))
  assert.ok(mail.text.includes('$84.00'), 'line total is unit price times quantity')
  assert.ok(mail.text.includes('Free'), 'free shipping reads as Free, not $0.00')
  assert.ok(mail.text.includes('$90.09'))
  assert.equal(order.subtotalCents + order.shippingCents + order.taxCents, order.totalCents)
})

test('user-supplied text cannot inject markup into the HTML body', () => {
  assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')

  const mail = welcome({
    name: '<img src=x onerror=alert(1)>',
    email: 'ada@example.com',
    role: 'CUSTOMER',
    createdAt: new Date('2026-08-11T09:00:00Z'),
  })
  assert.doesNotMatch(mail.html, /<img/)
  assert.ok(mail.html.includes('&lt;img'))
})

test('the welcome email renders the account details, and drops rows it has no value for', () => {
  const base = { email: 'ada@example.com', role: 'CUSTOMER', createdAt: new Date('2026-08-11T09:00:00Z') }

  const plain = welcome(base)
  assert.ok(plain.html.includes('>Customer<'), 'the role enum is rendered capitalised, not shouted')
  assert.ok(plain.html.includes('11 Aug 2026'), 'member since is dd MMM yyyy')
  assert.doesNotMatch(plain.html, /Membership/, 'the optional row is omitted, not left blank')
  assert.doesNotMatch(plain.html, /Full Name/, 'a nameless signup shows no empty name row')
  assert.equal(plain.subject, 'Welcome to Intimate Bunnie')

  const withOrg = welcome({ ...base, name: 'Ada', org: 'VIP' })
  assert.ok(withOrg.html.includes('Membership') && withOrg.html.includes('>VIP<'))
  assert.ok(withOrg.html.includes('Welcome, Ada!'))
  assert.ok(withOrg.text.includes('Membership: VIP'), 'the plain-text twin carries the same rows')
})

test('the welcome email is painted from the same palette as the confirmation email', () => {
  // The two now arrive at different moments in one flow, so they have to look
  // like a pair. Any colour that is not a brand token is a leftover.
  const brand = new Set([
    '#ffffff',
    '#fffaf7', // cream
    '#fff4ee', // peach-50
    '#ffe7db', // peach-100
    '#ffd4c0', // peach-200
    '#fce4ec', // rose-50
    '#f9c8d9', // rose-100
    '#e91e63', // rose-500
    '#9d0f3d', // rose-700
    '#2b1a22', // plum-900
    '#4b323d', // plum-700
    '#7a6069', // plum-500
    '#a6919a', // plum-300
    '#f0ddd4', // line
  ])

  const mail = welcome({ email: 'ada@example.com', role: 'CUSTOMER', createdAt: new Date('2026-08-11T09:00:00Z') })
  for (const hex of mail.html.match(/(?<!&)#[0-9a-fA-F]{3,8}\b/g) ?? []) {
    assert.ok(brand.has(hex.toLowerCase()), `${hex} in the welcome email is not a brand colour`)
  }

  const confirm = verifyEmail({ url: 'https://intimatebunnie.com/account/verify?token=t', expiresInHours: 72 })
  for (const hex of confirm.html.match(/(?<!&)#[0-9a-fA-F]{3,8}\b/g) ?? []) {
    assert.ok(brand.has(hex.toLowerCase()), `${hex} in the confirmation email is not a brand colour`)
  }
})
