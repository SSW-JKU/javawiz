import assert from 'node:assert/strict'
import test from 'node:test'
import { zoomIdentity } from 'd3-zoom'
import { getFitTransform, getHorizontalCenterTransform, getTranslationToChange, ViewZoom, ZOOM } from '../src/helpers/zooming.ts'

// Expected values were computed with the earlier zoom code of the array, list, and tree views
// (offset 1.1, threshold 1.05), so the shared helper keeps their behavior.
const VIEW_WIDTH = 600
const VIEW_HEIGHT = 400
const CELL_NODE = { width: 64.8, height: 36 }
const LIFELINE_NODE = { width: 42, height: 21 }
const zoomedAndPanned = zoomIdentity.translate(-200, -100).scale(2)

function assertTranslation (actual: [number, number], expected: [number, number]) {
  assert.ok(Math.abs(actual[0] - expected[0]) < 1e-9 && Math.abs(actual[1] - expected[1]) < 1e-9,
    `expected [${expected}], got [${actual}]`)
}

test('does not move the view when the changed node is visible', () => {
  assertTranslation(getTranslationToChange(100, 100, zoomIdentity, VIEW_WIDTH, VIEW_HEIGHT, CELL_NODE), [0, 0])
})

test('moves left and up to a node above and left of the view', () => {
  assertTranslation(getTranslationToChange(-300, -200, zoomIdentity, VIEW_WIDTH, VIEW_HEIGHT, CELL_NODE), [-335.64, -239.6])
})

test('moves right and down far enough to show the whole node', () => {
  assertTranslation(getTranslationToChange(900, 700, zoomIdentity, VIEW_WIDTH, VIEW_HEIGHT, CELL_NODE), [400.44, 375.6])
})

test('uses the zoomed and panned view', () => {
  assertTranslation(getTranslationToChange(200, 130, zoomedAndPanned, VIEW_WIDTH, VIEW_HEIGHT, CELL_NODE), [0, 0])
  assertTranslation(getTranslationToChange(200, 100, zoomedAndPanned, VIEW_WIDTH, VIEW_HEIGHT, CELL_NODE), [0, -29.2])
  assertTranslation(getTranslationToChange(500, 400, zoomedAndPanned, VIEW_WIDTH, VIEW_HEIGHT, CELL_NODE), [236.08, 265.2])
})

test('uses the node size of the view, for example sequence diagram lifelines', () => {
  assertTranslation(getTranslationToChange(900, 700, zoomIdentity, VIEW_WIDTH, VIEW_HEIGHT, LIFELINE_NODE), [365.1, 344.1])
})

test('fits content centered at 80 percent of the view', () => {
  const transform = getFitTransform(800, 600, { x: 0, y: 0, width: 400, height: 100 })
  assert.ok(transform)
  assert.equal(transform.k, 1.6)
  assert.equal(transform.x, 80)
  assert.equal(transform.y, 220)
})

test('does not fit empty content', () => {
  assert.equal(getFitTransform(800, 600, { x: 0, y: 0, width: 0, height: 100 }), null)
  assert.equal(getFitTransform(800, 600, { x: 0, y: 0, width: 400, height: 0 }), null)
})

test('centers a content x coordinate horizontally at scale 1', () => {
  const transform = getHorizontalCenterTransform(800, 25000)
  assert.equal(transform.k, 1)
  assert.equal(transform.x, -24600)
  assert.equal(transform.y, 0)
})

// The transform must be usable before the view is mounted, for example by a redraw during setup.
test('a view zoom has the identity transform before it is attached to an SVG', () => {
  const transform = new ViewZoom('#content').transform
  assert.equal(transform.k, 1)
  assert.equal(transform.x, 0)
  assert.equal(transform.y, 0)
})

test('all views share one set of zoom settings', () => {
  assert.equal(ZOOM.step, 1.3)
  assert.deepEqual(ZOOM.scaleExtent, [0.1, 10])
  assert.equal(ZOOM.followOffset, 1.1)
  assert.equal(ZOOM.followThreshold, 1.05)
  assert.deepEqual(new ViewZoom('#content').behavior.scaleExtent(), [0.1, 10])
})
