import type { HeapItem, ProcessedTraceState, StackFrame, Val } from '../../dto/TraceState'
import type { AbstractSyntaxTree } from '../../dto/AbstractSyntaxTree'
import { buildHeapAliasIndex, type HeapAliasIndex } from './HeapAliasIndex.ts'
import type { HistoryFormatter } from './historyFormatting.ts'

export interface AssignmentDslFilter {
  kind: 'assignment'
  target: string
  targetValue: string
  isActive: true
}

export interface CallDslFilter {
  kind: 'call'
  methodName: string
  isActive: true
}

export interface InactiveDslFilter {
  kind: 'inactive'
  isActive: false
}

export type DslFilter = AssignmentDslFilter | CallDslFilter | InactiveDslFilter

export interface HistoryLookup {
  clear: () => void
  getArrayElementTargets: (
    heapObjectId: number,
    elementIndex: number,
    state: ProcessedTraceState
  ) => string[]
  getDisplayName: (heapObjectId: number, state: ProcessedTraceState) => string
  getObjectFieldTargets: (
    heapItem: HeapItem,
    fieldName: string,
    state: ProcessedTraceState
  ) => string[]
}

export type HistoryEntryIcon =
  | 'array-element'
  | 'call'
  | 'constructor'
  | 'local'
  | 'object-field'
  | 'static-field'
  | 'static-initializer'

export interface FilteredHistoryEntry {
  key: string
  icon: HistoryEntryIcon
  text: string
  match: HistoryEntryMatch
  isCall: boolean
  extraIndent: number
}

export type HistoryEntryMatch =
  | {
    kind: 'assignment'
    names: string | readonly string[]
    value: string
  }
  | {
    kind: 'call'
    methodName: string | undefined
  }

export interface FilteredHistoryState {
  state: ProcessedTraceState
  traceIndex: number
  entries: FilteredHistoryEntry[]
}

export interface HistoryDatasetOptions {
  trace: readonly ProcessedTraceState[]
  showFieldAssignments: boolean
  showArrayInitialization: boolean
  isMethodEnabled: (className: string, methodName: string) => boolean
  formatter: HistoryFormatter
  lookup: HistoryLookup
}

export interface MethodFilter {
  key: string
  checked: boolean
  label: string
}

// Removes optional legacy DSL prefixes so all assignment targets use the same canonical lookup form.
const LEGACY_TARGET_PREFIX_PATTERN = /^(?:var|field|static)\s+/i

// Normalizes array-index spacing while retaining numeric and wildcard indices for target lookup.
const ARRAY_INDEX_SPACING_PATTERN = /\s*\[\s*(\d+|\*)\s*\]/g

// Normalizes typed-receiver spacing so equivalent class-qualified targets compare identically.
const TYPED_RECEIVER_SPACING_PATTERN = /\s*<\s*([a-zA-Z_$][a-zA-Z0-9_.$]*)\s*>\s*/g

// Normalizes field-access spacing so equivalent dotted target paths compare identically.
const FIELD_ACCESS_SPACING_PATTERN = /\s*\.\s*/g

// Recognizes method-call filters while rejecting additional text that would make the lookup ambiguous.
const CALL_FILTER_PATTERN = /^call\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*$/i

// Separates assignment targets from requested values so both sides can be matched independently.
const ASSIGNMENT_FILTER_PATTERN = /^\s*([^=]+?)\s*=\s*(.+?)\s*$/

// Escapes target text before converting supported DSL wildcards into safe regular-expression matching.
const REGEX_SPECIAL_CHARACTERS_PATTERN = /[.*+?^${}()|[\]\\]/g

// Locates escaped array wildcards so they can match concrete runtime indices without changing other target text.
const ESCAPED_ARRAY_WILDCARD_PATTERN = /\\\[\\\*\\\]/g

/**
 * Canonicalizes a DSL assignment target for comparison with generated
 * history-entry targets.
 *
 * @param target - User-entered target expression.
 * @returns The target without legacy prefixes or insignificant whitespace.
 */
export function normalizeFilterTarget (target: string): string {
  return target
    .replace(LEGACY_TARGET_PREFIX_PATTERN, '')
    .replace(ARRAY_INDEX_SPACING_PATTERN, '[$1]')
    .replace(TYPED_RECEIVER_SPACING_PATTERN, '<$1>')
    .replace(FIELD_ACCESS_SPACING_PATTERN, '.')
    .trim()
}

