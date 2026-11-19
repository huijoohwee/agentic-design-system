import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { validateSharedUiProfile } from './design-system-icon-profile.mjs'
import { PANEL_SECTION, recoverSectionFocus, isSectionGroupCollapsed, updateSectionGroup,
  installPanelSections, setPanelSectionExpanded } from '../site/panel-section.js'

function fixture() {
  const doc = { activeElement: null }, listeners = new Map(), sections = []
  let observations = 0, disconnects = 0, refresh
  doc.defaultView = { MutationObserver: class {
    constructor(callback) { refresh = callback }
    observe() { observations++ }
    disconnect() { disconnects++ }
  } }
  const root = { ownerDocument: doc, contains: node => node === group || sections.includes(node) || node === button,
    querySelectorAll: () => sections, addEventListener: (key, fn) => listeners.set(key, fn),
    removeEventListener: (key, fn) => { if (listeners.get(key) === fn) listeners.delete(key) } }
  const group = { querySelectorAll: () => sections }
  const button = { dataset: { agenticSectionsAction: 'toggle' }, getAttribute: () => 'group', closest() { return this } }
  doc.getElementById = id => id === 'group' ? group : null
  const makeSection = () => {
    const input = { value: 'retained' }, summary = { dataset: {}, classList: { add() {} }, contains: node => node === summary,
      focus: options => { assert.deepEqual(options, { preventScroll: true }); doc.activeElement = summary } }
    const section = { localName: 'details', open: true, dataset: {}, ownerDocument: doc,
      classList: { add: name => { assert.equal(name, PANEL_SECTION.section) } },
      matches: () => true, contains: node => [input, summary].includes(node), querySelector: () => summary }
    sections.push(section)
    return { section, summary, input }
  }
  return { root, doc, makeSection, button, listeners, refresh: () => refresh(),
    counters: () => ({ observations, disconnects }) }
}

test('group updates retain identity for unchanged state and do not mutate owner state', () => {
  const first = new Set(['a'])
  assert.equal(updateSectionGroup(first, 'a', true), first)
  const next = updateSectionGroup(first, 'b', true)
  assert.deepEqual([...first], ['a']); assert.deepEqual([...next], ['a', 'b'])
  assert.equal(isSectionGroupCollapsed([], first), false)
  assert.equal(isSectionGroupCollapsed(['a'], first), true)
  assert.equal(isSectionGroupCollapsed(['a', 'b'], first), false)
  assert.equal(PANEL_SECTION.defaultCollapsed, true)
  assert(Object.isFrozen(PANEL_SECTION))
})

test('native installation is idempotent, follows inserted sections and fully disposes listeners', () => {
  const f = fixture(), a = f.makeSection()
  const dispose = installPanelSections(f.root)
  assert.equal(installPanelSections(f.root), dispose)
  assert.equal(a.summary.dataset.agenticSticky, 'true')
  const b = f.makeSection(); b.section.dataset.agenticSticky = 'false'; f.refresh()
  assert.equal(b.summary.dataset.agenticSticky, 'false')
  f.doc.activeElement = a.input
  f.listeners.get('click')({ target: f.button })
  assert.equal(a.section.open, false); assert.equal(b.section.open, false)
  assert.equal(f.doc.activeElement, a.summary); assert.equal(a.input.value, 'retained')
  f.listeners.get('click')({ target: f.button })
  assert.equal(a.section.open, true); assert.equal(b.section.open, true)
  f.doc.activeElement = b.input; b.section.open = false
  f.listeners.get('toggle')({ target: b.section })
  assert.equal(f.doc.activeElement, b.summary)
  dispose(); dispose()
  assert.equal(f.listeners.size, 0); assert.deepEqual(f.counters(), { observations: 1, disconnects: 1 })
  const second = installPanelSections(f.root); assert.notEqual(second, dispose); second()
})

test('focus recovery is local and invalid native contracts fail loudly', () => {
  let focuses = 0
  recoverSectionFocus({ ownerDocument: { activeElement: {} }, contains: () => false }, { focus: () => focuses++ })
  assert.equal(focuses, 0)
  assert.throws(() => setPanelSectionExpanded({}, true), TypeError)
  assert.throws(() => installPanelSections({}), TypeError)
  const f = fixture(), a = f.makeSection(); a.section.querySelector = () => null
  assert.throws(() => installPanelSections(f.root), /direct summary/)
})

