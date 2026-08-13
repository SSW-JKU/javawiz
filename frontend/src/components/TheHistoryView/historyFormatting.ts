import type { HeapArray, HeapItem, ProcessedTraceState, Val } from '../../dto/TraceState'

const CONSTRUCTOR_LOOKBACK_LIMIT = 2000

export interface HistoryFormatter {
  formatCall: (traceIndex: number) => string
  formatValue: (value: Val, heap: HeapItem[], type?: string, traceIndex?: number) => string
}

/**
 * Creates the value and call formatter used while building History View
 * entries.
 *
 * Constructor lookups are cached for the lifetime of the formatter because the
 * same referenced value can appear in several entries from one dataset build.
 *
 * @param trace - Processed trace used to resolve calls and constructors.
 * @returns Formatting operations bound to the supplied trace.
 */
export function createHistoryFormatter (trace: readonly ProcessedTraceState[]): HistoryFormatter {
  const constructorParamsCache = new Map<string, string | null>()

  /**
   * Formats a trace value for display in a history entry.
   *
   * @param value - Trace value to format.
   * @param heap - Heap snapshot used to resolve references.
   * @param type - Optional declared type used for character formatting.
   * @param traceIndex - Optional processed-trace index used to reconstruct constructors.
   * @returns A human-readable representation of the value.
   */
  function formatValue (value: Val, heap: HeapItem[], type?: string, traceIndex?: number): string {
    if (value.kind === 'PrimitiveVal') {
      return type === 'char' ? `'${value.vizValue}'` : value.vizValue
    }
    if (value.kind === 'ReferenceVal') {
      return formatHeapReference(value.reference, heap, traceIndex)
    }
    return 'null'
  }

  /**
   * Resolves and formats a heap reference for display in a history entry.
   *
   * @param reference - Heap object ID referenced by the trace value.
   * @param heap - Heap snapshot containing the referenced item.
   * @param traceIndex - Optional processed-trace index used to reconstruct constructors.
   * @returns A human-readable heap value or an unknown-reference marker.
   */
  function formatHeapReference (reference: number, heap: HeapItem[], traceIndex?: number): string {
    const heapItem = heap.find(item => item.id === reference)
    if (!heapItem) return 'Unknown reference'

    if (heapItem.kind === 'HeapString') {
      return `"${heapItem.vizString}"`
    }
    if (heapItem.kind === 'HeapArray') {
      return `new ${formatArrayType(heapItem, heap)}`
    }

    if (traceIndex !== undefined) {
      const params = getConstructorParams(reference, traceIndex)
      if (params !== null) return `${heapItem.type}(${params})`
    }
    return `${heapItem.type} object`
  }

  /**
   * Resolves concrete dimensions for a possibly nested array type.
   *
   * @param heapArray - Outermost array to format.
   * @param heap - Heap snapshot used to follow nested array references.
   * @returns Array type with every resolvable dimension replaced by its length.
   */
  function formatArrayType (heapArray: HeapArray, heap: HeapItem[]): string {
    let result = heapArray.type
    let currentArray = heapArray

    while (result.includes('[]')) {
      result = result.replace('[]', `[${currentArray.elements.length}]`)
      const firstElement = currentArray.elements[0]
      if (firstElement?.value.kind !== 'ReferenceVal') break

      const nestedArrayId = firstElement.value.reference
      const nestedArray = heap.find(item => item.id === nestedArrayId)
      if (!nestedArray || nestedArray.kind !== 'HeapArray') break
      currentArray = nestedArray
    }

    return result
  }

  /**
   * Finds and formats constructor arguments for a heap object by scanning a
   * bounded number of preceding processed trace states.
   *
   * @param reference - Heap object ID of the constructed object.
   * @param currentIndex - Processed-trace index from which to search backwards.
   * @returns Comma-separated constructor argument values, or `null` if no matching call is found.
   */
  function getConstructorParams (reference: number, currentIndex: number): string | null {
    const cacheKey = `${reference}:${currentIndex}`
    if (constructorParamsCache.has(cacheKey)) {
      return constructorParamsCache.get(cacheKey) ?? null
    }

    const start = Math.max(0, currentIndex - CONSTRUCTOR_LOOKBACK_LIMIT)
    for (let index = currentIndex - 1; index >= start; index--) {
      const state = trace[index]
      const frame = state?.stackAfterExecution[0]
      const isConstructorCall = index > 0
        && state.stackAfterExecution.length > state.stackBeforeExecution.length
        && frame?.method === '<init>'
      if (!isConstructorCall || frame.this?.reference !== reference) continue

      const params = frame.localVariables
        .filter(variable => variable.name !== 'this')
        .map(variable => formatValue(variable.value, state.heapAfterExecution, variable.type, index))
        .join(', ')
      constructorParamsCache.set(cacheKey, params)
      return params
    }

    constructorParamsCache.set(cacheKey, null)
    return null
  }

  /**
   * Formats a method argument, preferring a caller-local or caller-field alias
   * over its raw value.
   *
   * @param value - Argument value from the callee frame.
   * @param traceIndex - Zero-based processed-trace index of the call.
   * @returns The best available source-level alias or formatted value.
   */
  function formatParam (value: Val, traceIndex: number): string {
    const state = trace[traceIndex]
    if (!state) return ''

    if (value.kind === 'ReferenceVal' && traceIndex > 0) {
      const callerFrame = state.stackBeforeExecution[0]
      const callerLocal = callerFrame?.localVariables.find(variable =>
        variable.value.kind === 'ReferenceVal' && variable.value.reference === value.reference
      )
      if (callerLocal) return callerLocal.name

      const thisReference = callerFrame?.this
      if (thisReference?.kind === 'ReferenceVal') {
        const thisObject = state.heapBeforeExecution.find(item => item.id === thisReference.reference)
        if (thisObject?.kind === 'HeapObject') {
          const field = thisObject.fields.find(candidate =>
            candidate.value.kind === 'ReferenceVal' && candidate.value.reference === value.reference
          )
          if (field) return `this.${field.name}`
        }
      }
    }

    return formatValue(value, state.heapAfterExecution, undefined, traceIndex)
  }

  /**
   * Formats a method-call, constructor-call, or static-initializer history entry.
   *
   * @param traceIndex - Zero-based processed-trace index of the call.
   * @returns A human-readable description of the call and its arguments.
   */
  function formatCall (traceIndex: number): string {
    const state = trace[traceIndex]
    const frame = state?.stackAfterExecution[0]
    if (!state || !frame) return 'Unknown call'

    let receiverName = frame.class
    if (frame.this?.kind === 'ReferenceVal') {
      const callerFrame = state.stackBeforeExecution[0]
      const callerLocal = callerFrame?.localVariables.find(variable =>
        variable.value.kind === 'ReferenceVal' && variable.value.reference === frame.this?.reference
      )
      if (callerLocal) {
        receiverName = callerLocal.name
      } else {
        const receiver = state.heapAfterExecution.find(item => item.id === frame.this?.reference)
        if (receiver?.kind === 'HeapObject') receiverName = receiver.type
        if (receiver?.kind === 'HeapString') receiverName = `"${receiver.vizString}"`
      }
    }

    const params = frame.localVariables
      .map(variable => `${variable.name}=${formatParam(variable.value, traceIndex)}`)
      .join(', ')

    if (frame.method === '<init>') return `Constructor: new ${frame.class}(${params})`
    if (frame.method === '<clinit>') return `Static Initializer: ${frame.class}`
    return `Call: ${receiverName}.${frame.method}(${params})`
  }

  return { formatCall, formatValue }
}
