import { calculateXCoordinate, calculateYCoordinate } from './layout'
import { BaseType, Selection } from 'd3-selection'
import { HTML, LAYOUT } from './constants'
import { SVG } from '../constants'
import { getNodeString, getNodeType, isFieldChanged } from '../heap-tree-node-utils'
import { HeapTreeNode } from '../heapBFS'
import { ChildPointer, TreeNode, TreeNodePointer } from './types'
import { getChildPointerCoordinates } from './child-pointer-utils'
import { getPointerCoordinates } from './pointer-utils'

// calculate coordinates of a node, assuming yCoordinatesOfLevels and widthsOfLevels are set correctly
export function getNodeCoordinates (node: TreeNode): [number, number] {
  return [
    calculateXCoordinate(node.index, node.level, node.treeLevel),
    calculateYCoordinate(node.level, node.treeLevel)
  ]
}

// sets attributes of the field-group
export function fieldAttributes (
  group: Selection<any, HeapTreeNode & { parent: HeapTreeNode }, BaseType, any>,
  ...specialNames: string[]
) {
  return group
    .classed(HTML.classes.changed, (d, i) => isFieldChanged(d.parent, i))
    .classed(HTML.classes.fieldText, d => getNodeType(d, ...specialNames) === 'name')
    .classed(HTML.classes.valueText, d => getNodeType(d, ...specialNames) === 'value')
    .text(d => getNodeString(d, ...specialNames))
    .attr('title', d => getNodeString(d, ...specialNames))
}

// joins the texts of node fields
export function joinFieldTexts (
  group: Selection<any, TreeNode, BaseType, any>,
  component: { leftName: string, rightName: string }
) {
  group.selectAll(`.${HTML.classes.nodes.field}`)
    .data(d => d.node!.children
      .filter(child => child.name !== component.leftName && child.name !== component.rightName)
      .map(child => {
        return { ...child, parent: d.node! }
      }))
    .join(
      entered => fieldAttributes(
        entered.append('foreignObject')
          .classed(HTML.classes.nodes.field, true)
          .attr('x', 0)
          .attr('y', (_, i) => i * SVG.cellHeight + LAYOUT.nodes.verticalTextOffset)
          .attr('width', SVG.cellWidth)
          .attr('height', SVG.cellHeight)
          .append('xhtml:div')
      ),
      updated => fieldAttributes(updated.select('div')),
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
  nodePointers: TreeNodePointer[],
  successorPointers: ChildPointer[]
) {
  // find changed node pointers
  const changedPointers = nodePointers.filter(pointer => pointer.changed)

  // x and y coordinate which should be moved into frame
  let x: number = NaN
  let y: number = NaN
  let coordinates: number[] = []

  if (changedPointers.length > 0) {
    // get coordinates of the first changed pointer
    const changedPointer = changedPointers[0]
    // changed pointer is from tree
    coordinates = changedPointer.node
      ? getNodeCoordinates(changedPointer.node)
      : getPointerCoordinates(changedPointer)
  } else {
    // check if successor-pointer was changed, if no node pointer changed
    // find changed pointer and get its coordinates
    const changedSuccessorPointers = successorPointers.filter(pointer => pointer.changed)
    if (changedSuccessorPointers.length > 0) {
      const changedSuccessorPointer = changedSuccessorPointers[0]
      coordinates = changedSuccessorPointer.child.node
        ? getNodeCoordinates(changedSuccessorPointer.child)
        : getChildPointerCoordinates(changedSuccessorPointer)
    }
  }
  if (coordinates.length === 2) {
    x = coordinates[0]
    y = coordinates[1]
  }
  return { x, y }
}
