import { HeapTreeNode } from '../heapBFS'

/**
 * interface for a node in the tree
 * node: HeapNode of node or undefined if used as null child-pointer in ChildPointer
 * index: index of node in its tree level
 * level: level of the node in the tree
 * treeLevel: level the node containing tree is on
 */
export interface TreeNode {
  node?: HeapTreeNode,
  index: number,
  level: number,
  treeLevel: number,
  height: number,
  valFieldIndex: number,
  leftFieldIndex: number,
  rightFieldIndex: number
}

/**
 * interface for child pointers
 * parent: origin node, node inside TreeNode must not be null
 * child: child node, node inside TreeNode may be null if pointer is null
 * direction: 'left' if it's the left child, 'right' if it's the right one
 * changed: true iff the pointer has changed in the last step
 */
export interface ChildPointer {
  parent: TreeNode,
  child: TreeNode,
  direction: 'left' | 'right',
  changed: boolean
}

/**
 * interface for pointers to nodes
 * name: name of the pointer
 * node: TreeNode which the pointer references, may be null if pointer is null
 * index: this pointers index at the node it's referencing (pointers pointing to the same node are ordered and offset)
 * isNull: true iff pointer is null
 * nodeIndex: shortcut for the node's index, should be the same as node.index if node is not null
 * nodeLevel: shortcut for the node's level, should be the same as node.level if node is not null
 * inTree: true iff referenced node is in tree
 * changed: true iff pointer has changed in the last step
 */
export interface TreeNodePointer {
  name: string,
  methodOrParentId: string,
  parent: HeapTreeNode,
  node?: TreeNode,
  index: number,
  isNull: boolean,
  nodeIndex: number,
  nodeLevel: number,
  treeLevel: number,
  changed: boolean
}
