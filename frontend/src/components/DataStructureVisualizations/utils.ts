import { select } from 'd3-selection'
import { HeapItem, LoadedClass, ProcessedTraceState, StackFrame, TraceState } from '@/dto/TraceState'
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
