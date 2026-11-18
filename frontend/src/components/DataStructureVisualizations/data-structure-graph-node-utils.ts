import { DataStructureGraphNode } from './dataStructureGraph'
import { HeapArrayElementVar, HeapItem, HeapObject, HeapString, Var } from '@/dto/TraceState'

/** Deepest level of nested objects and arrays that `getNodeString` writes out by default. */
export const DEFAULT_MAX_DEPTH = 2

/**
 * returns a toString-representation of a data-structure graph node
 *
 * Objects are written as `{ name: value, ... }` and arrays as `[ value, ... ]`, with referenced objects and
 * arrays written out inside, up to `maxDepth` levels. Deeper ones are shown as `{ ... }` or `[ ... ]`.
 * Level 1 is the object that holds the cell, when the node has a `parent` (the views bind each field cell
 * as `{ ...node, parent }`); otherwise it is the node's own object. For example, for
 * `class Item { int x; Point p; Item self; }` with `item.self = item`:
 * - `getNodeString(itemNode)` gives `{ x: 4, p: { x: 3, y: 4, color: { ... } }, self: { ... } }`
 * - the value box row of `p` gives `{ x: 3, y: 4, color: { ... } }`
 *
 * Each object or array is written out only once per text. Any later reference to it, and a reference to
 * the parent, is also shown as `{ ... }` or `[ ... ]`. This also ends cycles in the heap. For example,
 * `int[][] m = {row, row}` gives `[ [ 1, 2 ], [ ... ] ]`.
 * @param dataStructureGraphNode node of which a string should be generated, optionally with the `parent` that holds it
 * @param maxDepth deepest level that is written out
 * @param specialNames field names of list or tree node elements (such as `next`); a cell whose node has one
 *   of these labels shows just the label. Nested data is never shown this way, because data objects have no
 *   special names.
 */
export function getNodeString (
  dataStructureGraphNode: DataStructureGraphNode & { parent?: DataStructureGraphNode },
  maxDepth = DEFAULT_MAX_DEPTH,
  ...specialNames: string[]
): string {
  if (specialNames.includes(dataStructureGraphNode.label) && (dataStructureGraphNode.traceElement as HeapObject).type !== 'java.lang.String') {
    return dataStructureGraphNode.label
  }
  const visited = new Set<HeapItem>()
  const parentKind = dataStructureGraphNode.parent?.traceElement?.kind
  if (parentKind === 'HeapObject' || parentKind === 'HeapArray') {
    visited.add(dataStructureGraphNode.parent!.traceElement as HeapItem)
  }
  return nodeString(dataStructureGraphNode, dataStructureGraphNode.parent ? 2 : 1, maxDepth, visited)
}

/**
 * Does the work of `getNodeString` for a node at the given level.
 * @param visited objects and arrays that are already written out in this text, or are the parent.
 *   They are identified by their heap item, not by their graph node, because the views also pass copies of graph nodes.
 */
function nodeString (dataStructureGraphNode: DataStructureGraphNode, level: number, maxDepth: number, visited: Set<HeapItem>): string {
  switch (dataStructureGraphNode.traceElement?.kind) {
    case 'Var':
    case 'HeapArrayElementVar':
      return getVarString(dataStructureGraphNode, dataStructureGraphNode.traceElement) ?? ''
    case 'HeapObject': {
      const values = childStrings(dataStructureGraphNode, level, maxDepth, visited)
      if (!values) {
        return '{ ... }'
      }
      // one child node per field, in the order of the fields
      const fields = dataStructureGraphNode.traceElement.fields
      return values.length > 0 ? `{ ${values.map((value, i) => `${fields[i].name}: ${value}`).join(', ')} }` : '{}'
    }
    case 'HeapString':
      return `"${(dataStructureGraphNode.traceElement).string}` as string + '"'
    case 'HeapArray': {
      const values = childStrings(dataStructureGraphNode, level, maxDepth, visited)
      if (!values) {
        return '[ ... ]'
      }
      return values.length > 0 ? `[ ${values.join(', ')} ]` : '[]'
    }
  }
  return ''
}

