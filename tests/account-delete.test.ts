import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Deleting a customer is one `DELETE FROM "User"`. What survives it is decided
// entirely by the foreign keys in the schema, not by anything in the action —
// so that is what gets asserted. Add `onDelete: Cascade` to Order.user and the
// store starts quietly erasing its own books every time someone closes an
// account, with no error anywhere to notice it by.

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')

function relationLine(model: string, field: string): string {
  const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1]
  assert.ok(block, `model ${model} not found`)
  const line = block.split('\n').find((row) => row.trim().startsWith(`${field} `))
  assert.ok(line, `${model}.${field} not found`)
  return line
}

test('deleting a customer keeps their orders', () => {
  const line = relationLine('Order', 'user')
  assert.match(line, /User\?/, 'Order.user must stay optional so the row survives with userId nulled')
  assert.doesNotMatch(line, /onDelete:\s*Cascade/, 'orders are financial records — they must not cascade')
})

test('deleting a customer takes their personal rows with it', () => {
  for (const model of ['Address', 'WishlistItem', 'StoreCredit']) {
    assert.match(relationLine(model, 'user'), /onDelete:\s*Cascade/, `${model} rows would be orphaned`)
  }
})