/**
 * Parses a History View query into one of the supported DSL filter variants.
 *
 * @param rawQuery - Unprocessed query entered in the History View.
 * @returns A parsed filter, or `null` for an empty query.
 */
export function parseDslFilter (rawQuery: string): DslFilter | null {
  const query = rawQuery.trim()
  if (!query) return null

  const callMatch = query.match(CALL_FILTER_PATTERN)
  if (callMatch) {
    return {
      kind: 'call',
      methodName: callMatch[1],
      isActive: true
    }
  }

  const assignmentMatch = query.match(ASSIGNMENT_FILTER_PATTERN)
  if (assignmentMatch) {
    return {
      kind: 'assignment',
      target: normalizeFilterTarget(assignmentMatch[1]),
      targetValue: assignmentMatch[2].trim(),
      isActive: true
    }
  }

  return {
    kind: 'inactive',
    isActive: false
  }
}

/**
 * Tests an assignment history entry against a parsed assignment filter.
 *
 * @param filter - Active History View filter.
 * @param names - Canonical target names associated with the history entry.
 * @param value - Display value assigned by the history entry.
 * @returns `true` when a target name and the requested value both match.
 */
export function matchesAssignmentDslFilter (
  filter: DslFilter | null,
  names: string | readonly string[],
  value: string
): boolean {
  if (!filter || filter.kind !== 'assignment') return false

  const nameArray = Array.isArray(names) ? names : [names]
  return createAssignmentNameMatcher(filter.target)(nameArray) &&
    (filter.targetValue === '*' || value === filter.targetValue)
}

/**
 * Creates a reusable assignment-target matcher so wildcard regular expressions
 * are compiled once per active filter rather than once per history entry.
 *
 * @param target - Canonical assignment target from the parsed DSL filter.
 * @returns Matcher for one or more canonical history-entry names.
 */
function createAssignmentNameMatcher (
  target: string
): (names: readonly string[]) => boolean {
  if (!target.includes('[*]')) {
    return names => names.includes(target)
  }

  const escapedTarget = target.replace(REGEX_SPECIAL_CHARACTERS_PATTERN, '\\$&')
  // Builds an exact target matcher that allows array wildcards to select concrete runtime indices.
  const targetRegex = new RegExp(`^${escapedTarget.replace(ESCAPED_ARRAY_WILDCARD_PATTERN, '\\[\\d+\\]')}$`)
  return names => names.some(name => targetRegex.test(name))
}

/**
 * Tests a method name against a parsed call filter.
 *
 * @param filter - Active History View filter.
 * @param methodName - Runtime method name associated with the history entry.
 * @returns `true` when the filter requests the supplied method name.
 */
export function matchesCallDslFilter (
  filter: DslFilter | null,
  methodName: string | undefined
): boolean {
  return filter?.kind === 'call' && methodName === filter.methodName
}

/**
 * Produces the accepted exact-type spellings for a runtime class.
 *
 * @param typeName - Fully qualified or simple runtime class name.
 * @returns The fully qualified name followed by its simple name, without duplicates.
 */
function getClassNames (typeName: string): string[] {
  const simpleName = typeName.split('.').at(-1) ?? typeName
  return simpleName === typeName ? [typeName] : [typeName, simpleName]
}

/**
 * Selects the simple display name of a runtime class.
 *
 * @param typeName - Fully qualified or simple runtime class name.
 * @returns The simple class name.
 */
export function getDisplayClassName (typeName: string): string {
  return getClassNames(typeName).at(-1) ?? typeName
}

/**
 * Builds the DSL targets that identify a class field by fully qualified or
 * simple class name.
 *
 * @param className - Runtime class that owns the field.
 * @param fieldName - Name of the field.
 * @returns Canonical class-field targets accepted by the filter.
 */
export function getStaticFieldTargets (className: string, fieldName: string): string[] {
  return getClassNames(className).map(name => `${name}.${fieldName}`)
}

/**
 * Builds the deduplicated method-filter controls represented by the current
 * source ASTs.
 *
 * Existing checked states are retained so recompilation does not reset the
 * user's method visibility choices. Overloaded methods share one filter because
 * runtime matching is based on class and method name rather than signature.
 *
 * @param asts - Source ASTs used to discover class and method names.
 * @param existingFilters - Current controls whose checked state should be retained.
 * @returns Alphabetically sorted class-qualified method filters.
 */
