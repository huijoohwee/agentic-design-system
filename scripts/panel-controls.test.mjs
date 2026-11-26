import { createTabList } from '../site/floating-panel.js'
import {
  SELECTION_TARGET_ATTRIBUTE,
  SELECTION_TARGET_SELECTOR,
  assertAnnotationTargets,
} from '../site/annotation-targets.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createDesignIcon, createPanelControlIcon, getPanelControlLabel, updatePanelControlButton } from '../site/toolbar-icons.js'

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

  getBoundingClientRect() { return { left: 0, right: 100 } }
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
  button.setAttribute('aria-label', 'Minimize panel')
  button.title = 'Minimize panel'
  button.className = 'agentic-toolbar-item'

  button.title = ''
  updatePanelControlButton(button, 'minimize', { action() {} })

  assert.equal(button.getAttribute('aria-label'), 'Minimize panel')
  assert.equal(button.title, 'Minimize panel')
  assert.equal(button.children.length, 1)
})

test('a non-empty consumer label override remains forbidden', () => {
  const button = documentMock.createElement('button')
  button.dataset.agenticPanelControl = 'minimize'
  button.setAttribute('aria-label', 'Minimize panel')
  button.title = 'Minimize floating panel'

  assert.throws(() => updatePanelControlButton(button, 'minimize', { action() {} }), /cannot override its canonical title/u)
})