/**
 * Returns the texts of an object's fields or an array's elements, or `undefined` if the object or array lies
 * below `maxDepth` or is already written out in this text.
 */
function childStrings (dataStructureGraphNode: DataStructureGraphNode, level: number, maxDepth: number, visited: Set<HeapItem>): string[] | undefined {
  const heapItem = dataStructureGraphNode.traceElement as HeapItem
  if (level > maxDepth || visited.has(heapItem)) {
    return undefined
  }
  visited.add(heapItem)
  return dataStructureGraphNode.childDataStructureGraphNodes.map(child => {
    // a nested null is just `null`; `getVarString` would add the field name, which the object text already shows
    const element = child.traceElement
    if ((element?.kind === 'Var' || element?.kind === 'HeapArrayElementVar') && element.value.kind === 'NullVal') {
      return 'null'
    }
    return nodeString(child, level + 1, maxDepth, visited)
  })
}

/**
 * returns 'name' if the node has a name in special names or 'value' if not
 * @param dataStructureGraphNode node of which the type should be returned
 * @param specialNames names of nodes of which 'name' should be returned
 */
export function getNodeType (dataStructureGraphNode: DataStructureGraphNode, ...specialNames: string[]): ('value' | 'name') {
  if (specialNames.includes(dataStructureGraphNode.label)) {
    return 'name'
  } else {
    return 'value'
  }
}

/**
 * returns string of variables
 * @param dataStructureGraphNode: data-structure graph node of the variable
 * @param variable: variable to return the string of
 */
export function getVarString (dataStructureGraphNode: DataStructureGraphNode, variable: Var | HeapArrayElementVar) {
  if (variable.value.kind === 'PrimitiveVal') {
    if (variable.type === 'char') {
      return '\'' + variable.value.primitiveValue + '\''
    } else {
      return variable.value.primitiveValue
    }
  } else if (variable.value.kind === 'NullVal') {
    return dataStructureGraphNode.label.length > 0 ? dataStructureGraphNode.label + ': null' : 'null'
  } else if (variable.type === 'java.lang.String') {
    return (dataStructureGraphNode.childDataStructureGraphNodes[0].traceElement as HeapString).string
  }
}

/**
 * returns the index of the field with the given name, -1 if not found
 * @param dataStructureGraphNode contains the HeapObject with the fields to search in
 * @param fieldName name of the field to search for
 */
export function getFieldIndex (dataStructureGraphNode: DataStructureGraphNode, fieldName: string) {
  return dataStructureGraphNode.traceElement?.kind === 'HeapObject'
    ? dataStructureGraphNode.traceElement.fields.findIndex(field => (field as Var).name === fieldName)
    : -1
}

/**
 * Sets the node's childChangedFlags: one flag per field telling whether it changed. The order is the same as in the fields array of the node's trace element
 * @param dataStructureGraphNode node to set the childChangedFlags of
 */
export function setChildChangedFlags (dataStructureGraphNode: DataStructureGraphNode) {
  dataStructureGraphNode.childChangedFlags = (dataStructureGraphNode!.traceElement as HeapObject).fields.map(field => field.changed)
}

/**
 * Returns true, iff the field with the given index has changed
 * @param dataStructureGraphNode node with initialized childChangedFlags
 * @param index index in childDataStructureGraphNodes, negative indexes also possible (-1 for last elem, -2 for second last, ...)
 */
export function isFieldChanged (dataStructureGraphNode: DataStructureGraphNode | undefined, index: number) {
  if (dataStructureGraphNode && dataStructureGraphNode.childChangedFlags && index < dataStructureGraphNode.childChangedFlags.length) {
    return dataStructureGraphNode.childChangedFlags[index >= 0 ? index : dataStructureGraphNode.childChangedFlags.length + index]
  } else {
    return false
  }
}
