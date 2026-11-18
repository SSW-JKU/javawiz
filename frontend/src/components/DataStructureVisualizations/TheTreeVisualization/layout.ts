import { yCoordinatesByTreeRowAndDepth, treeRowWidths } from './state'
import { LAYOUT } from './constants'
import { SVG } from '../constants'

// calculates a node's x-coordinate from its slot in its depth, its depth and its tree row. Assumes treeRowWidths is set correctly
export function calculateXCoordinate (slotInDepth: number, depth: number, treeRow: number): number {
  const indexOffset = ((slotInDepth + 1) * 2 - 1)
  const treeRowWidth = treeRowWidths[slotInDepth >= 0 ? treeRow : 0]
  const nodeDistance = (treeRowWidth / (2 ** ((slotInDepth >= 0 ? depth : 0) + 1)))
  const offset = -SVG.cellWidth / 2 - treeRowWidth / 2 + LAYOUT.svgWidth / 2
  return indexOffset * nodeDistance + offset
}

// calculates a node's y-coordinate from its depth and its tree row
export function calculateYCoordinate (depth: number, treeRow?: number): number {
  if ((treeRow ?? 0) < yCoordinatesByTreeRowAndDepth.length) {
    return yCoordinatesByTreeRowAndDepth[treeRow ?? 0][depth]
  } else {
    return LAYOUT.nodes.yOrigin
  }
}

// returns width of tree with given depth
export function calcTreeWidth (maxDepth: number) {
  return SVG.cellWidth * 2 ** maxDepth * LAYOUT.treeWidthMultiplier
}
