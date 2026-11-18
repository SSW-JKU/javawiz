import { ChildFieldPointer, TreeNodeBox, VariableToTreeNodePointer } from './types'
import { HeapObject, ReferenceVal, Var } from '@/dto/TraceState'
import { heapObjectFieldIdentifier, rootVariableIdentifier } from '@/identifiers/trace-identifiers'
import { hasSuccessorPointerChanged } from './child-field-pointer-utils'
import { DataStructureGraphNode } from '../dataStructureGraph'
import { HTML, LAYOUT } from './constants'
import { select } from 'd3-selection'
import { SVG } from '../constants'
import { moveElemInArray } from '../utils'
import { getVariablePointers } from '../preprocessing-utils'
import { getFieldIndex, setChildChangedFlags } from '../data-structure-graph-node-utils'
import { calcTreeWidth } from './layout'

function updateLevelCoordinates (childTreeNodeBox: TreeNodeBox, yCoordinatesByTreeRowAndDepth: number[][]) {
  const treeLevelCoordinates = yCoordinatesByTreeRowAndDepth[childTreeNodeBox.treeRow]
  const levelDepth = treeLevelCoordinates[childTreeNodeBox.depth] + childTreeNodeBox.height + LAYOUT.nodes.distanceBetween
  if (childTreeNodeBox.depth + 1 >= treeLevelCoordinates.length) {
    treeLevelCoordinates.push(levelDepth)
  } else if (levelDepth > treeLevelCoordinates[childTreeNodeBox.depth + 1]) {
    treeLevelCoordinates[childTreeNodeBox.depth + 1] = levelDepth
  }
}

// processes a child box: adds it to the visualization if needed and adds the child field pointer to it
function processChildNode (
  childTreeNodeBox: TreeNodeBox,
  parentTreeNodeBox: TreeNodeBox,
  layoutInfo: {
    treeRow: number,
    side: 'left' | 'right'
  },
  structures: {
    treeNodeBoxes: TreeNodeBox[],
    childFieldPointers: ChildFieldPointer[],
    yCoordinatesByTreeRowAndDepth: number[][]
  },
  component: { nodeClassNames: ReadonlySet<string>, valueName: string, leftName: string; rightName: string }
) {
  let actualChildTreeNodeBox: TreeNodeBox = childTreeNodeBox
  let depth = parentTreeNodeBox.depth
  if (childTreeNodeBox.dataStructureGraphNode?.traceElement?.kind === 'HeapObject') {
    if (!component.nodeClassNames.has(childTreeNodeBox.dataStructureGraphNode.traceElement.type)) {
      return depth
    }
    const existing = structures.treeNodeBoxes.find(treeNodeBox =>
      (treeNodeBox.dataStructureGraphNode?.traceElement as HeapObject).id === (childTreeNodeBox.dataStructureGraphNode!.traceElement as HeapObject).id)
    if (existing) {
      actualChildTreeNodeBox = existing
    } else {
      structures.treeNodeBoxes.push(actualChildTreeNodeBox)
      updateLevelCoordinates(childTreeNodeBox, structures.yCoordinatesByTreeRowAndDepth)
      depth = exploreTree(childTreeNodeBox, layoutInfo.treeRow, structures, component)
    }
  } else {
    actualChildTreeNodeBox.dataStructureGraphNode = undefined
  }
  structures.childFieldPointers.push({
    sourceTreeNodeBox: parentTreeNodeBox,
    targetTreeNodeBox: actualChildTreeNodeBox!,
    side: layoutInfo.side,
    changed: hasSuccessorPointerChanged(layoutInfo.side === 'left' ? component.leftName : component.rightName, parentTreeNodeBox)
  })
  return depth
}

