import type { strict as StrictAssert } from 'node:assert'
import { runDot } from './graphviz.testSupport'
import { createPinia, setActivePinia } from 'pinia'
import type {
  LoadedClass,
  LocalVar,
  ProcessedHeapItem,
  ProcessedHeapObject,
  ProcessedTraceState,
  StackFrame,
  StaticVar
} from '@/dto/TraceState'
import { HeapVizChart } from '@/components/TheHeapVisualization/HeapVizChart'
import { HeapVizTraceState } from '@/components/TheHeapVisualization/Types/HeapVizTraceState'
import type { MemoryViewRenderContext } from '@/components/TheHeapVisualization/MemoryViewRenderContext'

interface HeapVizChartInternals {
  readonly renderContext: MemoryViewRenderContext
  traceState: HeapVizTraceState
  calculateNodeVisibility: () => void
}

/** Where Graphviz placed the Statics/Stack table, the Heap box, and their titles, in points. */
interface HeapPlacement {
  rootsRight: number
  heapLeft: number
  /** Baselines of the "Stack" and "Heap" titles in the SVG, where y grows downward. */
  stackTitleY: number
  heapTitleY: number
}

/**
 * Largest accepted height difference between the "Stack" and "Heap" titles. Graphviz rounds cluster positions
 * to whole points, and the WebAssembly Graphviz that the Memory View uses estimates text sizes instead of
 * measuring fonts, so a little more than a point (about 1.1 pt, under 2 pixels) remains even when both bars
 * are aligned.
 */
const MAX_TITLE_OFFSET = 2

const nodeClass: LoadedClass = {
  kind: 'LoadedClass',
  class: 'Example$Node',
  staticFields: [],
  isHeapTraversalStop: false,
  isJavaDataStructure: false,
  hasCollectedFields: true
}

function intLocal (name: string, value: number): LocalVar {
  return {
    kind: 'Var', name, type: 'int', class: 'Example', method: 'main', changed: false,
    value: { kind: 'PrimitiveVal', primitiveValue: `${value}`, vizValue: `${value}`, title: undefined }
  }
}

function nodeLocal (name: string, reference: number): LocalVar {
  return {
    kind: 'Var', name, type: nodeClass.class, class: 'Example', method: 'main', changed: false,
    value: { kind: 'ReferenceVal', reference }
  }
}

/** A `Node` object whose `next` field points to `next`, or is null. */
function node (id: number, next?: number, faked = false): ProcessedHeapObject {
  return {
    kind: 'HeapObject', id, type: nodeClass.class, faked, loadedClass: nodeClass,
    fields: [{
      kind: 'Var', name: 'next', type: nodeClass.class, changed: false, class: nodeClass.class,
      value: next === undefined ? { kind: 'NullVal' } : { kind: 'ReferenceVal', reference: next }
    }]
  }
}

/** `main` with six int locals followed by `extraLocals`, so references come from the bottom of the stack. */
function mainFrame (extraLocals: LocalVar[]): StackFrame {
  return {
    kind: 'StackFrame',
    class: 'Example',
    method: 'main',
    signature: '()V',
    displaySignature: 'void main ()',
    displayText: 'Example.main()',
    line: 1,
    internal: false,
    conditionValues: [],
    arrayAccessValues: [],
    localVariables: [
      ...['a', 'b', 'c', 'd', 'e', 'f'].map((name, index) => intLocal(name, index + 1)),
      ...extraLocals
    ]
  }
}

/** The constructor frame of `new Node(...)`, whose `this` references the object being constructed. */
function constructorFrame (thisReference: number): StackFrame {
  return {
    kind: 'StackFrame',
    class: nodeClass.class,
    method: '<init>',
    signature: '(I)V',
    displaySignature: 'Node (int)',
    displayText: `Constructor of ${nodeClass.class}`,
    line: 1,
    internal: false,
    conditionValues: [],
    arrayAccessValues: [],
    localVariables: [],
    this: { kind: 'ReferenceVal', reference: thisReference }
  }
}

