/**
 * Geometry for placing PET callouts (speech bubbles and questions) next to the element they
 * annotate. Kept free of DOM, d3 and asset imports so the rules can be unit-tested with Node.
 *
 * All boxes and points use one coordinate system chosen by the caller: page coordinates for
 * callouts on JavaWiz controls, local SVG coordinates for callouts in the Memory View.
 */

export type Point = {
  x: number
  y: number
}

export type Box = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Where a callout sits relative to its target. Sides are centered on the target. */
export type CalloutSide = 'right' | 'left' | 'below' | 'above' | 'above-right' | 'below-right' | 'below-left' | 'above-left'

/** Memory-view objects are laid out in columns, so a callout beside the object reads naturally. */
export const SVG_CALLOUT_SIDES: readonly CalloutSide[] = [
  'right', 'left', 'below', 'above', 'below-right', 'above-right', 'below-left', 'above-left'
]

/** JavaWiz controls sit in rows, so a callout below or above covers fewer neighbouring controls. */
export const HTML_CALLOUT_SIDES: readonly CalloutSide[] = [
  'below', 'above', 'right', 'left', 'below-right', 'below-left', 'above-right', 'above-left'
]

/** Minimum distance between a callout and the edge of the visible area, and between callouts. */
export const CALLOUT_MARGIN = 8
/** Distance between a target and its callout at the first try. */
const CALLOUT_GAP = 16
/** How much farther each further try moves the callout away from its target. */
const RING_STEP = 24
const RING_COUNT = 3
/** Distance between a target and the tip of the callout's pointer. */
const TARGET_POINTER_MARGIN = 2

/**
 * Chooses the top-left corner for a new callout of the given size.
 *
 * The callout is tried on each side of `target`, in the order of `sides`, first close to the
 * target and then twice farther away. Each try is moved inside `bounds` (keeping
 * `CALLOUT_MARGIN` to the edge), because that is where the callout will really be drawn. The
 * first try that keeps `CALLOUT_MARGIN` away from the target and from every box in `obstacles`
 * wins. If no try is free, the one with the smallest overlapping area wins, earlier tries first.
 *
 * Example: target `{ x: 100, y: 200, width: 60, height: 30 }`, a 120×40 callout, plenty of space
 * and `SVG_CALLOUT_SIDES` give `{ x: 176, y: 195 }`: 16 px right of the target, vertically centered.
 */
export function placeCallout (
  target: Box,
  width: number,
  height: number,
  bounds: Box,
  obstacles: readonly Box[],
  sides: readonly CalloutSide[]
): Point {
  const blocked = [target, ...obstacles].map(box => grow(box, CALLOUT_MARGIN))
  let best: Point | undefined
  let bestCost = Infinity

  for (let ring = 0; ring < RING_COUNT; ring++) {
    const distance = CALLOUT_GAP + ring * RING_STEP
    for (const side of sides) {
      const position = clampIntoBounds(candidatePosition(side, target, width, height, distance), width, height, bounds)
      const box = { ...position, width, height }
      const cost = blocked.reduce((sum, other) => sum + overlapArea(box, other), 0)
      if (cost === 0) return position
      if (cost < bestCost) {
        best = position
        bestCost = cost
      }
    }
  }
  return best ?? clampIntoBounds({ x: target.x, y: target.y }, width, height, bounds)
}

/**
 * SVG path data for the pointer from a target to its callout.
 *
 * The tip sits on the target edge facing the callout, `TARGET_POINTER_MARGIN` outside the target.
 * The pointer meets the callout edge facing the target: the left or right edge when the callout
 * lies completely beside the target, otherwise the top or bottom edge. An expanded callout gets a
 * triangle whose base lies on that edge; a collapsed callout gets a plain line.
 */
export function pointerPath (targetBox: Box, calloutBox: Box, collapsed: boolean): string {
  const targetCenter = center(targetBox)
  const calloutCenter = center(calloutBox)
  const tip = clampIntoBox(calloutCenter, grow(targetBox, TARGET_POINTER_MARGIN))
  const margin = Math.min(CALLOUT_MARGIN, calloutBox.width / 3, calloutBox.height / 3)
  const calloutRight = calloutBox.x + calloutBox.width
  const calloutBottom = calloutBox.y + calloutBox.height
  const beside = calloutBox.x >= targetBox.x + targetBox.width || calloutRight <= targetBox.x

  let first: Point
  let second: Point
  if (beside) {
    const x = calloutBox.x >= targetBox.x + targetBox.width ? calloutBox.x : calloutRight
    const y = clamp(targetCenter.y, calloutBox.y + margin, calloutBottom - margin)
    first = { x, y: y - margin }
    second = { x, y: y + margin }
  } else {
    const y = calloutCenter.y >= targetCenter.y ? calloutBox.y : calloutBottom
    const x = clamp(targetCenter.x, calloutBox.x + margin, calloutRight - margin)
    first = { x: x - margin, y }
    second = { x: x + margin, y }
  }

  if (collapsed) {
    return `M${tip.x},${tip.y} L${(first.x + second.x) / 2},${(first.y + second.y) / 2}`
  }
  return `M${tip.x},${tip.y} L${first.x},${first.y} L${second.x},${second.y} Z`
}

function candidatePosition (side: CalloutSide, target: Box, width: number, height: number, distance: number): Point {
  const right = target.x + target.width + distance
  const left = target.x - distance - width
  const below = target.y + target.height + distance
  const above = target.y - distance - height
  const centeredX = target.x + (target.width - width) / 2
  const centeredY = target.y + (target.height - height) / 2

  switch (side) {
    case 'right': return { x: right, y: centeredY }
    case 'left': return { x: left, y: centeredY }
    case 'below': return { x: centeredX, y: below }
    case 'above': return { x: centeredX, y: above }
    case 'above-right': return { x: right, y: above }
    case 'below-right': return { x: right, y: below }
    case 'below-left': return { x: left, y: below }
    case 'above-left': return { x: left, y: above }
  }
}

/** Moves a callout's top-left corner so the callout stays `CALLOUT_MARGIN` inside `bounds` where possible. */
function clampIntoBounds (position: Point, width: number, height: number, bounds: Box): Point {
  const minX = bounds.x + CALLOUT_MARGIN
  const minY = bounds.y + CALLOUT_MARGIN
  return {
    x: clamp(position.x, minX, Math.max(minX, bounds.x + bounds.width - width - CALLOUT_MARGIN)),
    y: clamp(position.y, minY, Math.max(minY, bounds.y + bounds.height - height - CALLOUT_MARGIN))
  }
}

function clampIntoBox (point: Point, box: Box): Point {
  return {
    x: clamp(point.x, box.x, box.x + box.width),
    y: clamp(point.y, box.y, box.y + box.height)
  }
}

function clamp (value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function center (box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

function grow (box: Box, amount: number): Box {
  return { x: box.x - amount, y: box.y - amount, width: box.width + amount * 2, height: box.height + amount * 2 }
}

function overlapArea (a: Box, b: Box): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return width > 0 && height > 0 ? width * height : 0
}
