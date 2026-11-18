import { DataStructureGraphNode } from './dataStructureGraph'

/**
 * Fields shared by the pointers that the Array View, the List View, and the Tree View draw as an arrow from a variable to a box:
 * `VariableToArrayPointer`, `VariableToListNodePointer` and `VariableToTreeNodePointer`. The variable is where the pointer
 * is stored: a local variable, a static field, or (List and Tree only) a field of the list or tree object. The box it points to,
 * and where the arrow is drawn, are declared by each pointer type.
 *
 * Example: for `Node head = list.first;` in `main`, the variable is the local `head` (`name: 'head'`,
 * `sourceVariableIdentifier: 'local_0_head'`).
 */
export interface VariableToBoxPointer {
  /** Name of the variable or field that stores the pointer, shown as the arrow's label. */
  name: string,
  /**
   * Official trace identifier of that variable or field, the same as in the Memory View, e.g. `local_0_head` for a
   * local, `static_StaticList_head` for a static field, or `obj_12-first` for a field of the object with id 12.
   * Used as the D3 data key and in the arrow's DOM id, so it must be unique among the drawn pointers.
   */
  sourceVariableIdentifier: string,
  /**
   * Data-structure graph node that stores the pointer: the node of the local variable or static field, or, for a
   * field of the list or tree object, the node of that object. Its trace element kind (`Var` or `HeapObject`)
   * tells which of these it is; the hover and the arrow's description depend on it.
   */
  sourceDataStructureGraphNode: DataStructureGraphNode,
  /** `true` if the variable holds `null`; the pointer then has no target box and its arrow is hidden. */
  isNull: boolean,
  /** `true` if the variable's value changed in the last step; the arrow and its label are then drawn in red. */
  changed: boolean
}
