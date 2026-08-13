import type { HeapItem, LoadedClass, StackFrame } from '../../dto/TraceState'

/**
 * Maps each heap object ID to the variable, field, and array-element paths that
 * reference that heap item.
 */
export type HeapAliasIndex = ReadonlyMap<number, readonly string[]>

interface PendingAlias {
  heapObjectId: number
  name: string
  depth: number
  visitedHeapObjectIds: ReadonlySet<number>
}

const DEFAULT_MAX_DEPTH = 10

export interface HeapAliasIndexOptions {
  maxDepth?: number
  loadedClasses?: readonly LoadedClass[]
}

/**
 * Builds an index of reference paths reachable from local variables, static
 * fields, and the current `this` reference.
 *
 * Object fields and array elements are traversed breadth-first. Cycles are
 * rejected per path, and aliases at the maximum depth are included without
 * traversing their children.
 *
 * @param stackFrames - Stack frames whose local variables provide alias roots.
 * @param heap - Heap items used to follow object-field and array-element references.
 * @param options - Maximum traversal depth or detailed lookup options.
 * @returns A map from heap object IDs to all discovered reference paths.
 */
export function buildHeapAliasIndex (
  stackFrames: readonly StackFrame[],
  heap: readonly HeapItem[],
  options: number | HeapAliasIndexOptions = {}
): HeapAliasIndex {
  const maxDepth = typeof options === 'number'
    ? options
    : options.maxDepth ?? DEFAULT_MAX_DEPTH
  const loadedClasses = typeof options === 'number'
    ? []
    : options.loadedClasses ?? []
  const heapObjectById = new Map(heap.map(item => [item.id, item]))
  const aliasesByHeapObjectId = new Map<number, Set<string>>()
  const pending: PendingAlias[] = []

  /**
   * Adds a depth-zero reference path to the traversal queue.
   *
   * @param heapObjectId - ID of the heap item referenced by the root.
   * @param name - Source-level name of the root reference.
   */
  function enqueueRoot (heapObjectId: number, name: string) {
    pending.push({
      heapObjectId,
      name,
      depth: 0,
      visitedHeapObjectIds: new Set([heapObjectId])
    })
  }

  for (const stackFrame of stackFrames) {
    for (const localVariable of stackFrame.localVariables) {
      if (localVariable.name !== 'this' && localVariable.value.kind === 'ReferenceVal') {
        enqueueRoot(localVariable.value.reference, localVariable.name)
      }
    }
  }

  const thisReference = stackFrames[0]?.this
  if (thisReference?.kind === 'ReferenceVal') {
    enqueueRoot(thisReference.reference, 'this')
  }

  for (const loadedClass of loadedClasses.filter(x => !x.detailedFieldsOnly)) {
    const simpleClassName = loadedClass.class.split('.').at(-1) ?? loadedClass.class
    const classNames = simpleClassName === loadedClass.class
      ? [loadedClass.class]
      : [loadedClass.class, simpleClassName]
    for (const staticField of loadedClass.staticFields) {
      if (staticField.value.kind !== 'ReferenceVal') continue
      for (const className of classNames) {
        enqueueRoot(staticField.value.reference, `${className}.${staticField.name}`)
      }
    }
  }

  for (let cursor = 0; cursor < pending.length; cursor++) {
    const alias = pending[cursor]
    const existingAliases = aliasesByHeapObjectId.get(alias.heapObjectId) ?? new Set<string>()
    if (existingAliases.has(alias.name)) continue

    existingAliases.add(alias.name)
    aliasesByHeapObjectId.set(alias.heapObjectId, existingAliases)

    if (alias.depth >= maxDepth) continue

    const heapItem = heapObjectById.get(alias.heapObjectId)
    if (!heapItem) continue

    const referencedValues = heapItem.kind === 'HeapObject'
      ? heapItem.fields.map(field => ({
        name: `${alias.name}.${field.name}`,
        value: field.value
      }))
      : heapItem.kind === 'HeapArray'
        ? heapItem.elements.map(element => ({
          name: `${alias.name}[${element.index}]`,
          value: element.value
        }))
        : []

    for (const referencedValue of referencedValues) {
      if (referencedValue.value.kind !== 'ReferenceVal') continue

      const referencedHeapObjectId = referencedValue.value.reference
      if (alias.visitedHeapObjectIds.has(referencedHeapObjectId)) continue

      pending.push({
        heapObjectId: referencedHeapObjectId,
        name: referencedValue.name,
        depth: alias.depth + 1,
        visitedHeapObjectIds: new Set([...alias.visitedHeapObjectIds, referencedHeapObjectId])
      })
    }
  }

  return new Map(
    [...aliasesByHeapObjectId.entries()]
      .map(([heapObjectId, aliases]) => [heapObjectId, [...aliases]] as const)
  )
}