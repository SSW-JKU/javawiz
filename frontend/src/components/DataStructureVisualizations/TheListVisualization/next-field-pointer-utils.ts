import { NextFieldPointer } from './types'
import { calculateColumnXCoordinate, calculateRowYCoordinate } from './node-utils'
import { LAYOUT } from './constants'
import { BaseType, Selection } from 'd3-selection'
import { SVG } from '../constants'
import { TRANSFORMATION } from '@/helpers/constants'

// calculate coordinates of a next field pointer
export function getNextFieldPointerCoordinates (pointer: NextFieldPointer): [number, number] {
  return [
    calculateColumnXCoordinate(pointer.sourceListNodeBox.column) + SVG.cellWidth - LAYOUT.nextPointer.xOffset,
    calculateRowYCoordinate(pointer.sourceListNodeBox.row) + SVG.cellHeight / 2
  ]
}

// calculates x-length of a next field pointer
export function calculateNextFieldPointerXOffset (pointer: NextFieldPointer) {
  return (calculateColumnXCoordinate(pointer.targetListNodeBox.column) - calculateColumnXCoordinate(pointer.sourceListNodeBox.column) - SVG.cellWidth) *
    (pointer.targetListNodeBox.dataStructureGraphNode ? 1 : LAYOUT.nextPointer.nullLengthMultiplier) +
    LAYOUT.nextPointer.xOffset
}

// calculates y-length of a next field pointer
export function calculateNextFieldPointerYOffset (pointer: NextFieldPointer) {
  return calculateRowYCoordinate(pointer.targetListNodeBox.row) - calculateRowYCoordinate(pointer.sourceListNodeBox.row)
}

// sets the attributes for the line of a next field pointer
export function nextLineAttributes (
  line: Selection<any, NextFieldPointer, BaseType, unknown>
) {
  line
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', d => calculateNextFieldPointerXOffset(d))
    .attr('y2', d => calculateNextFieldPointerYOffset(d))
}

// updates the attributes for the line of a next field pointer
export function updateNextLineAttributes (
  line: Selection<any, NextFieldPointer, BaseType, unknown>
) {
  return line
    .transition()
    .duration(TRANSFORMATION.duration)
    .ease(TRANSFORMATION.ease)
    .attr('x2', d => calculateNextFieldPointerXOffset(d))
    .attr('y2', d => calculateNextFieldPointerYOffset(d))
}
