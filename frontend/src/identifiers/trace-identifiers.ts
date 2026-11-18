/**
 * Identifiers for the elements of a trace state: heap items, array elements, object fields,
 * stack locals and static fields, plus the cells and edges the Memory View renders for them.
 * The Memory View and the data-structure views share them, so the same variable has the same
 * identifier everywhere.
 *
 * Every identifier is a valid CSS identifier, so `#<identifier>` selects its element directly:
 * - local `arr` in `main` (frame 0): `local_0_arr`
 * - static field `count` of class `Main`: `static_Main_count`
 * - heap item 1: `obj_1`; its field `next`: `obj_1-next`; its array element 3: `obj_1-3`
 * - a cell of a record: `obj_1-next--value`; a reference edge: `edge-obj_1-next--obj_2`
 *
 * The Memory View also needs each variable's Graphviz node and port (`roots:local_0_arr`,
 * `obj_1:next`) for its DOT edges. The `…NodeAndPort` functions build them, and the identifier is
 * derived from the same port text, so the two forms always match. No code reads meaning back out of
 * an identifier; only `identifierFromSvgCellIdentifier` removes a known cell suffix.
 */
import type { HeapArrayElementVar, HeapItem, LoadedClass, StackFrame, TraceState, Var } from '@/dto/TraceState'

/*
Dollar characters (e.g. in class names, for inner classes etc.) and dots (package names) seem to cause trouble in the heap viz
therefore we replace them by a dummy value
*/
export function sanitizeIdentifier (name: string) {
  return name.replaceAll('$', '_DOLLAR_SIGN_REPLACEMENT_').replaceAll('.', '_DOT_CHARACTER_REPLACEMENT_')
}

/** Graphviz node name and port of a table cell, written in DOT as `node:port`, e.g. `obj_1:next`. */
export interface GraphvizNodeAndPort { readonly node: string, readonly port: string }

/** The Graphviz node of the Statics/Stack table, see `RootsNodeRenderer.ts`. */
const ROOTS_NODE = 'roots'
/** Separates a heap item from its field or element. Java names cannot contain `-`. */
const PART_SEPARATOR = '-'
/** Separates a record identifier from a cell suffix. It cannot occur inside a record identifier. */
const CELL_SEPARATOR = '--'

/**
 * Identifier of a heap object, array or string, e.g. `obj_1`. It is also the item's Graphviz node name.
 */
export function heapItemIdentifier (heapItem: Pick<HeapItem, 'id'>): string {
  return `obj_${heapItem.id}`
}

/** Graphviz node and port of a local variable's cell: `{ node: 'roots', port: 'local_0_arr' }`. */
export function stackLocalNodeAndPort (stackFrameNumber: number, localVar: Pick<Var, 'name'>): GraphvizNodeAndPort {
  return { node: ROOTS_NODE, port: `local_${stackFrameNumber}_${sanitizeIdentifier(localVar.name)}` }
}

/** Graphviz node and port of a static field's cell: `{ node: 'roots', port: 'static_Main_count' }`. */
export function staticFieldNodeAndPort (loadedClass: Pick<LoadedClass, 'class'>, staticField: Pick<Var, 'name'>): GraphvizNodeAndPort {
  return { node: ROOTS_NODE, port: `static_${sanitizeIdentifier(loadedClass.class)}_${sanitizeIdentifier(staticField.name)}` }
}

/** Graphviz node and port of an object field's cell: `{ node: 'obj_1', port: 'next' }`. */
export function heapObjectFieldNodeAndPort (heapObject: Pick<HeapItem, 'id'>, field: Pick<Var, 'name'>): GraphvizNodeAndPort {
  return { node: heapItemIdentifier(heapObject), port: sanitizeIdentifier(field.name) }
}

/**
 * Graphviz node and port of an array element's cell: `{ node: 'obj_1', port: '3' }`. The index alone is
 * enough, because a Java field name cannot start with a digit, and DOT accepts it as a port (`obj_1:3:e`).
 */
