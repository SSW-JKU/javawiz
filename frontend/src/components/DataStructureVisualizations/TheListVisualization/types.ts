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
 * A pointer drawn as an arrow from where it is stored (its source) to the list node it references (its target).
 * Example: for `Node head = list.first;` in `main`, the source is the local variable `head` and the target is
 * the list node of the referenced object.
 *
 * name: name of the variable or field that stores the pointer, shown as the arrow's label
 * sourceVariableIdentifier: identifier of that variable or field, the same as in the memory view: a local variable
 *   (`roots:l_0_head`), a static field (`roots:s_StaticList_head`) or a field of the list object (`o_12:first`)
 * source: heap-tree node that stores the pointer: the root variable, or the list object whose field holds it
 * target: list node the pointer references; undefined if the pointer is null
 * index: this pointer's index at the node it's referencing (pointers to the same node are ordered and offset)
 * isNull: true iff pointer is null
 * nodeIndex: shortcut for the target's index, the same as target.index if target is not undefined
 * changed: true iff the pointer has changed in the last step
 * isListPointer: true iff the pointer is a field of the list object (source is a heap object), not a variable
 */
export interface ListNodePointer {
  name: string,
  sourceVariableIdentifier: string,
  source: HeapTreeNode,
  target?: ListNode,
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
