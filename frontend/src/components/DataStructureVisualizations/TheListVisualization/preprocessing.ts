import { HeapTreeNode } from '../heapBFS'
import { ListNode, ListNodePointer, NextPointer, ReferenceNode } from './types'
import { HeapObject, LocalVar, ReferenceVal, Var } from '@/dto/TraceState'
import { hasNextPointerChanged } from './pointer-utils'
import { BaseType, Selection } from 'd3-selection'
import { HTML, LAYOUT } from './constants'
import { REGEX, SVG } from '../constants'
import { moveElemInArray } from '../utils'
import { getVariablePointers } from '../preprocessing-utils'
import { getFieldIndex, setChangesInFields } from '../heap-tree-node-utils'

function processNode (
  heapNode: HeapTreeNode & { list?: HeapTreeNode },
  positionInfo: {
    index: number,
    level: number
  },
  iterationInfo: {
    current: HeapTreeNode,
    previous: ListNode | undefined
  },
  structures: {
    nodes: ListNode[],
    referenceNodes: ReferenceNode[],
    nextPointers: NextPointer[],
    dummyNodes: ListNode[]
  },
  component: { nodeClassName: string, nextName: string, valName: string }
) {
  // add node
  const lists = heapNode.list ? [heapNode.list] : []
  let nodeHeight = SVG.cellHeight * iterationInfo.current.children.length
  const listNode: ListNode = {
    node: iterationInfo.current,
    index: positionInfo.index,
    lists,
    level: positionInfo.level,
    height: nodeHeight,
    valFieldIndex: getFieldIndex(iterationInfo.current, component.valName),
    nextFieldIndex: getFieldIndex(iterationInfo.current, component.nextName)
  }
  structures.nodes.push(listNode)
  // handle reference node
  const nrOfFieldsInReference = processReferenceNode(listNode, structures.referenceNodes)
  if (nrOfFieldsInReference > 0) {
    nodeHeight += (nrOfFieldsInReference + 1) * SVG.cellHeight
  }
  // add next pointer
  const currentListNode = structures.nodes[structures.nodes.length - 1]
  if (iterationInfo.previous) {
    structures.nextPointers.push({
      from: iterationInfo.previous,
      to: currentListNode,
      changed: hasNextPointerChanged(component.nextName, iterationInfo.previous)
    })
  }
  const nextHeapNode: HeapTreeNode | undefined = iterationInfo.current.children[currentListNode.nextFieldIndex]
  const nextListNode = structures.nodes.find(node => (node.node?.element as HeapObject)?.id === (nextHeapNode?.element as HeapObject)?.id)
  let nextNode: HeapTreeNode | undefined
  if (nextListNode) {
    // next node is already existing
    // create next pointer
    structures.nextPointers.push({
      from: currentListNode,
      to: nextListNode,
      changed: hasNextPointerChanged(component.nextName, currentListNode)
    })
    // update indexes of nodes before and after this node, if it's connected to some list
    if (nextListNode.lists.length > 0 && nextListNode.level !== currentListNode.level) {
      const nrOfNewNodes = positionInfo.index + 1
      const indexDifference = nextListNode.index
      // update indexes of nodes after this one
      const nodesToCheck = structures.nodes.concat(structures.dummyNodes)
      nodesToCheck.filter(n => n.index >= indexDifference && n.lists.some(list => nextListNode.lists.includes(list))).forEach(n => {
        n.index += nrOfNewNodes
        n.lists.push(...lists)
      })

      // update indexes of nodes on same level
      structures.nodes.filter(n => n.level === positionInfo.level).forEach(n => {
        n.index += indexDifference
        n.lists.push(...nextListNode.lists)
      })
    }
  } else {
    // next node does not exist yet
    if (nextHeapNode && nextHeapNode.element?.kind === 'HeapObject') {
      // set nextNode to be processed
      nextNode = nextHeapNode
    } else {
      // if next node is null, add dummy next pointer
      const dummyNode = { index: positionInfo.index + 1, lists, level: positionInfo.level, height: 0, valFieldIndex: -1, nextFieldIndex: -1 }
      structures.dummyNodes.push(dummyNode)
      structures.nextPointers.push({
        from: currentListNode,
        to: dummyNode,
        changed: hasNextPointerChanged(component.nextName, currentListNode)
      })
    }
  }
  return { nextNode, currentListNode, nodeHeight }
}

