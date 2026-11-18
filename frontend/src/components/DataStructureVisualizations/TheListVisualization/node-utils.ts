import { ListNodeBox, VariableToListNodePointer, NextFieldPointer, ValueObjectBox } from './types'
import { rowYCoordinates } from './state'
import { HTML, LAYOUT } from './constants'
import { BaseType, Selection } from 'd3-selection'
import { DataStructureGraphNode } from '../dataStructureGraph'
import { HeapObject, Var } from '@/dto/TraceState'
import { SVG } from '../constants'
import { DEFAULT_MAX_DEPTH, getNodeString, getNodeType, getVarString, isFieldChanged } from '../data-structure-graph-node-utils'
import { getPointerCoordinates } from './pointer-utils'
import { getNextFieldPointerCoordinates } from './next-field-pointer-utils'

// calculates the x coordinate of a list node box's column
export function calculateColumnXCoordinate (column: number): number {
  return ((column + 1) * LAYOUT.nodes.distances.multiplier * SVG.cellWidth + LAYOUT.nodes.distances.constant * SVG.cellWidth)
}

// calculates the y coordinate of a list node box's row
export function calculateRowYCoordinate (row: number): number {
  return rowYCoordinates[row]
}

// calculate coordinates of a list node box
export function getListNodeBoxCoordinates (listNodeBox: ListNodeBox): [number, number] {
  return [
    calculateColumnXCoordinate(listNodeBox.column),
    calculateRowYCoordinate(listNodeBox.row)
  ]
}

// calculate coordinates of a value object box
export function getValueObjectBoxCoordinates (valueObjectBox: ValueObjectBox): [number, number] {
  const nodeCoordinates = getListNodeBoxCoordinates(valueObjectBox.ownerListNodeBox)
  return [
    nodeCoordinates[0],
    nodeCoordinates[1] + valueObjectBox.ownerListNodeBox.height + LAYOUT.nodes.distances.value
  ]
}

// calculates X distance from a list node box to its value object box
export function calculateXDistanceToValueObjectBox (listNodeBox: ListNodeBox) {
  return (listNodeBox.valueObjectBox ? getValueObjectBoxCoordinates(listNodeBox.valueObjectBox)[0] : 0) - calculateColumnXCoordinate(listNodeBox.column) + SVG.cellWidth / 2
}

// calculates Y distance from a list node box to its value object box
export function calculateYDistanceToValueObjectBox (listNodeBox: ListNodeBox) {
  return (listNodeBox.valueObjectBox ? getValueObjectBoxCoordinates(listNodeBox.valueObjectBox)[1] : 0) - calculateRowYCoordinate(listNodeBox.row)
}

// addon for the getNodeString function to handle the value-field
export function getNodeStringAddon (dataStructureGraphNode: DataStructureGraphNode, valName: string, isLast: boolean, ...specialNames: string[]): string {
  if (dataStructureGraphNode.label === valName && dataStructureGraphNode.traceElement?.kind === 'Var') {
    const string = getVarString(dataStructureGraphNode, dataStructureGraphNode.traceElement as Var)
    if (string) {
      return string
    }
  } else if (dataStructureGraphNode.traceElement?.kind === 'HeapObject' && isLast && dataStructureGraphNode.traceElement.type !== 'java.lang.String') {
    // last child is always value for nodes
    return valName
  }
  return getNodeString(dataStructureGraphNode, DEFAULT_MAX_DEPTH, ...specialNames)
}

// addon for the getNodeType function to handle the value-field
export function getNodeTypeAddon (dataStructureGraphNode: DataStructureGraphNode, valName: string, isLast: boolean, ...specialNames: string[]): ('value' | 'name') {
  if (dataStructureGraphNode.label === valName && dataStructureGraphNode.traceElement?.kind === 'Var') {
    if (getVarString(dataStructureGraphNode, dataStructureGraphNode.traceElement as Var)) {
      return 'value'
    }
  } else if ((dataStructureGraphNode.traceElement as HeapObject).type === 'java.lang.String') {
    return 'value'
  } else if (dataStructureGraphNode.traceElement?.kind === 'HeapObject' && isLast) {
    // last child is always value for nodes
    return 'name'
  }
  return getNodeType(dataStructureGraphNode, ...specialNames)
}

