import type { strict as StrictAssert } from 'node:assert'
import { Trace } from '@/debugger/Trace'
import type {
  HeapItem, InputBufferInfo, LoadedClass, LocalVar, MarbleDiagramDataCollection, ProcessedTraceState,
  StackFrame, StaticVar, TraceState, Val
} from '@/dto/TraceState'

/*
 * One user action (Step over across a call, Run to line across a loop) can move over many trace states.
 * The memory view highlights what differs from the state shown before the action. These tests check
 * the comparison behind it, Trace.getTraceData(stateIndex, previousStateIndex), on synthetic states:
 *
 * S0, line 10: x = 1, text -> string 3 "a", numbers -> array 2 [0, 0], node -> object 1 { value = 0 }, flip = 0, Example.counter = 0
 * S1, line 11: x = 2, flip = 1
 * S2, line 12: numbers[1] = 5, node.value = 7, Example.counter = 3, flip = 0
 * S3, line 13: text -> new string 4 "ab"
 * S4, line 14: nothing changes
 */

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

function primitive (value: string): Val {
  return { kind: 'PrimitiveVal', title: undefined, vizValue: value, primitiveValue: value }
}

function reference (id: number): Val {
  return { kind: 'ReferenceVal', reference: id }
}

function local (method: string, name: string, type: string, value: Val): LocalVar {
  return { kind: 'Var', class: 'Example', method, name, type, value, changed: false }
}

function stackFrame (line: number, method: string, localVariables: LocalVar[]): StackFrame {
  return {
    kind: 'StackFrame',
    line,
    class: 'Example',
    method,
    signature: '()V',
    displaySignature: `${method}()`,
    localVariables,
    conditionValues: [],
    arrayAccessValues: [],
    internal: false,
    displayText: `Example.${method}()`
  }
}

function loadedClass (counter: string): LoadedClass {
  const staticVar: StaticVar = { kind: 'Var', class: 'Example', name: 'counter', type: 'int', value: primitive(counter), changed: false }
  return {
    kind: 'LoadedClass',
    class: 'Example',
    staticFields: [staticVar],
    isHeapTraversalStop: false,
    isJavaDataStructure: false,
    hasCollectedFields: true
  }
}

function traceState (line: number, stack: StackFrame[], heap: HeapItem[], counter: string): TraceState {
  return {
    kind: 'TraceState',
    sourceFileUri: 'Example.java',
    line,
    stack,
    heap,
    loadedClasses: [loadedClass(counter)],
    output: '',
    error: '',
    input: '',
    inputBufferInfo,
    stepProcessingTime: 0,
    timeSinceLastStep: 0,
    streamVisualizationData
  }
}

interface ShownValues { x: string, textId: number, numbers: [string, string], nodeValue: string, flip: string, counter: string }

function state (line: number, v: ShownValues): TraceState {
  const text = v.textId === 3 ? 'a' : 'ab'
  const heap: HeapItem[] = [
    {
      kind: 'HeapObject',
      id: 1,
      type: 'Node',
      faked: false,
      fields: [{ kind: 'Var', class: 'Node', name: 'value', type: 'int', value: primitive(v.nodeValue), changed: false, heapObjectId: 1 }]
    },
    {
      kind: 'HeapArray',
      id: 2,
      type: 'int[]',
      faked: false,
      elements: v.numbers.map((value, index) => ({ kind: 'HeapArrayElementVar', arrayId: 2, type: 'int', value: primitive(value), index, changed: false }))
    },
    {
      kind: 'HeapString',
      id: v.textId,
      type: 'String',
      faked: false,
      string: text,
      vizString: text,
      charArr: { kind: 'Var', class: 'String', name: 'value', type: 'char[]', value: primitive(text), changed: false }
    }
  ]
  const main = stackFrame(line, 'main', [
    local('main', 'x', 'int', primitive(v.x)),
    local('main', 'text', 'String', reference(v.textId)),
    local('main', 'numbers', 'int[]', reference(2)),
    local('main', 'node', 'Node', reference(1)),
    local('main', 'flip', 'int', primitive(v.flip))
  ])
  return traceState(line, [main], heap, v.counter)
}

function actionStates (): TraceState[] {
  const s0: ShownValues = { x: '1', textId: 3, numbers: ['0', '0'], nodeValue: '0', flip: '0', counter: '0' }
  const s1: ShownValues = { ...s0, x: '2', flip: '1' }
  const s2: ShownValues = { ...s1, numbers: ['0', '5'], nodeValue: '7', counter: '3', flip: '0' }
  const s3: ShownValues = { ...s2, textId: 4 }
  return [state(10, s0), state(11, s1), state(12, s2), state(13, s3), state(14, s3)]
}

function createTrace (): Trace {
  const trace = new Trace()
  trace.addTraceStates(actionStates())
  return trace
}

/**
 * The changed flag of every local, static, object field, array element, and string char array of a state,
 * keyed by a readable name, e.g. `x`, `Example.counter`, `node.value`, `numbers[1]`, `string 4`.
 */
