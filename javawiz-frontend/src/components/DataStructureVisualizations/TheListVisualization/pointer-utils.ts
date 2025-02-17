import { ListNode, ListNodePointer } from './types'
import { calculateNodesXCoordinate, calculateNodesYCoordinate } from './node-utils'
import { LAYOUT } from './constants'
import { HeapObject } from '@/dto/TraceState'

// calculate coordinates of a pointer
export function getPointerCoordinates (pointer: ListNodePointer, nodeToPointerDistance?: Map<ListNode | null, {count: number, distance: number}>): [number, number] {
  return [
    (calculateNodesXCoordinate(pointer.nodeIndex) + pointer.index *
      (nodeToPointerDistance && nodeToPointerDistance.has(pointer.node ?? null)
        ? nodeToPointerDistance.get(pointer.node ?? null)!.distance
        : 0) +
      LAYOUT.pointers.xOffset),
    calculateNodesYCoordinate(pointer.node ? pointer.node.level : 0)
  ]
}

// calculates pointer length
export function getPointerLength (pointer: ListNodePointer) {
  return -(pointer.isNull ? LAYOUT.pointers.null.length : LAYOUT.pointers.length)
}

// calculates y-offset of the pointer's text
export function getPointerTextYOffset (pointer: ListNodePointer) {
  return getPointerLength(pointer) - LAYOUT.pointers.text.yOffset
}

// calculates text-width of pointer
export function getPointerTextWidth (pointer: ListNodePointer, nodeToPointerDistance: Map<ListNode | null, {count: number, distance: number}>) {
  return nodeToPointerDistance.get(pointer.node ?? null)!.distance
}

// return true, iff next-pointer of given node has changed
export function hasNextPointerChanged (nextName: string, node: ListNode): boolean {
  return (node.node?.element as HeapObject).fields.find(field => field.name === nextName && field.changed) !== undefined
}
