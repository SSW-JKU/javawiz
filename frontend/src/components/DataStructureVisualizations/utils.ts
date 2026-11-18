import { select } from 'd3-selection'
import { HeapItem, LoadedClass, ProcessedTraceState, StackFrame, TraceState } from '@/dto/TraceState'
import { buildDataStructureGraph } from './dataStructureGraph'

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
 * Builds the data-structure graph of the given trace state (see `buildDataStructureGraph`). Uses the
 * classes, stack and heap after execution of `traceState`, or those of `firstState` for state 0.
 */
export function getDataStructureGraph (
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
  return buildDataStructureGraph(loadedClasses, stack, heap, onlyCurrentStackFrame)
}