// explores the tree below the given box and adds the boxes of its descendants to structures.treeNodeBoxes; returns the deepest depth reached
export function exploreTree (
  treeNodeBox: TreeNodeBox,
  treeRow: number,
  structures: {
    treeNodeBoxes: TreeNodeBox[],
    childFieldPointers: ChildFieldPointer[],
    yCoordinatesByTreeRowAndDepth: number[][]
  },
  component: { nodeClassNames: ReadonlySet<string>, valueName: string, leftName: string; rightName: string }
) {
  if (treeNodeBox.dataStructureGraphNode) {
    const leftChild = treeNodeBox.dataStructureGraphNode?.childDataStructureGraphNodes[treeNodeBox.leftFieldPosition]
    const rightChild = treeNodeBox.dataStructureGraphNode?.childDataStructureGraphNodes[treeNodeBox.rightFieldPosition]
    if (leftChild && rightChild) {
      const leftTreeNodeBox: TreeNodeBox = {
        dataStructureGraphNode: leftChild,
        slotInDepth: treeNodeBox.slotInDepth * 2,
        depth: treeNodeBox.depth + 1,
        treeRow,
        height: (leftChild.childDataStructureGraphNodes.length - 1) * SVG.cellHeight,
        valueFieldPosition: getFieldIndex(leftChild, component.valueName),
        leftFieldPosition: getFieldIndex(leftChild, component.leftName),
        rightFieldPosition: getFieldIndex(leftChild, component.rightName)
      }

      const rightTreeNodeBox: TreeNodeBox = {
        dataStructureGraphNode: rightChild,
        slotInDepth: treeNodeBox.slotInDepth * 2 + 1,
        depth: treeNodeBox.depth + 1,
        treeRow,
        height: (rightChild.childDataStructureGraphNodes.length - 1) * SVG.cellHeight,
        valueFieldPosition: getFieldIndex(rightChild, component.valueName),
        leftFieldPosition: getFieldIndex(rightChild, component.leftName),
        rightFieldPosition: getFieldIndex(rightChild, component.rightName)
      }

      const leftDepth = processChildNode(leftTreeNodeBox, treeNodeBox, { treeRow, side: 'left' }, structures, component)
      const rightDepth = processChildNode(rightTreeNodeBox, treeNodeBox, { treeRow, side: 'right' }, structures, component)
      return Math.max(leftDepth, rightDepth)
    }
  }
  return treeNodeBox.depth
}

export function createTreeNodeBoxesAndChildFieldPointers (
  rootDataStructureGraphNode: DataStructureGraphNode,
  treeDataStructureGraphNodes: DataStructureGraphNode[],
  yCoordinatesByTreeRowAndDepth: number[][],
  treeRowWidths: number[],
  component: { nodeClassNames: ReadonlySet<string>, valueName: string, leftName: string, rightName: string }
) {
  // get all variables that point to a node
  const variableDataStructureGraphNodes = getVariablePointers(rootDataStructureGraphNode, component.nodeClassNames)

  // collect nodes
  const treeNodeDataStructureGraphNodes = treeDataStructureGraphNodes
    .flatMap(tree =>
      tree.childDataStructureGraphNodes.filter(child => child.traceElement?.kind === 'HeapObject' && component.nodeClassNames.has(child.traceElement.type))
    )
  treeNodeDataStructureGraphNodes.push(...variableDataStructureGraphNodes
    .filter(pointer => (pointer.traceElement as Var).value.kind === 'ReferenceVal' && pointer.childDataStructureGraphNodes[0])
    .map(pointer => pointer.childDataStructureGraphNodes[0]))

  let treeRow = 0
  const structures = {
    treeNodeBoxes: [] as TreeNodeBox[],
    childFieldPointers: [] as ChildFieldPointer[],
    yCoordinatesByTreeRowAndDepth
  }

  treeNodeDataStructureGraphNodes.forEach(node => {
    if (!structures.treeNodeBoxes.find(treeNodeBox => (treeNodeBox.dataStructureGraphNode?.traceElement as HeapObject).id === (node.traceElement as HeapObject).id)) {
      yCoordinatesByTreeRowAndDepth.push([
        yCoordinatesByTreeRowAndDepth.length >= 1
          ? yCoordinatesByTreeRowAndDepth[treeRow - 1][yCoordinatesByTreeRowAndDepth[treeRow - 1].length - 1] - LAYOUT.nodes.distanceBetween + LAYOUT.distanceBetweenTrees
          : LAYOUT.nodes.yOrigin
      ])
      const nrOfNodes = structures.treeNodeBoxes.push({
        dataStructureGraphNode: node,
        slotInDepth: 0,
        depth: 0,
        treeRow,
        height: (node.childDataStructureGraphNodes.length - 1) * SVG.cellHeight,
        valueFieldPosition: getFieldIndex(node, component.valueName),
        leftFieldPosition: getFieldIndex(node, component.leftName),
        rightFieldPosition: getFieldIndex(node, component.rightName)
      })
      updateLevelCoordinates(structures.treeNodeBoxes[nrOfNodes - 1], structures.yCoordinatesByTreeRowAndDepth)
      const depth = exploreTree(structures.treeNodeBoxes[nrOfNodes - 1], treeRow, structures, component)
      if (treeRow < treeRowWidths.length) {
        treeRowWidths[treeRow] = calcTreeWidth(depth)
      } else {
        treeRowWidths.push(calcTreeWidth(depth))
      }
      treeRow++
    }
  })

  return {
    treeNodeBoxes: structures.treeNodeBoxes,
    childFieldPointers: structures.childFieldPointers,
    variableDataStructureGraphNodes: variableDataStructureGraphNodes
  }
}

