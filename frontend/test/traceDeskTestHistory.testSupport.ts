import type { strict as StrictAssert } from 'node:assert'
import { Trace } from '@/debugger/Trace'
import type { InputBufferInfo, LoadedClass, StackFrame, MarbleDiagramDataCollection, TraceState } from '@/dto/TraceState'

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

function traceState (line: number): TraceState {
  return {
    kind: 'TraceState',
    sourceFileUri: 'Example.java',
    line,
    stack: [stackFrame(line)],
    heap: [],
    loadedClasses: [loadedClass],
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