export function buildMethodFilters (
  asts: readonly AbstractSyntaxTree[],
  existingFilters: readonly MethodFilter[]
): MethodFilter[] {
  const checkedByKey = new Map(existingFilters.map(filter => [filter.key, filter.checked]))
  const filtersByKey = new Map<string, MethodFilter>()

  for (const ast of asts) {
    for (const sourceClass of ast.file.classes) {
      for (const method of sourceClass.methods) {
        if (method.name === '<init>') continue

        const key = methodKey(sourceClass.name, method.name)
        filtersByKey.set(key, {
          key,
          checked: checkedByKey.get(key) ?? true,
          label: key
        })
      }
    }
  }

  return [...filtersByKey.values()]
    .sort((first, second) => first.label.localeCompare(second.label))
}

/**
 * Builds the stable identity used by method-filter controls and runtime lookup.
 *
 * @param className - Class that declares the method.
 * @param methodName - Name of the method.
 * @returns Class-qualified method name.
 */
export function methodKey (className: string, methodName: string): string {
  return `${className}.${methodName}`
}

/**
 * Builds the visible History View entries from the current trace and visibility
 * controls.
 *
 * @param options - Trace data, visibility controls, formatting callbacks, and alias lookup.
 * @returns Pre-filtered state groups ready for rendering and DSL matching.
 */
export function buildFilteredHistoryStates (options: HistoryDatasetOptions): FilteredHistoryState[] {
  return options.trace.flatMap((state, traceIndex) => {
    const entries = buildEntriesForState(options, state, traceIndex)
    return entries.length > 0 ? [{ state, traceIndex, entries }] : []
  })
}

/**
 * Builds all visible entry categories for one processed trace state.
 *
 * @param options - Shared dataset construction dependencies.
 * @param state - Processed trace state to convert.
 * @param traceIndex - Zero-based index of the state in the processed trace.
 * @returns Ordered render entries for the state.
 */
function buildEntriesForState (
  options: HistoryDatasetOptions,
  state: ProcessedTraceState,
  traceIndex: number
): FilteredHistoryEntry[] {
  const methodCall = isMethodCall(options.trace, traceIndex)
  const topFrameEnabled = isTopStackFrameEnabled(state.stackAfterExecution, options.isMethodEnabled)
  if (!topFrameEnabled) return []

  return [
    ...buildCallEntries(options, state, traceIndex, methodCall),
    ...buildLocalEntries(options, state, traceIndex, methodCall),
    ...buildStaticFieldEntries(options, state, traceIndex),
    ...buildHeapEntries(options, state, traceIndex)
  ]
}

/**
 * Builds the optional call entry for a processed trace state.
 *
 * @param options - Shared dataset construction dependencies.
 * @param state - Processed trace state to convert.
 * @param traceIndex - Zero-based index of the state in the processed trace.
 * @param methodCall - Whether the state pushed a stack frame.
 * @returns Zero or one call entry.
 */
function buildCallEntries (
  options: HistoryDatasetOptions,
  state: ProcessedTraceState,
  traceIndex: number,
  methodCall: boolean
): FilteredHistoryEntry[] {
  if (!methodCall || isFakedCall(state)) return []

  const methodName = state.stackAfterExecution[0]?.method
  return [createEntry(
    `state:${state.stateIndex}:call`,
    getCallIcon(methodName),
    options.formatter.formatCall(traceIndex),
    { kind: 'call', methodName },
    true
  )]
}

/**
 * Builds changed local-variable entries for a non-call state.
 *
 * @param options - Shared dataset construction dependencies.
 * @param state - Processed trace state to convert.
 * @param traceIndex - Zero-based index of the state in the processed trace.
 * @param methodCall - Whether the state pushed a stack frame.
 * @returns Visible local-variable entries.
 */
function buildLocalEntries (
  options: HistoryDatasetOptions,
  state: ProcessedTraceState,
  traceIndex: number,
  methodCall: boolean
): FilteredHistoryEntry[] {
  if (methodCall) return []

  return state.stackAfterExecution.flatMap((stackFrame, stackIndex) => {
    if (!options.isMethodEnabled(stackFrame.class, stackFrame.method)) return []

    return stackFrame.localVariables.flatMap((localVariable, localIndex) => {
      if (!localVariable.changed) return []

      const value = options.formatter.formatValue(
        localVariable.value,
        state.heapAfterExecution,
        localVariable.type,
        traceIndex
      )
      return [createEntry(
        `state:${state.stateIndex}:local:${stackIndex}:${localIndex}:${localVariable.name}`,
        'local',
        `${localVariable.name} = ${value}`,
        { kind: 'assignment', names: localVariable.name, value }
      )]
    })
  })
}

