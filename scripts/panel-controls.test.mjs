import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('toolbar overlay uses the one shared Design System layer token', () => {
  const profile = JSON.parse(readFileSync(new URL('../site/tokens/shared-ui-profile.json', import.meta.url), 'utf8'))
  const toolbarCss = readFileSync(new URL('../site/toolbar.css', import.meta.url), 'utf8')

  assert.deepEqual(profile.tokens.find(token => token.key === 'layout.toolbar.overlay-layer'), {
    key: 'layout.toolbar.overlay-layer',
    cssVar: '--agentic-toolbar-overlay-layer',
    type: 'number',
    value: '6000',
  })
  assert.match(toolbarCss, /\.agentic-toolbar-overlay-layer\s*\{\s*z-index:\s*var\(--agentic-toolbar-overlay-layer\);\s*\}/u)
  assert.doesNotMatch(toolbarCss, /z-index:\s*calc\(var\(--agentic-floating-panel-layer/u)
})

test('viewport floating panels reserve the shared toolbar row and safe viewport insets', () => {
  const panelCss = readFileSync(new URL('../site/floating-panel.css', import.meta.url), 'utf8')

  assert.match(panelCss, /inset-block-start:\s*calc\(max\(var\(--agentic-menu-edge-gap\), env\(safe-area-inset-top\)\) \+ var\(--agentic-row-height\) \+ var\(--agentic-menu-edge-gap\)\)/u)
  assert.match(panelCss, /inset-inline-end:\s*max\(var\(--agentic-menu-edge-gap\), env\(safe-area-inset-right\)\)/u)
  assert.match(panelCss, /block-size:\s*min\(var\(--agentic-panel-main-height\), calc\(100dvh - max\(var\(--agentic-menu-edge-gap\), env\(safe-area-inset-top\)\) - var\(--agentic-row-height\)/u)
  assert.match(panelCss, /max-block-size:\s*min\(var\(--agentic-panel-main-max-height\), calc\(100dvh - max\(var\(--agentic-menu-edge-gap\), env\(safe-area-inset-top\)\) - var\(--agentic-row-height\)/u)
  assert.doesNotMatch(panelCss, /floating-panel-avoid-bottom|floating-panel-available-height/u)
})

test('MainPanel and FloatingPanel retain shared viewport dimensions when other panels open', () => {
  const panelCss = readFileSync(new URL('../site/floating-panel.css', import.meta.url), 'utf8')
  const profile = JSON.parse(readFileSync(new URL('../site/tokens/shared-ui-profile.json', import.meta.url), 'utf8'))
  const mainWidth = profile.tokens.find(token => token.key === 'layout.panel.main-width')
  const mainHeight = profile.tokens.find(token => token.key === 'layout.panel.main-height')

  assert.equal(mainWidth?.value, '80vw')
  assert.equal(mainHeight?.value, '80vh')
  assert.match(panelCss, /\.agentic-panel-main--open\.agentic-panel-main\s*\{\s*block-size:\s*min\(var\(--agentic-panel-main-height\)/u)
  assert.match(panelCss, /\.agentic-panel-bottom\s*\{[^}]*block-size:\s*min\(var\(--agentic-panel-bottom-height\)/u)
  assert.doesNotMatch(panelCss, /agentic-floating-panel-available-height|data-agentic-floating-panel-avoid-bottom/u)
})
