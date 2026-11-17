import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  HOVER_PARTS, buildSettingsKeyTooltip, buildSettingsValueTooltip, buildNumericTooltip,
  buildRoleActionOutcomeTooltip, buildDefaultTooltip, buildHoverKeyValueText, formatHoverValue,
  computeTooltipMaxWidthPx, constrainTooltipPosition,
} from '../site/hover-text.js'
import { createHoverPanel, installHoverLabels } from '../site/hover.js'

test('key/value help retains the established action and bounds grammar', () => {
  assert.equal(buildRoleActionOutcomeTooltip({ role: 'Editor', actions: ['adjust', 'apply'], outcome: 'inspect' }),
    'Editor → adjust → apply → inspect')
  assert.equal(buildSettingsKeyTooltip({ area: 'Capacity', key: 'limit', responsibility: 'bound work' }),
    'Capacity → edit limit in MainPanel → Settings → apply changes via MainPanel header → bound work')
  assert.equal(buildSettingsValueTooltip({ type: 'number', key: 'limit', defaultValue: 10,
    notes: 'clamps to [0, 20]; step: 2', impact: 'increase capacity; reduce capacity' }),
  'Default: 10; Min: 0; Max: 20; Interval: 2; increase capacity; reduce capacity')
  assert.equal(buildNumericTooltip({ defaultValue: 0, min: 0, max: 10, impact: 'bound work' }),
    'Default: 0; Min: 0; Max: 10; bound work')
  assert.equal(buildSettingsValueTooltip({ type: 'boolean', key: 'enabled', defaultValue: false, impact: 'optional' }),
    'Default: false; optional')
  assert(buildDefaultTooltip({ defaultValue: 0, impact: Array(40).fill('word').join(' ') }).split(/\s+/).length <= 15)
})

test('content remains text and unknowns never become fabricated numeric facts', () => {
  assert.equal(buildHoverKeyValueText('<img src=x onerror=alert(1)>', 0), '<img src=x onerror=alert(1)>: 0')
  assert.equal(formatHoverValue(false), 'false')
  assert.equal(formatHoverValue(null), '—')
  assert.equal(formatHoverValue(undefined), '—')
  assert.equal(formatHoverValue(NaN), '—')
  assert.equal(formatHoverValue([1, 2, 3, 4]), '[1,2,3]')
  const circular = {}; circular.self = circular
  assert.throws(() => formatHoverValue(circular), TypeError)
})

test('placement stays within narrow, zoomed and corner viewport boundaries', () => {
  for (const width of [160, 160.5, 320, 320.25, 390, 768, 1280]) {
    const w = Math.min(250.5, width - 16), h = 100
    for (const x of [0, width / 2, width]) {
      const next = constrainTooltipPosition({ pos: { left: x, top: 490 }, tooltipRect: { width: w, height: h },
        anchorRect: { top: 480 }, viewportW: width, viewportH: 500, paddingPx: 8, offsetPx: 4 })
      assert(next.left - w / 2 >= 8)
      assert(next.left + w / 2 <= width - 8)
      assert(next.top >= 8 && next.top + h <= 492)
    }
  }
  const corner = constrainTooltipPosition({ pos: { left: 0, top: 14 }, tooltipRect: { width: 120, height: 100 },
    anchorRect: { top: 0 }, viewportW: 160, viewportH: 120, paddingPx: 8, offsetPx: 4 })
  assert.equal(corner.top, 8)
  assert.throws(() => constrainTooltipPosition({ pos: { left: NaN, top: 0 }, tooltipRect: { width: 1, height: 1 },
    anchorRect: { top: 0 }, viewportW: 100, viewportH: 100, paddingPx: 8, offsetPx: 4 }), TypeError)
})

test('explicit and previous-sibling width precedence is shared and fail-loud', () => {
  const anchor = { previousElementSibling: { getBoundingClientRect: () => ({ width: 120.4 }) } }
  assert.equal(computeTooltipMaxWidthPx(anchor, { defaultMaxWidthPx: 250, maxWidthFromPrevSibling: true }), 120)
  assert.equal(computeTooltipMaxWidthPx(anchor, { defaultMaxWidthPx: 250, maxWidthFromPrevSibling: true, maxWidthPx: 200 }), 200)
  assert.throws(() => computeTooltipMaxWidthPx(anchor, { defaultMaxWidthPx: NaN }), TypeError)
  assert.throws(() => createHoverPanel(null), TypeError)
  assert.throws(() => installHoverLabels(null), TypeError)
})

test('framework bindings import the native owner and cannot acquire a product dependency', () => {
  assert(Object.isFrozen(HOVER_PARTS))
  const adapter = readFileSync(new URL('../packages/react-hover/src/index.tsx', import.meta.url), 'utf8')
  const native = readFileSync(new URL('../site/hover.js', import.meta.url), 'utf8')
  assert.match(adapter, /from '\.\.\/\.\.\/\.\.\/site\/hover\.js'/)
  assert.doesNotMatch(adapter, /getBoundingClientRect|setInterval|createElement|backgroundColor/)
  assert.doesNotMatch(adapter + native, /from ['"].*(?:agentic-graph|grph-shared|agentic-base)/)
  for (const name of ['hover.js', 'hover-text.js', 'hover.css']) {
    const bytes = readFileSync(new URL('../site/' + name, import.meta.url))
    assert(bytes.length < 500_000 && bytes.toString().split('\n').length < 600)
  }
})
