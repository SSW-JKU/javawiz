import { ArrayIndex, ArrayNode } from './types'
import { getArrayCoordinates, getArrayLength } from './array-utils'
import { LAYOUT } from './constants'
import { SelectionOrTransition } from 'd3'
import { BaseType } from 'd3-selection'
import { SVG } from '../constants'

// calculates index coordinates
export function getIndexCoordinates (index: { array: ArrayNode, value: number }, ignoreTwoDim: boolean = false): [number, number] {
  const arrayCoordinates = getArrayCoordinates(index.array, ignoreTwoDim)
  if (index.array.kind === 'TwoDimArrayNode') {
    return [
      arrayCoordinates[0] + index.array.dimensions[1] * index.array.cellWidth + LAYOUT.indexes.row.xOffset,
      arrayCoordinates[1] + index.value * SVG.cellHeight
    ]
  } else {
    return [
      arrayCoordinates[0] + index.value * index.array.cellWidth,
      arrayCoordinates[1] - LAYOUT.indexes.col.yOffset
    ]
  }
}

// calculates index' offset
export function calculateIndexOffset (index: { array: ArrayNode; value: number; index: number }) {
  let entry: { count: number, distance: number } | undefined
  if (index.array.indexDistances) {
    const i = getIndexInDistArr(index.value, index.array)
    entry = index.array.indexDistances[i]
  }
  if (index.array.kind === 'TwoDimArrayNode') {
    return entry && entry.count > 1
      ? LAYOUT.indexes.row.yOffset + index.index * entry.distance
      : 1 / 2 * SVG.cellHeight
  } else {
    return entry && entry.count > 1
      ? LAYOUT.indexes.col.xOffset + index.index * entry.distance
      : index.array.cellWidth / 2
  }
}

// returns the index of a value in the distances array
function getIndexInDistArr (value: number, array: ArrayNode) {
  if (value < 0) {
    // index in distArray for indexes < 0
    return array.indexDistances!.length - 2
  } else if (value >= getArrayLength(array)) {
    // index in distArray for indexes >= array.length
    return array.indexDistances!.length - 1
  } else {
    return value
  }
}

// adds an index into the indexes array
export function addIndex (
  indexes: ArrayIndex[],
  props: {
    array: ArrayNode,
    name: string,
    value: number,
    changed: boolean,
    isGhost: boolean
  }
) {
  // init distance info if needed
  if (!props.array.indexDistances) {
    props.array.indexDistances = [...Array(getArrayLength(props.array) + 2).keys()].map(_ => {
      return { count: 0, distance: 0 }
    })
    props.array.indexDistances[props.array.indexDistances.length - 1].distance = (props.array.cellWidth - 2 * LAYOUT.indexes.col.xOffset)
  }

  // add index
  const i = getIndexInDistArr(props.value, props.array)
  const entry = props.array.indexDistances[i]
  props.value = Math.max(-1, Math.min(props.value, getArrayLength(props.array)))
  indexes.push({
    ...props,
    index: entry.count,
    rotated: props.name.length > LAYOUT.indexes.col.rotationThreshold
  })
  entry.count++

  // update index distances
  if (entry.count > 1 && i < props.array.indexDistances.length - 1) {
    if (props.array.kind === 'TwoDimArrayNode') {
      entry.distance = (SVG.cellHeight - 2 * LAYOUT.indexes.row.yOffset) / (entry.count - 1)
    } else {
      entry.distance = (props.array.cellWidth - 2 * LAYOUT.indexes.col.xOffset) / (entry.count - 1)
    }
  }
}

// return index offset as coordinate
export function calculateIndexOffsetCoordinates (index: { array: ArrayNode, value: number, index: number }): [number, number] {
  if (index.array.kind === 'TwoDimArrayNode') {
    return [0, calculateIndexOffset(index)]
  } else {
    return [calculateIndexOffset(index), 0]
  }
}

// sets the index' text field attributes (mainly handles rotation)
export function indexForeignObjectAttributes (foreignObject: SelectionOrTransition<any, ArrayIndex, BaseType, unknown>) {
  foreignObject.attr('height', LAYOUT.indexes.height)
  foreignObject.filter(d => d.array.kind === 'TwoDimArrayNode')
    .attr('x', LAYOUT.indexes.row.text.xOffset)
    .attr('y', -LAYOUT.indexes.height / 2 + LAYOUT.indexes.row.text.yOffset)
    .attr('width', LAYOUT.indexes.row.width)
  foreignObject.filter(d => d.array.kind !== 'TwoDimArrayNode')
    .attr('x', d => d.rotated ? LAYOUT.indexes.col.rotatedText.xOffset : -LAYOUT.indexes.col.normalText.width / 2)
    .attr('y', d => d.rotated ? LAYOUT.indexes.col.rotatedText.yOffset : LAYOUT.indexes.col.normalText.yOffset)
    .attr('width', d => d.rotated ? LAYOUT.indexes.col.rotatedText.width : LAYOUT.indexes.col.normalText.width)
    .filter(d => d.rotated)
    .attr('transform', LAYOUT.indexes.col.rotatedText.transform)
}
