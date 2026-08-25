import { test } from 'node:test'
import assert from 'node:assert/strict'
import { imageUrl, imageSrcSet, PLACEHOLDER_IMAGE } from '../src/services/media.ts'
import { resolveRedirect } from '../src/lib/redirects.ts'

// ── image optimisation ──────────────────────────────────────────────────────
// A width the optimiser does not recognise is answered with a 400, which shows
// up as a broken product image rather than an error anyone notices.

test('requested widths snap up to a width the optimiser will serve', () => {
  assert.match(imageUrl('https://cdn.example/a.jpg', { width: 800 }), /[?&]w=828(&|$)/)
  assert.match(imageUrl('https://cdn.example/a.jpg', { width: 160 }), /[?&]w=256(&|$)/)
  assert.match(imageUrl('https://cdn.example/a.jpg', { width: 640 }), /[?&]w=640(&|$)/)
  assert.match(imageUrl('https://cdn.example/a.jpg', { width: 99_999 }), /[?&]w=3840(&|$)/)
})

test('the source URL is encoded, not concatenated', () => {
  const src = imageUrl('https://cdn.example/a b.jpg?v=1&x=2', { width: 640 })
  assert.ok(src.startsWith('/_next/image?url='))
  assert.ok(!src.includes('a b.jpg'))
  assert.equal(new URL(src, 'https://x').searchParams.get('url'), 'https://cdn.example/a b.jpg?v=1&x=2')
})

test('data URIs and already-optimised URLs are left alone', () => {
  assert.equal(imageUrl(PLACEHOLDER_IMAGE, { width: 640 }), PLACEHOLDER_IMAGE)
  assert.equal(imageUrl('/_next/image?url=x&w=640&q=72', { width: 640 }), '/_next/image?url=x&w=640&q=72')
  assert.equal(imageUrl(''), '')
})

test('a URL with no width is passed through rather than guessed at', () => {
  assert.equal(imageUrl('https://cdn.example/a.jpg'), 'https://cdn.example/a.jpg')
})

test('srcset is ascending, deduplicated, and omitted when unusable', () => {
  const set = imageSrcSet('https://cdn.example/a.jpg', [750, 256, 384, 250])!
  const widths = set.split(', ').map((entry) => Number(entry.split(' ')[1].replace('w', '')))
  assert.deepEqual(widths, [256, 384, 750])
  assert.equal(imageSrcSet(PLACEHOLDER_IMAGE, [640]), undefined)
})

// ── managed redirects ───────────────────────────────────────────────────────
// A loop here is not a bad redirect, it is an unreachable site.

test('a chain collapses to its final destination', () => {
  const map = {
    '/a': { destination: '/b', statusCode: 301 },
    '/b': { destination: '/c', statusCode: 302 },
  }
  assert.deepEqual(resolveRedirect(map, '/a'), { destination: '/c', statusCode: 302 })
})

test('a self-referencing rule is refused rather than served', () => {
  assert.equal(resolveRedirect({ '/a': { destination: '/a', statusCode: 301 } }, '/a'), null)
})

test('a cycle is refused rather than served', () => {
  const map = {
    '/a': { destination: '/b', statusCode: 301 },
    '/b': { destination: '/a', statusCode: 301 },
  }
  assert.equal(resolveRedirect(map, '/a'), null)
  assert.equal(resolveRedirect(map, '/b'), null)
})

test('an unmapped path is not a redirect', () => {
  assert.equal(resolveRedirect({}, '/a'), null)
})

test('a single hop keeps its own status code', () => {
  assert.deepEqual(resolveRedirect({ '/old': { destination: '/new', statusCode: 301 } }, '/old'), {
    destination: '/new',
    statusCode: 301,
  })
})
