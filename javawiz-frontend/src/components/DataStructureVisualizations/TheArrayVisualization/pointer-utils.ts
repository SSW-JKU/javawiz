import { BaseType, Selection } from 'd3-selection'
import { ArrayPointer } from './types'
import { DEFINITIONS } from '@/helpers/SvgDefinitions.vue'
import { Transition } from 'd3'
import { HTML, LAYOUT } from './constants'
import { getLevelYCoordinate } from './utils'
import { SVG } from '../constants'
import { TRANSFORMATION } from '@/helpers/constants'

// calculates pointer's coordinates
export function getPointerCoordinates (pointer: ArrayPointer): [number, number] {
  return [
    LAYOUT.pointers.xOrigin,
    getLevelYCoordinate(pointer.level)
  ]
}

// calculates pointer's target X offset
export function calculatePointerXOffset (pointer: ArrayPointer) {
  return (LAYOUT.xOrigin - LAYOUT.pointers.xOrigin) * (pointer.isNull ? LAYOUT.pointers.null.lengthMultiplier : 1)
}

// calculates pointer's target Y offset
export function calculatePointerYOffset (pointer: ArrayPointer) {
  if (pointer.isNull) {
    return SVG.cellHeight / 2
  } else {
    let offset = getLevelYCoordinate(pointer.array!.level) - getLevelYCoordinate(pointer.level) + SVG.cellHeight / 2
    if (pointer.array?.kind === 'TwoDimArrayChild') {
      offset += pointer.array.indexInParent * SVG.cellHeight
    }
    return offset
  }
}

// applies attributes to pointer lines
export function pointerLineAttributes (line: Selection<SVGLineElement, ArrayPointer, BaseType, unknown>) {
  line.classed(HTML.classes.pointers.lines, true)
    .attr('x1', 0)
    .attr('x2', d => calculatePointerXOffset(d))
    .attr('y1', SVG.cellHeight / 2)
    .attr('y2', d => calculatePointerYOffset(d))
    .attr('marker-start', d => d.changed ? DEFINITIONS.urls.redDot : DEFINITIONS.urls.dot)
}

// updates attributes of pointer lines
export function updatePointerLineAttributes (line: Selection<BaseType, ArrayPointer, BaseType, unknown>) {
  return line
    .attr('marker-start', d => d.changed ? DEFINITIONS.urls.redDot : DEFINITIONS.urls.dot)
    .transition()
    .duration(TRANSFORMATION.duration)
    .ease(TRANSFORMATION.ease)
    .attr('x2', d => calculatePointerXOffset(d))
    .attr('y2', d => calculatePointerYOffset(d))
}

// sets attributes for null pointers
export function nullPointerLineAttributes (line: Selection<any, ArrayPointer, BaseType, unknown>, update: boolean) {
  let l: Selection<any, ArrayPointer, BaseType, unknown> | Transition<any, ArrayPointer, BaseType, unknown> = line
  if (update) {
    l = l.transition()
      .duration(TRANSFORMATION.duration)
      .ease(TRANSFORMATION.ease)
  }
  l.attr('opacity', d => d.isNull ? '1' : '0')
    .attr('x1', d => calculatePointerXOffset(d))
    .attr('x2', d => calculatePointerXOffset(d))
    .attr('y1', d => calculatePointerYOffset(d) - LAYOUT.pointers.null.lineLength / 2)
    .attr('y2', d => calculatePointerYOffset(d) + LAYOUT.pointers.null.lineLength / 2)
}
