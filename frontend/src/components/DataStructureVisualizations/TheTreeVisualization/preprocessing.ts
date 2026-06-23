import { ChildPointer, TreeNode, TreeNodePointer } from './types'
import { HeapObject, LocalVar, ReferenceVal, Var } from '@/dto/TraceState'
import { hasSuccessorPointerChanged } from './child-pointer-utils'
import { HeapTreeNode } from '../heapBFS'
import { HTML, LAYOUT } from './constants'
import { select } from 'd3-selection'
import { REGEX, SVG } from '../constants'
import { moveElemInArray } from '../utils'
import { getVariablePointers } from '../preprocessing-utils'
import { getFieldIndex, setChangesInFields } from '../heap-tree-node-utils'
import { calcTreeWidth } from './layout'

function updateLevelCoordinates (childNode: TreeNode, levelCoordinates: number[][]) {
  const treeLevelCoordinates = levelCoordinates[childNode.treeLevel]
  const levelDepth = treeLevelCoordinates[childNode.level] + childNode.height + LAYOUT.nodes.distanceBetween
  if (childNode.level + 1 >= treeLevelCoordinates.length) {
    treeLevelCoordinates.push(levelDepth)
  } else if (levelDepth > treeLevelCoordinates[childNode.level + 1]) {
    treeLevelCoordinates[childNode.level + 1] = levelDepth
  }
}

// processes child node: adds it to the visualization if needed and add child-pointer
function processChildNode (
  childNode: TreeNode,
  parentNode: TreeNode,
  layoutInfo: {
    treeLevel: number,
    direction: 'left' | 'right'
  },
  structures: {
    treeNodes: TreeNode[],
    childPointers: ChildPointer[],
    levelCoordinates: number[][]
  },
  component: { valueName: string, leftName: string; rightName: string }
) {
  let actualChildNode: TreeNode = childNode
  let depth = parentNode.level
  if (childNode.node?.element?.kind === 'HeapObject') {
    const existing = structures.treeNodes.find(treeNode =>
      (treeNode.node?.element as HeapObject).id === (childNode.node!.element as HeapObject).id)
    if (existing) {
      actualChildNode = existing
    } else {
      structures.treeNodes.push(actualChildNode)
      updateLevelCoordinates(childNode, structures.levelCoordinates)
      depth = exploreTree(childNode, layoutInfo.treeLevel, structures, component)
    }
  } else {
    actualChildNode.node = undefined
  }
  structures.childPointers.push({
    parent: parentNode,
    child: actualChildNode!,
    direction: layoutInfo.direction,
    changed: hasSuccessorPointerChanged(layoutInfo.direction === 'left' ? component.leftName : component.rightName, parentNode)
  })
  return depth
}

// explores tree and adds tree-nodes to given array
export function exploreTree (
  treeNode: TreeNode,
  treeLevel: number,
  structures: {
    treeNodes: TreeNode[],
    childPointers: ChildPointer[],
    levelCoordinates: number[][]
  },
  component: { valueName: string, leftName: string; rightName: string }
) {
  if (treeNode.node) {
    const leftChild = treeNode.node?.children[treeNode.leftFieldIndex]
    const rightChild = treeNode.node?.children[treeNode.rightFieldIndex]
    if (leftChild && rightChild) {
      const leftNode: TreeNode = {
        node: leftChild,
        index: treeNode.index * 2,
        level: treeNode.level + 1,
        treeLevel,
        height: (leftChild.children.length - 1) * SVG.cellHeight,
        valFieldIndex: getFieldIndex(leftChild, component.valueName),
        leftFieldIndex: getFieldIndex(leftChild, component.leftName),
        rightFieldIndex: getFieldIndex(leftChild, component.rightName)
      }

      const rightNode: TreeNode = {
        node: rightChild,
        index: treeNode.index * 2 + 1,
        level: treeNode.level + 1,
        treeLevel,
        height: (rightChild.children.length - 1) * SVG.cellHeight,
        valFieldIndex: getFieldIndex(rightChild, component.valueName),
        leftFieldIndex: getFieldIndex(rightChild, component.leftName),
        rightFieldIndex: getFieldIndex(rightChild, component.rightName)
      }

      const leftDepth = processChildNode(leftNode, treeNode, { treeLevel, direction: 'left' }, structures, component)
      const rightDepth = processChildNode(rightNode, treeNode, { treeLevel, direction: 'right' }, structures, component)
      return Math.max(leftDepth, rightDepth)
    }
  }
  return treeNode.level
}

