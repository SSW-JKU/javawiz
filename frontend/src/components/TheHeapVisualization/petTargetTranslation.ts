import type { HeapArrayElementVar, HeapItem, ReferenceVal, StaticVar, TraceState, Var } from '@/dto/TraceState'

export type TranslatedPetTarget = Var | HeapArrayElementVar | HeapItem

export function translatePetTarget (
  target: string,
  traceState: TraceState
): TranslatedPetTarget | undefined {
  const vars: Var[] = []

  for (const frame of traceState.stack) {
    vars.push(...frame.localVariables)
  }

  for (const clazz of traceState.loadedClasses) {
    vars.push(...clazz.staticFields)
  }

  const isObjectTarget = target.startsWith('object ')

  const cleaned =
    target.startsWith('field ')
      ? target.substring(6)
      : target.startsWith('object ')
        ? target.substring(7)
        : target.startsWith('element ')
          ? target.substring(8)
          : target

  return translatePetTargetPath(
    cleaned,
    vars,
    traceState,
    isObjectTarget
  )
}

function translatePetTargetPath (
  path: string,
  vars: Var[],
  traceState: TraceState,
  resolveFinalReference: boolean
): TranslatedPetTarget | undefined {
  let i = 0

  while (
    i < path.length &&
    path[i] !== '.' &&
    path[i] !== '['
  ) {
    i++
  }

  const currentName = path.substring(0, i)
  const remaining = path.substring(i)

  const foundVar = vars.find(v => v.name === currentName)

  if (!foundVar) {
    return undefined
  }

  if (remaining.length === 0) {
    if (!resolveFinalReference) {
      return foundVar
    }

    return resolveReference(foundVar, traceState)
  }

  const heapObject = resolveReference(foundVar, traceState)

  if (!heapObject) {
    return undefined
  }

  if (remaining.startsWith('.')) {
    if (heapObject.kind !== 'HeapObject') {
      return undefined
    }

    return translatePetTargetPath(
      remaining.substring(1),
      heapObject.fields,
      traceState,
      resolveFinalReference
    )
  }

  if (remaining.startsWith('[')) {
    if (heapObject.kind !== 'HeapArray') {
      return undefined
    }

    const rBrack = remaining.indexOf(']')
    const index = parseInt(remaining.substring(1, rBrack))
    const element = heapObject.elements[index]

    if (!element) {
      return undefined
    }

    if (remaining.length === rBrack + 1) {
      if (!resolveFinalReference) {
        return element
      }

      return resolveReference(element, traceState)
    }

    const nextHeapObject = resolveReference(element, traceState)

    if (!nextHeapObject) {
      return undefined
    }

    const rest = remaining.substring(rBrack + 1)

    if (rest.startsWith('[')) {
      if (nextHeapObject.kind !== 'HeapArray') {
        return undefined
      }

      return translatePetTargetPath(
        '__array__' + rest,
        [fakeReferenceVar(nextHeapObject)],
        traceState,
        resolveFinalReference
      )
    }

    if (rest.startsWith('.')) {
      if (nextHeapObject.kind !== 'HeapObject') {
        return undefined
      }

      return translatePetTargetPath(
        rest.substring(1),
        nextHeapObject.fields,
        traceState,
        resolveFinalReference
      )
    }
  }

  return undefined
}

function resolveReference (variable: Var | HeapArrayElementVar, traceState: TraceState): HeapItem | undefined {
  if (variable.value.kind !== 'ReferenceVal') {
    return undefined
  }

  const reference = variable.value as ReferenceVal
  return traceState.heap.find(obj => obj.id === reference.reference)
}

function fakeReferenceVar (heapItem: HeapItem): StaticVar {
  return {
    kind: 'Var',
    class: '__fakeClass__',
    name: '__array__',
    type: heapItem.type,
    value: {
      kind: 'ReferenceVal',
      reference: heapItem.id
    },
    changed: false
  }
}
