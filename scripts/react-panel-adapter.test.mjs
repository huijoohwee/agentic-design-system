import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFile(resolve(root, path), 'utf8')
const readJson = async path => JSON.parse(await read(path))

test('exports one optional-peer React panel adapter from the Design System package', async () => {
  const pkg = await readJson('package.json')
  const lock = await readJson('package-lock.json')
  assert.deepEqual(pkg.exports?.['./react/panels'], {
    types: './packages/react-panels/src/index.ts',
    import: './packages/react-panels/src/index.ts',
  })
  assert.deepEqual(pkg.peerDependenciesMeta?.react, { optional: true })
  assert.equal(pkg.peerDependencies?.react, '>=18')
  assert.deepEqual(lock.packages?.['']?.peerDependencies, pkg.peerDependencies)
  assert.deepEqual(lock.packages?.['']?.peerDependenciesMeta, pkg.peerDependenciesMeta)
})

test('React bridges reuse Design System runtime and canonical contracts', async () => {
  const [index, shell, tabs, button, group, close, runtimeTypes, contract, runtime] = await Promise.all([
    read('packages/react-panels/src/index.ts'),
    read('packages/react-panels/src/FloatingPanelShell.tsx'),
    read('packages/react-panels/src/FloatingPanelTabs.tsx'),
    read('packages/react-panels/src/PanelControlButton.tsx'),
    read('packages/react-panels/src/PanelControlGroup.tsx'),
    read('packages/react-panels/src/FloatingPanelCloseButton.tsx'),
    read('packages/react-panels/src/design-system-runtime.d.ts'),
    read('site/floating-panel-contract.d.ts'),
    read('site/toolbar-icons.js'),
  ])
  const controls = await readJson('site/icons.json')
  const roleUnion = contract.match(/^export type PanelControlName\s*=\s*([^\n]+)/mu)?.[1]
  const declaredRoles = roleUnion?.match(/'([a-z]+)'/gu)?.map(role => role.slice(1, -1))
  assert.deepEqual(declaredRoles, Object.keys(controls.panelControls))
  assert.match(index, /FloatingPanelShell/)
  assert.match(index, /FloatingPanelTabs/)
  assert.match(index, /PanelControlButton/)
  assert.match(index, /PanelControlGroup/)
  assert.match(index, /reference path="\.\/design-system-runtime\.d\.ts"/)
  assert.match(runtimeTypes, /\*site\/toolbar-icons\.js/)
  assert.match(shell, /\.\.\/\.\.\/\.\.\/site\/floating-panel\.css/)
  assert.match(shell, /\.\.\/\.\.\/\.\.\/site\/vendor\/shared-ui-profile\.css/)
  assert.match(shell, /\.\.\/\.\.\/\.\.\/site\/toolbar\.css/)
  assert.match(shell, /theme = 'inherit'/)
  assert.match(shell, /colorScheme: theme === 'system' \? 'light dark' : theme/)
  assert.match(shell, /\{minimized \? null : <div className="agentic-panel-body">\{children\}<\/div>\}/)
  assert.doesNotMatch(shell, /'width'|'height'|'minWidth'|'maxWidth'/)
  assert.match(tabs, /role="tablist"/)
  assert.match(button, /updatePanelControlButton\(/)
  assert.match(group, /updatePanelControlGroup\(/)
  assert.match(close, /control="close"/)
  assert.match(runtime, /export function updatePanelControlButton/)
  assert.match(runtime, /export function updatePanelControlGroup/)
  assert.match(runtime, /export function resolvePanelControlRoles/)
  for (const source of [index, shell, tabs, button, group, close]) {
    assert.doesNotMatch(source, /@agentic-base|PANEL_CONTROL_(?:ICONS|LABELS|ORDER)/)
  }
})
