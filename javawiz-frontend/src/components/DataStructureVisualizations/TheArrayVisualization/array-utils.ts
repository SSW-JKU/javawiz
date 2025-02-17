import { ArrayNode } from './types'
import { addCellWidthAndStringChanged, getLevelYCoordinate } from './utils'
import { HTML, LAYOUT } from './constants'
import { BaseType, Selection } from 'd3-selection'
import { HeapArray, HeapArrayElementVar } from '@/dto/TraceState'
import { SVG } from '../constants'
import { blendOutAnimation } from '../animations'
import { getNodeString } from '../heap-tree-node-utils'
import { TRANSFORMATION } from '@/helpers/constants'

// calculates array's coordinates
export function getArrayCoordinates (array: ArrayNode, ignoreTwoDim: boolean = false): [number, number] {
  return [
    LAYOUT.xOrigin,
    getLevelYCoordinate(array.level) + (!ignoreTwoDim && array.kind === 'TwoDimArrayChild' ? array.indexInParent * SVG.cellHeight : 0)
  ]
}

// joins dividers lines of arrays
export function joinDividerLines (group: Selection<SVGGElement, ArrayNode, BaseType, unknown>) {
  group
    .selectAll('line')
    .data(d => addCellWidthAndStringChanged(d).slice(1))
    .join(
      entered => entered.append('line')
        .attr('x1', (d, i) => (i + 1) * d.cellWidth)
        .attr('x2', (d, i) => (i + 1) * d.cellWidth)
        .attr('y1', 0)
        .attr('y2', SVG.cellHeight),
      updated => updated
        .transition()
        .duration(TRANSFORMATION.duration)
        .ease(TRANSFORMATION.ease)
        .attr('x1', (d, i) => (i + 1) * d.cellWidth)
        .attr('x2', (d, i) => (i + 1) * d.cellWidth)
        .selection(),
      removed => blendOutAnimation(removed)
    )
}

// joins texts in array cells
export function joinElementTexts (group: Selection<SVGGElement, ArrayNode, BaseType, unknown>) {
  group
    .selectAll('foreignObject')
    .data(d => addCellWidthAndStringChanged(d))
    .join(
      enter => enter
        .append('foreignObject')
        .attr('x', (d, i) => i * d.cellWidth + LAYOUT.arrays.cells.padding)
        .attr('y', LAYOUT.arrays.cells.verticalTextOffset)
        .attr('width', d => d.cellWidth - 2 * LAYOUT.arrays.cells.padding)
        .attr('height', SVG.cellHeight)
        .append('xhtml:div')
        .classed(HTML.classes.valueText, true)
        .classed(HTML.classes.changed, d => d.element?.kind === 'HeapString'
          ? d.stringChanged
          : (d.element as HeapArrayElementVar).changed)
        .text(d => getNodeString(d))
        .attr('title', d => getNodeString(d)),
      updated => {
        updated
          .transition()
          .duration(TRANSFORMATION.duration)
          .ease(TRANSFORMATION.ease)
          .attr('x', (d, i) => i * d.cellWidth + LAYOUT.arrays.cells.padding)
          .attr('width', d => d.cellWidth - 2 * LAYOUT.arrays.cells.padding)
        updated.select('div')
          .classed(HTML.classes.changed, d => d.element?.kind === 'HeapString'
            ? d.stringChanged
            : (d.element as HeapArrayElementVar).changed)
          .text(d => getNodeString(d))
          .attr('title', d => getNodeString(d))
        return updated
      },
      removed => removed.remove()
    )
}

// joins index numbers at arrays
export function joinIndexesAtArray (group: Selection<any, ArrayNode, BaseType, unknown>) {
  group
    .filter(d => d.kind !== 'TwoDimArrayChild' || d.indexInParent === 0)
    .selectAll(`.${HTML.classes.indexes.oneDim}`)
    .data(d => getNumberedIndexArray(d), (_, i) => i)
    .join(
      entered => entered
        .append('foreignObject')
        .classed(HTML.classes.indexes.number, true)
        .classed(HTML.classes.indexes.oneDim, true)
        .attr('x', (d, i) => i * d.cellWidth)
        .attr('y', LAYOUT.arrays.indexNrs.yOffset)
        .attr('width', d => d.cellWidth)
        .attr('height', LAYOUT.arrays.indexNrs.height)
        .append('xhtml:div')
        .text((_, i) => i)
        .attr('title', (_, i) => i),
      updated => updated
        .transition()
        .duration(TRANSFORMATION.duration)
        .ease(TRANSFORMATION.ease)
        .attr('x', (d, i) => i * d.cellWidth)
        .attr('width', d => d.cellWidth)
        .selection(),
      removed => blendOutAnimation(removed)
    )
  blendOutAnimation(
    group
      .filter(d => d.kind === 'TwoDimArrayChild' && d.indexInParent > 0)
      .selectAll(`.${HTML.classes.indexes.oneDim}`)
  )
}

// returns the name of the array
export function getArrayName (array: ArrayNode) {
  if (array.kind === 'TwoDimArrayChild' && array.parent?.kind === 'TwoDimArrayNode') {
    return `${array.parent.name}[]`
  } else {
    return array.name
  }
}

// returns a unique array string
export function getUniqueArrayString (array: ArrayNode) {
  let uniqueString = (array.element as HeapArray).id.toString()
  // TODO: support arrays referenced not from stack
  if (array.kind === 'TwoDimArrayChild') {
    uniqueString += `-${array.indexInParent}`
  }
  return uniqueString
}

// returns the array length
export function getArrayLength (array: ArrayNode) {
  if (array.kind === 'TwoDimArrayChild') {
    return array.parentDimensions[1]
  } else {
    return array.dimensions[0]
  }
}

// returns an array with the length of the array and each element containing the cellWidth
function getNumberedIndexArray (node: ArrayNode) {
  return [...Array(getArrayLength(node)).keys()].map(_ => {
    return { cellWidth: node.cellWidth }
  })
}
