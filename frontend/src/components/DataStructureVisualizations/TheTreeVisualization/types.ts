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
 * A pointer drawn as an arrow from where it is stored (its source) to the tree node it references (its target).
 * Example: for `static Node root;`, the source is the static field `root` and the target is the tree node of
 * the referenced object.
 *
 * name: name of the variable or field that stores the pointer, shown as the arrow's label
 * sourceVariableIdentifier: identifier of that variable or field, the same as in the memory view: a local variable
 *   (`roots:l_0_cur`), a static field (`roots:s_StaticTree_root`) or a field of the tree object (`o_12:root`)
 * source: heap-tree node that stores the pointer: the root variable, or the tree object whose field holds it
 * target: tree node the pointer references; undefined if the pointer is null
 * index: this pointer's index at the node it's referencing (pointers to the same node are ordered and offset)
 * isNull: true iff pointer is null
 * nodeIndex: shortcut for the target's index, the same as target.index if target is not undefined
 * nodeLevel: shortcut for the target's level, the same as target.level if target is not undefined
 * treeLevel: shortcut for the target's tree level
 * changed: true iff pointer has changed in the last step
 */
export interface TreeNodePointer {
  name: string,
  sourceVariableIdentifier: string,
  source: HeapTreeNode,
  target?: TreeNode,
  index: number,
  isNull: boolean,
  nodeIndex: number,
  nodeLevel: number,
  treeLevel: number,
  changed: boolean
}
