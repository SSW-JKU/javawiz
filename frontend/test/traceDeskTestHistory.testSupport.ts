import type { strict as StrictAssert } from 'node:assert'
import { Trace } from '@/debugger/Trace'
import { deskTestStaticKey } from '@/components/TheDeskTest/line'
import type { DeskTestLine, DeskTestStatic, DeskTestVal } from '@/components/TheDeskTest/types'
import type { HeapItem, InputBufferInfo, LoadedClass, StackFrame, MarbleDiagramDataCollection, StaticVar, TraceState, Val } from '@/dto/TraceState'

const loadedClass: LoadedClass = {
  kind: 'LoadedClass',
  class: 'Example',
  staticFields: [],
  isHeapTraversalStop: false,
  isJavaDataStructure: false,
  hasCollectedFields: true
}

const inputBufferInfo: InputBufferInfo = {
  kind: 'InputBufferInfo',
  past: '',
  future: '',
  done: false,
  latestValue: '',
  latestMethod: '',
  traceSuccess: true
}

const streamVisualizationData: MarbleDiagramDataCollection = {
  kind: 'MarbleDiagramDataCollection',
  streams: []
}

function stackFrame (line: number): StackFrame {
  return {
    kind: 'StackFrame',
    line,
    class: 'Example',
    method: 'main',
    signature: '()V',
    displaySignature: 'main()',
    localVariables: [],
    conditionValues: [],
    arrayAccessValues: [],
    internal: false,
    displayText: 'Example.main()'
  }
}

function traceState (line: number, loadedClasses: LoadedClass[] = [loadedClass], heap: HeapItem[] = []): TraceState {
  return {
    kind: 'TraceState',
    sourceFileUri: 'Example.java',
    line,
    stack: [stackFrame(line)],
    heap,
    loadedClasses,
    output: '',
    error: '',
    input: '',
    inputBufferInfo,
    stepProcessingTime: 0,
    timeSinceLastStep: 0,
    streamVisualizationData
  }
}

/** Verifies that appending a later debugger response does not discard prior Desk Test rows. */
export async function runTraceDeskTestHistoryAssertions (assert: typeof StrictAssert): Promise<void> {
  const trace = new Trace()
  trace.addTraceStates([traceState(10), traceState(20)])
  trace.addTraceStates([traceState(30)])

  const traceData = trace.getTraceData(2, undefined)
  assert.deepEqual(traceData?.deskTestLines.map(line => line.line), [10, 20])
}

function staticField (clazz: string, name: string, type: string, value: Val): StaticVar {
  return { kind: 'Var', class: clazz, name, type, value, changed: false }
}

function classWithStatics (clazz: string, staticFields: StaticVar[]): LoadedClass {
  return { ...loadedClass, class: clazz, staticFields }
}

function primitive (value: string): Val {
  return { kind: 'PrimitiveVal', title: undefined, vizValue: value, primitiveValue: value }
}

function reference (id: number): Val {
  return { kind: 'ReferenceVal', reference: id }
}

function node (id: number): HeapItem {
  return { kind: 'HeapObject', id, type: 'Node', faked: false, fields: [] }
}

/**
 * The value a Tabular view row shows in a static's column, looked up the same way as
 * TheDeskTest.vue does it: the column objects come from the last line, the values from each line.
 */
function currentStaticValue (row: DeskTestLine, column: DeskTestStatic): DeskTestVal | undefined {
  return row.currentStatics.get(deskTestStaticKey(column))
}

function staticColumn (lines: DeskTestLine[], clazz: string, name: string): DeskTestStatic {
  const column = lines.at(-1)?.statics.find(s => s.class === clazz && s.name === name)
  if (!column) throw new Error(`No Tabular view column for ${clazz}.${name}`)
  return column
}

/** JW-704: a static reference that is assigned a different object keeps showing its value in its column. */
export async function runDeskTestStaticReferenceAssertions (assert: typeof StrictAssert): Promise<void> {
  const firstPointsTo = (target: Val) => [classWithStatics('Example', [staticField('Example', 'first', 'Node', target)])]
  const trace = new Trace()
  trace.addTraceStates([
    traceState(10, firstPointsTo({ kind: 'NullVal' })),
    traceState(20, firstPointsTo(reference(1)), [node(1)]),
    traceState(30, firstPointsTo(reference(2)), [node(1), node(2)]),
    traceState(40, firstPointsTo(reference(2)), [node(1), node(2)])
  ])

  const lines = trace.getTraceData(3, undefined)!.deskTestLines
  const column = staticColumn(lines, 'Example', 'first')
  const shownValues = lines.map(row => currentStaticValue(row, column))
  // Line 10 assigns object 1, line 20 assigns object 2; both rows must show a value.
  assert.ok(shownValues[0], 'line 10 shows the first object')
  assert.ok(shownValues[1], 'line 20 shows the second object in the same column')
}

/** JW-704: a changed static is detected even when another class has a static with the same name and the old value. */
export async function runDeskTestStaticSameNameAssertions (assert: typeof StrictAssert): Promise<void> {
  // `Example` is the class of the stack frame; the flow chart overlay looks it up.
  const counts = (a: string, b: string) => [
    loadedClass,
    classWithStatics('A', [staticField('A', 'count', 'int', primitive(a))]),
    classWithStatics('B', [staticField('B', 'count', 'int', primitive(b))])
  ]
  const trace = new Trace()
  trace.addTraceStates([
    traceState(10, counts('1', '2')),
    traceState(20, counts('1', '2')),
    traceState(30, counts('2', '2')),
    traceState(40, counts('2', '2'))
  ])

  const lines = trace.getTraceData(3, undefined)!.deskTestLines
  const column = staticColumn(lines, 'A', 'count')
  // Line 20 changes A.count from 1 to 2; B.count already holds 2.
  assert.equal(currentStaticValue(lines[1], column)?.primitive, '2')
}
