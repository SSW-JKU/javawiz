import { TreeNodeBox, VariableToTreeNodePointer } from './types'
import { calculateXCoordinate, calculateYCoordinate } from './layout'
import { LAYOUT } from './constants'
import { SVG } from '../constants'

// calculate coordinates of a pointer, assuming yCoordinatesOfLevels and widthsOfLevels are set correctly
export function getPointerCoordinates (
  pointer: VariableToTreeNodePointer,
  pointerSpacingByTargetTreeNodeBox?: Map<TreeNodeBox, {count: number, distance: number}>
): [number, number] {
  return [
    calculateXCoordinate(pointer.targetSlot, pointer.targetDepth, pointer.targetTreeRow),
    (calculateYCoordinate(pointer.targetDepth, pointer.targetTreeRow) +
      pointer.positionAtTarget * ((pointer.targetTreeNodeBox && pointerSpacingByTargetTreeNodeBox && pointerSpacingByTargetTreeNodeBox.has(pointer.targetTreeNodeBox))
        ? pointerSpacingByTargetTreeNodeBox.get(pointer.targetTreeNodeBox)!.distance
        : LAYOUT.pointers.distance) +
      LAYOUT.pointers.yOffset)
  ]
}

// calculates pointer length
export function getPointerLength (pointer: VariableToTreeNodePointer) {
  return pointer.isNull ? -LAYOUT.pointers.null.length : -LAYOUT.pointers.length
}

// calculates x-offset of the pointer's text
export function getPointerTextXOffset (pointer: VariableToTreeNodePointer) {
  return pointer.isNull
    ? LAYOUT.pointers.textOffset.nullMultiplier * LAYOUT.pointers.null.length
    : LAYOUT.pointers.textOffset.normalMultiplier * LAYOUT.pointers.length
}

// calculates width of text for pointer
export function getPointerTextWidth (pointer: VariableToTreeNodePointer) {
  if (pointer.isNull) {
    return LAYOUT.pointers.null.textWidth
  }
  return calculateXCoordinate(pointer.targetSlot, pointer.targetDepth, pointer.targetTreeRow) -
    calculateXCoordinate(Math.max(pointer.targetSlot - 1, LAYOUT.pointers.null.index), pointer.targetDepth, pointer.targetTreeRow) -
    getPointerTextXOffset(pointer) - (pointer.targetSlot > 0 ? SVG.cellWidth : 0)
}
