import { TreeNode, TreeNodePointer } from './types'
import { calculateXCoordinate, calculateYCoordinate } from './layout'
import { LAYOUT } from './constants'
import { SVG } from '../constants'

// calculate coordinates of a pointer, assuming yCoordinatesOfLevels and widthsOfLevels are set correctly
export function getPointerCoordinates (pointer: TreeNodePointer, nodeToPointerDistance?: Map<TreeNode, {count: number, distance: number}>): [number, number] {
  return [
    calculateXCoordinate(pointer.nodeIndex, pointer.nodeLevel, pointer.treeLevel),
    (calculateYCoordinate(pointer.nodeLevel, pointer.treeLevel) +
      pointer.index * ((pointer.node && nodeToPointerDistance && nodeToPointerDistance.has(pointer.node))
        ? nodeToPointerDistance.get(pointer.node)!.distance
        : LAYOUT.pointers.distance) +
      LAYOUT.pointers.yOffset)
  ]
}

// calculates pointer length
export function getPointerLength (pointer: TreeNodePointer) {
  return pointer.isNull ? -LAYOUT.pointers.null.length : -LAYOUT.pointers.length
}

// calculates x-offset of the pointer's text
export function getPointerTextXOffset (pointer: TreeNodePointer) {
  return pointer.isNull
    ? LAYOUT.pointers.textOffset.nullMultiplier * LAYOUT.pointers.null.length
    : LAYOUT.pointers.textOffset.normalMultiplier * LAYOUT.pointers.length
}

// calculates width of text for pointer
export function getPointerTextWidth (pointer: TreeNodePointer) {
  if (pointer.isNull) {
    return LAYOUT.pointers.null.textWidth
  }
  return calculateXCoordinate(pointer.nodeIndex, pointer.nodeLevel, pointer.treeLevel) -
    calculateXCoordinate(Math.max(pointer.nodeIndex - 1, LAYOUT.pointers.null.index), pointer.nodeLevel, pointer.treeLevel) -
    getPointerTextXOffset(pointer) - (pointer.nodeIndex > 0 ? SVG.cellWidth : 0)
}
