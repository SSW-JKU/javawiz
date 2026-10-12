import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFilteredHistoryStates,
  buildShownMethodFilters,
  createHistoryLookup,
  findHighlightedHistoryEntries,
  getDisplayClassName,
  getStaticFieldTargets,
  matchesAssignmentDslFilter,
  matchesCallDslFilter,
  normalizeFilterTarget,
  parseDslFilter
} from '../src/components/TheHistoryView/historyFiltering.ts'
import type { AbstractSyntaxTree } from '../src/dto/AbstractSyntaxTree.d.ts'
import type { HeapItem, LocalVar, ProcessedTraceState, StackFrame, Val } from '../src/dto/TraceState.d.ts'

const primitive = (value: string) => ({
  kind: 'PrimitiveVal' as const,
  primitiveValue: value,
  title: value,
  vizValue: value
})

const reference = (heapObjectId: number) => ({
  kind: 'ReferenceVal' as const,
  reference: heapObjectId
})

const local = (name: string, value: Val, changed: boolean): LocalVar => ({
  kind: 'Var',
  name,
  type: 'Object',
  value,
  changed,
  class: 'Example',
  method: 'run'
})

function frame (localVariables: LocalVar[]): StackFrame {
  return {
    kind: 'StackFrame',
    line: 1,
    class: 'Example',
    method: 'run',
    signature: '()V',
    displaySignature: 'run()',
    localVariables,
    conditionValues: [],
    arrayAccessValues: [],
    internal: false,
    displayText: 'run()'
  }
}

function processedState (
  stackAfterExecution: StackFrame[],
  heapBeforeExecution: HeapItem[] = [],
  heapAfterExecution: HeapItem[] = []
): ProcessedTraceState {
  return {
    kind: 'ProcessedTraceState',
    stateIndex: 0,
    localUri: 'Example.java',
    line: 1,
    heapBeforeExecution,
    stackBeforeExecution: stackAfterExecution,
    loadedClassesBeforeExecution: [],
    heapAfterExecution,
    stackAfterExecution,
    loadedClassesAfterExecution: []
  }
}

const formatValue = (value: Val): string => {
  if (value.kind === 'PrimitiveVal') return value.vizValue
  if (value.kind === 'ReferenceVal') return `reference ${value.reference}`
  return 'null'
}

const formatter = {
  formatValue,
  formatCall: () => ''
}

test('normalizes assignment targets into canonical lookup names', () => {
  assert.equal(normalizeFilterTarget('field this < Person > . values [ * ] '), 'this<Person>.values[*]')
  assert.equal(normalizeFilterTarget('static example.Person . count'), 'example.Person.count')
})

test('parses call and assignment filters and rejects unsupported queries', () => {
  assert.deepEqual(parseDslFilter('call sort'), {
    kind: 'call',
    methodName: 'sort',
    isActive: true
  })
  assert.deepEqual(parseDslFilter('numbers [ 2 ] = 7'), {
    kind: 'assignment',
    target: 'numbers[2]',
    targetValue: '7',
    isActive: true
  })
  assert.deepEqual(parseDslFilter('a + b'), {
    kind: 'inactive',
    isActive: false
  })
  assert.deepEqual(parseDslFilter('counter ='), {
    kind: 'inactive',
    isActive: false
  })
  assert.equal(parseDslFilter('   '), null)
})

test('matches exact and wildcard array targets without treating other target text as a pattern', () => {
  assert.equal(matchesAssignmentDslFilter(parseDslFilter('numbers[2] = *'), 'numbers[2]', '7'), true)
  assert.equal(matchesAssignmentDslFilter(parseDslFilter('numbers[*] = 7'), 'numbers[2]', '7'), true)
  assert.equal(matchesAssignmentDslFilter(parseDslFilter('numbers[*] = 7'), 'numbers[2]', '8'), false)
  assert.equal(matchesAssignmentDslFilter(parseDslFilter('Person.* = *'), 'Person.name', '"Ada"'), false)
})