export function createVariablePointers (
  treeNodeBoxes: TreeNodeBox[],
  variableDataStructureGraphNodes: DataStructureGraphNode[],
  treeDataStructureGraphNodes: DataStructureGraphNode[],
  component: { parentName: string, nodeClassNames: ReadonlySet<string> }
) {
  const variableToTreeNodePointers: VariableToTreeNodePointer[] = []
  treeNodeBoxes.forEach(treeNodeBox => {
    variableDataStructureGraphNodes.filter(pointer => (pointer.traceElement as Var).value.kind === 'ReferenceVal' &&
      ((pointer.traceElement as Var).value as unknown as ReferenceVal).reference ===
      (treeNodeBox.dataStructureGraphNode?.traceElement as HeapObject).id)
      .forEach((pointer, index) => variableToTreeNodePointers.push({
        name: pointer.label,
        sourceVariableIdentifier: rootVariableIdentifier(pointer.traceElement as Var, pointer.stackFrameNumber),
        sourceDataStructureGraphNode: pointer,
        targetTreeNodeBox: treeNodeBox,
        positionAtTarget: index,
        isNull: false,
        targetSlot: treeNodeBox.slotInDepth,
        targetDepth: treeNodeBox.depth,
        targetTreeRow: treeNodeBox.treeRow,
        changed: (pointer.traceElement as Var).changed
      }))
  })

  // find parent-pointer and move to front
  const parentPointer = variableToTreeNodePointers.find(pointer => pointer.name === component.parentName)
  if (parentPointer) {
    const otherPointers = variableToTreeNodePointers
      .filter(pointer => pointer.targetTreeNodeBox === parentPointer.targetTreeNodeBox && pointer.name !== component.parentName)
    parentPointer.positionAtTarget = 0
    otherPointers.forEach((pointer, index) => {
      pointer.positionAtTarget = index + 1
    })
  }
  // index for pointers that are null
  let nrOfNullPointers = 0

  // add variables of tree itself (root, ...)
  treeDataStructureGraphNodes.forEach(heapNode => {
    const dataStructure = heapNode.traceElement as HeapObject
    dataStructure.fields.filter(field => field.value.kind === 'ReferenceVal'
      ? treeNodeBoxes.some(treeNodeBox => (treeNodeBox.dataStructureGraphNode?.traceElement as HeapObject).id === (field.value as ReferenceVal).reference)
      : field.value.kind === 'NullVal' && component.nodeClassNames.has(field.type))
      .slice()
      .reverse()
      .forEach(field => {
        if (field.value.kind === 'ReferenceVal') {
          const fieldReference = field.value.reference
          // increment indices of all other pointers to same node, so list-pointers are displayed first
          variableToTreeNodePointers.filter(pointer =>
            (pointer.targetTreeNodeBox?.dataStructureGraphNode?.traceElement as HeapObject | undefined)?.id === fieldReference)
            .forEach(pointer => {
              pointer.positionAtTarget++
            })
            // find node and add entry
          const targetTreeNodeBox = treeNodeBoxes.find(candidateTreeNodeBox =>
            (candidateTreeNodeBox.dataStructureGraphNode?.traceElement as HeapObject).id === fieldReference)
          if (targetTreeNodeBox) {
            variableToTreeNodePointers.push({
              name: field.name,
              sourceVariableIdentifier: heapObjectFieldIdentifier(dataStructure, field),
              sourceDataStructureGraphNode: heapNode,
              targetTreeNodeBox: targetTreeNodeBox,
              positionAtTarget: 0,
              isNull: false,
              targetSlot: targetTreeNodeBox.slotInDepth,
              targetDepth: targetTreeNodeBox.depth,
              targetTreeRow: targetTreeNodeBox.treeRow,
              changed: field.changed
            })
          }
        } else if (field.value.kind === 'NullVal') {
          variableToTreeNodePointers.push({
            name: field.name,
            sourceVariableIdentifier: heapObjectFieldIdentifier(dataStructure, field),
            sourceDataStructureGraphNode: heapNode,
            positionAtTarget: nrOfNullPointers,
            isNull: true,
            targetSlot: LAYOUT.pointers.null.index,
            targetDepth: 0,
            targetTreeRow: 0,
            changed: field.changed
          })
          nrOfNullPointers++
        }
      })
  })

  // create index-map to keep track of null-pointer's index on each level
  const indexMap = new Map()
  indexMap.set(0, nrOfNullPointers - 1)
  // variables null pointers (parent, ...)
  variableDataStructureGraphNodes
    .filter(pointer => (pointer.traceElement as Var).value.kind === 'NullVal')
    .forEach(pointer => {
      const sourceVariableIdentifier = rootVariableIdentifier(pointer.traceElement as Var, pointer.stackFrameNumber)
      const pointerSelection = select(`#${HTML.ids.prefixes.pointer}-${sourceVariableIdentifier}`)
      const targetDepth = pointerSelection.empty() || !pointerSelection.datum() ? 0 : ((pointerSelection.datum() as VariableToTreeNodePointer).targetDepth)
      const targetTreeRow = pointerSelection.empty() || !pointerSelection.datum() ? 0 : ((pointerSelection.datum() as VariableToTreeNodePointer).targetTreeRow)
      if (targetDepth && !indexMap.has(targetDepth)) {
        indexMap.set(targetDepth, 0)
      } else {
        indexMap.set(targetDepth, indexMap.get(targetDepth) + 1)
      }
      variableToTreeNodePointers.push({
        name: (pointer.traceElement as Var).name as string,
        sourceVariableIdentifier,
        sourceDataStructureGraphNode: pointer,
        positionAtTarget: indexMap.get(targetDepth),
        isNull: true,
        targetSlot: LAYOUT.pointers.null.index,
        targetDepth,
        targetTreeRow,
        changed: (pointer.traceElement as Var).changed
      })
    })
  return variableToTreeNodePointers
}

