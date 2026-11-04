import type { strict as StrictAssert } from 'node:assert'
import { Trace } from '@/debugger/Trace'
import { SequenceDiagramHistory } from '@/components/TheSequenceDiagram/SequenceDiagramHistory'
import type { InputBufferInfo, LoadedClass, StackFrame, MarbleDiagramDataCollection, TraceState } from '@/dto/TraceState'

// A small program, delivered by the debugger in four responses (batches):
//   Example.main calls the static method Helper.compute, which returns to main.
// Each call builds fresh state objects, so every history and trace gets its own copies.

function loadedClass (name: string): LoadedClass {
  return { kind: 'LoadedClass', class: name, staticFields: [], isHeapTraversalStop: false, isJavaDataStructure: false, hasCollectedFields: true }
}

const inputBufferInfo: InputBufferInfo = {
  kind: 'InputBufferInfo', past: '', future: '', done: false, latestValue: '', latestMethod: '', traceSuccess: true
}

const streamVisualizationData: MarbleDiagramDataCollection = { kind: 'MarbleDiagramDataCollection', streams: [] }

function frame (clazz: string, method: string, line: number): StackFrame {
  return {
    kind: 'StackFrame',
    line,
    class: clazz,
    method,
    signature: '()V',
    displaySignature: `${method}()`,
    localVariables: [],
    conditionValues: [],
    arrayAccessValues: [],
    internal: false,
    displayText: `${clazz}.${method}()`
  }
}

function state (stack: StackFrame[]): TraceState {
  return {
    kind: 'TraceState',
    sourceFileUri: 'Example.java',
    line: stack[0].line,
    stack,
    heap: [],
    loadedClasses: [loadedClass('Example'), loadedClass('Helper')],
    output: '',
    error: '',
    input: '',
    inputBufferInfo,
    stepProcessingTime: 0,
    timeSinceLastStep: 0,
    streamVisualizationData
  }
}

const main = (line: number) => frame('Example', 'main', line)
const compute = (line: number) => frame('Helper', 'compute', line)

function batches (): TraceState[][] {
  return [
    [state([main(3)])],
    [state([main(4)]), state([compute(10), main(4)])],
    [state([compute(11), main(4)]), state([main(5)])],
    [state([main(6)])]
  ]
}

const expectedBatchStartIndices = [0, 1, 3, 5]
const stateCount = 6

/** Feeds the batches one by one, as Trace does before JW-681. This is the reference result. */
function incrementalHistory (): SequenceDiagramHistory {
  const history = new SequenceDiagramHistory()
  let start = 0
  for (const batch of batches()) {
    history.addTraceStates(batch, start)
    start += batch.length
  }
  return history
}

function traceWith (batchList: TraceState[][]): Trace {
  const trace = new Trace()
  batchList.forEach(batch => trace.addTraceStates(batch))
  return trace
}

// The histories create their own element objects, so compare plain field values instead of identity.
function snapshot (history: SequenceDiagramHistory, stateIndex: number) {
  return {
    lifeLines: history.getLifeLines(stateIndex).map(l => ({
      index: l.index, label: l.label, className: l.className, start: l.start, end: l.end, programEnd: l.programEnd
    })),
    arrows: history.getArrows(stateIndex).map(a => ({
      kind: a.kind,
      label: a.label,
      time: a.time,
      from: a.from?.index,
      to: a.to?.index,
      fromBoxIndex: a.fromBoxIndex,
      toBoxIndex: a.toBoxIndex,
      fromDepth: a.fromDepth,
      toDepth: a.toDepth,
      methodCallId: a.methodCallId,
      line: a.line
    })),
    boxes: history.getBoxes(stateIndex).map(b => ({
      index: b.index, lifeLine: b.lifeLine.index, start: b.start, end: b.end, methodCallId: b.methodCallId, depth: b.depth
    })),
    timeIdx: history.getTimeIdx(stateIndex),
    timeIdxStateIdxMap: [...history.getTimeIdxStateIdxMap()],
    visitedLines: [...history.getVisitedLines()]
  }
}

function assertSameHistory (assert: typeof StrictAssert, actual: SequenceDiagramHistory, expected: SequenceDiagramHistory, label: string) {
  for (let i = 0; i < stateCount; i++) {
    assert.deepEqual(snapshot(actual, i), snapshot(expected, i), `${label}: state ${i}`)
  }
}

/** The reference program must produce call and return arrows, otherwise the comparisons prove little. */
export function assertReferenceIsMeaningful (assert: typeof StrictAssert): void {
  const arrows = incrementalHistory().getArrows(stateCount - 1)
  assert.ok(arrows.some(a => a.kind === 'Call'), 'reference history has a call arrow')
  assert.ok(arrows.some(a => a.kind === 'Return'), 'reference history has a return arrow')
}

/** Trace records where each batch starts and no longer hands out sequence diagram data. */
export function assertTraceRecordsBatchesOnly (assert: typeof StrictAssert): void {
  const trace = traceWith(batches())
  assert.deepEqual([...trace.getBatchStartIndices()], expectedBatchStartIndices)

  const traceData = trace.getTraceData(stateCount - 1, stateCount - 2) as Record<string, unknown>
  for (const key of ['lifeLines', 'arrows', 'boxes', 'timeIdx', 'timeIdxStateIdxMap', 'visitedLines']) {
    assert.ok(!(key in traceData), `TraceData has no ${key}`)
  }
  assert.ok(!('end' in trace), 'Trace has no end()')
}

function replay (history: SequenceDiagramHistory, trace: Trace) {
  history.addRecordedBatches(trace.trace, trace.getBatchStartIndices())
}

/** Replaying the recorded batches, at once or in catch-up steps, gives the same history as feeding them one by one. */
export function assertReplayMatchesIncremental (assert: typeof StrictAssert): void {
  const reference = incrementalHistory()

  const atOnce = new SequenceDiagramHistory()
  replay(atOnce, traceWith(batches()))
  assertSameHistory(assert, atOnce, reference, 'replayed at once')

  const all = batches()
  const growingTrace = traceWith(all.slice(0, 2))
  const catchingUp = new SequenceDiagramHistory()
  replay(catchingUp, growingTrace)
  all.slice(2).forEach(batch => growingTrace.addTraceStates(batch))
  replay(catchingUp, growingTrace)
  replay(catchingUp, growingTrace) // nothing new: must not add anything
  assertSameHistory(assert, catchingUp, reference, 'replayed in catch-up steps')
}

/** Ending all lifelines after a replay gives the same result as before, and a second call changes nothing. */
export function assertProgramEndMatches (assert: typeof StrictAssert): void {
  const reference = incrementalHistory()
  reference.endAllLifeLines()

  const replayed = new SequenceDiagramHistory()
  replay(replayed, traceWith(batches()))
  replayed.endAllLifeLines()
  assertSameHistory(assert, replayed, reference, 'after program end')
  assert.ok(replayed.getLifeLines(stateCount - 1).every(l => l.programEnd && l.end !== undefined), 'all lifelines ended')

  replayed.endAllLifeLines()
  assertSameHistory(assert, replayed, reference, 'after ending twice')
}