test('matches all overloaded calls by method name', () => {
  const searchFilter = parseDslFilter('call search')

  assert.equal(matchesCallDslFilter(searchFilter, 'search'), true)
  assert.equal(matchesCallDslFilter(searchFilter, 'searched'), false)
  assert.equal(matchesCallDslFilter(parseDslFilter('search = *'), 'search'), false)
})

test('highlights every overload when searching for a method name', () => {
  const initialState = processedState([])
  const callState = (stateIndex: number, displaySignature: string): ProcessedTraceState => {
    const stackFrame: StackFrame = {
      ...frame([]),
      method: 'search',
      displaySignature
    }
    return {
      ...processedState([stackFrame]),
      stateIndex,
      stackBeforeExecution: [],
      stackAfterExecution: [stackFrame]
    }
  }
  const states = buildFilteredHistoryStates({
    trace: [
      initialState,
      callState(1, 'void search (String value)'),
      callState(2, 'void search (int value)')
    ],
    showFieldAssignments: true,
    showArrayInitialization: false,
    isShownMethod: () => true,
    formatter: {
      formatValue,
      formatCall: traceIndex => traceIndex === 1 ? 'search(String)' : 'search(int)'
    },
    lookup: createHistoryLookup()
  })

  const highlightedEntries = findHighlightedHistoryEntries(states, parseDslFilter('call search'))

  assert.deepEqual([...highlightedEntries].map(entry => entry.text), ['search(String)', 'search(int)'])
})

test('builds simple and fully qualified class lookup names', () => {
  assert.equal(getDisplayClassName('example.Person'), 'Person')
  assert.deepEqual(
    getStaticFieldTargets('example.Person', 'count'),
    ['example.Person.count', 'Person.count']
  )
})

test('deduplicates duplicate signatures and preserves overloaded shown states', () => {
  const asts = [{
    file: {
      classes: [
        {
          name: 'Second',
          methods: [{ name: 'run', signature: 'void run ()' }]
        },
        {
          name: 'First',
          methods: [
            { name: 'sort', signature: 'void sort (int value)' },
            { name: 'sort', signature: 'void sort (long value)' },
            { name: 'sort', signature: 'void sort (int value)' },
            { name: '<init>', signature: 'First First ()' }
          ]
        }
      ]
    }
  }] as unknown as AbstractSyntaxTree[]

  assert.deepEqual(buildShownMethodFilters(asts, [{
    key: 'First.void sort (long value)',
    shown: false,
    label: 'First.void sort (long value)'
  }]), [
    { key: 'First.void sort (int value)', shown: true, label: 'First.void sort (int value)' },
    { key: 'First.void sort (long value)', shown: false, label: 'First.void sort (long value)' },
    { key: 'Second.void run ()', shown: true, label: 'Second.void run ()' }
  ])
})

test('pre-filters local entries and builds a highlight-entry set', () => {
  const state = processedState([
    frame([
      local('changed', primitive('7'), true),
      local('unchanged', primitive('8'), false)
    ])
  ])
  const states = buildFilteredHistoryStates({
    trace: [state],
    showFieldAssignments: true,
    showArrayInitialization: false,
    isShownMethod: () => true,
    formatter,
    lookup: createHistoryLookup()
  })
  const highlightedEntries = findHighlightedHistoryEntries(states, parseDslFilter('changed = *'))

  assert.equal(states.length, 1)
  assert.deepEqual(states[0].entries.map(entry => entry.text), ['changed = 7'])
  assert.deepEqual([...highlightedEntries], [states[0].entries[0]])

  const hiddenStates = buildFilteredHistoryStates({
    trace: [state],
    showFieldAssignments: true,
    showArrayInitialization: false,
    isShownMethod: () => false,
    formatter,
    lookup: createHistoryLookup()
  })
  assert.deepEqual(hiddenStates, [])
})

