import assert from 'node:assert/strict'
import test from 'node:test'
import { createHistoryFormatter } from '../src/components/TheHistoryView/historyFormatting.ts'
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

const local = (name: string, value: Val, type = 'Object'): LocalVar => ({
  kind: 'Var',
  name,
  type,
  value,
  changed: false,
  class: 'Example',
  method: 'run'
})

function frame (
  method: string,
  localVariables: LocalVar[] = [],
  thisHeapObjectId?: number
): StackFrame {
  return {
    kind: 'StackFrame',
    line: 1,
    class: 'example.Person',
    method,
    signature: '()V',
    displaySignature: `${method}()`,
    localVariables,
    conditionValues: [],
    arrayAccessValues: [],
    this: thisHeapObjectId === undefined ? undefined : reference(thisHeapObjectId),
    internal: false,
    displayText: `${method}()`
  }
}

function state (
  stateIndex: number,
  stackBeforeExecution: StackFrame[] = [],
  stackAfterExecution: StackFrame[] = [],
  heapBeforeExecution: HeapItem[] = [],
  heapAfterExecution: HeapItem[] = []
): ProcessedTraceState {
  return {
    kind: 'ProcessedTraceState',
    stateIndex,
    localUri: 'Example.java',
    line: 1,
    heapBeforeExecution,
    stackBeforeExecution,
    loadedClassesBeforeExecution: [],
    heapAfterExecution,
    stackAfterExecution,
    loadedClassesAfterExecution: []
  }
}

test('formats primitive, character, null, and unknown-reference values', () => {
  const formatter = createHistoryFormatter([])

  assert.equal(formatter.formatValue(primitive('7'), [], 'int'), '7')
  assert.equal(formatter.formatValue(primitive('A'), [], 'char'), '\'A\'')
  assert.equal(formatter.formatValue({ kind: 'NullVal' }, []), 'null')
  assert.equal(formatter.formatValue(reference(99), []), 'Unknown reference')
})

test('formats strings and every resolvable nested-array dimension', () => {
  const innerArray = {
    kind: 'HeapArray' as const,
    id: 2,
    type: 'int[]',
    faked: false,
    elements: [
      { kind: 'HeapArrayElementVar' as const, arrayId: 2, type: 'int', value: primitive('1'), index: 0, changed: false },
      { kind: 'HeapArrayElementVar' as const, arrayId: 2, type: 'int', value: primitive('2'), index: 1, changed: false }
    ]
  }
  const outerArray = {
    kind: 'HeapArray' as const,
    id: 1,
    type: 'int[][]',
    faked: false,
    elements: [
      { kind: 'HeapArrayElementVar' as const, arrayId: 1, type: 'int[]', value: reference(2), index: 0, changed: false }
    ]
  }
  const string = {
    kind: 'HeapString' as const,
    id: 3,
    type: 'java.lang.String',
    faked: false,
    string: 'hello',
    vizString: 'hello',
    charArr: {
      kind: 'Var' as const,
      name: 'value',
      type: 'char[]',
      value: { kind: 'NullVal' as const },
      changed: false,
      class: 'java.lang.String'
    }
  }
  const heap = [outerArray, innerArray, string]
  const formatter = createHistoryFormatter([])

  assert.equal(formatter.formatValue(reference(1), heap), 'new int[1][2]')
  assert.equal(formatter.formatValue(reference(3), heap), '"hello"')
})

test('renders zero-argument constructors instead of falling back to a generic object label', () => {
  const object = {
    kind: 'HeapObject' as const,
    id: 1,
    type: 'example.Person',
    faked: false,
    fields: []
  }
  const trace = [
    state(0),
    state(1, [], [frame('<init>', [], 1)], [], [object]),
    state(2, [frame('run')], [frame('run')], [object], [object])
  ]
  const formatter = createHistoryFormatter(trace)

  assert.equal(formatter.formatValue(reference(1), [object], undefined, 2), 'example.Person()')
})

test('formats instance calls with caller aliases for receiver and arguments', () => {
  const worker = {
    kind: 'HeapObject' as const,
    id: 1,
    type: 'example.Person',
    faked: false,
    fields: []
  }
  const argument = {
    kind: 'HeapObject' as const,
    id: 2,
    type: 'example.Value',
    faked: false,
    fields: []
  }
  const caller = frame('run', [
    local('worker', reference(1)),
    local('argument', reference(2))
  ])
  const callee = frame('sort', [local('value', reference(2))], 1)
  const trace = [
    state(0),
    state(1, [caller], [callee, caller], [worker, argument], [worker, argument])
  ]
  const formatter = createHistoryFormatter(trace)

  assert.equal(formatter.formatCall(1), 'Call: worker.sort(value=argument)')
})

test('formats static initializers and missing call data safely', () => {
  const trace = [
    state(0, [], [frame('<clinit>')])
  ]
  const formatter = createHistoryFormatter(trace)

  assert.equal(formatter.formatCall(0), 'Static Initializer: example.Person')
  assert.equal(formatter.formatCall(99), 'Unknown call')
})