function changedFlags (stack: StackFrame[], loadedClasses: LoadedClass[], heap: HeapItem[]): Record<string, boolean> {
  const flags: Record<string, boolean> = {}
  for (const frame of stack) {
    for (const v of frame.localVariables) flags[v.name] = v.changed
  }
  for (const clazz of loadedClasses) {
    for (const v of clazz.staticFields) flags[`${clazz.class}.${v.name}`] = v.changed
  }
  for (const item of heap) {
    switch (item.kind) {
      case 'HeapObject':
        for (const field of item.fields) flags[`node.${field.name}`] = field.changed
        break
      case 'HeapArray':
        for (const element of item.elements) flags[`numbers[${element.index}]`] = element.changed
        break
      case 'HeapString':
        flags[`string ${item.id}`] = item.charArr.changed
        break
    }
  }
  return flags
}

/** The flags the memory view gets when it shows state `stateIndex` after having shown `previousStateIndex`. */
function shownChanges (trace: Trace, stateIndex: number, previousStateIndex: number): Record<string, boolean> {
  const processed: ProcessedTraceState | undefined = trace.getTraceData(stateIndex, previousStateIndex)?.processedTraceState
  if (!processed) throw new Error(`No processed state for ${previousStateIndex} -> ${stateIndex}`)
  return changedFlags(processed.stackAfterExecution, processed.loadedClassesAfterExecution, processed.heapAfterExecution)
}

/** All flags false; `textId` is the string that `text` refers to in the compared state. */
function nothingChanged (textId: number = 4): Record<string, boolean> {
  return {
    x: false,
    text: false,
    numbers: false,
    node: false,
    flip: false,
    'Example.counter': false,
    'node.value': false,
    'numbers[0]': false,
    'numbers[1]': false,
    [`string ${textId}`]: false
  }
}

/** Run to line from S0 to S4 highlights the changes of all crossed states, but not `flip`, which is back at 0. */
export async function runMultiStateActionAssertions (assert: typeof StrictAssert): Promise<void> {
  assert.deepEqual(shownChanges(createTrace(), 4, 0), {
    ...nothingChanged(),
    x: true,
    text: true,
    'Example.counter': true,
    'node.value': true,
    'numbers[1]': true,
    'string 4': true
  })
}

/** A single step from S1 to S2 highlights only what that step changed. */
export async function runSingleStepAssertions (assert: typeof StrictAssert): Promise<void> {
  assert.deepEqual(shownChanges(createTrace(), 2, 1), {
    ...nothingChanged(3),
    flip: true,
    'Example.counter': true,
    'node.value': true,
    'numbers[1]': true
  })
}

/** `flip` goes 0 -> 1 -> 0 between S0 and S2, so it is not highlighted; `x` is. */
export async function runChangedBackAssertions (assert: typeof StrictAssert): Promise<void> {
  const flags = shownChanges(createTrace(), 2, 0)
  assert.equal(flags.flip, false)
  assert.equal(flags.x, true)
}

/** Step into a method: the parameters of the new top frame are highlighted. */
export async function runEnterMethodAssertions (assert: typeof StrictAssert): Promise<void> {
  const [s0] = actionStates()
  const callee = stackFrame(20, 'twice', [local('twice', 'n', 'int', primitive('1'))])
  const s1 = traceState(20, [callee, ...structuredClone(s0.stack)], structuredClone(s0.heap), '0')
  const trace = new Trace()
  trace.addTraceStates([s0, s1])

  assert.equal(shownChanges(trace, 1, 0).n, true)
}

/**
 * Comparing across several states works on a copy: afterwards the per-step comparisons and the stored
 * trace state (used by the Tabular view and the flow chart overlay) still show only each step's changes.
 */
export async function runPerStepFlagsKeptAssertions (assert: typeof StrictAssert): Promise<void> {
  const trace = createTrace()
  shownChanges(trace, 4, 0)

  // Read the stored state first: the later calls recompute its flags and would hide a change made by the call above.
  const stored = trace.getTraceState(4)!
  assert.deepEqual(changedFlags(stored.stack, stored.loadedClasses, stored.heap), nothingChanged(), 'stored S4 keeps its per-step flags')
  assert.deepEqual(shownChanges(trace, 4, 3), nothingChanged(), 'S3 -> S4 changes nothing')
  assert.deepEqual(shownChanges(trace, 3, 2), { ...nothingChanged(), text: true, 'string 4': true }, 'S2 -> S3 changes only text')
}

/** The ids of the heap items flagged as new, i.e. absent from the state shown before (JW-753). */
function newHeapItemIds (trace: Trace, stateIndex: number, previousStateIndex: number): number[] {
  const processed: ProcessedTraceState | undefined = trace.getTraceData(stateIndex, previousStateIndex)?.processedTraceState
  if (!processed) throw new Error(`No processed state for ${previousStateIndex} -> ${stateIndex}`)
  return processed.heapAfterExecution
    .filter(item => item.isNew)
    .map(item => item.id)
    .sort((a, b) => a - b)
}

/** String 4 is created in S3: it is new after S2 -> S3 and after S0 -> S4, but not after S3 -> S4. */
export async function runNewHeapItemAssertions (assert: typeof StrictAssert): Promise<void> {
  const trace = createTrace()
  assert.deepEqual(newHeapItemIds(trace, 3, 2), [4], 'S2 -> S3 creates string 4')
  assert.deepEqual(newHeapItemIds(trace, 4, 0), [4], 'S0 -> S4 crosses the creation of string 4')
  assert.deepEqual(newHeapItemIds(trace, 4, 3), [], 'S3 -> S4 creates nothing')
  assert.deepEqual(newHeapItemIds(trace, 2, 1), [], 'S1 -> S2 creates nothing')
}
