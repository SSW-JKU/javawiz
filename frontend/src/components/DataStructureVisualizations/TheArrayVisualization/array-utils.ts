import { ArrayBox } from './types'
import { addCellWidthAndStringChanged, getRowYCoordinate } from './utils'
import { HTML, LAYOUT } from './constants'
import { BaseType, Selection } from 'd3'
import { HeapArray, HeapArrayElementVar } from '@/dto/TraceState'
import { SVG } from '../constants'
import { blendOutAnimation } from '../animations'
import { getNodeString } from '../data-structure-graph-node-utils'
import { TRANSFORMATION } from '@/helpers/constants'
import { heapArrayElementIdentifier, heapItemIdentifier } from '@/identifiers/trace-identifiers'

// calculates array's coordinates
export function getArrayCoordinates (arrayBox: ArrayBox, ignoreTwoDim: boolean = false): [number, number] {
  return [
    LAYOUT.xOrigin,
    getRowYCoordinate(arrayBox.row) + (!ignoreTwoDim && arrayBox.kind === 'TwoDimArrayRowBox' ? arrayBox.rowIndex * SVG.cellHeight : 0)
  ]
}

// joins dividers lines of arrays
export function joinDividerLines (group: Selection<SVGGElement, ArrayBox, BaseType, unknown>) {
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
export function joinElementTexts (group: Selection<SVGGElement, ArrayBox, BaseType, unknown>) {
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
        .classed(HTML.classes.changed, d => d.traceElement?.kind === 'HeapString'
          ? d.stringChanged
          : (d.traceElement as HeapArrayElementVar).changed)
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
          .classed(HTML.classes.changed, d => d.traceElement?.kind === 'HeapString'
            ? d.stringChanged
            : (d.traceElement as HeapArrayElementVar).changed)
          .text(d => getNodeString(d))
          .attr('title', d => getNodeString(d))
        return updated
      },
      removed => removed.remove()
    )
}

// joins index numbers at arrays
export function joinIndexesAtArray (group: Selection<any, ArrayBox, BaseType, unknown>) {
  group
    .filter(d => d.kind !== 'TwoDimArrayRowBox' || d.rowIndex === 0)
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
      .filter(d => d.kind === 'TwoDimArrayRowBox' && d.rowIndex > 0)
      .selectAll(`.${HTML.classes.indexes.oneDim}`)
  )
}

// returns the name of the array
export function getArrayName (arrayBox: ArrayBox) {
  if (arrayBox.kind === 'TwoDimArrayRowBox' && arrayBox.parentArrayBox?.kind === 'TwoDimArrayBox') {
    return `${arrayBox.parentArrayBox.label}[]`
  } else {
    return arrayBox.label
  }
}

/**
 * Returns the D3 key and DOM id suffix of an array box, the same identifier as in the Memory View.
 * A whole array is identified by its heap item (`obj_5`). A row of a two-dimensional array is the element
 * of its parent array (`obj_4-1`), so rows that share one inner array still get distinct boxes.
 */
export function getUniqueArrayString (arrayBox: ArrayBox) {
  // TODO: support arrays referenced not from stack
  if (arrayBox.kind === 'TwoDimArrayRowBox' && arrayBox.parentArrayBox) {
    return heapArrayElementIdentifier({ arrayId: (arrayBox.parentArrayBox.traceElement as HeapArray).id, index: arrayBox.rowIndex })
  }
  return heapItemIdentifier(arrayBox.traceElement as HeapArray)
}

// returns the array length
export function getArrayLength (arrayBox: ArrayBox) {
  if (arrayBox.kind === 'TwoDimArrayRowBox') {
    return arrayBox.parentDimensions[1]
  } else {
    return arrayBox.dimensions[0]
  }
}

// returns an array with the length of the array and each element containing the cellWidth
function getNumberedIndexArray (arrayBox: ArrayBox) {
  return [...Array(getArrayLength(arrayBox)).keys()].map(_ => {
    return { cellWidth: arrayBox.cellWidth }
  })
}
