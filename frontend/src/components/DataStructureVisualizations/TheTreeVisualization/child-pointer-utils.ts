import { BaseType, Selection } from 'd3-selection'
import { ChildPointer, TreeNode } from './types'
import { calculateXCoordinate, calculateYCoordinate } from './layout'
import { LAYOUT } from './constants'
import { HeapObject } from '@/dto/TraceState'
import { SVG } from '../constants'
import { TRANSFORMATION } from '@/helpers/constants'

// adds all coordinates for lines of child-pointers
export function childLineAttributes (line: Selection<any, ChildPointer, BaseType, unknown>) {
  line
    .attr('x1', d => calculateXChildPointerOffset(d))
    .attr('x2', 0)
    .attr('y1', d => calculateYChildPointerOffset(d))
    .attr('y2', 0)
}

// updates changing coordinates for lines of child-pointers
export function updateChildPointerAttributes (line: Selection<BaseType, ChildPointer, BaseType, unknown>) {
  return line
    .transition()
    .duration(TRANSFORMATION.duration)
    .ease(TRANSFORMATION.ease)
    .attr('x1', d => calculateXChildPointerOffset(d))
    .attr('y1', d => calculateYChildPointerOffset(d))
}

// calculates x-offset for lines of child-pointers
function calculateXChildPointerOffset (pointer: ChildPointer) {
  if (pointer.child.node) {
    return calculateXCoordinate(pointer.parent.index, pointer.parent.level, pointer.parent.treeLevel) -
      calculateXCoordinate(pointer.child.index, pointer.child.level, pointer.child.treeLevel) -
      (pointer.direction === 'left'
        ? SVG.cellWidth / 4
        : -SVG.cellWidth / 4)
  } else {
    if (pointer.child.index % 2 === 0) {
      return LAYOUT.childPointers.null.offset
    } else {
      return -LAYOUT.childPointers.null.offset
    }
  }
}

// calculates y-offset for lines of child-pointers
function calculateYChildPointerOffset (pointer: ChildPointer) {
  return pointer.child.node
    ? -(calculateYCoordinate(pointer.child.level, pointer.child.treeLevel) -
      calculateYCoordinate(pointer.parent.level, pointer.parent.treeLevel) -
      pointer.parent.height + LAYOUT.childPointers.yOffset)
    : -LAYOUT.childPointers.null.offset - LAYOUT.childPointers.yOffset
}

// calculate coordinates of a child-pointer, assuming yCoordinatesOfLevels, widthsOfLevels and rectHeight are set correctly
export function getChildPointerCoordinates (pointer: ChildPointer): [number, number] {
  const nullOffset = pointer.direction === 'left'
    ? (SVG.cellWidth / 4 + LAYOUT.childPointers.null.offset)
    : -(SVG.cellWidth / 4 + LAYOUT.childPointers.null.offset)
  return [
    pointer.child.node
      ? calculateXCoordinate(pointer.child.index, pointer.child.level, pointer.child.treeLevel) + SVG.cellWidth / 2
      : (calculateXCoordinate(pointer.parent.index, pointer.parent.level, pointer.parent.treeLevel) + SVG.cellWidth / 2 -
        nullOffset),
    pointer.child.node
      ? calculateYCoordinate(pointer.child.level, pointer.child.treeLevel)
      : calculateYCoordinate(pointer.parent.level, pointer.parent.treeLevel) + pointer.parent.height + LAYOUT.childPointers.null.offset
  ]
}

// return true, iff given successor-pointer of node has changed
export function hasSuccessorPointerChanged (successorName: string, node: TreeNode): boolean {
  return (node.node?.element as HeapObject).fields.find(field => field.name === successorName && field.changed) !== undefined
}
