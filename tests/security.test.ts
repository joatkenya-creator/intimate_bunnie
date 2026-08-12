import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { clientIp, isSameOrigin, rateLimit } from '../src/lib/security.ts'

test('a bucket allows exactly the limit, then blocks', () => {
  const key = `test-limit-${Math.random()}`
  for (let attempt = 1; attempt <= 3; attempt++) {
    assert.equal(rateLimit(key, 3, 60_000), true, `attempt ${attempt} is inside the limit`)
  }
  assert.equal(rateLimit(key, 3, 60_000), false, 'the fourth is over')
  assert.equal(rateLimit(key, 3, 60_000), false, 'and stays over')
})

test('buckets are independent per key', () => {
  const a = `test-a-${Math.random()}`
  const b = `test-b-${Math.random()}`
  assert.equal(rateLimit(a, 1, 60_000), true)
  assert.equal(rateLimit(a, 1, 60_000), false)
  assert.equal(rateLimit(b, 1, 60_000), true, 'one caller over the limit must not block another')
})

test('the window reopens once it has passed', async () => {
  const key = `test-window-${Math.random()}`
  assert.equal(rateLimit(key, 1, 20), true)
  assert.equal(rateLimit(key, 1, 20), false)
  await sleep(30)
  assert.equal(rateLimit(key, 1, 20), true, 'a new window starts fresh')
})

test('clientIp reads a Request or bare Headers, proxy header first', () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18', 'x-real-ip': '10.0.0.1' })
  assert.equal(clientIp(headers), '203.0.113.7', 'the client is the first hop, not the proxy chain')
  assert.equal(clientIp(new Request('https://example.com', { headers })), '203.0.113.7')
  assert.equal(clientIp(new Headers()), 'unknown', 'a missing IP must still key a bucket, not throw')
})

test('state-changing requests need a same-origin Origin header', () => {
  const post = (origin?: string) =>
    new Request('https://shop.example/api/admin/x', {
      method: 'POST',
      headers: origin ? { origin, host: 'shop.example' } : { host: 'shop.example' },
    })

  assert.equal(isSameOrigin(post('https://shop.example')), true)
  assert.equal(isSameOrigin(post('https://evil.example')), false)
  assert.equal(isSameOrigin(post()), false, 'no Origin on a POST is not a browser form we trust')
  assert.equal(isSameOrigin(post('not a url')), false)
  assert.equal(isSameOrigin(new Request('https://shop.example/x')), true, 'GET is not state-changing')
})
