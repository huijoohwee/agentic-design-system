import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createFieldTypeIcon, createKeyTypeValueRow, createKeyTypeValueRows, validateKeyTypeValueRows, KTV_ROW_PARTS } from '../site/key-type-value.js'

function documentFixture() {
  const document = { createElement: tag => ({ tag, nodeType: 1, ownerDocument: document, dataset: {}, attributes: {}, setAttribute(key, value) { this.attributes[key] = value }, children: [], append(...nodes) { this.children.push(...nodes) } }) }
  document.createElementNS = (_, name) => document.createElement(name)
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

test('independent range values occupy separate KTV rows without cloning their controls', () => {
  const ownerDocument = documentFixture(), low = ownerDocument.createElement('input'), high = ownerDocument.createElement('input')
  low.value = '12'; high.value = '18'; low.oninput = () => 'minimum edited'
  const group = createKeyTypeValueRows({ ownerDocument, rows: [
    { id: 'cost-minimum', keyNode: 'Cost minimum', typeNode: 'Number', valueNode: low },
    { id: 'cost-maximum', keyNode: 'Cost maximum', typeNode: 'Number', valueNode: high },
  ] })
  assert.equal(group.children.length, 2)
  for (const [index, value] of [low, high].entries()) {
    const row = group.children[index].children[0]
    assert.deepEqual(row.children.map(cell => cell.tag), ['dt', 'dd', 'dd'])
    assert.deepEqual(row.children[2].children, [value])
  }
  assert.equal(low.oninput(), 'minimum edited'); assert.equal(low.value, '12'); assert.equal(high.value, '18')
})

test('invalid row groups fail atomically before moving any control', () => {
  const ownerDocument = documentFixture(), control = ownerDocument.createElement('input')
  const first = { id: 'minimum', keyNode: 'Minimum', typeNode: 'Number', valueNode: control }
  for (const rows of [[], [first, { ...first }], [first, { ...first, id: 'maximum' }],
    [first, { id: 'maximum', keyNode: 'Maximum', typeNode: 'Number' }]]) {
    assert.throws(() => createKeyTypeValueRows({ ownerDocument, rows }), TypeError)
  }
  for (const rows of [[{ id: '' }], [{ id: 'x', align: 'other' }]]) assert.throws(() => validateKeyTypeValueRows(rows), TypeError)
  const adapter = readFileSync(new URL('../packages/react-ktv/src/index.tsx', import.meta.url), 'utf8')
  assert.match(adapter, /validateKeyTypeValueRows\(rows\)/)
  assert.match(adapter, /key=\{row\.id\}/)
})

test('compact field types have a shared glyph, tooltip and accessible name', () => {
  const doc = documentFixture()
  for (const [kind, label] of Object.entries({ text: 'Text', number: 'Number', boolean: 'Boolean', datetime: 'Date and time', list: 'List', object: 'Object' })) {
    const marker = createFieldTypeIcon(kind, doc)
    assert.equal(marker.attributes.role, 'img')
    assert.equal(marker.attributes['aria-label'], label)
    assert.equal(marker.title, label)
    assert.equal(marker.children[0].tag, 'svg')
    assert.equal(marker.children[0].attributes['aria-hidden'], 'true')
  }
  assert.throws(() => createFieldTypeIcon('constructor', doc), /Unknown field type/)
})
