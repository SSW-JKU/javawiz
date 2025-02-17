import { levelCoordinates, levelWidths } from './TheTreeVisualization.vue'
import { LAYOUT } from './constants'
import { SVG } from '../constants'

// calculates node's x-coordinate based on index, level and tree level. Assumes widthsOfLevels is set correctly
export function calculateXCoordinate (index: number, level: number, treeLevel: number): number {
  const indexOffset = ((index + 1) * 2 - 1)
  const levelWidth = levelWidths[index >= 0 ? treeLevel : 0]
  const nodeDistance = (levelWidth / (2 ** ((index >= 0 ? level : 0) + 1)))
  const offset = -SVG.cellWidth / 2 - levelWidth / 2 + LAYOUT.svgWidth / 2
  return indexOffset * nodeDistance + offset
}

// calculates node's y-coordinate based on level and rectHeight
export function calculateYCoordinate (level: number, treeLevel?: number): number {
  if ((treeLevel ?? 0) < levelCoordinates.length) {
    return levelCoordinates[treeLevel ?? 0][level]
  } else {
    return LAYOUT.nodes.yOrigin
  }
}

// returns width of tree with given depth
export function calcTreeWidth (maxLevel: number) {
  return SVG.cellWidth * 2 ** maxLevel * LAYOUT.treeWidthMultiplier
}