test('pre-filters heap entries using field and array-visibility controls', () => {
  const objectBefore = {
    kind: 'HeapObject' as const,
    id: 1,
    type: 'example.Person',
    faked: false,
    fields: [{
      kind: 'Var' as const,
      name: 'age',
      type: 'int',
      value: primitive('6'),
      changed: false,
      class: 'example.Person'
    }]
  }
  const objectAfter = {
    ...objectBefore,
    fields: [{
      ...objectBefore.fields[0],
      value: primitive('7'),
      changed: true
    }]
  }
  const arrayBefore = {
    kind: 'HeapArray' as const,
    id: 2,
    type: 'int[]',
    faked: false,
    elements: [{
      kind: 'HeapArrayElementVar' as const,
      arrayId: 2,
      type: 'int',
      value: primitive('0'),
      index: 2,
      changed: false
    }]
  }
  const arrayAfter = {
    ...arrayBefore,
    elements: [{
      ...arrayBefore.elements[0],
      value: primitive('9'),
      changed: true
    }]
  }
  const state = processedState(
    [frame([
      local('person', reference(1), false),
      local('numbers', reference(2), false)
    ])],
    [objectBefore, arrayBefore],
    [objectAfter, arrayAfter]
  )
  const states = buildFilteredHistoryStates({
    trace: [state],
    showFieldAssignments: false,
    showArrayInitialization: false,
    isShownMethod: () => true,
    formatter,
    lookup: createHistoryLookup()
  })
  const highlightedEntries = findHighlightedHistoryEntries(states, parseDslFilter('numbers[2] = *'))

  assert.deepEqual(states[0].entries.map(entry => entry.text), ['numbers[2] = 9'])
  assert.equal(highlightedEntries.has(states[0].entries[0]), true)
})

test('builds and highlights call entries while respecting method and synthetic-object filters', () => {
  const callFrame = {
    ...frame([]),
    method: 'sort'
  }
  const initialState = processedState([])
  const callState = {
    ...processedState([callFrame]),
    stateIndex: 1,
    stackBeforeExecution: [],
    stackAfterExecution: [callFrame]
  }
  const options = {
    trace: [initialState, callState],
    showFieldAssignments: true,
    showArrayInitialization: false,
    isShownMethod: () => true,
    formatter: {
      formatValue,
      formatCall: () => 'Call: Example.sort()'
    },
    lookup: createHistoryLookup()
  }
  const states = buildFilteredHistoryStates(options)
  const highlightedEntries = findHighlightedHistoryEntries(states, parseDslFilter('call sort'))

  assert.equal(states.length, 1)
  assert.equal(states[0].entries[0].icon, 'call')
  assert.deepEqual([...highlightedEntries], [states[0].entries[0]])

  assert.deepEqual(buildFilteredHistoryStates({
    ...options,
    isShownMethod: () => false
  }), [])

  const syntheticReceiver = {
    kind: 'HeapObject' as const,
    id: 1,
    type: 'Example',
    faked: true,
    fields: []
  }
  const syntheticCallFrame = {
    ...callFrame,
    this: reference(1)
  }
  assert.deepEqual(buildFilteredHistoryStates({
    ...options,
    trace: [
      initialState,
      {
        ...callState,
        stackAfterExecution: [syntheticCallFrame],
        heapAfterExecution: [syntheticReceiver]
      }
    ]
  }), [])
})

test('filters overloaded runtime methods independently by display signature', () => {
  const initialState = processedState([])
  const intCallFrame: StackFrame = {
    ...frame([]),
    method: 'sort',
    displaySignature: 'void sort (int value)'
  }
  const longCallFrame: StackFrame = {
    ...frame([]),
    method: 'sort',
    displaySignature: 'void sort (long value)'
  }
  const callState = (stateIndex: number, stackFrame: StackFrame): ProcessedTraceState => ({
    ...processedState([stackFrame]),
    stateIndex,
    stackBeforeExecution: [],
    stackAfterExecution: [stackFrame]
  })

  const states = buildFilteredHistoryStates({
    trace: [initialState, callState(1, intCallFrame), callState(2, longCallFrame)],
    showFieldAssignments: true,
    showArrayInitialization: false,
    isShownMethod: (_className, methodSignature) => methodSignature === 'void sort (int value)',
    formatter: {
      formatValue,
      formatCall: () => 'Call: Example.sort()'
    },
    lookup: createHistoryLookup()
  })

  assert.deepEqual(states.map(state => state.state.stateIndex), [1])
})

