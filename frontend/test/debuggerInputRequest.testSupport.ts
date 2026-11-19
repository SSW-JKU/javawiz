import type { strict as StrictAssert } from 'node:assert'
import { createPinia, setActivePinia } from 'pinia'
import { Debugger } from '@/debugger/Debugger'
import { RUNNING } from '@/debugger/DebuggerState'
import type { DebuggerState } from '@/debugger/DebuggerState'
import { Trace } from '@/debugger/Trace'
import type { InputBufferInfo, MarbleDiagramDataCollection, TraceState } from '@/dto/TraceState'

// A program at two recorded steps: it printed "Enter a number: " (step 0) and landed on the
// line that reads the number (step 1, the live step). Stepping over that line makes the program
// wait for input; the backend answers without a new step.

const inputBufferInfo: InputBufferInfo = {
  kind: 'InputBufferInfo', past: '', future: '', done: false, latestValue: '', latestMethod: '', traceSuccess: true
}

const streamVisualizationData: MarbleDiagramDataCollection = { kind: 'MarbleDiagramDataCollection', streams: [] }

function state (line: number, output: string): TraceState {
  return {
    kind: 'TraceState',
    sourceFileUri: 'IoDemo.java',
    line,
    stack: [{
      kind: 'StackFrame',
      line,
      class: 'IoDemo',
      method: 'main',
      signature: '([Ljava/lang/String;)V',
      displaySignature: 'main(String[])',
      localVariables: [],
      conditionValues: [],
      arrayAccessValues: [],
      internal: false,
      displayText: 'IoDemo.main(String[])'
    }],
    heap: [],
    loadedClasses: [{ kind: 'LoadedClass', class: 'IoDemo', staticFields: [], isHeapTraversalStop: false, isJavaDataStructure: false, hasCollectedFields: true }],
    output,
    error: '',
    input: '',
    inputBufferInfo,
    stepProcessingTime: 0,
    timeSinceLastStep: 0,
    streamVisualizationData
  }
}

/** The private parts of Debugger that the test sets up or calls, as in a running session. */
interface DebuggerInternals {
  trace: Trace
  stateIndex: number
  state: DebuggerState
  handleMessage (event: { data: string }): void
}

/** The backend's answer when the program blocks in a read: no new step, but waiting for input. */
function receiveWaitingForInput (internals: DebuggerInternals): void {
  internals.handleMessage({
    data: JSON.stringify({
      kind: 'StepResultResponse',
      data: { traceStates: [], isWaitingForInput: true, vmrunning: true }
    })
  })
}

/**
 * Puts the debugger at the live step of the two-step program above and lets the program ask for
 * input there, as after stepping over the line that reads. Also used by the console tests.
 */
export function waitForInputAtLiveStep (debuggerUnderTest: Debugger): void {
  const internals = debuggerUnderTest as unknown as DebuggerInternals
  internals.trace.addTraceStates([state(10, ''), state(11, 'Enter a number: ')])
  internals.stateIndex = 1
  internals.state = RUNNING
  receiveWaitingForInput(internals)
}

/**
 * Input is expected only right after the program asked for it at the live step. Returning to that
 * step from the history shows it as "landed on the read", without input, until the user steps again.
 */
export function assertInputExpectedOnlyRightAfterRequest (assert: typeof StrictAssert): void {
  setActivePinia(createPinia())
  const debuggerUnderTest = new Debugger()
  const internals = debuggerUnderTest as unknown as DebuggerInternals

  waitForInputAtLiveStep(debuggerUnderTest)
  assert.equal(debuggerUnderTest.inputExpected, true, 'the program asked for input at the live step')

  debuggerUnderTest.stepBack()
  assert.equal(debuggerUnderTest.isLive, false)
  assert.equal(debuggerUnderTest.inputExpected, false, 'stepped back into the history')

  debuggerUnderTest.stepInto()
  assert.equal(debuggerUnderTest.isLive, true)
  assert.equal(debuggerUnderTest.inputExpected, false, 'returned to the waiting step: only landed on the read')

  // Stepping again at the live step runs the read again; without a WebSocket, nothing is sent.
  debuggerUnderTest.stepInto()
  receiveWaitingForInput(internals)
  assert.equal(debuggerUnderTest.inputExpected, true, 'the program asked for input again')
}
