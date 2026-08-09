import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatUSD, percentOff, quoteTotals, FREE_SHIPPING_THRESHOLD_CENTS } from '../src/lib/money.ts'

test('formats cents as USD', () => {
  assert.equal(formatUSD(0), '$0.00')
  assert.equal(formatUSD(4200), '$42.00')
  assert.equal(formatUSD(199_99), '$199.99')
})

test('percentOff only applies to a genuine markdown', () => {
  assert.equal(percentOff(4200, 5900), 29)
  assert.equal(percentOff(4200, null), null)
  assert.equal(percentOff(4200, 4200), null, 'equal compare price is not a discount')
  assert.equal(percentOff(4200, 3000), null, 'compare price below price is not a discount')
})

test('shipping is free at the threshold, not just above it', () => {
  assert.equal(quoteTotals(FREE_SHIPPING_THRESHOLD_CENTS).shippingCents, 0)
  assert.ok(quoteTotals(FREE_SHIPPING_THRESHOLD_CENTS - 1).shippingCents > 0)
  assert.equal(quoteTotals(0).shippingCents, 0, 'an empty cart is never charged shipping')
})

test('totals add up exactly, in integer cents', () => {
  const totals = quoteTotals(10_000)
  assert.equal(totals.totalCents, totals.subtotalCents + totals.shippingCents + totals.taxCents)
  assert.ok(Number.isInteger(totals.taxCents))
})