test('panel restore is distinct from restoring history', () => {
  const restoreIcon = createPanelControlIcon('restore', documentMock)
  const historyIcon = createDesignIcon('History', documentMock)

  assert.equal(getPanelControlLabel('minimize'), 'Minimize panel')
  assert.equal(getPanelControlLabel('restore'), 'Restore panel')
  assert.notDeepEqual(restoreIcon.children, historyIcon.children)
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

test('viewport floating panels reserve host chrome and persistent bottom controls', () => {
  const panelCss = readFileSync(new URL('../site/floating-panel.css', import.meta.url), 'utf8')
  const mobileCss = panelCss.slice(panelCss.indexOf('@media (max-width: 768px)'))

  assert.match(panelCss, /--agentic-floating-panel-effective-block-start-offset:\s*var\(--agentic-floating-panel-block-start-offset, calc\(max\(var\(--agentic-menu-edge-gap\), env\(safe-area-inset-top\)\) \+ var\(--agentic-toolbar-height\) \+ var\(--agentic-menu-edge-gap\)\)\)/u)
  assert.match(panelCss, /--agentic-floating-panel-available-block-size:\s*max\(0px, calc\(100dvh - var\(--agentic-floating-panel-effective-block-start-offset\) - var\(--agentic-floating-panel-bottom-offset, 0px\) - max\(var\(--agentic-menu-edge-gap\), env\(safe-area-inset-bottom\)\)\)\)/u)
  assert.match(panelCss, /inset-block-start:\s*var\(--agentic-floating-panel-effective-block-start-offset\)/u)
  assert.match(panelCss, /inset-inline-end:\s*max\(var\(--agentic-menu-edge-gap\), env\(safe-area-inset-right\)\)/u)
  assert.match(panelCss, /block-size:\s*min\(var\(--agentic-panel-main-height\), var\(--agentic-floating-panel-available-block-size\)\)/u)
  assert.match(panelCss, /max-block-size:\s*min\(var\(--agentic-panel-main-max-height\), var\(--agentic-floating-panel-available-block-size\)\)/u)
  assert.match(mobileCss, /block-size:\s*min\(var\(--agentic-panel-main-height-mobile\), var\(--agentic-floating-panel-available-block-size\)\)/u)
  assert.match(mobileCss, /max-block-size:\s*min\(var\(--agentic-panel-main-max-height\), var\(--agentic-floating-panel-available-block-size\)\)/u)
  assert.doesNotMatch(mobileCss, /100dvh - max\(var\(--agentic-menu-edge-gap\), env\(safe-area-inset-top\)\) - var\(--agentic-toolbar-height\)/u)
  assert.doesNotMatch(panelCss, /floating-panel-avoid-bottom|floating-panel-available-height/u)
})

test('all panel states reuse toolbar chrome and control sizing', () => {
  const panelCss = readFileSync(new URL('../site/floating-panel.css', import.meta.url), 'utf8')
  const toolbarCss = readFileSync(new URL('../site/toolbar.css', import.meta.url), 'utf8')
  const profile = JSON.parse(readFileSync(new URL('../site/tokens/shared-ui-profile.json', import.meta.url), 'utf8'))

  assert.equal(profile.tokens.some(token => token.cssVar === '--agentic-panel-shadow'), false)
  assert.equal(profile.tokens.find(token => token.cssVar === '--agentic-toolbar-shadow')?.value, '0 1px 2px rgb(0 0 0 / .04)')
  assert.match(panelCss, /border-radius:\s*var\(--agentic-panel-radius\); box-shadow:\s*var\(--agentic-toolbar-shadow\)/u)
  assert.match(panelCss, /block-size:\s*var\(--agentic-toolbar-height\); min-block-size:\s*var\(--agentic-toolbar-height\)/u)
  assert.match(panelCss, /min-block-size:\s*var\(--agentic-toolbar-height\)/u)
  assert.match(panelCss, /\.agentic-panel-main--collapsed\.agentic-panel-main,\s*\.agentic-panel-bottom--collapsed,\s*\.agentic-base-floating-panel\[data-agentic-base-panel-minimized="true"\]\s*\{\s*block-size: var\(--agentic-toolbar-height\); min-block-size: var\(--agentic-toolbar-height\); max-block-size: var\(--agentic-toolbar-height\);/u)
  const inner = panelCss.match(/(?:^|\n)\.agentic-base-floating-panel-inner \{([^}]+)\}/u)?.[1]
  assert.ok(inner, 'shared shell inner layout is present')
  assert.doesNotMatch(inner, /padding|margin|gap/u, 'the shell cannot add insets around the padded body')
  assert.doesNotMatch(panelCss, /\.agentic-base-floating-panel-expanded > \.agentic-base-floating-panel-header/u, 'the header meets the frame directly')
  assert.match(panelCss, /\.agentic-panel-body,\s*\.agentic-floating-panel-body \{[^}]*padding: var\(--agentic-control-padding-inline\)/u)
  assert.match(panelCss, /\.agentic-panel-main--collapsed :is\(\.agentic-panel-header, \.agentic-base-floating-panel-header\),\s*\.agentic-panel-bottom--collapsed :is\(\.agentic-panel-header, \.agentic-base-floating-panel-header\),\s*\.agentic-base-floating-panel\[data-agentic-base-panel-minimized="true"\] \.agentic-base-floating-panel-header\s*\{\s*block-size: calc\(var\(--agentic-toolbar-height\) - var\(--agentic-panel-frame-stroke-width\) - var\(--agentic-panel-frame-stroke-width\)\);\s*min-block-size: calc\(var\(--agentic-toolbar-height\) - var\(--agentic-panel-frame-stroke-width\) - var\(--agentic-panel-frame-stroke-width\)\);\s*border-block-end: 0;/u)
  assert.match(panelCss, /\.agentic-base-floating-panel \.agentic-floating-panel-tab:not\(\[aria-selected="true"\]\):not\(:hover\):not\(:focus-visible\):has\(> \.agentic-icon\) > span \{ font-size: 0; line-height: 0; \}/u)
  assert.match(panelCss, /\.agentic-base-floating-panel :is\(\.agentic-floating-panel-tab, \.agentic-base-floating-panel-close\):has\(> \.agentic-icon:only-child\),\s*\.agentic-base-floating-panel\[data-agentic-base-panel-minimized="true"\] \.agentic-floating-panel-tab:not\(\[aria-selected="true"\]\):not\(:hover\):not\(:focus-visible\):has\(> \.agentic-icon\)\s*\{\s*inline-size: max\(var\(--agentic-control-height\), var\(--agentic-icon-size-default\)\)/u)
  assert.doesNotMatch(panelCss, /\.agentic-base-floating-panel\[data-agentic-base-panel-minimized="true"\][^{]*\.agentic-floating-panel-tab[^}]*font-size: 0/u)
  assert.match(toolbarCss, /border:\s*var\(--agentic-panel-border\);\s*border-radius:\s*var\(--agentic-panel-radius\);\s*box-shadow:\s*var\(--agentic-toolbar-shadow\)/u)
  assert.match(toolbarCss, /--agentic-toolbar-height:\s*var\(--agentic-row-height\)/u)
})

test('expanded and minimized panel tabs reveal labels on hover, focus, and selection', () => {
  const panelCss = readFileSync(new URL('../site/floating-panel.css', import.meta.url), 'utf8')

  const compactLabelRule = panelCss.match(/\.agentic-base-floating-panel \.agentic-floating-panel-tab:not\(\[aria-selected="true"\]\):not\(:hover\):not\(:focus-visible\):has\(> \.agentic-icon\) > span \{[^}]+\}/u)?.[0]

  assert.ok(compactLabelRule, 'inactive tabs compact their labels only when neither hovered nor focused')
  assert.doesNotMatch(compactLabelRule, /expanded|collapsed|minimized/u, 'the same label rule applies in every panel state')
  assert.doesNotMatch(panelCss, /\.agentic-base-floating-panel\[data-agentic-base-panel-minimized="true"\][^{]*\.agentic-floating-panel-tab[^}]*font-size:\s*0/u, 'minimized panels do not hide selected, hovered, or focused labels')
  assert.match(panelCss, /\.agentic-base-floating-panel \.agentic-floating-panel-tab\[aria-selected="true"\]/u, 'the selected tab remains a labeled tab in minimized and expanded panels')
  assert.doesNotMatch(panelCss, /\.agentic-base-floating-panel:not\(\.agentic-panel-main\):not\(\.agentic-panel-bottom\)[^}]*\.agentic-floating-panel-tab/u)
})

test('FloatingPanel shares the panel tab label behavior', () => {
  const panelCss = readFileSync(new URL('../site/floating-panel.css', import.meta.url), 'utf8')

  assert.match(panelCss, /\.agentic-base-floating-panel \.agentic-floating-panel-tab:not\(\[aria-selected="true"\]\):not\(:hover\):not\(:focus-visible\):has\(> \.agentic-icon\) > span \{ font-size: 0; line-height: 0; \}/u)
  assert.match(panelCss, /\.agentic-base-floating-panel \.agentic-floating-panel-tab\s*\{[^}]*block-size:\s*max\(var\(--agentic-control-height\), var\(--agentic-icon-size-default\)\)/u)
})

test('icon and icon-label panel tabs share one control height', () => {
  const panelCss = readFileSync(new URL('../site/floating-panel.css', import.meta.url), 'utf8')
  const coarsePointer = panelCss.indexOf('@media (pointer: coarse)')
  const touchTabRule = panelCss.indexOf('.agentic-base-floating-panel .agentic-floating-panel-tab {', coarsePointer)

  assert.match(panelCss, /\.agentic-base-floating-panel \.agentic-floating-panel-tab\s*\{[^}]*block-size:\s*max\(var\(--agentic-control-height\), var\(--agentic-icon-size-default\)\);\s*min-block-size:\s*max\(var\(--agentic-control-height\), var\(--agentic-icon-size-default\)\)/u)
  assert.ok(coarsePointer >= 0 && touchTabRule > coarsePointer)
  assert.match(panelCss.slice(touchTabRule, touchTabRule + 320), /block-size:\s*max\(var\(--agentic-control-height-touch\), var\(--agentic-icon-size-default\)\);\s*min-block-size:\s*max\(var\(--agentic-control-height-touch\), var\(--agentic-icon-size-default\)\);/u)
})

test('collection views use the toolbar height inside documents and shadow roots', () => {
  const collection = readFileSync(new URL('../site/collection-layout.css', import.meta.url), 'utf8')
  const toolbar = readFileSync(new URL('../site/toolbar.css', import.meta.url), 'utf8')
  assert.match(collection, /^@import "\.\/toolbar\.css";/u)
  assert.match(collection, /\.agentic-table-toolbar,\s*\.agentic-table-column-header\[scope="col"\]\s*\{[^}]*block-size: var\(--agentic-toolbar-height\)/u)
  assert.doesNotMatch(collection, /--agentic-toolbar-height\s*:/u)
  assert.match(toolbar, /:root, :host\s*\{[^}]*--agentic-toolbar-height:/u)
})

test('minimized dock panels override placement height without changing their width', () => {
  const panelCss = readFileSync(new URL('../site/floating-panel.css', import.meta.url), 'utf8')
  const dockSizing = panelCss.indexOf('.agentic-base-floating-panel-root[data-agentic-floating-panel-placement="dock"] > .agentic-base-floating-panel { height: 100%; }')
  const minimizedDockSizing = panelCss.indexOf('.agentic-base-floating-panel-root[data-agentic-floating-panel-placement="dock"] > .agentic-base-floating-panel[data-agentic-base-panel-minimized="true"]')

  assert.ok(dockSizing >= 0)
  assert.ok(minimizedDockSizing > dockSizing, 'minimized dimensions follow the dock placement rule')
  assert.match(panelCss.slice(minimizedDockSizing), /block-size:\s*var\(--agentic-toolbar-height\);\s*min-block-size:\s*var\(--agentic-toolbar-height\);\s*max-block-size:\s*var\(--agentic-toolbar-height\);/u)
  assert.doesNotMatch(panelCss.slice(minimizedDockSizing).split('}')[0], /inline-size|width\s*:/u)
})

test('MainPanel and FloatingPanel retain shared viewport dimensions when other panels open', () => {
  const panelCss = readFileSync(new URL('../site/floating-panel.css', import.meta.url), 'utf8')
  const profile = JSON.parse(readFileSync(new URL('../site/tokens/shared-ui-profile.json', import.meta.url), 'utf8'))
  const mainWidth = profile.tokens.find(token => token.key === 'layout.panel.main-width')
  const mainHeight = profile.tokens.find(token => token.key === 'layout.panel.main-height')

  assert.equal(mainWidth?.value, '80vw')
  assert.equal(mainHeight?.value, '80vh')
  assert.match(panelCss, /\.agentic-panel-main\s*\{[^}]*inline-size:\s*min\(var\(--agentic-panel-main-width\), calc\(100vw - 2 \* var\(--agentic-menu-edge-gap\)\)\)/u)
  assert.match(panelCss, /\.agentic-panel-main--open\.agentic-panel-main\s*\{\s*block-size:\s*min\(var\(--agentic-panel-main-height\)/u)
  assert.match(panelCss, /\.agentic-panel-bottom\s*\{[^}]*block-size:\s*min\(var\(--agentic-panel-bottom-height\)/u)
  assert.doesNotMatch(panelCss, /agentic-floating-panel-available-height|data-agentic-floating-panel-avoid-bottom/u)
})

test('a standalone worksheet rail binds selected tabs to their panels and reports a single transition', () => {
  const root = documentMock.createElement('section')
  root.id = 'worksheets'
  for (const key of ['source', 'chart']) {
    const page = documentMock.createElement('section')
    page.dataset.panelTab = key
    page.dataset.panelLabel = key
    root.append(page)
  }
  const events = []
  const list = createTabList(root, { label: 'Worksheets', activeKey: 'chart', onChange: key => events.push(key) })
  assert.equal(list.rail.getAttribute('role'), 'tablist')
  assert.equal(list.rail.children[1].getAttribute('aria-controls'), root.children[1].id)
  assert.deepEqual(root.children.map(page => page.hidden), [true, false])
  list.select('source')
  list.select('source')
  assert.deepEqual(events, ['source'])
  assert.deepEqual(list.rail.children.map(tab => tab.tabIndex), [0, -1])
  assert.throws(() => list.select('unknown'), RangeError)
})

test('annotation target lookup has one stable selector and keeps the shared panel on a semantic dialog root', () => {
  const source = readFileSync(new URL('../site/floating-panel.js', import.meta.url), 'utf8')

  assert.equal(SELECTION_TARGET_ATTRIBUTE, 'data-selection-target')
  assert.equal(SELECTION_TARGET_SELECTOR, '[data-selection-target]')
  assert.equal(typeof assertAnnotationTargets, 'function')
  assert.match(source, /element\(doc, 'aside', 'agentic-base-floating-panel agentic-form-controls'\)/u)
  assert.match(source, /selectionTarget, returnFocus/u)
  assert.match(source, /if \(selectionTarget\) dialog\.dataset\.selectionTarget = selectionTarget/u)
  assert.doesNotMatch(source, /dialog\.dataset\.selectionTarget = 'floating-panel'/u)
  assert.match(readFileSync(new URL('../site/index.html', import.meta.url), 'utf8'), /id="floating-panel-preview-trigger"[^>]*data-selection-target="floating-panel-preview-trigger"/u)
  assert.match(source, /dialog\.setAttribute\('role', 'dialog'\)/u)
})

function annotationFixture({ name = 'sample.target', tag = 'button', hit = true, hidden = false, left = 0 } = {}) {
  let element
  const document = {
    defaultView: {
      innerWidth: 200,
      innerHeight: 100,
      getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto' }),
    },
    elementFromPoint: () => hit ? element : null,
    getElementById: () => null,
  }
  element = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    ownerDocument: document,
    childNodes: [{ nodeType: 3, nodeValue: 'Visible target', textContent: 'Visible target' }],
    hidden,
    inert: false,
    isConnected: true,
    parentElement: null,
    labels: [],
    getAttribute: key => key === SELECTION_TARGET_ATTRIBUTE ? name : key === 'href' && tag === 'a' ? '#target' : null,
    hasAttribute: key => key === SELECTION_TARGET_ATTRIBUTE || key === 'href' && tag === 'a',
    getBoundingClientRect: () => ({ left, top: 0, width: 100, height: 40 }),
    scrollIntoView: () => {},
    contains: child => child === element,
  }
  return element
}

test('annotation release assertion is self-contained for browser execution and rejects duplicates or generic targets', () => {
  const targets = [annotationFixture({ name: 'repeat', tag: 'div' }), annotationFixture({ name: 'repeat' })]
  const root = { querySelectorAll: selector => selector === SELECTION_TARGET_SELECTOR ? targets : [] }
  assert.match(assertAnnotationTargets.toString(), /data-selection-target/u)
  assert.doesNotMatch(assertAnnotationTargets.toString(), /\b(?:SELECTION_TARGET_SELECTOR|inspectAnnotationTargets|findSelectionTargets)\b/u)
  assert.throws(() => assertAnnotationTargets(root), /shared contract/u)
})

test('annotation release assertion requires visible browser hit-testing and accepts the browser-evaluation options form', () => {
  const target = annotationFixture()
  const root = { querySelectorAll: selector => selector === SELECTION_TARGET_SELECTOR ? [target] : [] }
  assert.equal(assertAnnotationTargets(root).schema, 'agentic-design-system/annotation-target-audit/v1')
  assert.throws(() => assertAnnotationTargets({ querySelectorAll: () => [annotationFixture({ hit: false })] }), /not-hit-testable/u)
  assert.throws(() => assertAnnotationTargets({ querySelectorAll: () => [annotationFixture({ left: 300 })] }), /outside-viewport/u)
  const previous = globalThis.document
  try {
    globalThis.document = root
    assert.equal(assertAnnotationTargets({ minTargets: 1 }).targetCount, 1)
  } finally {
    if (previous === undefined) delete globalThis.document
    else globalThis.document = previous
  }
})