/**
 * Builds changed static-field entries for a processed trace state.
 *
 * @param options - Shared dataset construction dependencies.
 * @param state - Processed trace state to convert.
 * @param traceIndex - Zero-based index of the state in the processed trace.
 * @returns Visible static-field entries.
 */
function buildStaticFieldEntries (
  options: HistoryDatasetOptions,
  state: ProcessedTraceState,
  traceIndex: number
): FilteredHistoryEntry[] {
  if (!options.showFieldAssignments) return []

  return state.loadedClassesAfterExecution.flatMap((loadedClass, loadedClassIndex) =>
    loadedClass.staticFields.flatMap((staticField, staticFieldIndex) => {
      if (!staticField.changed ||
        isStrangeStaticChange(staticField, loadedClass.class, state)) {
        return []
      }

      const value = options.formatter.formatValue(
        staticField.value,
        state.heapAfterExecution,
        staticField.type,
        traceIndex
      )
      return [createEntry(
        `state:${state.stateIndex}:static:${loadedClassIndex}:${staticFieldIndex}:${staticField.name}`,
        'static-field',
        `${getDisplayClassName(loadedClass.class)}.${staticField.name} = ${value}`,
        {
          kind: 'assignment',
          names: getStaticFieldTargets(loadedClass.class, staticField.name),
          value
        }
      )]
    })
  )
}

/**
 * Builds changed object-field and array-element entries for a processed trace
 * state.
 *
 * @param options - Shared dataset construction dependencies.
 * @param state - Processed trace state to convert.
 * @param traceIndex - Zero-based index of the state in the processed trace.
 * @returns Visible heap entries.
 */
function buildHeapEntries (
  options: HistoryDatasetOptions,
  state: ProcessedTraceState,
  traceIndex: number
): FilteredHistoryEntry[] {
  return state.heapAfterExecution.flatMap(heapItem => {
    if (heapItem.faked) return []
    if (heapItem.kind === 'HeapObject') {
      return options.showFieldAssignments
        ? buildObjectFieldEntries(options, state, traceIndex, heapItem)
        : []
    }
    if (heapItem.kind === 'HeapArray') {
      return buildArrayElementEntries(options, state, traceIndex, heapItem)
    }
    return []
  })
}

/**
 * Builds changed field entries for one heap object.
 *
 * @param options - Shared dataset construction dependencies.
 * @param state - Processed trace state containing the object.
 * @param traceIndex - Zero-based index of the state in the processed trace.
 * @param heapObject - Heap object whose fields should be converted.
 * @returns Visible object-field entries.
 */
function buildObjectFieldEntries (
  options: HistoryDatasetOptions,
  state: ProcessedTraceState,
  traceIndex: number,
  heapObject: Extract<HeapItem, { kind: 'HeapObject' }>
): FilteredHistoryEntry[] {
  return heapObject.fields.flatMap((field, fieldIndex) => {
    if (!field.changed || isStrangeFieldChange(field, heapObject, state)) return []

    const value = options.formatter.formatValue(field.value, state.heapAfterExecution, field.type, traceIndex)
    return [createEntry(
      `state:${state.stateIndex}:object:${heapObject.id}:${fieldIndex}:${field.name}`,
      'object-field',
      `${options.lookup.getDisplayName(heapObject.id, state)}.${field.name} = ${value}`,
      {
        kind: 'assignment',
        names: options.lookup.getObjectFieldTargets(heapObject, field.name, state),
        value
      }
    )]
  })
}

/**
 * Builds changed element entries for one heap array.
 *
 * @param options - Shared dataset construction dependencies.
 * @param state - Processed trace state containing the array.
 * @param traceIndex - Zero-based index of the state in the processed trace.
 * @param heapArray - Heap array whose elements should be converted.
 * @returns Visible array-element entries.
 */