/** Builds a trace state; with several frames, the innermost one comes first, as in the trace. */
function traceState (frames: StackFrame | StackFrame[], heap: ProcessedHeapItem[], staticFields: StaticVar[] = []): ProcessedTraceState {
  const stack = [frames].flat()
  const exampleClass: LoadedClass = {
    kind: 'LoadedClass',
    class: 'Example',
    staticFields,
    isHeapTraversalStop: false,
    isJavaDataStructure: false,
    hasCollectedFields: true
  }
  const loadedClasses = [exampleClass, nodeClass]
  return {
    kind: 'ProcessedTraceState',
    localUri: '',
    line: 1,
    stateIndex: 0,
    heapBeforeExecution: heap,
    stackBeforeExecution: stack,
    loadedClassesBeforeExecution: loadedClasses,
    heapAfterExecution: heap,
    stackAfterExecution: stack,
    loadedClassesAfterExecution: loadedClasses
  }
}

/** Renders the chart's DOT exactly as the memory view does after a step. */
function renderDot (state: ProcessedTraceState): string {
  setActivePinia(createPinia())
  const chart = new HeapVizChart()
  const internals = chart as unknown as HeapVizChartInternals
  internals.traceState = new HeapVizTraceState(state, internals.renderContext)
  internals.calculateNodeVisibility()
  return chart.render()
}

/** Lays out the DOT with Graphviz and reads the table and Heap box edges and the y of both titles. */
function layOut (assert: typeof StrictAssert, dot: string): HeapPlacement {
  const json = runDot(dot, 'json')
  assert.equal(json.status, 0, json.stderr)
  const objects: { name: string, pos?: string, width?: string, bb?: string }[] = JSON.parse(json.stdout).objects
  const roots = objects.find(object => object.name === 'roots')
  const heap = objects.find(object => object.name === 'cluster_heap')
  assert.ok(roots?.pos && roots.width, 'Graphviz must place the roots table')
  assert.ok(heap?.bb, 'Graphviz must draw the Heap box')
  const [x] = roots.pos.split(',').map(Number)

  const svg = runDot(dot, 'svg')
  assert.equal(svg.status, 0, svg.stderr)
  const titleY = (title: string): number => {
    const y = new RegExp(`<text[^>]* y="([-\\d.]+)"[^>]*>${title}</text>`).exec(svg.stdout)?.[1]
    assert.ok(y, `the SVG must contain the ${title} title`)
    return Number(y)
  }
  return {
    // Graphviz reports node widths in inches and positions in points (72 pt per inch).
    rootsRight: x + Number(roots.width) * 72 / 2,
    heapLeft: Number(heap.bb.split(',')[0]),
    stackTitleY: titleY('Stack'),
    heapTitleY: titleY('Heap')
  }
}

/** Top and bottom of a heap object, in points below the top of the Heap box. */
interface HeapObjectBox {
  top: number
  bottom: number
}

/** Lays out the DOT with Graphviz and reads where each heap object `o_<id>` sits inside the Heap box. */
function heapObjectBoxes (assert: typeof StrictAssert, dot: string): Map<number, HeapObjectBox> {
  const json = runDot(dot, 'json')
  assert.equal(json.status, 0, json.stderr)
  const objects: { name: string, pos?: string, height?: string, bb?: string }[] = JSON.parse(json.stdout).objects
  const heap = objects.find(object => object.name === 'cluster_heap')
  assert.ok(heap?.bb, 'Graphviz must draw the Heap box')
  // Graphviz's y axis points up, so the top of the box is the largest y of its bounding box.
  const heapTop = Number(heap.bb.split(',')[3])
  const boxes = new Map<number, HeapObjectBox>()
  for (const object of objects) {
    const id = /^obj_(\d+)$/.exec(object.name)?.[1]
    if (!id || !object.pos || !object.height)
      continue
    const y = Number(object.pos.split(',')[1])
    const halfHeight = Number(object.height) * 72 / 2
    boxes.set(Number(id), { top: heapTop - (y + halfHeight), bottom: heapTop - (y - halfHeight) })
  }
  return boxes
}

