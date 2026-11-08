/**
 * Identifiers for the elements of a trace state: heap items, array elements, object fields,
 * stack locals and static fields, plus the cells and edges the memory view renders for them.
 * The memory view and the data-structure views share them, so the same variable has the same
 * identifier everywhere, for example `roots:l_0_arr` for the local `arr` in `main`.
 */
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

/**
 * Escapes an identifier for use inside a quoted CSS attribute selector such as `[id="…"]`.
 * Identifiers contain `:`, which a `#id` selector would read as a pseudo-class, so lookups
 * by identifier use attribute selectors instead.
 */
export function escapeIdForAttributeSelector (id: string): string {
  return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/** CSS selector for the element with exactly this id, e.g. `[id="list-p-roots:l_0_head"]`. */
export function idAttributeSelector (id: string): string {
  return `[id="${escapeIdForAttributeSelector(id)}"]`
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

/**
 * Identifier of a root variable: a static field when there is no stack frame, otherwise a local
 * variable in stack frame `stackFrameNumber` (0 = `main`). This matches the root nodes built by
 * the data-structure views, e.g. `rootVariableIdentifier(arr, 0)` → `roots:l_0_arr` and
 * `rootVariableIdentifier(head, undefined)` → `roots:s_StaticList_head`.
 */
export function rootVariableIdentifier (variable: Var, stackFrameNumber: number | undefined): string {
  return stackFrameNumber === undefined || stackFrameNumber === null
    ? staticFieldIdentifier(variable, variable)
    : stackLocalIdentifier(stackFrameNumber, variable)
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

export const SVG_CELL_SUFFIXES = {
  method: 'method',
  header: 'header',
  typeAndName: 'typeandname',
  index: 'index',
  pseudo: 'pseudo',
  value: 'value',
  moreLess: 'moreless',
  empty: 'empty',
  bytes: 'bytes'
} as const

export type SvgCellSuffix = typeof SVG_CELL_SUFFIXES[keyof typeof SVG_CELL_SUFFIXES]

/** Builds the unique DOM ID injected into one rendered Graphviz table cell. */
export function svgCellIdentifier (recordIdentifier: string, suffix: SvgCellSuffix): string {
  return `${recordIdentifier}:${suffix}`
}

/**
 * Builds the DOM ID of the reference edge from the record `from` to the heap item `to`, for example
 * `edge:o_1:next->o_2`. The `edge:` prefix keeps the ID from starting with `o_1:`, so looking up all
 * cells of object `o_1` by that prefix does not also return the edge.
 */
export function edgeIdentifier (from: string, to: string): string {
  return `edge:${from}->${to}`
}

/** Builds the method-header ID while preserving the frame identifier used by hover synchronization. */
export function methodHeaderIdentifier (stackFrameNumber: number): string {
  return svgCellIdentifier(`stackframe_${stackFrameNumber}`, SVG_CELL_SUFFIXES.method)
}

/** Removes only a known cell suffix, leaving field and array-element identifiers intact. */
export function identifierFromSvgCellIdentifier (identifier: string): string {
  const suffix = Object.values(SVG_CELL_SUFFIXES).find(candidate => identifier.endsWith(`:${candidate}`))
  return suffix ? identifier.slice(0, -(suffix.length + 1)) : identifier
}

function escapeInjectedTitleAttributeValue (value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** Encodes SVG attributes in a Graphviz title so HeapLookup can restore them after rendering. */
export function injectedTitleAttributes (attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .map(([name, value]) => `${name}=&quot;${escapeInjectedTitleAttributeValue(value)}&quot;`)
    .join(' ')
}
