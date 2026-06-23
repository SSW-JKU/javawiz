import { HeapTreeNode } from '../heapBFS'

/**
 * interface for a node in the list
 * node: HeapNode of node or null if used as null to-pointer in NextPointer
 * index: index of node in list
 * inList: true if node is in list, false otherwise
 * level: level of node in visualization, 0 when in list
 */
export interface ListNode {
  node?: HeapTreeNode,
  index: number,
  lists: HeapTreeNode[],
  level: number,
  referenceValue?: ReferenceNode,
  height: number,
  valFieldIndex: number,
  nextFieldIndex: number
}

/**
 * interface for next pointers
 * from: origin node, node inside ListNode must not be null
 * to: next node, node inside ListNode may be null if pointer is null
 * changed: true iff the pointer has changed in the last step
 */
export interface NextPointer {
  from: ListNode,
  to: ListNode,
  changed: boolean
}

/**
 * interface for pointers to nodes
 * name: name of the pointer
 * node: ListNode which the pointer references, may be null if pointer is null
 * methodOrParentId: method or id of the parent of the pointer
 * index: this pointers index at the node it's referencing (pointers pointing to the same node are ordered and offset)
 * isNull: true iff pointer is null
 * nodeIndex: shortcut for the node's index, should be the same as node.index if node is not null
 * inList: true iff referenced node is in list
 * changed: true iff the pointer has changed in the last step
 */
export interface ListNodePointer {
  name: string,
  methodOrParentId: string,
  parent: HeapTreeNode,
  node?: ListNode,
  index: number,
  isNull: boolean,
  nodeIndex: number,
  changed: boolean,
  isListPointer: boolean
}

/**
 * interface for referenced values
 * node: node the value is positioned below
 * reference: heap node of the value
 */
export interface ReferenceNode {
  node: ListNode,
  reference: HeapTreeNode
}
