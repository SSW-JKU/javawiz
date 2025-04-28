import { select } from 'd3-selection'
import { ListNode } from './TheListVisualization/types'
import { TreeNode } from './TheTreeVisualization/types'
import { HeapItem, HeapObject, LoadedClass, ProcessedTraceState, StackFrame, TraceState } from '@/dto/TraceState'
import { heapBFS } from './heapBFS'

/**
 * Moves element from fromPos to toPos, if toPos is -1 element is appended
 * @param array array which should be changed
 * @param fromPos position from which the element should be cut
 * @param toPos position to which the element should be moved, -1 for appending
 */
export function moveElemInArray (array: any[] | undefined, fromPos: number, toPos: number) {
  if (!array) {
    return
  }
  const element = array[fromPos]
  array.splice(fromPos, 1)
  if (toPos === -1) {
    array.push(element)
  } else {
    array.splice(toPos, 0, element)
  }
}

/**
 * removes all children of the DOM-element with the given selector
 * @param selector selector to get the element of which the children should be deleted
 */
export function removeChildren (selector: string) {
  select(selector).selectAll('*')
    .remove()
}

/**
 * checks if all field names are existent in the first node
 * @param nodes nodes array
 * @param fieldNames names of fields to be checked for
 * @param errorDivId string of selector for which the style "display" should be set to 'flex' if not all fields have been found, 'none' otherwise
 */
export function checkFields (nodes: ListNode[] | TreeNode[], fieldNames: string[], errorDivId: string): boolean {
  let fieldNotFound = false
  if (nodes.length > 0) {
    const fields = (nodes[0].node?.element as HeapObject).fields
    fieldNames.forEach(name => {
      if (!fields.find(field => field.name === name)) {
        fieldNotFound = true
      }
    })
  }
  select(`#${errorDivId}`).style('display', fieldNotFound ? 'flex' : 'none')
  return fieldNotFound
}

/**
 * searches for searchString in possibleStrings by first checking for an exact match and then checking if some string in possibleString includes searchString
 * @param searchString string to be searched for
 * @param searchSpace array of strings in search space
 * @return string in search space that fuzzy matches searchString otherwise undefined
 */
export function fuzzySearch (searchString: string, searchSpace: string[]): string | undefined {
  // if exact match exists return it
  if (searchSpace.find(s => s === searchString)) {
    return searchString
  }

  // check if fuzzy match exists
  for (let i = 0; i < searchSpace.length; i++) {
    if (searchSpace[i].includes(searchString)) {
      return searchSpace[i]
    }
  }

  return undefined
}

/**
 * chooses the right stack and heap, depending on if it's the first state or not and creates a stack and heap graph
 * @param vm a component containing stateIndex, traceState and firstState
 */
export function getHeapTree (
  stateIndex: number,
  traceState: ProcessedTraceState | undefined,
  firstState: TraceState,
  onlyCurrentStackFrame?: boolean
) {
  let loadedClasses: LoadedClass[]
  let stack: StackFrame[]
  let heap: HeapItem[]
  // choose stack and heap from firstTrace or normal traceState
  if (stateIndex !== 0 && traceState) {
    loadedClasses = traceState.loadedClassesAfterExecution
    stack = traceState.stackAfterExecution
    heap = traceState.heapAfterExecution
  } else {
    loadedClasses = firstState.loadedClasses
    stack = firstState.stack
    heap = firstState.heap
  }
  return heapBFS(loadedClasses, stack, heap, onlyCurrentStackFrame)
}