export function heapArrayElementNodeAndPort (element: Pick<HeapArrayElementVar, 'arrayId' | 'index'>): GraphvizNodeAndPort {
  return { node: heapItemIdentifier({ id: element.arrayId }), port: String(element.index) }
}

/**
 * CSS-compatible identifier of a variable (local, static field, object field or array element), built from
 * the Graphviz node and port of its cell. Locals and statics use their port alone (`local_0_arr`,
 * `static_Main_count`), because the `local_`/`static_` prefix is already unique. Fields and array elements
 * need their heap item in front (`obj_1-next`, `obj_1-3`).
 */
export function variableIdentifier ({ node, port }: GraphvizNodeAndPort): string {
  return node === ROOTS_NODE ? port : `${node}${PART_SEPARATOR}${port}`
}

export function heapArrayElementIdentifier (element: Pick<HeapArrayElementVar, 'arrayId' | 'index'>): string {
  return variableIdentifier(heapArrayElementNodeAndPort(element))
}

export function heapObjectFieldIdentifier (heapObject: Pick<HeapItem, 'id'>, field: Pick<Var, 'name'>): string {
  return variableIdentifier(heapObjectFieldNodeAndPort(heapObject, field))
}

export function stackLocalIdentifier (stackFrameNumber: number, localVar: Pick<Var, 'name'>): string {
  return variableIdentifier(stackLocalNodeAndPort(stackFrameNumber, localVar))
}

export function staticFieldIdentifier (loadedClass: Pick<LoadedClass, 'class'>, staticField: Pick<Var, 'name'>): string {
  return variableIdentifier(staticFieldNodeAndPort(loadedClass, staticField))
}

/** Identifier of a stack frame's method header record, e.g. `stackframe_0` for `main`. */
export function stackFrameIdentifier (stackFrameNumber: number): string {
  return `stackframe_${stackFrameNumber}`
}

/**
 * Identifier of a root variable: a static field when there is no stack frame, otherwise a local
 * variable in stack frame `stackFrameNumber` (0 = `main`). This matches the root nodes built by
 * the data-structure views, e.g. `rootVariableIdentifier(arr, 0)` → `local_0_arr` and
 * `rootVariableIdentifier(head, undefined)` → `static_StaticList_head`.
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

/** Builds the unique DOM ID injected into one rendered Graphviz table cell, e.g. `obj_1-next--value`. */
export function svgCellIdentifier (recordIdentifier: string, suffix: SvgCellSuffix): string {
  return `${recordIdentifier}${CELL_SEPARATOR}${suffix}`
}

/**
 * Builds the DOM ID of the reference edge from the record `from` to the heap item `to`, for example
 * `edge-obj_1-next--obj_2`. The `edge-` prefix keeps the ID from starting with `obj_1-`, so looking up all
 * cells of object `obj_1` by that prefix does not also return the edge.
 */
export function edgeIdentifier (from: string, to: string): string {
  return `edge-${from}${CELL_SEPARATOR}${to}`
}

/** Builds the ID of a stack frame's method header cell, e.g. `stackframe_0--method`. */
export function methodHeaderIdentifier (stackFrameNumber: number): string {
  return svgCellIdentifier(stackFrameIdentifier(stackFrameNumber), SVG_CELL_SUFFIXES.method)
}

/**
 * Returns the record identifier of a cell id by removing a known cell suffix, e.g. `obj_1-next--value` →
 * `obj_1-next`. Any other id, such as a record identifier or an edge id, is returned unchanged.
 */
export function identifierFromSvgCellIdentifier (identifier: string): string {
  const suffix = Object.values(SVG_CELL_SUFFIXES).find(candidate => identifier.endsWith(`${CELL_SEPARATOR}${candidate}`))
  return suffix ? identifier.slice(0, -(suffix.length + CELL_SEPARATOR.length)) : identifier
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
