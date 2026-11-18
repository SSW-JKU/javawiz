import { IndexLabel, ArrayBox } from './types'
import { getArrayCoordinates, getArrayLength } from './array-utils'
import { LAYOUT } from './constants'
import { BaseType, Selection } from 'd3'
import { SVG } from '../constants'

// calculates the coordinates of an index label's cell
export function getIndexCoordinates (indexLabel: Pick<IndexLabel, 'arrayBox' | 'cellIndex'>, ignoreTwoDim: boolean = false): [number, number] {
  const arrayCoordinates = getArrayCoordinates(indexLabel.arrayBox, ignoreTwoDim)
  if (indexLabel.arrayBox.kind === 'TwoDimArrayBox') {
    return [
      arrayCoordinates[0] + indexLabel.arrayBox.dimensions[1] * indexLabel.arrayBox.cellWidth + LAYOUT.indexes.row.xOffset,
      arrayCoordinates[1] + indexLabel.cellIndex * SVG.cellHeight
    ]
  } else {
    return [
      arrayCoordinates[0] + indexLabel.cellIndex * indexLabel.arrayBox.cellWidth,
      arrayCoordinates[1] - LAYOUT.indexes.col.yOffset
    ]
  }
}

// calculates an index label's offset within its cell, so several labels at one cell do not overlap
export function calculateIndexOffset (indexLabel: Pick<IndexLabel, 'arrayBox' | 'cellIndex' | 'positionAtCell'>) {
  let entry: { labelCount: number, spacing: number } | undefined
  if (indexLabel.arrayBox.indexLabelsPerCell) {
    const i = getIndexLabelSlot(indexLabel.cellIndex, indexLabel.arrayBox)
    entry = indexLabel.arrayBox.indexLabelsPerCell[i]
  }
  if (indexLabel.arrayBox.kind === 'TwoDimArrayBox') {
    return entry && entry.labelCount > 1
      ? LAYOUT.indexes.row.yOffset + indexLabel.positionAtCell * entry.spacing
      : 1 / 2 * SVG.cellHeight
  } else {
    return entry && entry.labelCount > 1
      ? LAYOUT.indexes.col.xOffset + indexLabel.positionAtCell * entry.spacing
      : indexLabel.arrayBox.cellWidth / 2
  }
}

// returns the slot of `indexLabelsPerCell` for an index value: the cell itself, or one of the two slots for indexes < 0 and ≥ length
function getIndexLabelSlot (value: number, arrayBox: ArrayBox) {
  if (value < 0) {
    // slot for indexes < 0
    return arrayBox.indexLabelsPerCell!.length - 2
  } else if (value >= getArrayLength(arrayBox)) {
    // slot for indexes >= array length
    return arrayBox.indexLabelsPerCell!.length - 1
  } else {
    return value
  }
}

// adds an index label to the list, placing it after the labels already at its cell
export function addIndexLabel (
  indexLabels: IndexLabel[],
  props: Pick<IndexLabel, 'arrayBox' | 'text' | 'cellIndex' | 'changed' | 'isGhost'>
) {
  // create the label slots of this array box on its first index label
  if (!props.arrayBox.indexLabelsPerCell) {
    props.arrayBox.indexLabelsPerCell = [...Array(getArrayLength(props.arrayBox) + 2).keys()].map(_ => {
      return { labelCount: 0, spacing: 0 }
    })
    props.arrayBox.indexLabelsPerCell[props.arrayBox.indexLabelsPerCell.length - 1].spacing = (props.arrayBox.cellWidth - 2 * LAYOUT.indexes.col.xOffset)
  }

  // add the label
  const i = getIndexLabelSlot(props.cellIndex, props.arrayBox)
  const entry = props.arrayBox.indexLabelsPerCell[i]
  props.cellIndex = Math.max(-1, Math.min(props.cellIndex, getArrayLength(props.arrayBox)))
  indexLabels.push({
    ...props,
    positionAtCell: entry.labelCount,
    isRotated: props.text.length > LAYOUT.indexes.col.rotationThreshold
  })
  entry.labelCount++

  // spread the labels at this cell evenly over the cell
  if (entry.labelCount > 1 && i < props.arrayBox.indexLabelsPerCell.length - 1) {
    if (props.arrayBox.kind === 'TwoDimArrayBox') {
      entry.spacing = (SVG.cellHeight - 2 * LAYOUT.indexes.row.yOffset) / (entry.labelCount - 1)
    } else {
      entry.spacing = (props.arrayBox.cellWidth - 2 * LAYOUT.indexes.col.xOffset) / (entry.labelCount - 1)
    }
  }
}

// returns an index label's offset within its cell as coordinates
export function calculateIndexOffsetCoordinates (indexLabel: Pick<IndexLabel, 'arrayBox' | 'cellIndex' | 'positionAtCell'>): [number, number] {
  if (indexLabel.arrayBox.kind === 'TwoDimArrayBox') {
    return [0, calculateIndexOffset(indexLabel)]
  } else {
    return [calculateIndexOffset(indexLabel), 0]
  }
}

// sets the attributes of an index label's text (mainly handles rotation)
export function indexForeignObjectAttributes (foreignObject: Selection<any, IndexLabel, BaseType, unknown>) {
  foreignObject.attr('height', LAYOUT.indexes.height)
  foreignObject.filter(d => d.arrayBox.kind === 'TwoDimArrayBox')
    .attr('x', LAYOUT.indexes.row.text.xOffset)
    .attr('y', -LAYOUT.indexes.height / 2 + LAYOUT.indexes.row.text.yOffset)
    .attr('width', LAYOUT.indexes.row.width)
  foreignObject.filter(d => d.arrayBox.kind !== 'TwoDimArrayBox')
    .attr('x', d => d.isRotated ? LAYOUT.indexes.col.rotatedText.xOffset : -LAYOUT.indexes.col.normalText.width / 2)
    .attr('y', d => d.isRotated ? LAYOUT.indexes.col.rotatedText.yOffset : LAYOUT.indexes.col.normalText.yOffset)
    .attr('width', d => d.isRotated ? LAYOUT.indexes.col.rotatedText.width : LAYOUT.indexes.col.normalText.width)
    .filter(d => d.isRotated)
    .attr('transform', LAYOUT.indexes.col.rotatedText.transform)
}
