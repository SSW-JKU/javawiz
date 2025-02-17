import { BaseType, Selection } from 'd3-selection'
import { HTML, LAYOUT } from './constants'
import { SelectionOrTransition, Transition } from 'd3'
import { ArrayIndex, ArrayNode, CopyAnimations, TempVariable } from './types'
import { getCoordinatesAndWidth } from './utils'
import { ArrayAccessValue } from '@/dto/TraceState'
import { getArrayLength } from './array-utils'
import { SVG } from '../constants'

// updates the duration of the animation of array accesses
export function updateDuration (coordinatesFrom: [number, number], coordinatesTo: [number, number], copyAnimations: CopyAnimations) {
  const dX = coordinatesFrom[0] - coordinatesTo[0]
  const dY = coordinatesFrom[1] - coordinatesTo[1]
  const distance = dX * dX + dY * dY
  const duration = 1500 + distance * 0.01
  if (copyAnimations.duration < duration) {
    copyAnimations.duration = duration
  }
}

// adds a 'flying' rectangle and highlights the source's and the target's cell
export function visualizeValueCopy (
  copyAnimations: CopyAnimations,
  staticViz: Selection<BaseType, unknown, HTMLElement, any>,
  animationInfo: {
    source: ArrayNode | TempVariable,
    target: ArrayNode | TempVariable | { kind: 'MissingSource', coordinates: [number, number], width: number },
    arrayCopy: boolean
  },
  indexes: {
    from?: number,
    to?: number
  }
) {
  const { coordinates: coordinatesFrom, width: widthFrom } = getCoordinatesAndWidth(animationInfo.source, animationInfo.arrayCopy, indexes.from)
  const { coordinates: coordinatesTo, width: widthTo } = animationInfo.target.kind === 'MissingSource'
    ? animationInfo.target
    : getCoordinatesAndWidth(animationInfo.target, animationInfo.arrayCopy, indexes.to)

  if (animationInfo.target.kind !== 'MissingSource') {
    // highlight source
    appendHighlightedCell(staticViz, coordinatesFrom, widthFrom, 'source')
  }
  // highlight target
  appendHighlightedCell(staticViz, coordinatesTo, widthTo, 'target')

  updateDuration(coordinatesFrom, coordinatesTo, copyAnimations)
  copyAnimations.data.push({
    coordinatesFrom,
    coordinatesTo,
    widthFrom,
    widthTo
  })
}

// adds a highlighted cell
function appendHighlightedCell (
  viz: Selection<BaseType, unknown, HTMLElement, any>,
  coordinates: [number, number],
  cellWidth: number,
  color: 'source' | 'target'
) {
  viz.append('rect')
    .classed(color === 'source' ? HTML.classes.highlightedCells.sources : HTML.classes.highlightedCells.targets, true)
    .attr('x', coordinates[0])
    .attr('y', coordinates[1])
    .attr('width', cellWidth)
    .attr('height', SVG.cellHeight)
}

// returns a animation to animate along a path
export function animateAlongPath (path: Selection<SVGPathElement, unknown, HTMLElement, any>) {
  const length = path.node()!!.getTotalLength()
  return () => {
    return (x: number) => {
      const p = path.node()!!.getPointAtLength(length * x)
      return `translate(${[p.x, p.y]})`
    }
  }
}

// sets the attributes for highlighting rectangles
export function highlightRectAttributes (rect: SelectionOrTransition<any, ArrayIndex, BaseType, unknown>) {
  (rect.attr('x', (d: ArrayIndex) => d.array.kind === 'TwoDimArrayNode'
    ? -LAYOUT.indexes.row.xOffset - d.array.dimensions[1] * d.array.cellWidth
    : 0) as Transition<any, ArrayIndex, BaseType, unknown>)
    .attr('y', (d: ArrayIndex) => d.array.kind === 'TwoDimArrayNode' ? 0 : LAYOUT.indexes.col.yOffset)
    .attr('width', (d: ArrayIndex) => d.array.kind === 'TwoDimArrayNode' ? d.array.dimensions[1] * d.array.cellWidth : d.array.cellWidth)
    .attr('height', (d: ArrayIndex) => d.array.kind === 'TwoDimArrayChild'
      ? d.array.parentDimensions[0] * SVG.cellHeight
      : SVG.cellHeight
    )
    .style('fill', (d: ArrayIndex) => d.array.kind === 'TwoDimArrayNode' ? LAYOUT.indexes.highlightColor.horizontal : LAYOUT.indexes.highlightColor.vertical)
    .style('opacity', d => d.value < 0 || d.value >= getArrayLength(d.array) ? '0' : '1')
}

// returns the array to be used for value copy animations
export function getAnimationArray (arrayAccessValue: ArrayAccessValue, array: ArrayNode) {
  if (array.kind === 'TwoDimArrayNode') {
    return array.children[arrayAccessValue.indexValues[arrayAccessValue.indexValues.length - 1]]
  } else {
    return array
  }
}