test('React adapts the owner contract and uses native buttons without duplicate key handlers', () => {
  const adapter = readFileSync(new URL('../packages/react-panels/src/PanelSection.tsx', import.meta.url), 'utf8')
  assert.match(adapter, /from '\.\.\/\.\.\/\.\.\/site\/panel-section.js'/)
  assert.match(adapter, /hasExpanded \|\| !isCollapsed/)
  assert.match(adapter, /hidden=\{isCollapsed\}/)
  assert.match(adapter, /<button ref=\{trigger\} type="button"/)
  assert.doesNotMatch(adapter, /onKeyDown|@agentic-base|grph-shared|lucide|localStorage|addEventListener/)
  const css = readFileSync(new URL('../site/panel-section.css', import.meta.url), 'utf8')
  assert.match(css, /position: sticky; inset-block-start: var\(--agentic-section-offset/)
  assert.match(css, /overflow: auto; overscroll-behavior: contain/)
  assert.match(css, /\[hidden\] \{ display: none !important/)
  assert.match(css, /@media print/)
})

test('the native preview and offline cache both admit section runtime assets', () => {
  for (const path of ['../scripts/dev.mjs', '../site/sw.js']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(source, /panel-section\.js/)
    assert.match(source, /panel-section\.css/)
  }
})

test('panel surfaces use the active profile and share one border with their controls', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  const profile = validateSharedUiProfile(read('../site/tokens/shared-ui-profile.json'))
  const surface = profile.tokens.find(token => token.key === 'surface.panel.background')
  surface.value = surface.value.replace('--kg-panel-bg', '--kg-border')
  assert.throws(() => validateSharedUiProfile(JSON.stringify(profile)), /Invalid shared UI profile/)

  const controls = read('../site/vendor/shared-ui-profile.css')
  assert.ok(read('../site/floating-panel.css').includes('--agentic-panel-control-border: var(--agentic-panel-border)'))
  assert.ok(controls.includes('border: var(--agentic-panel-control-border, var(--agentic-control-border))'))
  for (const [path, selector] of [
    ['../site/floating-panel.css', '.agentic-base-floating-panel {'],
    ['../site/collection-layout.css', '.agentic-collection-item {'],
    ['../site/panel-section.css', '.agentic-panel-section-header[data-agentic-sticky="true"] {'],
    ['../site/vendor/shared-ui-profile.css', '.agentic-toggle-group {'],
  ]) {
    const rule = read(path).split(selector)[1]?.split('}')[0]
    assert.ok(rule?.includes('background: var(--agentic-panel-background)'), path)
  }
})

test('collection layout picker retains controls and reports the chosen layout to the host', async () => {
  const { mountCollectionLayoutPicker } = await import('../site/collection-layout.js')
  const node = () => ({
    children: [], attrs: {}, dataset: {},
    setAttribute(key, value) { this.attrs[key] = value },
    append(child) { this.children.push(child) },
    replaceChildren(child) { this.children = [child] },
    addEventListener(key, listener) { this[key] = listener },
    remove() { this.removed = true },
  })
  const host = { ...node(), ownerDocument: { createElement: node, createElementNS: node } }
  const changes = []
  const picker = mountCollectionLayoutPicker(host, { layout: 'list', label: 'Media layout', onChange: value => changes.push(value) })
  const [control] = host.children
  const [list, card, grid] = control.children
  assert.deepEqual(control.children.map(button => button.title), ['List layout', 'Card layout', 'Grid layout'])
  assert.equal(list.attrs['aria-pressed'], 'true')
  grid.click()
  assert.deepEqual(changes, ['grid'])
  picker.setLayout('grid')
  assert.equal(grid.attrs['aria-pressed'], 'true')
  assert.equal(card.attrs['aria-pressed'], 'false')
  assert.equal(list.attrs['aria-pressed'], 'false')
  assert.throws(() => picker.setLayout('invalid'), RangeError)
  picker.destroy()
  assert.equal(control.removed, true)
})

test('native and React tabs share heading, body and group insets', () => {
  const css = readFileSync(new URL('../site/skills-commands.css', import.meta.url), 'utf8')
  for (const role of ['header', 'body']) {
    assert.match(css, new RegExp(`:(?:is|where)\\(\\.agentic-panel-tab-${role}, \\.agentic-skills-${role}\\) \\{[^}]*padding: var\\(--agentic-menu-padding\\)`))
  }
  assert.match(css, /\.agentic-panel-tab-body \.agentic-panel-section, \.agentic-panel-section\.agentic-skills-group-section \{ padding-inline: 0;/)
  assert.match(css, /data-agentic-tab-viewport="true"\] \{ grid-template-rows: minmax\(0, 1fr\)/)
})
