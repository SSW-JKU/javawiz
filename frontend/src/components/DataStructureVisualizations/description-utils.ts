import { DataStructureGraphNode } from './dataStructureGraph'
import { LocalVar, StaticVar } from '@/dto/TraceState'
import { VariableToBoxPointer } from './types'

/**
 * returns description of pointer containing its name and where it is stored
 * @param pointer the pointer to get the description of; `sourceDataStructureGraphNode` is the data-structure graph node that stores it
 *   (a local or static variable, or the object whose field holds it)
 */
export function getPointerDescription (pointer: Pick<VariableToBoxPointer, 'name' | 'sourceDataStructureGraphNode'>) {
  return pointer.name + getParentDescription(pointer.sourceDataStructureGraphNode)
}

/**
 * appends array description to the string array in the form of <array name>[<first dim index>][<optional second dim index>]
 * @param stringArray string array (acts like a StringBuilder)
 * @param dataStructureGraphNode child node of array to get the description of
 */
function appendArrayDescription (stringArray: string[], dataStructureGraphNode: DataStructureGraphNode | undefined) {
  const startIndex = stringArray.length
  let current = dataStructureGraphNode
  while (current && current.parentDataStructureGraphNodes && current.parentDataStructureGraphNodes[0].traceElement?.kind === 'HeapArray') {
    const parent = current.parentDataStructureGraphNodes[0]
    const index = parent.childDataStructureGraphNodes.indexOf(current)
    stringArray.splice(startIndex, 0, `[${index}]`)
    stringArray.splice(startIndex, 0, parent.label)
    current = current.parentDataStructureGraphNodes ? current.parentDataStructureGraphNodes[0] : undefined
  }
  return current
}

/**
 * returns the description of a parent like "in <array>..." or "of <object>..."
 * @param parent
 */
function getParentDescription (parent: DataStructureGraphNode) {
  const stringArray: string[] = []
  let current: DataStructureGraphNode | undefined = parent
  while (current !== undefined && current.traceElement?.kind !== 'Var') {
    if (current.traceElement?.kind === 'HeapObject' && current.parentDataStructureGraphNodes && current.parentDataStructureGraphNodes[0].traceElement?.kind === 'HeapArray') {
      stringArray.push(' in ')
      current = appendArrayDescription(stringArray, current)
    } else if (current.traceElement?.kind === 'HeapObject') {
      stringArray.push(' of ')
      stringArray.push(current.label)
    }
    if (current) {
      current = current.parentDataStructureGraphNodes ? current.parentDataStructureGraphNodes[0] : undefined
    }
  }
  if (current && current.traceElement?.kind === 'Var') {
    if (current.stackFrameNumber === undefined) {
      stringArray.push(` in static variables of class ${(current.traceElement as StaticVar).class}`)
    } else {
      stringArray.push(` in ${(current.traceElement as LocalVar).method} at stack-frame-depth ${current.stackFrameNumber}`)
    }
  }
  return stringArray.join('')
}

/**
 * gets the simple parent name, only object-name, array-name or method-name
 * @param dataStructureGraphNode
 */
export function getSimpleParentDescription (dataStructureGraphNode: DataStructureGraphNode) {
  if (dataStructureGraphNode.traceElement?.kind === 'HeapObject' &&
    dataStructureGraphNode.parentDataStructureGraphNodes &&
    dataStructureGraphNode.parentDataStructureGraphNodes[0].traceElement?.kind === 'HeapArray') {
    const stringArray: string[] = []
    appendArrayDescription(stringArray, dataStructureGraphNode)
    return stringArray.join('')
  } else if (dataStructureGraphNode.traceElement?.kind === 'HeapObject') {
    return dataStructureGraphNode.label
  } else if (dataStructureGraphNode.traceElement?.kind === 'Var') {
    return (dataStructureGraphNode.traceElement as LocalVar).method
  }
  return ''
}