function assertHeapRightOfStackAndLevel (assert: typeof StrictAssert, state: ProcessedTraceState, name: string): void {
  const placement = layOut(assert, renderDot(state))
  assert.ok(placement.heapLeft > placement.rootsRight,
    `${name}: the Heap box must start right of the Statics/Stack table (heap left ${placement.heapLeft}, table right ${placement.rootsRight})`)
  const titleOffset = placement.heapTitleY - placement.stackTitleY
  assert.ok(Math.abs(titleOffset) <= MAX_TITLE_OFFSET,
    `${name}: the Heap and Stack titles must be at the same height, at most ${MAX_TITLE_OFFSET} pt apart (Heap title ${Math.abs(titleOffset).toFixed(2)} pt ${titleOffset < 0 ? 'higher' : 'lower'})`)
}

/** A single reference from the last stack variable used to pull the Heap box down to that row. */
export function runReferenceFromLastLocalAssertions (assert: typeof StrictAssert): void {
  assertHeapRightOfStackAndLevel(assert, traceState(mainFrame([nodeLocal('head', 1)]), [node(1)]), 'reference from the last local')
}

/** A chain of objects plus a static field reference keep the Heap box beside the Stack header. */
export function runChainAndStaticReferenceAssertions (assert: typeof StrictAssert): void {
  const cache: StaticVar = {
    kind: 'Var', name: 'cache', type: nodeClass.class, class: 'Example', changed: false,
    value: { kind: 'ReferenceVal', reference: 3 }
  }
  const state = traceState(mainFrame([nodeLocal('head', 1)]), [node(1, 2), node(2), node(3)], [cache])
  assertHeapRightOfStackAndLevel(assert, state, 'chain and static reference')
}

/** A visible object that no variable references (for example one still under construction). */
export function runUnreferencedObjectAssertions (assert: typeof StrictAssert): void {
  const state = traceState(mainFrame([]), [node(1, undefined, true)])
  const dot = renderDot(state)
  assert.doesNotMatch(dot, /-> obj_1:heap_object_header/, 'the fixture must have no edge into the heap')
  assertHeapRightOfStackAndLevel(assert, state, 'unreferenced object')
}

/**
 * Right after a constructor returns, the new object is still unreferenced: the backend keeps it visible for one
 * step, marks it `faked`, and appends it to the heap. It must appear below the referenced objects, and the
 * referenced objects must keep the place they had one step earlier, inside the constructor.
 */
export function runReturnedObjectBelowReferencedAssertions (assert: typeof StrictAssert): void {
  const main = mainFrame([nodeLocal('head', 1)])
  const inConstructor = heapObjectBoxes(assert, renderDot(traceState([constructorFrame(3), main], [node(3), node(1, 2), node(2)])))
  const afterReturnState = traceState(main, [node(1, 2), node(2), node(3, undefined, true)])
  const afterReturn = heapObjectBoxes(assert, renderDot(afterReturnState))

  for (const id of [1, 2]) {
    const shift = afterReturn.get(id)!.top - inConstructor.get(id)!.top
    assert.ok(Math.abs(shift) <= 1,
      `o_${id} must keep its place when the constructor returns (moved ${Math.abs(shift).toFixed(1)} pt ${shift > 0 ? 'down' : 'up'})`)
  }
  const returned = afterReturn.get(3)!
  const head = afterReturn.get(1)!
  assert.ok(returned.top >= head.bottom,
    `the unreferenced object must be below obj_1 (its top ${returned.top.toFixed(1)} pt, obj_1 bottom ${head.bottom.toFixed(1)} pt)`)
  assertHeapRightOfStackAndLevel(assert, afterReturnState, 'unreferenced object after a return')
}

/** Without visible heap items, the memory view draws no Heap box and adds no anchor. */
export function runEmptyHeapAssertions (assert: typeof StrictAssert): void {
  const dot = renderDot(traceState(mainFrame([]), []))
  assert.doesNotMatch(dot, /heap_anchor/)
  const graphviz = runDot(dot, 'json')
  assert.equal(graphviz.status, 0, graphviz.stderr)
  const objects: { name: string, bb?: string }[] = JSON.parse(graphviz.stdout).objects
  // Graphviz still lists an empty cluster, but gives it no bounding box and does not draw it.
  const heap = objects.find(object => object.name === 'cluster_heap')
  assert.equal(heap?.bb, undefined, 'an empty heap must not be drawn')
}
