import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeHtml, stripHtml } from '../src/lib/html.ts'

// Editor HTML is stored and then rendered with dangerouslySetInnerHTML. If this
// function is wrong, a compromised staff account becomes stored XSS on every
// product page — so it gets the tests.

test('keeps the formatting an editor actually uses', () => {
  const input = '<h2>Care</h2><p>Wash with <strong>mild soap</strong>.</p><ul><li>Rinse</li></ul>'
  assert.equal(sanitizeHtml(input), input)
})

test('removes script elements and their contents', () => {
  assert.equal(sanitizeHtml('<p>ok</p><script>alert(1)</script>'), '<p>ok</p>')
  assert.equal(sanitizeHtml('<script src="https://evil.test/x.js"></script>hi'), 'hi')
})

test('removes style, iframe, object, embed, and form', () => {
  for (const tag of ['style', 'iframe', 'object', 'embed', 'form']) {
    assert.ok(!sanitizeHtml(`<${tag}>x</${tag}><p>kept</p>`).includes(tag))
  }
})

test('drops event handler attributes', () => {
  const output = sanitizeHtml('<p onclick="steal()">text</p>')
  assert.equal(output, '<p>text</p>')
  assert.ok(!output.includes('onclick'))
})

test('drops javascript: and data: URLs but keeps ordinary links', () => {
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)">x</a>'), '<a>x</a>')
  // Whitespace and control characters must not smuggle the scheme past the check.
  assert.equal(sanitizeHtml('<a href="java\tscript:alert(1)">x</a>'), '<a>x</a>')
  assert.equal(sanitizeHtml('<a href="/pages/care">x</a>'), '<a href="/pages/care">x</a>')
  assert.equal(sanitizeHtml('<a href="https://example.com">x</a>'), '<a href="https://example.com">x</a>')
})

test('forces noopener on links that open a new tab', () => {
  const output = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>')
  assert.ok(output.includes('rel="noopener noreferrer"'))
})

test('removes unknown tags entirely rather than unwrapping them', () => {
  assert.equal(sanitizeHtml('<marquee>spin</marquee>'), 'spin')
  assert.equal(sanitizeHtml('<svg><use href="#x"/></svg>'), '')
})

test('strips comments, which can hide markup from a reviewer', () => {
  assert.equal(sanitizeHtml('<p>a</p><!-- <script>alert(1)</script> --><p>b</p>'), '<p>a</p><p>b</p>')
})

test('stripHtml produces plain text and truncates with an ellipsis', () => {
  assert.equal(stripHtml('<p>Hello <strong>there</strong></p>'), 'Hello there')
  assert.equal(stripHtml('<p>&amp; &lt;tag&gt;</p>'), '& <tag>')
  assert.equal(stripHtml('<p>abcdefghij</p>', 6), 'abcde…')
})
