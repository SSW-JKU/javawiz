import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HTML_CALLOUT_SIDES,
  placeCallout,
  pointerPath,
  SVG_CALLOUT_SIDES,
  type Box
} from '../src/components/petCalloutPlacement.ts'

// JW-628: PET callouts sit centered beside their target and avoid their target and each other.
const BOUNDS: Box = { x: 0, y: 0, width: 800, height: 600 }
const WIDTH = 120
const HEIGHT = 40
const TARGET: Box = { x: 100, y: 200, width: 60, height: 30 }

function calloutBox (position: { x: number, y: number }): Box {
  return { ...position, width: WIDTH, height: HEIGHT }
}

function overlaps (a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function pathPoints (path: string): { x: number, y: number }[] {
  return [...path.matchAll(/[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)]
    .map(match => ({ x: Number(match[1]), y: Number(match[2]) }))
}

test('places a memory-view callout right of its target, vertically centered', () => {
  assert.deepEqual(placeCallout(TARGET, WIDTH, HEIGHT, BOUNDS, [], SVG_CALLOUT_SIDES), { x: 176, y: 195 })
})

test('places a callout on a JavaWiz control below it, horizontally centered', () => {
  assert.deepEqual(placeCallout(TARGET, WIDTH, HEIGHT, BOUNDS, [], HTML_CALLOUT_SIDES), { x: 70, y: 246 })
})

test('uses the left side for a memory-view target at the right edge', () => {
  const target = { x: 720, y: 200, width: 60, height: 30 }
  const box = calloutBox(placeCallout(target, WIDTH, HEIGHT, BOUNDS, [], SVG_CALLOUT_SIDES))
  assert.ok(box.x + box.width <= target.x, `callout at x=${box.x} is not left of the target`)
  assert.equal(overlaps(box, target), false)
})

test('uses the space above a JavaWiz control at the bottom edge', () => {
  const target = { x: 300, y: 560, width: 60, height: 30 }
  const box = calloutBox(placeCallout(target, WIDTH, HEIGHT, BOUNDS, [], HTML_CALLOUT_SIDES))
  assert.ok(box.y + box.height <= target.y, `callout at y=${box.y} is not above the target`)
})

test('places a second callout on the same target away from the first', () => {
  const first = calloutBox(placeCallout(TARGET, WIDTH, HEIGHT, BOUNDS, [], SVG_CALLOUT_SIDES))
  const second = calloutBox(placeCallout(TARGET, WIDTH, HEIGHT, BOUNDS, [first], SVG_CALLOUT_SIDES))
  assert.equal(overlaps(first, second), false)
  assert.equal(overlaps(second, TARGET), false)
})

test('spreads three callouts on one target without any overlap', () => {
  for (const sides of [SVG_CALLOUT_SIDES, HTML_CALLOUT_SIDES]) {
    const placed: Box[] = []
    for (let i = 0; i < 3; i++) {
      placed.push(calloutBox(placeCallout(TARGET, WIDTH, HEIGHT, BOUNDS, placed, sides)))
    }
    for (const [index, box] of placed.entries()) {
      assert.equal(overlaps(box, TARGET), false, `callout ${index} covers its target`)
      assert.ok(box.x >= BOUNDS.x && box.y >= BOUNDS.y &&
        box.x + box.width <= BOUNDS.width && box.y + box.height <= BOUNDS.height, `callout ${index} leaves the bounds`)
      for (const other of placed.slice(index + 1)) {
        assert.equal(overlaps(box, other), false, `callout ${index} overlaps a later callout`)
      }
    }
  }
})

test('avoids another annotated target', () => {
  const otherTarget = { x: 180, y: 195, width: 60, height: 40 }
  const box = calloutBox(placeCallout(TARGET, WIDTH, HEIGHT, BOUNDS, [otherTarget], SVG_CALLOUT_SIDES))
  assert.equal(overlaps(box, otherTarget), false)
  assert.equal(overlaps(box, TARGET), false)
})

test('stays inside a visible area that has no free spot', () => {
  const bounds = { x: 0, y: 0, width: 150, height: 60 }
  const target = { x: 10, y: 10, width: 130, height: 40 }
  const { x, y } = placeCallout(target, WIDTH, HEIGHT, bounds, [], SVG_CALLOUT_SIDES)
  // The margin to the visible edge is 8 px, as for the existing clamp.
  assert.ok(x >= 8 && x <= 150 - WIDTH - 8, `x=${x} is outside the visible area`)
  assert.ok(y >= 8 && y <= 60 - HEIGHT - 8, `y=${y} is outside the visible area`)
})

test('points from the right target edge to the left callout edge', () => {
  const points = pathPoints(pointerPath(TARGET, calloutBox({ x: 176, y: 195 }), false))
  assert.equal(points.length, 3)
  assert.equal(points[0].x, TARGET.x + TARGET.width + 2)
  assert.equal(points[1].x, 176)
  assert.equal(points[2].x, 176)
})

test('points from the bottom target edge to the top callout edge', () => {
  const points = pathPoints(pointerPath(TARGET, calloutBox({ x: 70, y: 246 }), false))
  assert.equal(points.length, 3)
  assert.equal(points[0].y, TARGET.y + TARGET.height + 2)
  assert.equal(points[1].y, 246)
  assert.equal(points[2].y, 246)
})

test('draws a collapsed pointer as a line', () => {
  const path = pointerPath(TARGET, { x: 176, y: 195, width: 36, height: 36 }, true)
  assert.equal(pathPoints(path).length, 2)
  assert.equal(path.includes('Z'), false)
})
