import { NextPointer } from './types'
import { calculateNodesXCoordinate, calculateNodesYCoordinate } from './node-utils'
import { LAYOUT } from './constants'
import { BaseType, Selection } from 'd3-selection'
import { SVG } from '../constants'
import { TRANSFORMATION } from '@/helpers/constants'

// calculate coordinates of a next-pointer
export function getNextPointerCoordinates (pointer: NextPointer): [number, number] {
  return [
    calculateNodesXCoordinate(pointer.from.index) + SVG.cellWidth - LAYOUT.nextPointer.xOffset,
    calculateNodesYCoordinate(pointer.from.level) + SVG.cellHeight / 2
  ]
}

// calculates x-length of next-pointer
export function calculateNextPointerXOffset (pointer: NextPointer) {
  return (calculateNodesXCoordinate(pointer.to.index) - calculateNodesXCoordinate(pointer.from.index) - SVG.cellWidth) *
    (pointer.to.node ? 1 : LAYOUT.nextPointer.nullLengthMultiplier) +
    LAYOUT.nextPointer.xOffset
}

// calculates y-length of next-pointer
export function calculateNextPointerYOffset (pointer: NextPointer) {
  return calculateNodesYCoordinate(pointer.to.level) - calculateNodesYCoordinate(pointer.from.level)
}

// sets the attributes for the line of a next-pointer
export function nextLineAttributes (
  line: Selection<any, NextPointer, BaseType, unknown>
) {
  line
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', d => calculateNextPointerXOffset(d))
    .attr('y2', d => calculateNextPointerYOffset(d))
}

// updates the attributes for the line of a next-pointer
export function updateNextLineAttributes (
  line: Selection<any, NextPointer, BaseType, unknown>
) {
  return line
    .transition()
    .duration(TRANSFORMATION.duration)
    .ease(TRANSFORMATION.ease)
    .attr('x2', d => calculateNextPointerXOffset(d))
    .attr('y2', d => calculateNextPointerYOffset(d))
}