export function createListAndNextPointerStructs (
  heapTree: HeapTreeNode,
  lists: HeapTreeNode[],
  levelCoordinates: number[],
  component: { nodeClassName: string, nextName: string, valName: string }
) {
  const nodes: ListNode[] = []
  const referenceNodes: ReferenceNode[] = []
  const dummyNodes: ListNode[] = []
  const nextPointers: NextPointer[] = []

  // get all variables that point to a node
  const pointers = getVariablePointers(heapTree, component.nodeClassName)

  // collect nodes
  const heapNodes: (HeapTreeNode & { list?: HeapTreeNode })[] = lists.flatMap(list =>
    list.children.filter(child => child.element?.kind === 'HeapObject' && child.element.type === component.nodeClassName)
      .map(node => {
        return { ...node, list }
      })
  )
  heapNodes.push(...pointers.filter(pointer => (pointer.element as Var).value.kind === 'ReferenceVal').map(pointer => pointer.children[0]))

  // process nodes
  let level = 0
  heapNodes.forEach(heapNode => {
    const node = heapNode.element as HeapObject
    // create node, if it's not in the visualization
    if (!nodes.find(n => (n.node?.element as HeapObject).id === node.id)) {
      let index = 0
      let current: HeapTreeNode | undefined = heapNode
      let previous: ListNode | undefined
      let maxNodeHeightInLevel = 0
      previous = undefined
      while (current) {
        const ret = processNode(
          heapNode,
          { index, level },
          { current, previous },
          { nodes, referenceNodes, nextPointers, dummyNodes },
          component
        )
        current = ret.nextNode
        previous = ret.currentListNode
        if (ret.nodeHeight > maxNodeHeightInLevel) {
          maxNodeHeightInLevel = ret.nodeHeight
        }
        index++
      }
      levelCoordinates.push(levelCoordinates[levelCoordinates.length - 1] + maxNodeHeightInLevel + LAYOUT.nodes.distances.between)
      level++
    }
  })
  return { nodes, pointers, nextPointers, referenceNodes }
}

// adds changed flag to children of nodes and moves value and next children to the beginning/end of the children-array
export function processChildren (nodes: (ListNode | ReferenceNode)[], component?: { valName: string, nextName: string }) {
  nodes
    .map(node => (node as ReferenceNode).reference ?? node.node)
    .filter(node => node && node.element?.kind === 'HeapObject')
    .forEach(node => {
      setChangesInFields(node!)

      if (component) {
        const nextIndex = getFieldIndex(node!, component.nextName)
        const valueIndex = getFieldIndex(node!, component.valName)

        if (nextIndex !== -1) {
          node!.children[nextIndex].name = component.nextName
          moveElemInArray(node!.children, nextIndex, 0)
          moveElemInArray(node!.changesInFields, nextIndex, 0)
        }

        if (valueIndex !== -1) {
          const valueIndexUpdate = valueIndex < nextIndex ? valueIndex + 1 : valueIndex
          node!.children[valueIndexUpdate].name = component.valName
          moveElemInArray(node!.children, valueIndexUpdate, -1)
          moveElemInArray(node!.changesInFields, valueIndexUpdate, -1)
        }
      }
    })
}

