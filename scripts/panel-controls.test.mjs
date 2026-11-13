import assert from 'node:assert/strict'
import test from 'node:test'
import { updatePanelControlButton } from '../site/toolbar-icons.js'

class ElementMock {
  constructor(localName, ownerDocument) {
    this.localName = localName
    this.ownerDocument = ownerDocument
    this.attributes = new Map()
    this.dataset = {}
    this.children = []
    this.listeners = new Map()
    this.classes = new Set()
    this.classList = {
      add: name => this.classes.add(name),
      [Symbol.iterator]: () => this.classes[Symbol.iterator](),
    }
  }

  get className() { return [...this.classes].join(' ') }
  set className(value) { this.classes = new Set(String(value).split(/\s+/u).filter(Boolean)) }
  get title() { return this.getAttribute('title') ?? '' }
  set title(value) { this.setAttribute('title', value) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  hasAttribute(name) { return this.attributes.has(name) }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  append(child) { this.children.push(child) }
  replaceChildren(...children) { this.children = children }
  addEventListener(name, listener) { this.listeners.set(name, listener) }
}

const documentMock = {
  createElement: name => new ElementMock(name, documentMock),
  createElementNS: (_namespace, name) => new ElementMock(name, documentMock),
}

test('a transient empty title is repaired to the canonical panel-control label', () => {
  const button = documentMock.createElement('button')
  button.dataset.agenticPanelControl = 'minimize'
  button.setAttribute('aria-label', 'Minimize')
  button.title = 'Minimize'
  button.className = 'agentic-toolbar-item'

  button.title = ''
  updatePanelControlButton(button, 'minimize', { action() {} })

  assert.equal(button.getAttribute('aria-label'), 'Minimize')
  assert.equal(button.title, 'Minimize')
  assert.equal(button.children.length, 1)
})

test('a non-empty consumer label override remains forbidden', () => {
  const button = documentMock.createElement('button')
  button.dataset.agenticPanelControl = 'minimize'
  button.setAttribute('aria-label', 'Minimize')
  button.title = 'Minimize floating panel'

  assert.throws(() => updatePanelControlButton(button, 'minimize', { action() {} }), /cannot override its canonical title/u)
})
