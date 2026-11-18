import { ListNodeBox, VariableToListNodePointer } from './types'
import { calculateColumnXCoordinate, calculateRowYCoordinate } from './node-utils'
import { LAYOUT } from './constants'
import { HeapObject } from '@/dto/TraceState'

// calculate coordinates of a pointer
export function getPointerCoordinates (
  pointer: VariableToListNodePointer,
  pointerSpacingByTargetListNodeBox?: Map<ListNodeBox | null, {count: number, distance: number}>
): [number, number] {
  return [
    (calculateColumnXCoordinate(pointer.targetColumn) + pointer.positionAtTarget *
      (pointerSpacingByTargetListNodeBox && pointerSpacingByTargetListNodeBox.has(pointer.targetListNodeBox ?? null)
        ? pointerSpacingByTargetListNodeBox.get(pointer.targetListNodeBox ?? null)!.distance
        : 0) +
      LAYOUT.pointers.xOffset),
    calculateRowYCoordinate(pointer.targetListNodeBox ? pointer.targetListNodeBox.row : 0)
  ]
}

// calculates pointer length
export function getPointerLength (pointer: VariableToListNodePointer) {
  return -(pointer.isNull ? LAYOUT.pointers.null.length : LAYOUT.pointers.length)
}

// calculates y-offset of the pointer's text
export function getPointerTextYOffset (pointer: VariableToListNodePointer) {
  return getPointerLength(pointer) - LAYOUT.pointers.text.yOffset
}

// calculates text-width of pointer
export function getPointerTextWidth (pointer: VariableToListNodePointer, pointerSpacingByTargetListNodeBox: Map<ListNodeBox | null, {count: number, distance: number}>) {
  return pointerSpacingByTargetListNodeBox.get(pointer.targetListNodeBox ?? null)!.distance
}

// return true, iff the next field of the given list node box has changed
export function hasNextFieldPointerChanged (nextName: string, listNodeBox: ListNodeBox): boolean {
  return (listNodeBox.dataStructureGraphNode?.traceElement as HeapObject).fields.find(field => field.name === nextName && field.changed) !== undefined
}