function buildArrayElementEntries (
  options: HistoryDatasetOptions,
  state: ProcessedTraceState,
  traceIndex: number,
  heapArray: Extract<HeapItem, { kind: 'HeapArray' }>
): FilteredHistoryEntry[] {
  const displayName = options.lookup.getDisplayName(heapArray.id, state)
  const arrayInitialization = isArrayInitialization(state, heapArray.id)
  if (!options.showArrayInitialization && arrayInitialization) return []

  return heapArray.elements.flatMap((element, elementIndex) => {
    if (!element.changed) return []

    const value = options.formatter.formatValue(element.value, state.heapAfterExecution, element.type, traceIndex)
    return [createEntry(
      `state:${state.stateIndex}:array:${heapArray.id}:${elementIndex}:${element.index}`,
      'array-element',
      `${displayName}[${element.index}] = ${value}`,
      {
        kind: 'assignment',
        names: options.lookup.getArrayElementTargets(heapArray.id, element.index, state),
        value
      },
      false,
      arrayInitialization ? 1 : 0
    )]
  })
}

/**
 * Selects the icon category for a method call.
 *
 * @param methodName - Runtime name of the called method.
 * @returns Icon category for a constructor, static initializer, or regular call.
 */
function getCallIcon (methodName: string | undefined): HistoryEntryIcon {
  if (methodName === '<init>') return 'constructor'
  if (methodName === '<clinit>') return 'static-initializer'
  return 'call'
}

/**
 * Builds the set of prepared entries that match the active DSL filter.
 *
 * @param states - Pre-filtered History View state groups.
 * @param filter - Active parsed DSL filter.
 * @returns Entry references that the template should highlight.
 */
export function findHighlightedHistoryEntries (
  states: readonly FilteredHistoryState[],
  filter: DslFilter | null
): ReadonlySet<FilteredHistoryEntry> {
  const highlightedEntries = new Set<FilteredHistoryEntry>()
  if (!filter || filter.kind === 'inactive') return highlightedEntries

  const matchesEntry = createHistoryEntryMatcher(filter)
  states.forEach(state => {
    state.entries.forEach(entry => {
      if (matchesEntry(entry)) highlightedEntries.add(entry)
    })
  })

  return highlightedEntries
}

/**
 * Creates the entry predicate used to rebuild the highlight set for one parsed
 * filter.
 *
 * @param filter - Active assignment or call filter.
 * @returns Predicate that accepts matching prepared history entries.
 */
function createHistoryEntryMatcher (
  filter: AssignmentDslFilter | CallDslFilter
): (entry: FilteredHistoryEntry) => boolean {
  if (filter.kind === 'call') {
    return entry => entry.match.kind === 'call' && entry.match.methodName === filter.methodName
  }

  const namesMatch = createAssignmentNameMatcher(filter.target)
  return entry => {
    if (entry.match.kind !== 'assignment') return false
    const names = Array.isArray(entry.match.names) ? entry.match.names : [entry.match.names]
    return namesMatch(names) &&
      (filter.targetValue === '*' || entry.match.value === filter.targetValue)
  }
}

/**
 * Creates one render-ready History View entry with shared navigation and
 * indentation metadata.
 *
 * @param key - Stable identifier for highlighting and Vue rendering.
 * @param icon - Visual category rendered for the entry.
 * @param text - Preformatted entry text.
 * @param match - Lookup metadata used when rebuilding the highlight set.
 * @param isCall - Whether call-specific indentation applies.
 * @param extraIndent - Additional indentation levels.
 * @returns A render-ready history entry.
 */
function createEntry (
  key: string,
  icon: HistoryEntryIcon,
  text: string,
  match: HistoryEntryMatch,
  isCall = false,
  extraIndent = 0
): FilteredHistoryEntry {
  return { key, icon, text, match, isCall, extraIndent }
}

/**
 * Detects whether executing a trace state pushed a stack frame.
 *
 * @param trace - Complete processed trace.
 * @param traceIndex - Zero-based processed-trace index to inspect.
 * @returns `true` for a non-initial entry whose post-execution stack is deeper than its pre-execution stack.
 */
function isMethodCall (trace: readonly ProcessedTraceState[], traceIndex: number): boolean {
  if (traceIndex === 0) return false
  const executedLine = trace[traceIndex]
  return executedLine.stackAfterExecution.length > executedLine.stackBeforeExecution.length
}

