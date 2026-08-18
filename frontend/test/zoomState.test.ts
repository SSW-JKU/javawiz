import assert from 'node:assert/strict'
import test from 'node:test'
import { transform as listTransform } from '../src/components/DataStructureVisualizations/TheListVisualization/state.ts'
import { transform as treeTransform } from '../src/components/DataStructureVisualizations/TheTreeVisualization/state.ts'
import { resolveZoomTransform } from '../src/components/DataStructureVisualizations/zoom-transform.ts'

/** Verifies the operations used by zoomToChange are safe before component mount. */
function assertIdentityTransform (transform: typeof listTransform) {
  assert.deepEqual(transform.invert([0, 0]), [0, 0])
  assert.deepEqual(transform.invert([600, 400]), [600, 400])
  assert.equal(transform.k, 1)
}

test('list zoom state starts with a usable identity transform', () => {
  assertIdentityTransform(listTransform)
})

test('tree zoom state starts with a usable identity transform', () => {
  assertIdentityTransform(treeTransform)
})

test('null zoom state falls back to a usable identity transform', () => {
  assertIdentityTransform(resolveZoomTransform(null))
})
