import { DataStructureGraphNode } from '../dataStructureGraph'
import { VariableToBoxPointer } from '../types'

/**
 * Box the Tree View draws for one tree node object (an object of a selected node class), or the placeholder that a
 * child field pointer points to when the child field does not reference an object (it is `null`, or it holds a
 * primitive value or an array). Placeholders are not drawn as boxes; they only give the pointer its position.
 *
 * Boxes are laid out as complete binary trees: each tree reachable from a variable or tree object gets its own
 * row (`treeRow`), and within a tree each box has a depth and a slot at that depth.
 */
export interface TreeNodeBox {
  /** Graph node of the tree node object; `undefined` for a placeholder. */
  dataStructureGraphNode?: DataStructureGraphNode,
  /**
   * Slot of the box at its depth, counted from the left as if the tree were complete: 0 … 2^depth − 1.
   * A left child gets slot `2 * parentSlot`, a right child `2 * parentSlot + 1`.
   */
  slotInDepth: number,
  /** Depth of the box in its tree: 0 for the root, 1 for its children, and so on. */
  depth: number,
  /** Which of the stacked trees the box belongs to: 0 for the top tree, 1 for the one below it, and so on. */
  treeRow: number,
  /**
   * Height of the box in SVG units: one cell per field, with the left and right fields sharing the bottom row.
   * Not meaningful for a placeholder.
   */
  height: number,
  /**
   * Position of the value field among the object's fields (in the order of the trace), or −1 if the object has no
   * such field or the box is a placeholder.
   */
  valueFieldPosition: number,
  /** Position of the left child field among the object's fields, or −1 if absent or a placeholder. */
  leftFieldPosition: number,
  /** Position of the right child field among the object's fields, or −1 if absent or a placeholder. */
  rightFieldPosition: number
}

/**
 * Pointer the Tree View draws from a tree node's own left or right child field to the box of the child it
 * references. A child field that does not reference an object (it is `null`, or it holds a primitive value or an
 * array) points to a placeholder box and is drawn like a `null` pointer: with a short line at its end instead of an
 * arrow head.
 */
export interface ChildFieldPointer {
  /** Box of the tree node whose field the pointer starts at; never a placeholder. */
  sourceTreeNodeBox: TreeNodeBox,
  /** Box of the referenced child; a placeholder (without graph node) if the field does not reference an object. */
  targetTreeNodeBox: TreeNodeBox,
  /** Which child field the pointer starts at: the left or the right one (as named in the view settings). */
  side: 'left' | 'right',
  /** True if the child field changed in the last step; the pointer is then drawn in the "changed" style (red). */
  changed: boolean
}

/**
 * Pointer the Tree View draws as an arrow from a variable to the tree node box it references. The variable is a
 * local variable, a static field, or a field of the tree object (e.g. `root`).
 * Example: for `static Node root;`, the source is the static field `root` and the target is the box of the
 * referenced object.
 *
 * The shared fields (name, source variable and graph node, null and changed state) are described in
 * `VariableToBoxPointer`. Examples of `sourceVariableIdentifier`: a local variable (`local_0_cur`), a static field
 * (`static_StaticTree_root`) or a field of the tree object (`obj_12-root`).
 *
 * The pointer is drawn to the left of the box at `targetSlot`, `targetDepth` and `targetTreeRow`. These are copies of
 * the target box's layout values, because a `null` pointer has no target but still needs a position.
 */
export interface VariableToTreeNodePointer extends VariableToBoxPointer {
  /** Box the pointer references; `undefined` if the pointer is `null`. */
  targetTreeNodeBox?: TreeNodeBox,
  /**
   * Stacking order among the pointers drawn at the same place, 0 at the top: pointers to the same box, or `null`
   * pointers drawn at the same depth. Fields of the tree object come first, then the parent variable named in the
   * view settings.
   */
  positionAtTarget: number,
  /**
   * Slot of the target box at its depth (see `TreeNodeBox.slotInDepth`). For a `null` pointer a negative fractional
   * slot (`LAYOUT.pointers.null.index`), which places it left of the leftmost slot.
   */
  targetSlot: number,
  /**
   * Depth of the target box in its tree. For a `null` pointer of a variable, the depth it was drawn at in the
   * previous step, so it stays in place (0 if it was not drawn); 0 for a `null` field of the tree object.
   */
  targetDepth: number,
  /** Tree row of the target box (see `TreeNodeBox.treeRow`); for a `null` pointer chosen like `targetDepth`. */
  targetTreeRow: number
}
