import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseQuery } from '../src/lib/search-query.ts'

// The query goes into an ILIKE pattern, so the two wildcard characters have to
// be neutralised. A lone "%" would otherwise match the entire catalog.

test('strips SQL wildcards so a pattern cannot be smuggled in', () => {
  assert.equal(normaliseQuery('%'), '')
  assert.equal(normaliseQuery('%%%'), '')
  assert.equal(normaliseQuery('ro%se'), 'ro se')
  assert.equal(normaliseQuery('ro_se'), 'ro se')
  assert.equal(normaliseQuery('100%_silk'), '100 silk')
})

test('collapses whitespace and trims', () => {
  assert.equal(normaliseQuery('  rose   vibrator  '), 'rose vibrator')
  assert.equal(normaliseQuery('\t\nrose\n'), 'rose')
  assert.equal(normaliseQuery(''), '')
  assert.equal(normaliseQuery('   '), '')
})

test('caps length so a huge string cannot be sent to the database', () => {
  assert.equal(normaliseQuery('a'.repeat(500)).length, 80)
})

test('leaves an ordinary search untouched', () => {
  assert.equal(normaliseQuery('rose vibrator'), 'rose vibrator')
  assert.equal(normaliseQuery("Pearl String Crotchless Brief"), 'Pearl String Crotchless Brief')
})

test('quotes and semicolons survive as literal text, not syntax', () => {
  // They are bound as a parameter, never concatenated — normalising them away
  // would only mask that. This asserts they pass through unchanged.
  assert.equal(normaliseQuery("rose'; DROP TABLE x; --"), "rose'; DROP TABLE x; --")
})
