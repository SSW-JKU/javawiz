import { calculateXCoordinate, calculateYCoordinate } from './layout'
import { BaseType, Selection } from 'd3-selection'
import { HTML, LAYOUT } from './constants'
import { SVG } from '../constants'
import { DEFAULT_MAX_DEPTH, getNodeString, getNodeType, isFieldChanged } from '../data-structure-graph-node-utils'
import { DataStructureGraphNode } from '../dataStructureGraph'
import { ChildFieldPointer, TreeNodeBox, VariableToTreeNodePointer } from './types'
import { getChildFieldPointerCoordinates } from './child-field-pointer-utils'
import { getPointerCoordinates } from './pointer-utils'

// calculate coordinates of a node, assuming yCoordinatesOfLevels and widthsOfLevels are set correctly
export function getTreeNodeBoxCoordinates (treeNodeBox: TreeNodeBox): [number, number] {
  return [
    calculateXCoordinate(treeNodeBox.slotInDepth, treeNodeBox.depth, treeNodeBox.treeRow),
    calculateYCoordinate(treeNodeBox.depth, treeNodeBox.treeRow)
  ]
}

// sets attributes of the field-group
export function fieldAttributes (
  group: Selection<any, DataStructureGraphNode & { parent: DataStructureGraphNode }, BaseType, any>,
  ...specialNames: string[]
) {
  return group
    .classed(HTML.classes.changed, (d, i) => isFieldChanged(d.parent, i))
    .classed(HTML.classes.fieldText, d => getNodeType(d, ...specialNames) === 'name')
    .classed(HTML.classes.valueText, d => getNodeType(d, ...specialNames) === 'value')
    .text(d => getNodeString(d, DEFAULT_MAX_DEPTH, ...specialNames))
    .attr('title', d => getNodeString(d, DEFAULT_MAX_DEPTH, ...specialNames))
}

// joins the texts of node fields
export function joinFieldTexts (
  group: Selection<any, TreeNodeBox, BaseType, any>,
  component: { leftName: string, rightName: string }
) {
  group.selectAll(`.${HTML.classes.nodes.field}`)
    .data(d => d.dataStructureGraphNode!.childDataStructureGraphNodes
      .filter(child => child.label !== component.leftName && child.label !== component.rightName)
      .map(child => {
        return { ...child, parent: d.dataStructureGraphNode! }
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
 * checks for changed variable pointers and changed child field pointers
 * @param variableToTreeNodePointers all pointers from variables to tree node boxes
 * @param childFieldPointers all child field pointers
 */
export function getCoordinatesOfChange (
  variableToTreeNodePointers: VariableToTreeNodePointer[],
  childFieldPointers: ChildFieldPointer[]
) {
  // find changed variable pointers
  const changedPointers = variableToTreeNodePointers.filter(pointer => pointer.changed)

  // x and y coordinate which should be moved into frame
  let x: number = NaN
  let y: number = NaN
  let coordinates: number[] = []

  if (changedPointers.length > 0) {
    // get coordinates of the first changed pointer
    const changedPointer = changedPointers[0]
    // changed pointer is from tree
    coordinates = changedPointer.targetTreeNodeBox
      ? getTreeNodeBoxCoordinates(changedPointer.targetTreeNodeBox)
      : getPointerCoordinates(changedPointer)
  } else {
    // check if a child field pointer was changed, if no variable pointer changed
    // find changed pointer and get its coordinates
    const changedChildFieldPointers = childFieldPointers.filter(pointer => pointer.changed)
    if (changedChildFieldPointers.length > 0) {
      const changedChildFieldPointer = changedChildFieldPointers[0]
      coordinates = changedChildFieldPointer.targetTreeNodeBox.dataStructureGraphNode
        ? getTreeNodeBoxCoordinates(changedChildFieldPointer.targetTreeNodeBox)
        : getChildFieldPointerCoordinates(changedChildFieldPointer)
    }
  }
  if (coordinates.length === 2) {
    x = coordinates[0]
    y = coordinates[1]
  }
  return { x, y }
}
