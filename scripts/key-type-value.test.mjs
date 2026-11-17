import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createKeyTypeValueRow, KTV_ROW_PARTS } from '../site/key-type-value.js'

function documentFixture() {
  const document = { createElement: tag => ({ tag, nodeType: 1, ownerDocument: document, dataset: {}, children: [], append(...nodes) { this.children.push(...nodes) } }) }
  return document
}

test('native rows preserve control identity, callbacks and accessible labels', () => {
  const ownerDocument = documentFixture(), control = ownerDocument.createElement('input')
  control.value = '8'; control.oninput = () => 'updated'; control.ariaLabel = 'Capacity'
  const row = createKeyTypeValueRow({ keyNode: 'Capacity', typeNode: 'Number', valueNode: control, id: 'capacity', ownerDocument })
  assert.equal(row.className, 'agentic-ktv-container'); assert.equal(row.children[0].id, 'capacity')
  assert.deepEqual(row.children[0].children.map(cell => cell.tag), ['dt', 'dd', 'dd'])
  assert.equal(row.children[0].children[2].children[0], control)
  assert.equal(control.oninput(), 'updated'); assert.equal(control.value, '8'); assert.equal(control.ariaLabel, 'Capacity')
})

test('invalid rows fail before moving supplied cells', () => {
  const ownerDocument = documentFixture(), control = ownerDocument.createElement('input')
  for (const options of [{ keyNode: control, typeNode: control, valueNode: 'x' },
    { keyNode: 'Key', typeNode: 'Type', valueNode: documentFixture().createElement('input') },
    { keyNode: 'Key', typeNode: 'Type' }, { keyNode: 'Key', typeNode: 'Type', valueNode: 'x', align: 'other' }])
    assert.throws(() => createKeyTypeValueRow({ ...options, ownerDocument }), TypeError)
  assert.deepEqual(control.children, [])
})

test('React shares immutable slots without a reverse consumer dependency or inline geometry', () => {
  const adapter = readFileSync(new URL('../packages/react-ktv/src/index.tsx', import.meta.url), 'utf8')
  assert(Object.isFrozen(KTV_ROW_PARTS) && KTV_ROW_PARTS.every(Object.isFrozen))
  assert.match(adapter, /KTV_ROW_PARTS\.map/)
  assert.match(adapter, /from '\.\.\/\.\.\/\.\.\/site\/key-type-value\.js'/)
  assert.doesNotMatch(adapter, /@agentic-base|grph-shared|grid-template|style=/)
})