test('suppresses unchanged static values and renders actual static changes', () => {
  const staticFieldBefore = {
    kind: 'Var' as const,
    name: 'count',
    type: 'int',
    value: primitive('1'),
    changed: false,
    class: 'example.Counter'
  }
  const staticFieldAfter = {
    ...staticFieldBefore,
    changed: true
  }
  const unchangedState = {
    ...processedState([frame([])]),
    loadedClassesBeforeExecution: [{
      kind: 'LoadedClass' as const,
      class: 'example.Counter',
      staticFields: [staticFieldBefore]
    }],
    loadedClassesAfterExecution: [{
      kind: 'LoadedClass' as const,
      class: 'example.Counter',
      staticFields: [staticFieldAfter]
    }]
  }
  const options = {
    trace: [unchangedState],
    showFieldAssignments: true,
    showArrayInitialization: false,
    isShownMethod: () => true,
    formatter,
    lookup: createHistoryLookup()
  }

  assert.deepEqual(buildFilteredHistoryStates(options), [])

  const changedState = {
    ...unchangedState,
    loadedClassesAfterExecution: [{
      kind: 'LoadedClass' as const,
      class: 'example.Counter',
      staticFields: [{
        ...staticFieldAfter,
        value: primitive('2')
      }]
    }]
  }
  const states = buildFilteredHistoryStates({
    ...options,
    trace: [changedState]
  })
  assert.deepEqual(states[0].entries.map(entry => entry.text), ['Counter.count = 2'])
  assert.equal(
    findHighlightedHistoryEntries(states, parseDslFilter('Counter.count = *')).has(states[0].entries[0]),
    true
  )

  const previousObject = {
    kind: 'HeapObject' as const,
    id: 1,
    type: 'example.Value',
    faked: false,
    fields: []
  }
  const currentObject = {
    ...previousObject,
    id: 2
  }
  const changedReferenceState = {
    ...unchangedState,
    heapBeforeExecution: [previousObject],
    heapAfterExecution: [currentObject],
    loadedClassesBeforeExecution: [{
      kind: 'LoadedClass' as const,
      class: 'example.Counter',
      staticFields: [{
        ...staticFieldBefore,
        type: 'example.Value',
        value: reference(1)
      }]
    }],
    loadedClassesAfterExecution: [{
      kind: 'LoadedClass' as const,
      class: 'example.Counter',
      staticFields: [{
        ...staticFieldAfter,
        type: 'example.Value',
        value: reference(2)
      }]
    }]
  }
  const changedReferenceEntries = buildFilteredHistoryStates({
    ...options,
    trace: [changedReferenceState],
    formatter: {
      formatValue: value => value.kind === 'ReferenceVal' ? 'example.Value object' : formatValue(value),
      formatCall: () => ''
    }
  })
  assert.equal(changedReferenceEntries[0].entries.length, 1)
})

