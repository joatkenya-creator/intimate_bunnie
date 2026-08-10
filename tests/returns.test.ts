import { test } from 'node:test'
import assert from 'node:assert/strict'
import { daysLeftToReturn, isReturnable, returnDeadline, RETURN_WINDOW_DAYS } from '../src/lib/returns.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const ordered = new Date('2026-01-01T12:00:00Z')
const daysAfter = (n: number) => new Date(ordered.getTime() + n * DAY_MS)

test('the window is at least the published 30 days, and never shorter', () => {
  assert.ok(
    returnDeadline(ordered).getTime() - ordered.getTime() >= RETURN_WINDOW_DAYS * DAY_MS,
    'the clock starts at the order date, so the window must allow for transit on top of the policy',
  )
})

test('a paid order is returnable inside the window and not outside it', () => {
  const order = { status: 'PAID', createdAt: ordered }
  assert.equal(isReturnable(order, daysAfter(1)), true)
  assert.equal(isReturnable(order, daysAfter(RETURN_WINDOW_DAYS)), true, 'day 30 is still inside the window')
  assert.equal(isReturnable(order, daysAfter(90)), false)
})

test('only paid and fulfilled orders can be returned', () => {
  const day = daysAfter(1)
  assert.equal(isReturnable({ status: 'FULFILLED', createdAt: ordered }, day), true)
  assert.equal(isReturnable({ status: 'PENDING', createdAt: ordered }, day), false, 'unpaid order')
  assert.equal(isReturnable({ status: 'CANCELLED', createdAt: ordered }, day), false)
  assert.equal(isReturnable({ status: 'REFUNDED', createdAt: ordered }, day), false, 'already refunded once')
})

test('the countdown shown to the customer never goes negative', () => {
  assert.ok(daysLeftToReturn({ createdAt: ordered }, daysAfter(1)) > 0)
  assert.equal(daysLeftToReturn({ createdAt: ordered }, daysAfter(365)), 0)
})