// sets attribute of field group
export function fieldAttributes (
  group: Selection<any, DataStructureGraphNode & { parent: DataStructureGraphNode }, BaseType, any>,
  component: { valName: string },
  specialNames: string[]
) {
  return group
    .classed(HTML.classes.changed, (d, i) => isFieldChanged(d.parent, i))
    .classed(HTML.classes.valueText, (d, i) => getNodeTypeAddon(d, component.valName, i === d.parent.childDataStructureGraphNodes.length - 1, ...specialNames) === 'value')
    .classed(HTML.classes.fieldText, (d, i) => getNodeTypeAddon(d, component.valName, i === d.parent.childDataStructureGraphNodes.length - 1, ...specialNames) === 'name')
    .text((d, i) => getNodeStringAddon(d, component.valName, i === d.parent.childDataStructureGraphNodes.length - 1, ...specialNames))
    .attr('title', (d, i) => getNodeStringAddon(d, component.valName, i === d.parent.childDataStructureGraphNodes.length - 1, ...specialNames))
}

// joins the texts of node fields
export function joinFieldTexts (
  group: Selection<any, ListNodeBox, BaseType, any>,
  component: { valName: string, nextName: string }
) {
  const specialNames = [component.valName, component.nextName]
  group.selectAll('foreignObject')
    .data(d => d.dataStructureGraphNode!.childDataStructureGraphNodes.map(child => {
      return { ...child, parent: d.dataStructureGraphNode! }
    }))
    .join(
      entered => fieldAttributes(
        entered.append('foreignObject')
          .attr('x', 0)
          .attr('y', (_, i) => i * SVG.cellHeight + LAYOUT.nodes.fieldTextYOffset)
          .attr('width', SVG.cellWidth)
          .attr('height', SVG.cellHeight - LAYOUT.nodes.fieldTextYOffset)
          .append('xhtml:div'),
        component, specialNames),
      updated => fieldAttributes(updated.select('div'), component, specialNames),
      removed => removed.remove()
    )
}

/**
 * returns coordinates of changed pointer and pointer itself
 * checks for changed variable pointers and changed successor pointers
 * @param variableToListNodePointers all pointers from variables to list node boxes
 * @param nextFieldPointers all pointers to successor nodes (next or child pointers)
 */
export function getCoordinatesOfChange (
  variableToListNodePointers: VariableToListNodePointer[],
  nextFieldPointers: NextFieldPointer[]
) {
  // find changed variable pointers
  const changedPointer = variableToListNodePointers.find(pointer => pointer.changed)

  // x and y coordinate which should be moved into frame
  let x: number = NaN
  let y: number = NaN
  let coordinates: number[] = []

  if (changedPointer) {
    // get coordinates of the first changed pointer
    coordinates = changedPointer.targetListNodeBox
      ? getListNodeBoxCoordinates(changedPointer.targetListNodeBox)
      : getPointerCoordinates(changedPointer)
  } else {
    // check if successor-pointer was changed, if no variable pointer changed

    // function is called from list
    // find changed pointer and get its coordinates
    const changedNextFieldPointer = nextFieldPointers.find(pointer => pointer.changed)
    if (changedNextFieldPointer) {
      coordinates = changedNextFieldPointer.targetListNodeBox.dataStructureGraphNode
        ? getListNodeBoxCoordinates(changedNextFieldPointer.targetListNodeBox)
        : getNextFieldPointerCoordinates(changedNextFieldPointer)
    }
  }
  if (coordinates.length === 2) {
    x = coordinates[0]
    y = coordinates[1]
  }
  return { x, y }
}
