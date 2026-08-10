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
    welcome({ name: 'Ada', shopUrl: 'https://intimatebunnie.com/shop' }),
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

  const mail = welcome({ name: '<img src=x onerror=alert(1)>', shopUrl: 'https://intimatebunnie.com/shop' })
  assert.doesNotMatch(mail.html, /<img/)
  assert.ok(mail.html.includes('&lt;img'))
})
