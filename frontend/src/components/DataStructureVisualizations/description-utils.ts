import { HeapTreeNode } from './heapBFS'
import { LocalVar, StaticVar } from '@/dto/TraceState'

/**
 * returns description of pointer containing its name and information of its parent
 * @param pointer the pointer to get the description of
 */
export function getPointerDescription (pointer: { name: string, parent: HeapTreeNode }) {
  return pointer.name + getParentDescription(pointer.parent)
}

/**
 * appends array description to the string array in the form of <array name>[<first dim index>][<optional second dim index>]
 * @param stringArray string array (acts like a StringBuilder)
 * @param node child node of array to get the description of
 */
function appendArrayDescription (stringArray: string[], node: HeapTreeNode | undefined) {
  const startIndex = stringArray.length
  let current = node
  while (current && current.parents && current.parents[0].element?.kind === 'HeapArray') {
    const parent = current.parents[0]
    const index = parent.children.indexOf(current)
    stringArray.splice(startIndex, 0, `[${index}]`)
    stringArray.splice(startIndex, 0, parent.name)
    current = current.parents ? current.parents[0] : undefined
  }
  return current
}

/**
 * returns the description of a parent like "in <array>..." or "of <object>..."
 * @param parent
 */
function getParentDescription (parent: HeapTreeNode) {
  const stringArray: string[] = []
  let current: HeapTreeNode | undefined = parent
  while (current !== undefined && current.element?.kind !== 'Var') {
    if (current.element?.kind === 'HeapObject' && current.parents && current.parents[0].element?.kind === 'HeapArray') {
      stringArray.push(' in ')
      current = appendArrayDescription(stringArray, current)
    } else if (current.element?.kind === 'HeapObject') {
      stringArray.push(' of ')
      stringArray.push(current.name)
    }
    if (current) {
      current = current.parents ? current.parents[0] : undefined
    }
  }
  if (current && current.element?.kind === 'Var') {
    if (current.stackFrameDepth === undefined) {
      stringArray.push(` in static variables of class ${(current.element as StaticVar).class}`)
    } else {
      stringArray.push(` in ${(current.element as LocalVar).method} at stack-frame-depth ${current.stackFrameDepth}`)
    }
  }
  return stringArray.join('')
}

/**
 * gets the simple parent name, only object-name, array-name or method-name
 * @param node
 */
export function getSimpleParentDescription (node: HeapTreeNode) {
  if (node.element?.kind === 'HeapObject' && node.parents && node.parents[0].element?.kind === 'HeapArray') {
    const stringArray: string[] = []
    appendArrayDescription(stringArray, node)
    return stringArray.join('')
  } else if (node.element?.kind === 'HeapObject') {
    return node.name
  } else if (node.element?.kind === 'Var') {
    return (node.element as LocalVar).method
  }
  return ''
}
