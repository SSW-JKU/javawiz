import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFilteredHistoryStates,
  buildMethodFilters,
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

test('matches method names only for call filters', () => {
  assert.equal(matchesCallDslFilter(parseDslFilter('call sort'), 'sort'), true)
  assert.equal(matchesCallDslFilter(parseDslFilter('call sort'), 'sorted'), false)
  assert.equal(matchesCallDslFilter(parseDslFilter('sort = *'), 'sort'), false)
})

test('builds simple and fully qualified class lookup names', () => {
  assert.equal(getDisplayClassName('example.Person'), 'Person')
  assert.deepEqual(
    getStaticFieldTargets('example.Person', 'count'),
    ['example.Person.count', 'Person.count']
  )
})

test('deduplicates overloaded method filters and preserves checked states', () => {
  const asts = [{
    file: {
      classes: [
        {
          name: 'Second',
          methods: [{ name: 'run' }]
        },
        {
          name: 'First',
          methods: [{ name: 'sort' }, { name: 'sort' }, { name: '<init>' }]
        }
      ]
    }
  }] as unknown as AbstractSyntaxTree[]

  assert.deepEqual(buildMethodFilters(asts, [{
    key: 'First.sort',
    checked: false,
    label: 'First.sort'
  }]), [
    { key: 'First.sort', checked: false, label: 'First.sort' },
    { key: 'Second.run', checked: true, label: 'Second.run' }
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
    isMethodEnabled: () => true,
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
    isMethodEnabled: () => false,
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
    isMethodEnabled: () => true,
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
    isMethodEnabled: () => true,
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
    isMethodEnabled: () => false
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
    isMethodEnabled: () => true,
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
    isMethodEnabled: () => true,
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
