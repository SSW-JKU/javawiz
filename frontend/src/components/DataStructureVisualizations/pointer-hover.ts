import type { HeapObject, Var } from '@/dto/TraceState'
import type { HoverInfo } from '@/hover/types'
import { createHoverLocal, createHoverStatic } from '@/hover/hoverinfo-builder'
import type { DataStructureGraphNode } from './dataStructureGraph'

/*
 * Hover support for pointers in the List View and the Tree View. A pointer's `sourceDataStructureGraphNode` is the
 * data-structure graph node that stores it, and it tells what kind of pointer it is: the list or tree object (a heap object)
 * whose field holds it, a local variable (a `Var` with a method and a stack frame), or a static field
 * (a `Var` without a stack frame).
 */

/** Whether the pointer is a field of a heap object (e.g. a list's `head` field) rather than a variable. */
export function isField (sourceDataStructureGraphNode: DataStructureGraphNode): boolean {
  return sourceDataStructureGraphNode.traceElement?.kind === 'HeapObject'
}

/** Id of the heap object whose field holds the pointer. Only meaningful if `isField(sourceDataStructureGraphNode)`. */
export function idOfOwningHeapObject (sourceDataStructureGraphNode: DataStructureGraphNode): number {
  return (sourceDataStructureGraphNode.traceElement as HeapObject).id
}

/**
 * Hover info for a pointer that is a local variable or a static field, e.g. `head` in `main` gives
 * a `Local` hover info for method `main` in stack frame 0.
 */
export function createRootVariableHover (sourceDataStructureGraphNode: DataStructureGraphNode, reference: number): HoverInfo {
  const variable = sourceDataStructureGraphNode.traceElement as Var
  // A local's method includes its parameter types, e.g. `main(java.lang.String[])`; hover infos use the plain name.
  return sourceDataStructureGraphNode.stackFrameNumber === undefined || !('method' in variable)
    ? createHoverStatic(variable.class, variable.name, reference)
    : createHoverLocal(variable.class, variable.method.split('(')[0], variable.name, reference, sourceDataStructureGraphNode.stackFrameNumber)
}

/**
 * Tells whether a hovered local or static variable is the variable that stores this pointer. Other hover
 * kinds are not decided here and return `true`, so callers keep their own reference and name checks.
 */
export function isSameRootVariable (sourceDataStructureGraphNode: DataStructureGraphNode, hoverInfo: HoverInfo): boolean {
  const variable = sourceDataStructureGraphNode.traceElement
  if (hoverInfo.kind === 'Local') {
    return variable?.kind === 'Var' && 'method' in variable &&
      variable.method.split('(')[0] === hoverInfo.method &&
      (hoverInfo.stackFrameNr === undefined || hoverInfo.stackFrameNr === sourceDataStructureGraphNode.stackFrameNumber)
  }
  if (hoverInfo.kind === 'Static') {
    return variable?.kind === 'Var' && sourceDataStructureGraphNode.stackFrameNumber === undefined && variable.class === hoverInfo.class
  }
  return true
}