export function createPointerStructure (
  svg: Selection<BaseType, unknown, HTMLElement, any>,
  nodes: ListNode[],
  pointers: HeapTreeNode[],
  lists: HeapTreeNode[],
  component: { prevName: string, nodeClassName: string }
) {
  // create data-structure for node pointers
  const nodePointers: ListNodePointer[] = nodes.flatMap(node =>
    pointers.filter(pointer => (pointer.element as Var).value.kind === 'ReferenceVal' &&
      ((pointer.element as Var).value as ReferenceVal).reference ===
      (node.node?.element as HeapObject).id)
      .map((pointer, index) => {
        return {
          name: pointer.name,
          methodOrParentId: (pointer.element as LocalVar).method.replace(REGEX.illegalCssSelector, '') + (pointer.stackFrameDepth ?? ''),
          parent: pointer,
          node,
          index,
          isNull: false,
          nodeIndex: node.index,
          changed: (pointer.element as Var).changed,
          isListPointer: false
        }
      })
  )

  // find prev-pointer and move to front
  const prevPointer = nodePointers.find(pointer => pointer.name === component.prevName)
  if (prevPointer) {
    const otherPointers = nodePointers
      .filter(pointer => pointer.node === prevPointer.node && pointer !== prevPointer)
    prevPointer.index = 0
    otherPointers.forEach((pointer, index) => {
      pointer.index = index + 1
    })
  }

  // index for pointers that are null
  let frontIndex = 0

  // add variables of tree itself (root, ...)
  lists.forEach(heapNode => {
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
          const node = nodes.find(node =>
            (node.node?.element as HeapObject).id === fieldReference)
          if (node) {
            nodePointers.push({
              name: field.name,
              methodOrParentId: String(dataStructure.id),
              parent: heapNode,
              node: node as ListNode,
              index: 0,
              isNull: false,
              nodeIndex: node.index,
              changed: field.changed,
              isListPointer: true
            })
          }
        } else if (field.value.kind === 'NullVal') {
          nodePointers.push({
            name: field.name,
            methodOrParentId: String(dataStructure.id),
            parent: heapNode,
            index: frontIndex,
            isNull: true,
            nodeIndex: -1,
            changed: field.changed,
            isListPointer: true
          })
          frontIndex++
        }
      })
  })

  // add null-pointers
  const backNodeIndex = Math.max(...nodes.map(node => node.index)) + 1
  let backIndex = 0
  pointers
    .filter(pointer => (pointer.element as Var).value.kind === 'NullVal')
    .forEach(pointer => {
      const methodOrParentId = (pointer.element as LocalVar).method.replace(REGEX.illegalCssSelector, '') + (pointer.stackFrameDepth ?? '')
      const pointerSelection = svg.select(`#${HTML.ids.prefixes.pointer}-${pointer.name}-${methodOrParentId}`)
      const nodeIndex = pointerSelection.empty()
        ? undefined
        : ((pointerSelection.datum() as ListNodePointer).nodeIndex)
      nodePointers.push({
        name: (pointer.element as Var).name as string,
        methodOrParentId,
        parent: pointer,
        index: (nodes.length === 0 || pointerSelection.empty() || nodeIndex === -1)
          ? frontIndex++
          : backIndex++,
        isNull: true,
        // if pointer existed and pointed to a node in the right half of the list, move to end
        nodeIndex: (nodes.length === 0 || pointerSelection.empty() || nodeIndex === -1 || nodeIndex! < (backNodeIndex / 2))
          ? -1
          : backNodeIndex,
        changed: (pointer.element as Var).changed,
        isListPointer: false
      })
    })
  return nodePointers
}

// checks if given ListNode has a reference value, if so it is stored inside the node and it's added to the reference nodes
// assumed to be called before arrangeNextAndValue(), returns number of fields in reference node
function processReferenceNode (listNode: ListNode, referenceNodes: ReferenceNode[]) {
  if (listNode.node && listNode.node.children[listNode.valFieldIndex]?.element?.kind === 'HeapObject') {
    const referenceHeapNode = listNode.node.children[listNode.valFieldIndex]
    let referenceNode = referenceNodes.find(refNode => refNode.reference === referenceHeapNode)
    if (!referenceNode) {
      referenceNode = { node: listNode, reference: referenceHeapNode }
      referenceNodes.push(referenceNode)
    }
    listNode.referenceValue = referenceNode
    return referenceNode.reference.children.length
  }
  return 0
}

/**
 * adds pointers for fields in given data structures
 * @param dataStructures array with data structures
 * @param nodes nodes of data structure
 * @param nodePointers array with pointers of nodes
 * @param nodeClassName name of the node class
 * @param addPointerFunctions functions to add pointers to pointer data structure
 */
export function addFieldPointers (
  dataStructures: HeapTreeNode[],
  nodes: ListNode[],
  nodePointers: ListNodePointer[],
  nodeClassName: string,
  addPointerFunctions: {
    addNormalPointer: (nodePointers: ListNodePointer[], field: Var, dataStructure: HeapObject, heapNode: HeapTreeNode, node: ListNode) => void,
    addNullPointer: (nodePointers: ListNodePointer[], field: Var, dataStructure: HeapObject, heapNode: HeapTreeNode, nrOfNullPointers: number) => void
  }
) {
  // index for pointers that are null
  let nrOfNullPointers = 0

  // add variables of tree itself (root, ...)
  dataStructures.forEach(heapNode => {
    const dataStructure = heapNode.element as HeapObject
    dataStructure.fields.filter(field => field.type === nodeClassName)
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
          const node = nodes.find(node =>
            (node.node?.element as HeapObject).id === fieldReference)
          if (node) {
            addPointerFunctions.addNormalPointer(nodePointers, field, dataStructure, heapNode, node)
          }
        } else if (field.value.kind === 'NullVal') {
          addPointerFunctions.addNullPointer(nodePointers, field, dataStructure, heapNode, nrOfNullPointers)
          nrOfNullPointers++
        }
      })
  })
  return nrOfNullPointers
}
