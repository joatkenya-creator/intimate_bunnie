import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stateForZip, zipMatchesState, isValidZip, US_STATES } from '../src/lib/zip.ts'

// A wrong state on an order is a failed delivery, so the lookup gets real
// ZIPs from every corner of the table — boundaries, gaps, and the prefixes
// that interrupt a bigger state's run.

test('resolves well-known ZIPs to the right state', () => {
  const cases: [string, string][] = [
    ['10001', 'NY'], // Manhattan
    ['90210', 'CA'], // Beverly Hills
    ['60601', 'IL'], // Chicago
    ['78702', 'TX'], // Austin
    ['02139', 'MA'], // Cambridge
    ['97209', 'OR'], // Portland
    ['33101', 'FL'], // Miami
    ['99501', 'AK'], // Anchorage
    ['96813', 'HI'], // Honolulu
    ['20500', 'DC'], // White House
    ['80205', 'CO'], // Denver
    ['31401', 'GA'], // Savannah
    ['02903', 'RI'], // Providence
    ['11211', 'NY'], // Brooklyn
    ['94607', 'CA'], // Oakland
  ]
  for (const [zip, state] of cases) assert.equal(stateForZip(zip), state, `${zip} should be ${state}`)
})

test('handles the prefixes that interrupt another state\'s run', () => {
  // 340 sits inside Florida's 320–349 block but belongs to military Americas.
  assert.equal(stateForZip('33999'), 'FL')
  assert.equal(stateForZip('34002'), 'AA')
  assert.equal(stateForZip('34101'), 'FL')
  // 885 is El Paso, Texas, stranded between New Mexico and Nevada.
  assert.equal(stateForZip('88401'), 'NM')
  assert.equal(stateForZip('88540'), 'TX')
  assert.equal(stateForZip('89101'), 'NV')
  // 398–399 is Georgia, after Mississippi's run.
  assert.equal(stateForZip('39701'), 'MS')
  assert.equal(stateForZip('39901'), 'GA')
})

test('respects range boundaries exactly', () => {
  assert.equal(stateForZip('75000'), 'TX')
  assert.equal(stateForZip('79999'), 'TX')
  assert.equal(stateForZip('80000'), 'CO')
  assert.equal(stateForZip('74999'), 'OK')
})

test('ZIP+4 resolves on its five-digit prefix', () => {
  assert.equal(stateForZip('10001-1234'), 'NY')
  assert.equal(stateForZip('78702-0001'), 'TX')
})

test('rejects malformed input rather than guessing', () => {
  for (const bad of ['', '1234', '123456', 'abcde', '9021O', '10001-12']) {
    assert.equal(stateForZip(bad), null, `${bad} should not resolve`)
    assert.equal(isValidZip(bad), false)
  }
})

test('unassigned prefixes resolve to null', () => {
  // 429 and 095 fall in gaps between allocated ranges.
  assert.equal(stateForZip('42900'), null)
  assert.equal(stateForZip('09500'), 'AE')
})

test('matching accepts agreement and refuses a real mismatch', () => {
  assert.equal(zipMatchesState('78702', 'TX'), true)
  assert.equal(zipMatchesState('78702', 'tx'), true)
  assert.equal(zipMatchesState('78702', 'NY'), false)
  assert.equal(zipMatchesState('10001', 'CA'), false)
})

test('an unassigned prefix is allowed through rather than blocking a customer', () => {
  // The table is a snapshot; a new prefix must not fail a real order.
  assert.equal(stateForZip('42900'), null)
  assert.equal(zipMatchesState('42900', 'KY'), true)
})

test('every state the form offers is reachable from some ZIP', () => {
  const reachable = new Set<string>()
  for (let prefix = 0; prefix < 1000; prefix++) {
    const state = stateForZip(String(prefix).padStart(3, '0') + '01')
    if (state) reachable.add(state)
  }
  for (const state of US_STATES) {
    assert.ok(reachable.has(state), `${state} is offered in the form but no ZIP maps to it`)
  }
})
