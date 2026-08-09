import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv, normalize, slugify, toCents } from '../src/services/import/normalize.ts'

test('slugify produces clean URL segments', () => {
  assert.equal(slugify('Rose Suction Vibrator'), 'rose-suction-vibrator')
  assert.equal(slugify('  Gold Shimmer Body Oil!  '), 'gold-shimmer-body-oil')
  assert.equal(slugify('Ultra-Thin Condoms, 12 pack'), 'ultra-thin-condoms-12-pack')
})

test('toCents accepts dollars, strings, and cents', () => {
  assert.equal(toCents('$24.99'), 2499)
  assert.equal(toCents(24.99), 2499)
  assert.equal(toCents('42'), 4200)
  assert.equal(toCents(4200), 4200, 'large integers are already cents')
  assert.equal(toCents(undefined), 0)
})

test('parseCsv handles quotes, embedded commas, and CRLF', () => {
  const csv = 'name,price,description\r\n"Rose, Petite",42.00,"He said ""wow"""\r\n'
  const rows = parseCsv(csv)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, 'Rose, Petite')
  assert.equal(rows[0].description, 'He said "wow"')
})

test('normalize rejects records without a name', () => {
  assert.equal(normalize({ price: '10.00' }), null)
})

test('normalize builds a valid product from a loose record', () => {
  const product = normalize({
    name: 'Water-Based Lubricant, 8 oz',
    price: '$16.00',
    description: 'Glycerin-free and toy-safe.',
    category: 'Lubricants',
    tags: 'lube, water-based',
    inventory: 25,
  })
  assert.ok(product)
  assert.equal(product.slug, 'water-based-lubricant-8-oz')
  assert.equal(product.priceCents, 1600)
  assert.equal(product.categorySlug, 'lubricants')
  assert.deepEqual(product.tags, ['lube', 'water-based'])
})
