import type { HeapArrayElementVar, HeapItem, LoadedClass, StackFrame, TraceState, Var } from '@/dto/TraceState'

/*
Dollar characters (e.g. in class names, for inner classes etc.) and dots (package names) seem to cause trouble in the heap viz
therefore we replace them by a dummy value
*/
export function sanitizeIdentifier (name: string) {
  return name.replaceAll('$', '_DOLLAR_SIGN_REPLACEMENT_').replaceAll('.', '_DOT_CHARACTER_REPLACEMENT_')
}

export function desanitizeIdentifier (identifier: string) {
  return identifier.replaceAll('_DOLLAR_SIGN_REPLACEMENT_', '$').replaceAll('_DOT_CHARACTER_REPLACEMENT_', '.')
}

export function heapItemIdentifier (heapItem: Pick<HeapItem, 'id'>): string {
  return `o_${heapItem.id}`
}

export function heapArrayElementIdentifier (element: HeapArrayElementVar): string {
  return `${heapItemIdentifier({ id: element.arrayId })}:i_${element.index}`
}

export function heapObjectFieldIdentifier (heapObject: Pick<HeapItem, 'id'>, field: Pick<Var, 'name'>): string {
  return `${heapItemIdentifier(heapObject)}:${sanitizeIdentifier(field.name)}`
}

export function stackLocalIdentifier (stackFrameNumber: number, localVar: Pick<Var, 'name'>): string {
  return `roots:l_${stackFrameNumber}_${sanitizeIdentifier(localVar.name)}`
}

export function staticFieldIdentifier (loadedClass: Pick<LoadedClass, 'class'>, staticField: Pick<Var, 'name'>): string {
  return `roots:s_${sanitizeIdentifier(loadedClass.class)}_${sanitizeIdentifier(staticField.name)}`
}

function isSameVar (left: Var, right: Var): boolean {
  if (left === right) return true
  if (left.name !== right.name || left.type !== right.type || left.kind !== right.kind || left.heapObjectId !== right.heapObjectId) {
    return false
  }

  const leftMethod = 'method' in left ? left.method : undefined
  const rightMethod = 'method' in right ? right.method : undefined
  if (leftMethod !== rightMethod) return false

  const leftClass = 'class' in left ? left.class : undefined
  const rightClass = 'class' in right ? right.class : undefined
  return leftClass === rightClass
}

export function rawVarIdentifier (target: Var, traceState: TraceState): string {
  if (target.heapObjectId !== undefined) {
    return heapObjectFieldIdentifier({ id: target.heapObjectId }, target)
  }

  for (const heapItem of traceState.heap) {
    if (heapItem.kind === 'HeapObject') {
      const field = heapItem.fields.find(candidate => isSameVar(candidate, target))
      if (field) return heapObjectFieldIdentifier(heapItem, field)
    } else if (heapItem.kind === 'HeapString' && isSameVar(heapItem.charArr, target)) {
      return heapObjectFieldIdentifier(heapItem, heapItem.charArr)
    }
  }

  for (const loadedClass of traceState.loadedClasses) {
    const staticField = loadedClass.staticFields.find(candidate => isSameVar(candidate, target))
    if (staticField) return staticFieldIdentifier(loadedClass, staticField)
  }

  const reversedStack = [...traceState.stack].reverse()
  for (let stackFrameNumber = 0; stackFrameNumber < reversedStack.length; stackFrameNumber++) {
    const localVar = reversedStack[stackFrameNumber].localVariables.find(candidate => isSameVar(candidate, target))
    if (localVar) return stackLocalIdentifier(stackFrameNumber, localVar)
  }

  throw new Error('Cannot build a heap lookup identifier for this raw Var because it was not found in the provided TraceState.')
}

export function stackFrameNumberForRawStackFrame (traceState: Pick<TraceState, 'stack'>, stackFrame: StackFrame): number {
  const reversedStackFrameIndex = [...traceState.stack].reverse().findIndex(candidate => candidate === stackFrame)
  if (reversedStackFrameIndex < 0) {
    throw new Error('Cannot build heap visualization identifiers for a stack frame that was not found in the provided TraceState.')
  }
  return reversedStackFrameIndex
}
