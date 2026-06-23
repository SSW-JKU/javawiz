import { HeapTreeNode } from './heapBFS'
import { HeapArrayElementVar, HeapObject, HeapString, Var } from '@/dto/TraceState'

/**
 * returns a toString-representation of a HeapNode
 * @param node node of which a string should be generated
 * @param specialNames names of nodes of which only the name should be returned
 */
export function getNodeString (node: HeapTreeNode, ...specialNames: string[]): string {
  if (specialNames.includes(node.name) && (node.element as HeapObject).type !== 'java.lang.String') {
    return node.name
  }
  switch (node.element?.kind) {
    case 'Var':
    case 'HeapArrayElementVar':
      return getVarString(node, node.element) ?? ''
    case 'HeapObject':
      return `{${node.children.map((child) => getNodeString(child, ...specialNames)).join(', ')}}`
    case 'HeapString':
      return `"${(node.element).string}` as string + '"'
    case 'HeapArray':
      return `[${node.children.map(child => getNodeString(child, ...specialNames)).join(', ')}]`
  }
  return ''
}

/**
 * returns 'name' if the node has a name in special names or 'value' if not
 * @param node node of which the type should be returned
 * @param specialNames names of nodes of which 'name' should be returned
 */
export function getNodeType (node: HeapTreeNode, ...specialNames: string[]): ('value' | 'name') {
  if (specialNames.includes(node.name)) {
    return 'name'
  } else {
    return 'value'
  }
}

/**
 * returns string of variables
 * @param node: HeapNode of Variable
 * @param variable: variable to return the string of
 */
export function getVarString (node: HeapTreeNode, variable: Var | HeapArrayElementVar) {
  if (variable.value.kind === 'PrimitiveVal') {
    if (variable.type === 'char') {
      return '\'' + variable.value.primitiveValue + '\''
    } else {
      return variable.value.primitiveValue
    }
  } else if (variable.value.kind === 'NullVal') {
    return node.name.length > 0 ? node.name + ': null' : 'null'
  } else if (variable.type === 'java.lang.String') {
    return (node.children[0].element as HeapString).string
  }
}

/**
 * returns the index of the field with the given name, -1 if not found
 * @param node contains the HeapObject with the fields to search in
 * @param fieldName name of the field to search for
 */
export function getFieldIndex (node: HeapTreeNode, fieldName: string) {
  return node.element?.kind === 'HeapObject'
    ? node.element.fields.findIndex(field => (field as Var).name === fieldName)
    : -1
}

/**
 * Sets the changesInFields array in the node with booleans which fields changed. The order is the same as in the fields-array in the node's element
 * @param node node to set the changesInFields array of
 */
export function setChangesInFields (node: HeapTreeNode) {
  node.changesInFields = (node!.element as HeapObject).fields.map(field => field.changed)
}

/**
 * Returns true, iff the field with the given index has changed
 * @param node node of with an initialized changesInFields-array
 * @param index index in the children array, negative indexes also possible (-1 for last elem, -2 for second last, ...)
 */
export function isFieldChanged (node: HeapTreeNode | undefined, index: number) {
  if (node && node.changesInFields && index < node.changesInFields.length) {
    return node.changesInFields[index >= 0 ? index : node.changesInFields.length + index]
  } else {
    return false
  }
}
