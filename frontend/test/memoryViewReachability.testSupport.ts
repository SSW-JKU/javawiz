import type { strict as StrictAssert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { createPinia, setActivePinia } from 'pinia'
import type {
  LoadedClass,
  ProcessedHeapArray,
  ProcessedHeapObject,
  ProcessedHeapString,
  ProcessedTraceState
} from '@/dto/TraceState'
import { HeapVizChart } from '@/components/TheHeapVisualization/HeapVizChart'
import { HeapVizTraceState } from '@/components/TheHeapVisualization/Types/HeapVizTraceState'
import type { MemoryViewRenderContext } from '@/components/TheHeapVisualization/MemoryViewRenderContext'

interface HeapVizChartInternals {
  readonly renderContext: MemoryViewRenderContext
  traceState: HeapVizTraceState
  calculateNodeVisibility: () => void
}

/** Builds the object-to-String-to-backing-array path from the reported broken-link case. */
function createProcessedTraceState (): ProcessedTraceState {
  const ordinaryClass: LoadedClass = {
    kind: 'LoadedClass',
    class: 'Example',
    staticFields: [],
    isHeapTraversalStop: false,
    isJavaDataStructure: false,
    hasCollectedFields: true
  }
  const stringClass: LoadedClass = {
    kind: 'LoadedClass',
    class: 'java.lang.String',
    staticFields: [],
    isHeapTraversalStop: true,
    isJavaDataStructure: true,
    hasCollectedFields: true
  }
  const object: ProcessedHeapObject = {
    kind: 'HeapObject',
    id: 1,
    type: ordinaryClass.class,
    faked: true,
    loadedClass: ordinaryClass,
    fields: [{
      kind: 'Var',
      name: 'text',
      type: stringClass.class,
      value: { kind: 'ReferenceVal', reference: 2 },
      changed: false,
      class: ordinaryClass.class
    }]
  }
  const string: ProcessedHeapString = {
    kind: 'HeapString',
    id: 2,
    type: stringClass.class,
    faked: true,
    loadedClass: stringClass,
    string: 'A',
    vizString: 'A',
    charArr: {
      kind: 'Var',
      name: 'value',
      type: 'byte[]',
      value: { kind: 'ReferenceVal', reference: 3 },
      changed: false,
      class: stringClass.class
    }
  }
  const backingArray: ProcessedHeapArray = {
    kind: 'HeapArray',
    id: 3,
    type: 'byte[]',
    faked: false,
    loadedClass: undefined,
    elements: [{
      kind: 'HeapArrayElementVar',
      arrayId: 3,
      index: 0,
      type: 'byte',
      value: { kind: 'PrimitiveVal', primitiveValue: '65', vizValue: '65', title: undefined },
      changed: false
    }]
  }
  return {
    kind: 'ProcessedTraceState',
    localUri: '',
    line: 1,
    stateIndex: 0,
    heapBeforeExecution: [object, string, backingArray],
    stackBeforeExecution: [],
    loadedClassesBeforeExecution: [ordinaryClass, stringClass],
    heapAfterExecution: [object, string, backingArray],
    stackAfterExecution: [],
    loadedClassesAfterExecution: [ordinaryClass, stringClass]
  }
}

/** Verifies complete chart reachability and DOT output for compact and detailed Strings. */
export function runMemoryViewReachabilityAssertions (assert: typeof StrictAssert): void {
  setActivePinia(createPinia())
  const chart = new HeapVizChart()
  const internals = chart as unknown as HeapVizChartInternals
  const model = createProcessedTraceState()

  internals.traceState = new HeapVizTraceState(model, internals.renderContext)
  internals.calculateNodeVisibility()
  const compactDot = chart.render()
  assert.equal(internals.traceState.heapAfterExecution[2].isVisible, false)
  assert.doesNotMatch(compactDot, /o_2:value:e -> o_3:heap_object_header:w/)
  assert.doesNotMatch(compactDot, /o_3\[label=/)

  internals.renderContext.setDataStructureVisibilitySettings({
    showDataStructureDetails: true,
    showDataStructureStatics: false,
    showDataStructureFields: true
  })
  internals.calculateNodeVisibility()
  const detailedDot = chart.render()
  assert.equal(internals.traceState.heapAfterExecution[2].isVisible, true)
  assert.match(detailedDot, /o_2:value:e -> o_3:heap_object_header:w/)
  assert.match(detailedDot, /o_3\[label=<<font/)

  const graphviz = spawnSync('dot', ['-Tsvg'], { input: detailedDot, encoding: 'utf8' })
  assert.equal(graphviz.status, 0, graphviz.stderr)
  assert.match(graphviz.stdout, /<svg/)
}
