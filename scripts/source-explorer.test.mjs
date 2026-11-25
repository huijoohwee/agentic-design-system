import test from 'node:test'
import assert from 'node:assert/strict'
import {buildSourceFileTree, flattenVisibleSourceFileTree, expandSourceFolderAncestors, toggleSourceFolderPath} from '../site/source-explorer.js'
test('keeps stable IDs, input order and folder visibility while selecting a nested source', () => {
  const {root} = buildSourceFileTree([{id:'p',name:'Plan/Inputs/Price',active:true},{id:'r',name:'Plan/Report'}])
  const expandedPaths = expandSourceFolderAncestors({expandedPaths:new Set(),selectedFolderPath:'Plan/Inputs'})
  const visible = paths => flattenVisibleSourceFileTree({root, expandedPaths:paths})
  assert.deepEqual(visible(expandedPaths).map(row=>row.path), ['Plan','Plan/Inputs','Plan/Inputs/Price','Plan/Report'])
  assert.equal(visible(expandedPaths)[2].fileId, 'p')
  assert.deepEqual(visible(toggleSourceFolderPath(expandedPaths,'Plan')).map(row=>row.path), ['Plan'])
})