test('hides static fields from heap-traversal-stop classes', () => {
  const state = {
    ...processedState([frame([])]),
    loadedClassesBeforeExecution: [],
    loadedClassesAfterExecution: [
      {
        kind: 'LoadedClass' as const,
        class: 'java.util.Properties',
        staticFields: [{
          kind: 'Var' as const,
          name: 'serialVersionUID',
          type: 'long',
          value: primitive('1'),
          changed: true,
          class: 'java.util.Properties'
        }],
        isHeapTraversalStop: true,
        isJavaDataStructure: true,
        hasCollectedFields: true
      },
      {
        kind: 'LoadedClass' as const,
        class: 'example.Counter',
        staticFields: [{
          kind: 'Var' as const,
          name: 'count',
          type: 'int',
          value: primitive('2'),
          changed: true,
          class: 'example.Counter'
        }],
        isHeapTraversalStop: false,
        isJavaDataStructure: false,
        hasCollectedFields: true
      }
    ]
  }

  const states = buildFilteredHistoryStates({
    trace: [state],
    showFieldAssignments: true,
    showArrayInitialization: false,
    isShownMethod: () => true,
    formatter,
    lookup: createHistoryLookup()
  })

  assert.deepEqual(states[0].entries.map(entry => entry.text), ['Counter.count = 2'])
})

test('uses static-field aliases for arrays and applies the initialization toggle', () => {
  const heapArray = {
    kind: 'HeapArray' as const,
    id: 4,
    type: 'int[]',
    faked: false,
    elements: [{
      kind: 'HeapArrayElementVar' as const,
      arrayId: 4,
      type: 'int',
      value: primitive('9'),
      index: 2,
      changed: true
    }]
  }
  const state = {
    ...processedState([], [], [heapArray]),
    loadedClassesAfterExecution: [{
      kind: 'LoadedClass' as const,
      class: 'example.Holder',
      staticFields: [{
        kind: 'Var' as const,
        name: 'items',
        type: 'int[]',
        value: reference(4),
        changed: false,
        class: 'example.Holder'
      }]
    }]
  }
  const options = {
    trace: [state],
    showFieldAssignments: false,
    showArrayInitialization: false,
    isShownMethod: () => true,
    formatter,
    lookup: createHistoryLookup()
  }

  assert.deepEqual(buildFilteredHistoryStates(options), [])

  const states = buildFilteredHistoryStates({
    ...options,
    showArrayInitialization: true
  })
  assert.deepEqual(states[0].entries.map(entry => entry.text), ['Holder.items[2] = 9'])
  assert.equal(
    findHighlightedHistoryEntries(states, parseDslFilter('Holder.items[2] = *')).has(states[0].entries[0]),
    true
  )
  assert.equal(
    findHighlightedHistoryEntries(states, parseDslFilter('Holder.items[*] = *')).has(states[0].entries[0]),
    true
  )
})

test('matches static array aliases when a shorter local alias is displayed', () => {
  const arrayBefore = {
    kind: 'HeapArray' as const,
    id: 5,
    type: 'int[]',
    faked: false,
    elements: [{
      kind: 'HeapArrayElementVar' as const,
      arrayId: 5,
      type: 'int',
      value: primitive('0'),
      index: 2,
      changed: false
    }]
  }
  const arrayAfter = {
    ...arrayBefore,
    elements: [{
      ...arrayBefore.elements[0],
      value: primitive('9'),
      changed: true
    }]
  }
  const state = {
    ...processedState(
      [frame([local('alias', reference(5), false)])],
      [arrayBefore],
      [arrayAfter]
    ),
    loadedClassesAfterExecution: [{
      kind: 'LoadedClass' as const,
      class: 'example.Holder',
      staticFields: [{
        kind: 'Var' as const,
        name: 'items',
        type: 'int[]',
        value: reference(5),
        changed: false,
        class: 'example.Holder'
      }],
      isHeapTraversalStop: false,
      isJavaDataStructure: false,
      hasCollectedFields: true
    }]
  }
  const states = buildFilteredHistoryStates({
    trace: [state],
    showFieldAssignments: false,
    showArrayInitialization: false,
    isShownMethod: () => true,
    formatter,
    lookup: createHistoryLookup()
  })

  assert.deepEqual(states[0].entries.map(entry => entry.text), ['alias[2] = 9'])
  assert.equal(
    findHighlightedHistoryEntries(states, parseDslFilter('Holder.items[2] = *')).has(states[0].entries[0]),
    true
  )
})