export function createTreeAndChildPointerStructs (
  heapTree: HeapTreeNode,
  trees: HeapTreeNode[],
  levelCoordinates: number[][],
  levelWidths: number[],
  component: { nodeClassName: string, valueName: string, leftName: string, rightName: string }
) {
  // get all variables that point to a node
  const pointers = getVariablePointers(heapTree, component.nodeClassName)

  // collect nodes
  const heapNodes = trees
    .flatMap(tree =>
      tree.children.filter(child => child.element?.kind === 'HeapObject' && child.element.type === component.nodeClassName)
    )
  heapNodes.push(...pointers.filter(pointer => (pointer.element as Var).value.kind === 'ReferenceVal').map(pointer => pointer.children[0]))

  let treeLevel = 0
  const structures = {
    treeNodes: [] as TreeNode[],
    childPointers: [] as ChildPointer[],
    levelCoordinates
  }

  heapNodes.forEach(node => {
    if (!structures.treeNodes.find(treeNode => (treeNode.node?.element as HeapObject).id === (node.element as HeapObject).id)) {
      levelCoordinates.push([
        levelCoordinates.length >= 1
          ? levelCoordinates[treeLevel - 1][levelCoordinates[treeLevel - 1].length - 1] - LAYOUT.nodes.distanceBetween + LAYOUT.distanceBetweenTrees
          : LAYOUT.nodes.yOrigin
      ])
      const nrOfNodes = structures.treeNodes.push({
        node,
        index: 0,
        level: 0,
        treeLevel,
        height: (node.children.length - 1) * SVG.cellHeight,
        valFieldIndex: getFieldIndex(node, component.valueName),
        leftFieldIndex: getFieldIndex(node, component.leftName),
        rightFieldIndex: getFieldIndex(node, component.rightName)
      })
      updateLevelCoordinates(structures.treeNodes[nrOfNodes - 1], structures.levelCoordinates)
      const depth = exploreTree(structures.treeNodes[nrOfNodes - 1], treeLevel, structures, component)
      if (treeLevel < levelWidths.length) {
        levelWidths[treeLevel] = calcTreeWidth(depth)
      } else {
        levelWidths.push(calcTreeWidth(depth))
      }
      treeLevel++
    }
  })

  return {
    treeNodes: structures.treeNodes,
    childPointers: structures.childPointers,
    pointers
  }
}