/**
 * Checks whether the top stack frame is enabled by the method filters.
 *
 * @param stack - Post-execution call stack to inspect.
 * @param isMethodEnabled - Method-filter lookup callback.
 * @returns `true` for an empty stack or an enabled top frame.
 */
function isTopStackFrameEnabled (
  stack: readonly StackFrame[],
  isMethodEnabled: HistoryDatasetOptions['isMethodEnabled']
): boolean {
  if (stack.length === 0) return true
  const frame = stack[0]
  return isMethodEnabled(frame.class, frame.method)
}

/**
 * Checks whether the post-execution receiver is marked as a synthetic heap
 * item in either heap snapshot.
 *
 * @param state - Processed trace state to inspect.
 * @returns `true` when the receiver's heap item has the `faked` flag.
 */
function isFakedCall (state: ProcessedTraceState): boolean {
  const frame = state.stackAfterExecution[0]
  if (!frame?.this || frame.this.kind !== 'ReferenceVal') return false

  const heapItem = state.heapAfterExecution.find(item => item.id === frame.this?.reference)
    ?? state.heapBeforeExecution.find(item => item.id === frame.this?.reference)
  return heapItem?.faked ?? false
}

/**
 * Detects a static field that is marked as changed although its formatted value
 * is unchanged from the pre-execution state.
 *
 * @param staticField - Post-execution static field.
 * @param className - Class containing the static field.
 * @param state - Processed trace state containing both heap snapshots.
 * @returns `true` when the before and after values are semantically equal.
 */
function isStrangeStaticChange (
  staticField: ProcessedTraceState['loadedClassesAfterExecution'][number]['staticFields'][number],
  className: string,
  state: ProcessedTraceState
): boolean {
  const previousClass = state.loadedClassesBeforeExecution.find(candidate => candidate.class === className)
  const previousField = previousClass?.staticFields.find(candidate => candidate.name === staticField.name)
  if (!previousField) return false

  return traceValuesEqual(
    previousField.value,
    state.heapBeforeExecution,
    staticField.value,
    state.heapAfterExecution
  )
}

/**
 * Compares trace values using the same object identity and string-content
 * semantics as processed-trace change detection.
 *
 * @param previousValue - Value before execution.
 * @param previousHeap - Heap snapshot before execution.
 * @param currentValue - Value after execution.
 * @param currentHeap - Heap snapshot after execution.
 * @returns `true` when the values represent the same observable value.
 */
function traceValuesEqual (
  previousValue: Val,
  previousHeap: readonly HeapItem[],
  currentValue: Val,
  currentHeap: readonly HeapItem[]
): boolean {
  if (previousValue.kind !== currentValue.kind) return false
  if (previousValue.kind === 'NullVal' && currentValue.kind === 'NullVal') return true
  if (previousValue.kind === 'PrimitiveVal' && currentValue.kind === 'PrimitiveVal') {
    return previousValue.primitiveValue === currentValue.primitiveValue
  }
  if (previousValue.kind !== 'ReferenceVal' || currentValue.kind !== 'ReferenceVal') return false

  const previousItem = previousHeap.find(item => item.id === previousValue.reference)
  const currentItem = currentHeap.find(item => item.id === currentValue.reference)
  if (!previousItem || !currentItem) return previousItem === currentItem
  if (previousItem.kind !== currentItem.kind) return false
  if (previousItem.kind === 'HeapString' && currentItem.kind === 'HeapString') {
    return previousItem.string === currentItem.string
  }
  return previousItem.id === currentItem.id
}

/**
 * Detects an object field that is marked as changed although its underlying
 * value is unchanged from the pre-execution state.
 *
 * @param field - Post-execution object field.
 * @param heapItem - Post-execution heap item containing the field.
 * @param state - Processed trace state containing both heap snapshots.
 * @returns `true` when the before and after values have the same kind and value.
 */
function isStrangeFieldChange (
  field: Extract<HeapItem, { kind: 'HeapObject' }>['fields'][number],
  heapItem: Extract<HeapItem, { kind: 'HeapObject' }>,
  state: ProcessedTraceState
): boolean {
  const previousHeapItem = state.heapBeforeExecution.find(item => item.id === heapItem.id)
  if (!previousHeapItem || previousHeapItem.kind !== 'HeapObject') return false

  const previousField = previousHeapItem.fields.find(candidate => candidate.name === field.name)
  if (!previousField || field.value.kind !== previousField.value.kind) return false

  if (field.value.kind === 'PrimitiveVal' && previousField.value.kind === 'PrimitiveVal') {
    return field.value.vizValue === previousField.value.vizValue
  }
  if (field.value.kind === 'ReferenceVal' && previousField.value.kind === 'ReferenceVal') {
    return field.value.reference === previousField.value.reference
  }
  return field.value.kind === 'NullVal' && previousField.value.kind === 'NullVal'
}

