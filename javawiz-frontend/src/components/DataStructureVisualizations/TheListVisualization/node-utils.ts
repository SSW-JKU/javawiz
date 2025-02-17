import { ListNode, ListNodePointer, NextPointer, ReferenceNode } from './types'
import { levelCoordinates } from './TheListVisualization.vue'
import { HTML, LAYOUT } from './constants'
import { BaseType, Selection } from 'd3-selection'
import { HeapTreeNode } from '../heapBFS'
import { HeapObject, Var } from '@/dto/TraceState'
import { SVG } from '../constants'
import { getNodeString, getNodeType, getVarString, isFieldChanged } from '../heap-tree-node-utils'
import { getPointerCoordinates } from './pointer-utils'
import { getNextPointerCoordinates } from './next-pointer-utils'

// calculates node's x-coordinate based on index
export function calculateNodesXCoordinate (index: number): number {
  return ((index + 1) * LAYOUT.nodes.distances.multiplier * SVG.cellWidth + LAYOUT.nodes.distances.constant * SVG.cellWidth)
}

// calculates node's y-coordinate based on level
export function calculateNodesYCoordinate (level: number): number {
  return levelCoordinates[level]
}

// calculate coordinates of a node
export function getNodeCoordinates (node: ListNode): [number, number] {
  return [
    calculateNodesXCoordinate(node.index),
    calculateNodesYCoordinate(node.level)
  ]
}

// calculate coordinates of a reference node
export function getReferenceNodeCoordinates (refNode: ReferenceNode): [number, number] {
  const nodeCoordinates = getNodeCoordinates(refNode.node)
  return [
    nodeCoordinates[0],
    nodeCoordinates[1] + refNode.node.height + LAYOUT.nodes.distances.value
  ]
}

// calculates X distance from node to reference node
export function calculateXDistanceToReference (node: ListNode) {
  return (node.referenceValue ? getReferenceNodeCoordinates(node.referenceValue)[0] : 0) - calculateNodesXCoordinate(node.index) + SVG.cellWidth / 2
}

// calculates Y distance from node to reference node
export function calculateYDistanceToReference (node: ListNode) {
  return (node.referenceValue ? getReferenceNodeCoordinates(node.referenceValue)[1] : 0) - calculateNodesYCoordinate(node.level)
}

// addon for the getNodeString function to handle the value-field
export function getNodeStringAddon (node: HeapTreeNode, valName: string, isLast: boolean, ...specialNames: string[]): string {
  if (node.name === valName && node.element?.kind === 'Var') {
    const string = getVarString(node, node.element as Var)
    if (string) {
      return string
    }
  } else if (node.element?.kind === 'HeapObject' && isLast && node.element.type !== 'java.lang.String') {
    // last child is always value for nodes
    return valName
  }
  return getNodeString(node, ...specialNames)
}

// addon for the getNodeType function to handle the value-field
export function getNodeTypeAddon (node: HeapTreeNode, valName: string, isLast: boolean, ...specialNames: string[]): ('value' | 'name') {
  if (node.name === valName && node.element?.kind === 'Var') {
    if (getVarString(node, node.element as Var)) {
      return 'value'
    }
  } else if ((node.element as HeapObject).type === 'java.lang.String') {
    return 'value'
  } else if (node.element?.kind === 'HeapObject' && isLast) {
    // last child is always value for nodes
    return 'name'
  }
  return getNodeType(node, ...specialNames)
}

// sets attribute of field group
export function fieldAttributes (
  group: Selection<any, HeapTreeNode & { parent: HeapTreeNode }, BaseType, any>,
  component: { valName: string },
  specialNames: string[]
) {
  return group
    .classed(HTML.classes.changed, (d, i) => isFieldChanged(d.parent, i))
    .classed(HTML.classes.valueText, (d, i) => getNodeTypeAddon(d, component.valName, i === d.parent.children.length - 1, ...specialNames) === 'value')
    .classed(HTML.classes.fieldText, (d, i) => getNodeTypeAddon(d, component.valName, i === d.parent.children.length - 1, ...specialNames) === 'name')
    .text((d, i) => getNodeStringAddon(d, component.valName, i === d.parent.children.length - 1, ...specialNames))
    .attr('title', (d, i) => getNodeStringAddon(d, component.valName, i === d.parent.children.length - 1, ...specialNames))
}

// joins the texts of node fields
export function joinFieldTexts (
  group: Selection<any, ListNode, BaseType, any>,
  component: { valName: string, nextName: string }
) {
  const specialNames = [component.valName, component.nextName]
  group.selectAll('foreignObject')
    .data(d => d.node!.children.map(child => {
      return { ...child, parent: d.node! }
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
 * checks for changed node pointers and changed successor pointers
 * @param nodePointers all pointers to a node
 * @param successorPointers all pointers to successor nodes (next or child pointers)
 */
export function getCoordinatesOfChange (
  nodePointers: ListNodePointer[],
  successorPointers: NextPointer[]
) {
  // find changed node pointers
  const changedPointer = nodePointers.find(pointer => pointer.changed)

  // x and y coordinate which should be moved into frame
  let x: number = NaN
  let y: number = NaN
  let coordinates: number[] = []

  if (changedPointer) {
    // get coordinates of the first changed pointer
    coordinates = changedPointer.node
      ? getNodeCoordinates(changedPointer.node)
      : getPointerCoordinates(changedPointer)
  } else {
    // check if successor-pointer was changed, if no node pointer changed

    // function is called from list
    // find changed pointer and get its coordinates
    const changedSuccessorPointer = successorPointers.find(pointer => pointer.changed)
    if (changedSuccessorPointer) {
      coordinates = changedSuccessorPointer.to.node
        ? getNodeCoordinates(changedSuccessorPointer.to)
        : getNextPointerCoordinates(changedSuccessorPointer)
    }
  }
  if (coordinates.length === 2) {
    x = coordinates[0]
    y = coordinates[1]
  }
  return { x, y }
}