test('matches nested array and method-parameter aliases', () => {
  const objectBefore = {
    kind: 'HeapObject' as const,
    id: 6,
    type: 'example.Holder',
    faked: false,
    fields: [{
      kind: 'Var' as const,
      name: 'items',
      type: 'int[]',
      value: reference(7),
      changed: false,
      class: 'example.Holder'
    }]
  }
  const arrayBefore = {
    kind: 'HeapArray' as const,
    id: 7,
    type: 'int[]',
    faked: false,
    elements: [{
      kind: 'HeapArrayElementVar' as const,
      arrayId: 7,
      type: 'int',
      value: primitive('0'),
      index: 1,
      changed: false
    }]
  }
  const arrayAfter = {
    ...arrayBefore,
    elements: [{
      ...arrayBefore.elements[0],
      value: primitive('4'),
      changed: true
    }]
  }
  const parameterFrame = frame([local('itemsParameter', reference(7), false)])
  const callerFrame = frame([local('holder', reference(6), false)])
  const state = processedState(
    [parameterFrame, callerFrame],
    [objectBefore, arrayBefore],
    [{
      ...objectBefore,
      fields: [{
        ...objectBefore.fields[0],
        value: reference(7)
      }]
    }, arrayAfter]
  )
  const states = buildFilteredHistoryStates({
    trace: [state],
    showFieldAssignments: false,
    showArrayInitialization: false,
    isShownMethod: () => true,
    formatter,
    lookup: createHistoryLookup()
  })

  assert.deepEqual(states[0].entries.map(entry => entry.text), ['holder.items[1] = 4'])
  assert.equal(
    findHighlightedHistoryEntries(states, parseDslFilter('holder.items[1] = *')).has(states[0].entries[0]),
    true
  )
  assert.equal(
    findHighlightedHistoryEntries(states, parseDslFilter('itemsParameter[1] = *')).has(states[0].entries[0]),
    true
  )
})

test('keeps changed arrays visible when no source alias can be resolved', () => {
  const arrayBefore = {
    kind: 'HeapArray' as const,
    id: 8,
    type: 'int[]',
    faked: false,
    elements: [{
      kind: 'HeapArrayElementVar' as const,
      arrayId: 8,
      type: 'int',
      value: primitive('0'),
      index: 0,
      changed: false
    }]
  }
  const arrayAfter = {
    ...arrayBefore,
    elements: [{
      ...arrayBefore.elements[0],
      value: primitive('1'),
      changed: true
    }]
  }
  const state = processedState([], [arrayBefore], [arrayAfter])
  const states = buildFilteredHistoryStates({
    trace: [state],
    showFieldAssignments: false,
    showArrayInitialization: false,
    isShownMethod: () => true,
    formatter,
    lookup: createHistoryLookup()
  })

  assert.deepEqual(states[0].entries.map(entry => entry.text), ['Unknown[0] = 1'])
  assert.equal(
    findHighlightedHistoryEntries(states, parseDslFilter('Unknown[0] = *')).has(states[0].entries[0]),
    false
  )
})

test('clears state-index alias caches before reusing indexes for a new trace', () => {
  const firstObject = {
    kind: 'HeapObject' as const,
    id: 1,
    type: 'First',
    faked: false,
    fields: []
  }
  const secondObject = {
    kind: 'HeapObject' as const,
    id: 2,
    type: 'Second',
    faked: false,
    fields: []
  }
  const firstState = processedState(
    [frame([local('first', reference(1), false)])],
    [],
    [firstObject]
  )
  const secondState = processedState(
    [frame([local('second', reference(2), false)])],
    [],
    [secondObject]
  )
  const lookup = createHistoryLookup()

  assert.equal(lookup.getDisplayName(1, firstState), 'first')
  assert.equal(lookup.getDisplayName(2, secondState), 'Unknown')

  lookup.clear()
  assert.equal(lookup.getDisplayName(2, secondState), 'second')
})