export function createPointerStructure (
  treeNodes: TreeNode[],
  pointers: HeapTreeNode[],
  trees: HeapTreeNode[],
  component: { parentName: string, nodeClassName: string }
) {
  const nodePointers: TreeNodePointer[] = []
  treeNodes.forEach(node => {
    pointers.filter(pointer => (pointer.element as Var).value.kind === 'ReferenceVal' &&
      ((pointer.element as Var).value as unknown as ReferenceVal).reference ===
      (node.node?.element as HeapObject).id)
      .forEach((pointer, index) => nodePointers.push({
        name: pointer.name,
        methodOrParentId: (pointer.element as LocalVar).method.replace(REGEX.illegalCssSelector, '') + (pointer.stackFrameDepth ?? ''),
        parent: pointer,
        node,
        index,
        isNull: false,
        nodeIndex: node.index,
        nodeLevel: node.level,
        treeLevel: node.treeLevel,
        changed: (pointer.element as Var).changed
      }))
  })

  // find parent-pointer and move to front
  const parentPointer = nodePointers.find(pointer => pointer.name === component.parentName)
  if (parentPointer) {
    const otherPointers = nodePointers
      .filter(pointer => pointer.node === parentPointer.node && pointer.name !== component.parentName)
    parentPointer.index = 0
    otherPointers.forEach((pointer, index) => {
      pointer.index = index + 1
    })
  }
  // index for pointers that are null
  let nrOfNullPointers = 0

  // add variables of tree itself (root, ...)
  trees.forEach(heapNode => {
    const dataStructure = heapNode.element as HeapObject
    dataStructure.fields.filter(field => field.type === component.nodeClassName)
      .slice()
      .reverse()
      .forEach(field => {
        if (field.value.kind === 'ReferenceVal') {
          const fieldReference = field.value.reference
          // increment indices of all other pointers to same node, so list-pointers are displayed first
          nodePointers.filter(pointer =>
            (pointer.node?.node?.element as HeapObject | undefined)?.id === fieldReference)
            .forEach(pointer => {
              pointer.index++
            })
            // find node and add entry
          const node = treeNodes.find(node =>
            (node.node?.element as HeapObject).id === fieldReference)
          if (node) {
            nodePointers.push({
              name: field.name,
              methodOrParentId: String(dataStructure.id),
              parent: heapNode,
              node,
              index: 0,
              isNull: false,
              nodeIndex: node.index,
              nodeLevel: node.level,
              treeLevel: node.treeLevel,
              changed: field.changed
            })
          }
        } else if (field.value.kind === 'NullVal') {
          nodePointers.push({
            name: field.name,
            methodOrParentId: String(dataStructure.id),
            parent: heapNode,
            index: nrOfNullPointers,
            isNull: true,
            nodeIndex: LAYOUT.pointers.null.index,
            nodeLevel: 0,
            treeLevel: 0,
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
  pointers
    .filter(pointer => (pointer.element as Var).value.kind === 'NullVal')
    .forEach(pointer => {
      const methodOrParentId = (pointer.element as LocalVar).method.replace(REGEX.illegalCssSelector, '') + (pointer.stackFrameDepth ?? '')
      const pointerSelection = select(`#${HTML.ids.prefixes.pointer}-${pointer.name}-${methodOrParentId}`)
      const nodeLevel = pointerSelection.empty() || !pointerSelection.datum() ? 0 : ((pointerSelection.datum() as TreeNodePointer).nodeLevel)
      const treeLevel = pointerSelection.empty() || !pointerSelection.datum() ? 0 : ((pointerSelection.datum() as TreeNodePointer).treeLevel)
      if (nodeLevel && !indexMap.has(nodeLevel)) {
        indexMap.set(nodeLevel, 0)
      } else {
        indexMap.set(nodeLevel, indexMap.get(nodeLevel) + 1)
      }
      nodePointers.push({
        name: (pointer.element as Var).name as string,
        methodOrParentId,
        parent: pointer,
        index: indexMap.get(nodeLevel),
        isNull: true,
        nodeIndex: LAYOUT.pointers.null.index,
        nodeLevel,
        treeLevel,
        changed: (pointer.element as Var).changed
      })
    })
  return nodePointers
}

// adds changed flag to children of nodes and moves left and right children to the end of the children-array
export function processChildren (
  treeNodes: TreeNode[],
  component: { leftName: string, rightName: string }
) {
  treeNodes
    .map(node => node.node)
    .filter(node => node && node.element?.kind === 'HeapObject')
    .forEach(node => {
      setChangesInFields(node!)

      const leftIndex = getFieldIndex(node!, component.leftName)
      const rightIndex = getFieldIndex(node!, component.rightName)

      if (leftIndex >= 0 && node!.children[leftIndex]) {
        node!.children[leftIndex].name = component.leftName
        moveElemInArray(node!.children, leftIndex, -1)
        moveElemInArray(node!.changesInFields, leftIndex, -1)
      }

      if (rightIndex >= 0 && node!.children[rightIndex]) {
        const rightIndexUpdated = rightIndex > leftIndex ? rightIndex - 1 : rightIndex
        node!.children[rightIndexUpdated].name = component.rightName
        moveElemInArray(node!.children, rightIndexUpdated, -1)
        moveElemInArray(node!.changesInFields, rightIndexUpdated, -1)
      }
    })
}
