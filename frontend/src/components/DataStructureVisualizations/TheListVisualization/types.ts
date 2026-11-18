import { DataStructureGraphNode } from '../dataStructureGraph'
import { VariableToBoxPointer } from '../types'

/**
 * Box that the List View draws for one list node object (an object of a selected node class, e.g. `Node`), with one
 * row per field. A box without a graph node is the placeholder that a `null` next field points to: it is not drawn,
 * but gives the next field pointer's null marker a position one column to the right of its source box.
 */
export interface ListNodeBox {
  /** Graph node of the list node object; `undefined` for the placeholder of a `null` next field. */
  dataStructureGraphNode?: DataStructureGraphNode,
  /**
   * Grid column of the box, counted from 0 at the left. Boxes in the same row that follow each other through their
   * next fields have consecutive columns. When the next field of a chain's last node points into a list that is
   * already drawn in another row, the chain is moved right and the list's boxes from the target on are moved further
   * right, so that the chain's last box stands one column left of the box its next field points to.
   */
  column: number,
  /**
   * Grid row of the box, counted from 0 at the top. Each chain of nodes that is not reached through the next field of
   * an already drawn node gets its own row. The row's y coordinate in SVG units is `rowYCoordinates[row]`.
   */
  row: number,
  /**
   * Graph nodes of the list objects (objects of a selected list class, e.g. `MyList`) this box belongs to: the list
   * object whose field starts the box's chain of nodes, plus the list objects of chains it was joined with (see
   * `column`). Empty if the chain starts at a variable and was not joined with a list. Used to find the boxes whose
   * columns are shifted when two chains join.
   */
  containingListDataStructureGraphNodes: DataStructureGraphNode[],
  /**
   * Box of the object that the node's value field references, drawn below this box; `undefined` if the value field
   * does not reference an object with fields (it holds a primitive value, `null`, a string or an array) or does not
   * exist. Several list node boxes can share one value object box if their value fields reference the same object.
   */
  valueObjectBox?: ValueObjectBox,
  /** Height of the box in SVG units: one cell height per field; 0 for the placeholder of a `null` next field. */
  height: number,
  /**
   * Position of the value field in the fields of the node's trace element (the order before `processChildren` moves
   * the value field to the end); -1 if the node has no field with the configured value field name, and for the
   * placeholder.
   */
  valueFieldPosition: number,
  /**
   * Position of the next field in the fields of the node's trace element (the order before `processChildren` moves the
   * next field to the front); -1 if the node has no field with the configured next field name, and for the placeholder.
   */
  nextFieldPosition: number
}

/**
 * Arrow from a list node's own next field (the field with the configured next field name, e.g. `next`) to the box of
 * the node it references. If the next field is `null`, the arrow points to a placeholder box one column to the right
 * and ends in a null marker instead of an arrowhead.
 */
export interface NextFieldPointer {
  /** Box of the list node whose next field holds the pointer; it always has a graph node. */
  sourceListNodeBox: ListNodeBox,
  /**
   * Box of the node that the next field references, or the placeholder (a box without graph node) if the next field
   * is `null`.
   */
  targetListNodeBox: ListNodeBox,
  /** `true` if the source node's next field changed in the last step; the arrow is then drawn in red. */
  changed: boolean
}

/**
 * Pointer from a variable to a list node box, drawn as a vertical arrow from the variable's name down to the box.
 * The variable is a local variable, a static field, or a field of the list object.
 * Example: for `Node head = list.first;` in `main`, the variable is the local `head` and the target is the box of the
 * referenced list node.
 *
 * The shared fields (name, source graph node, null and changed state) are described in `VariableToBoxPointer`.
 * Examples of `sourceVariableIdentifier`: a local variable (`local_0_head`), a static field (`static_StaticList_head`)
 * or a field of the list object (`obj_12-first`).
 */
export interface VariableToListNodePointer extends VariableToBoxPointer {
  /** Box of the list node that the variable references; `undefined` if the variable holds `null`. */
  targetListNodeBox?: ListNodeBox,
  /**
   * Stacking order among the pointers drawn at the same place, counted from 0 at the left: among the pointers to the
   * same box (fields of the list object first, then the previous-node variable, then other variables), or among the
   * `null` pointers in front of or after the list. Each step moves the arrow one pointer distance to the right.
   */
  positionAtTarget: number,
  /**
   * Grid column the pointer is drawn at: the target box's column if the pointer is not `null`. A `null` pointer is
   * drawn in front of the list (-1); a `null` local variable or static field is instead drawn after the last column
   * if it was drawn in the right half of the list in the previous step.
   */
  targetColumn: number,
  /**
   * `true` if the variable is a field of the list object (its source graph node is that object), `false` for a local
   * variable or static field. Fields of the list object get the object's name drawn above their own name.
   */
  isListObjectField: boolean
}

/**
 * Box that the List View draws below a list node box for the object that the node's value field references (e.g. a
 * `Person` stored in the list), with one row per field of that object. Only one box is drawn per object, even if the
 * value fields of several list nodes reference it.
 */
export interface ValueObjectBox {
  /**
   * List node box that this box is drawn below: the first processed list node whose value field references the
   * object. Other list node boxes that reference the same object draw their value arrow to this box.
   */
  ownerListNodeBox: ListNodeBox,
  /** Graph node of the referenced value object; its children are the fields shown in the rows. */
  dataStructureGraphNode: DataStructureGraphNode
}
