import { levelCoordinates } from './TheArrayVisualization.vue'
import { ArrayIndex, ArrayNode, ArrayPointer, TempVariable } from './types'
import { getArrayCoordinates, getArrayLength } from './array-utils'
import { getPointerCoordinates } from './pointer-utils'
import { getIndexCoordinates } from './index-utils'
import { LAYOUT } from './constants'
import { HeapTreeNode } from '../heapBFS'
import { HeapArray } from '@/dto/TraceState'

import { getNodeString } from '../heap-tree-node-utils'

// get level's Y coordinate
export function getLevelYCoordinate (index: number) {
  return levelCoordinates.value[index]
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
export function addCellWidthAndStringChanged (parent: ArrayNode) {
  return (parent.children as HeapTreeNode[]).map((child, i) => {
    const toReturn = { ...child, cellWidth: parent.cellWidth, stringChanged: false }
    if (child.element?.kind === 'HeapString') {
      toReturn.stringChanged = (parent.element as HeapArray).elements[i].changed
    }
    return toReturn
  })
}

// returns coordinates and cell width of array node or temp variable
export function getCoordinatesAndWidth (arrayOrVar: ArrayNode | TempVariable, arrayCopy: boolean, index: number | undefined) {
  const coordinates = arrayOrVar.kind === 'TempVariable' ? arrayOrVar.coordinates : getArrayCoordinates(arrayOrVar)
  if (!arrayCopy && index && arrayOrVar.kind !== 'TempVariable') {
    coordinates[0] += index * arrayOrVar.cellWidth
  }
  let width = arrayOrVar.cellWidth
  if (arrayCopy && arrayOrVar.kind !== 'TempVariable') {
    width *= getArrayLength(arrayOrVar)
  }
  return { coordinates, width }
}

// gets the coordinates of a change
export function getCoordinatesOfChange (pointers: ArrayPointer[], indexes: ArrayIndex[]) {
  let coordinates: [number, number] | undefined

  const changedPointer = pointers.find(pointer => pointer.changed)
  if (changedPointer) {
    if (changedPointer.array) {
      coordinates = getArrayCoordinates(changedPointer.array)
    } else {
      coordinates = getPointerCoordinates(changedPointer)
    }
  } else {
    const changedIndex = indexes.find(index => index.changed)
    if (changedIndex) {
      coordinates = getIndexCoordinates(changedIndex)
    }
  }

  return coordinates
}

// returns the cell width of a heap tree node
export function getCellWidth (node: HeapTreeNode, minCellWidth: number) {
  return Math.min(minCellWidth * LAYOUT.arrays.cells.widthMultiplier.max, Math.max(minCellWidth,
    // differentiate between array/string nodes and nodes with primitive vars
    node.children.length > 0
      ? Math.max(
        ...(node.children
          .map(child => getTextWidth(getNodeString(child), 'value')))
      )
      : getTextWidth(getNodeString(node), 'value')
  ))
}