// adds changed flag to children of nodes and moves left and right children to the end of the children-array
export function processChildren (
  treeNodeBoxes: TreeNodeBox[],
  component: { leftName: string, rightName: string }
) {
  treeNodeBoxes
    .map(treeNodeBox => treeNodeBox.dataStructureGraphNode)
    .filter(node => node && node.traceElement?.kind === 'HeapObject')
    .forEach(node => {
      setChildChangedFlags(node!)

      const leftIndex = getFieldIndex(node!, component.leftName)
      const rightIndex = getFieldIndex(node!, component.rightName)

      if (leftIndex >= 0 && node!.childDataStructureGraphNodes[leftIndex]) {
        node!.childDataStructureGraphNodes[leftIndex].label = component.leftName
        moveElemInArray(node!.childDataStructureGraphNodes, leftIndex, -1)
        moveElemInArray(node!.childChangedFlags, leftIndex, -1)
      }

      if (rightIndex >= 0 && node!.childDataStructureGraphNodes[rightIndex]) {
        const rightIndexUpdated = rightIndex > leftIndex ? rightIndex - 1 : rightIndex
        node!.childDataStructureGraphNodes[rightIndexUpdated].label = component.rightName
        moveElemInArray(node!.childDataStructureGraphNodes, rightIndexUpdated, -1)
        moveElemInArray(node!.childChangedFlags, rightIndexUpdated, -1)
      }
    })
}
