import { BaseType, Selection } from 'd3-selection'
import { ChildFieldPointer, TreeNodeBox } from './types'
import { calculateXCoordinate, calculateYCoordinate } from './layout'
import { LAYOUT } from './constants'
import { HeapObject } from '@/dto/TraceState'
import { SVG } from '../constants'
import { TRANSFORMATION } from '@/helpers/constants'

// adds all coordinates for lines of child field pointers
export function childLineAttributes (line: Selection<any, ChildFieldPointer, BaseType, unknown>) {
  line
    .attr('x1', d => calculateXChildFieldPointerOffset(d))
    .attr('x2', 0)
    .attr('y1', d => calculateYChildFieldPointerOffset(d))
    .attr('y2', 0)
}

// updates changing coordinates for lines of child field pointers
export function updateChildFieldPointerAttributes (line: Selection<BaseType, ChildFieldPointer, BaseType, unknown>) {
  return line
    .transition()
    .duration(TRANSFORMATION.duration)
    .ease(TRANSFORMATION.ease)
    .attr('x1', d => calculateXChildFieldPointerOffset(d))
    .attr('y1', d => calculateYChildFieldPointerOffset(d))
}

// calculates x-offset for lines of child field pointers
function calculateXChildFieldPointerOffset (pointer: ChildFieldPointer) {
  if (pointer.targetTreeNodeBox.dataStructureGraphNode) {
    return calculateXCoordinate(pointer.sourceTreeNodeBox.slotInDepth, pointer.sourceTreeNodeBox.depth, pointer.sourceTreeNodeBox.treeRow) -
      calculateXCoordinate(pointer.targetTreeNodeBox.slotInDepth, pointer.targetTreeNodeBox.depth, pointer.targetTreeNodeBox.treeRow) -
      (pointer.side === 'left'
        ? SVG.cellWidth / 4
        : -SVG.cellWidth / 4)
  } else {
    if (pointer.targetTreeNodeBox.slotInDepth % 2 === 0) {
      return LAYOUT.childPointers.null.offset
    } else {
      return -LAYOUT.childPointers.null.offset
    }
  }
}

// calculates y-offset for lines of child field pointers
function calculateYChildFieldPointerOffset (pointer: ChildFieldPointer) {
  return pointer.targetTreeNodeBox.dataStructureGraphNode
    ? -(calculateYCoordinate(pointer.targetTreeNodeBox.depth, pointer.targetTreeNodeBox.treeRow) -
      calculateYCoordinate(pointer.sourceTreeNodeBox.depth, pointer.sourceTreeNodeBox.treeRow) -
      pointer.sourceTreeNodeBox.height + LAYOUT.childPointers.yOffset)
    : -LAYOUT.childPointers.null.offset - LAYOUT.childPointers.yOffset
}

// calculate coordinates of a child field pointer, assuming yCoordinatesOfLevels, widthsOfLevels and rectHeight are set correctly
export function getChildFieldPointerCoordinates (pointer: ChildFieldPointer): [number, number] {
  const nullOffset = pointer.side === 'left'
    ? (SVG.cellWidth / 4 + LAYOUT.childPointers.null.offset)
    : -(SVG.cellWidth / 4 + LAYOUT.childPointers.null.offset)
  return [
    pointer.targetTreeNodeBox.dataStructureGraphNode
      ? calculateXCoordinate(pointer.targetTreeNodeBox.slotInDepth, pointer.targetTreeNodeBox.depth, pointer.targetTreeNodeBox.treeRow) + SVG.cellWidth / 2
      : (calculateXCoordinate(pointer.sourceTreeNodeBox.slotInDepth, pointer.sourceTreeNodeBox.depth, pointer.sourceTreeNodeBox.treeRow) + SVG.cellWidth / 2 -
        nullOffset),
    pointer.targetTreeNodeBox.dataStructureGraphNode
      ? calculateYCoordinate(pointer.targetTreeNodeBox.depth, pointer.targetTreeNodeBox.treeRow)
      : calculateYCoordinate(pointer.sourceTreeNodeBox.depth, pointer.sourceTreeNodeBox.treeRow) + pointer.sourceTreeNodeBox.height + LAYOUT.childPointers.null.offset
  ]
}

// return true, iff given successor-pointer of node has changed
export function hasSuccessorPointerChanged (successorName: string, treeNodeBox: TreeNodeBox): boolean {
  return (treeNodeBox.dataStructureGraphNode?.traceElement as HeapObject).fields.find(field => field.name === successorName && field.changed) !== undefined
}