/**
 * Checks whether an array first appears in the processed trace at an entry.
 *
 * @param state - Processed trace state to inspect.
 * @param heapObjectId - Heap object ID of the array.
 * @returns `true` when the pre-execution heap lacks the array.
 */
function isArrayInitialization (
  state: ProcessedTraceState,
  heapObjectId: number
): boolean {
  return !state.heapBeforeExecution.some(item => item.id === heapObjectId)
}

/**
 * Creates the cached heap-alias lookup used by History View target matching
 * and display-name selection.
 *
 * @returns Lookup operations sharing one clearable alias-index cache.
 */
export function createHistoryLookup (): HistoryLookup {
  const heapAliasIndexes = new Map<number, HeapAliasIndex>()

  /**
   * Retrieves aliases for a heap item, building and caching the state's alias
   * index on first access.
   *
   * @param heapObjectId - ID of the heap item whose aliases are requested.
   * @param state - Processed trace state that defines the stack and heap graph.
   * @returns Known source-level paths to the heap item, or an empty array.
   */
  function getHeapAliases (heapObjectId: number, state: ProcessedTraceState): readonly string[] {
    let aliasIndex = heapAliasIndexes.get(state.stateIndex)
    if (!aliasIndex) {
      aliasIndex = buildHeapAliasIndex(state.stackAfterExecution, state.heapAfterExecution, {
        loadedClasses: state.loadedClassesAfterExecution
      })
      heapAliasIndexes.set(state.stateIndex, aliasIndex)
    }
    return aliasIndex.get(heapObjectId) ?? []
  }

  /**
   * Builds DSL targets for a changed array element from every known alias of
   * the containing array.
   *
   * @param heapObjectId - Heap object ID of the containing array.
   * @param elementIndex - Zero-based index of the changed element.
   * @param state - Processed trace state in which aliases are resolved.
   * @returns Canonical array-element targets accepted by the filter.
   */
  function getArrayElementTargets (
    heapObjectId: number,
    elementIndex: number,
    state: ProcessedTraceState
  ): string[] {
    return getHeapAliases(heapObjectId, state)
      .map(name => `${name}[${elementIndex}]`)
  }

  /**
   * Builds every supported DSL target for a changed object field.
   *
   * @param heapItem - Heap item containing the changed field.
   * @param fieldName - Name of the changed field.
   * @param state - Processed trace state in which aliases are resolved.
   * @returns Deduplicated canonical field targets accepted by the filter.
   */
  function getObjectFieldTargets (
    heapItem: HeapItem,
    fieldName: string,
    state: ProcessedTraceState
  ): string[] {
    const receiverTargets = getHeapAliases(heapItem.id, state)
      .map(name => `${name}.${fieldName}`)
    const classTargets = getClassNames(heapItem.type)
      .map(name => `${name}.${fieldName}`)
    const thisReference = state.stackAfterExecution[0]?.this
    const typedThisTargets = thisReference?.kind === 'ReferenceVal' && thisReference.reference === heapItem.id
      ? getClassNames(heapItem.type).map(name => `this<${name}>.${fieldName}`)
      : []

    return [...new Set([...receiverTargets, ...classTargets, ...typedThisTargets])]
  }

  /**
   * Selects the shortest known source-level alias for a heap item.
   *
   * @param heapObjectId - ID of the heap item to name.
   * @param state - Processed trace state in which aliases are resolved.
   * @returns The shortest alias, or `Unknown` when no alias is available.
   */
  function getDisplayName (heapObjectId: number, state: ProcessedTraceState): string {
    const names = getHeapAliases(heapObjectId, state)
    if (names.length === 0) return 'Unknown'
    return names.reduce((shortest, name) => name.length < shortest.length ? name : shortest)
  }

  return {
    clear: () => heapAliasIndexes.clear(),
    getArrayElementTargets,
    getDisplayName,
    getObjectFieldTargets
  }
}
