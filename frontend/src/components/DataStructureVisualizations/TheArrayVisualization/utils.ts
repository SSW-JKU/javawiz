import { rowYCoordinates } from './state'
import { IndexLabel, ArrayBox, VariableToArrayPointer, TemporaryVariableBox } from './types'
import { getArrayCoordinates, getArrayLength } from './array-utils'
import { getPointerCoordinates } from './pointer-utils'
import { getIndexCoordinates } from './index-utils'
import { LAYOUT } from './constants'
import { DataStructureGraphNode } from '../dataStructureGraph'
import { HeapArray } from '@/dto/TraceState'

import { getNodeString } from '../data-structure-graph-node-utils'

// returns the y coordinate of a row
export function getRowYCoordinate (row: number) {
  return rowYCoordinates.value[row]
}

// calculates displayed text width
export function getTextWidth (text: string, type: 'index' | 'value') {
  const tester = document.getElementById(type === 'index' ? 'index-text-tester' : 'value-text-tester')
  if (tester) {
    tester.innerText = text
    return tester.clientWidth + 1 + 2 * LAYOUT.arrays.cells.padding
  }
  return 0
}

// adds the cell's width of the parent and a property to check if a string has changed
export function addCellWidthAndStringChanged (arrayBox: ArrayBox) {
  return (arrayBox.childDataStructureGraphNodes as DataStructureGraphNode[]).map((child, i) => {
    const toReturn = { ...child, cellWidth: arrayBox.cellWidth, stringChanged: false }
    if (child.traceElement?.kind === 'HeapString') {
      toReturn.stringChanged = (arrayBox.traceElement as HeapArray).elements[i].changed
    }
    return toReturn
  })
}

// returns the coordinates and cell width of an array box or temporary variable box
export function getCoordinatesAndWidth (arrayBoxOrTemporaryVariableBox: ArrayBox | TemporaryVariableBox, isWholeArrayCopy: boolean, index: number | undefined) {
  const coordinates = arrayBoxOrTemporaryVariableBox.kind === 'TemporaryVariableBox'
    ? arrayBoxOrTemporaryVariableBox.coordinates
    : getArrayCoordinates(arrayBoxOrTemporaryVariableBox)
  if (!isWholeArrayCopy && index && arrayBoxOrTemporaryVariableBox.kind !== 'TemporaryVariableBox') {
    coordinates[0] += index * arrayBoxOrTemporaryVariableBox.cellWidth
  }
  let width = arrayBoxOrTemporaryVariableBox.cellWidth
  if (isWholeArrayCopy && arrayBoxOrTemporaryVariableBox.kind !== 'TemporaryVariableBox') {
    width *= getArrayLength(arrayBoxOrTemporaryVariableBox)
  }
  return { coordinates, width }
}

// gets the coordinates of a change
export function getCoordinatesOfChange (variableToArrayPointers: VariableToArrayPointer[], indexLabels: IndexLabel[]) {
  let coordinates: [number, number] | undefined

  const changedPointer = variableToArrayPointers.find(pointer => pointer.changed)
  if (changedPointer) {
    if (changedPointer.targetArrayBox) {
      coordinates = getArrayCoordinates(changedPointer.targetArrayBox)
    } else {
      coordinates = getPointerCoordinates(changedPointer)
    }
  } else {
    const changedIndexLabel = indexLabels.find(index => index.changed)
    if (changedIndexLabel) {
      coordinates = getIndexCoordinates(changedIndexLabel)
    }
  }

  return coordinates
}

// returns the cell width of a data-structure graph node
export function getCellWidth (dataStructureGraphNode: DataStructureGraphNode, minCellWidth: number) {
  return Math.min(minCellWidth * LAYOUT.arrays.cells.widthMultiplier.max, Math.max(minCellWidth,
    // differentiate between array/string nodes and nodes with primitive vars
    dataStructureGraphNode.childDataStructureGraphNodes.length > 0
      ? Math.max(
        ...(dataStructureGraphNode.childDataStructureGraphNodes
          .map(child => getTextWidth(getNodeString(child), 'value')))
      )
      : getTextWidth(getNodeString(dataStructureGraphNode), 'value')
  ))
}
