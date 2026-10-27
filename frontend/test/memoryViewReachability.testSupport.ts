import type { strict as StrictAssert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { createPinia, setActivePinia } from 'pinia'
import type {
  LoadedClass,
  ProcessedHeapArray,
  ProcessedHeapObject,
  ProcessedHeapString,
  ProcessedTraceState,
  StackFrame
} from '@/dto/TraceState'
import { HeapVizChart } from '@/components/TheHeapVisualization/HeapVizChart'
import { HeapVizTraceState } from '@/components/TheHeapVisualization/Types/HeapVizTraceState'
import { MemoryViewRenderContext } from '@/components/TheHeapVisualization/MemoryViewRenderContext'
import { HeapVizStackFrame } from '@/components/TheHeapVisualization/Types/HeapVizStackFrame'
import { useHeapVizMetaStore } from '@/store/HeapVizMetaStore'

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

/** Uses the backend's display-signature format, including a freely named entry parameter. */
function entryFrame (parameterName = 'args'): StackFrame {
  return {
    kind: 'StackFrame',
    class: 'Example',
    method: 'main',
    signature: '([Ljava/lang/String;)V',
    displaySignature: `void main (String[] ${parameterName})`,
    displayText: 'Example.main(String[])',
    line: 1,
    internal: false,
    conditionValues: [],
    arrayAccessValues: [],
    localVariables: [{
      kind: 'Var',
      name: parameterName,
      type: 'java.lang.String[]',
      class: 'Example',
      method: 'main',
      changed: false,
      value: { kind: 'ReferenceVal', reference: 4 }
    }]
  }
}

/** Checks parameter identity and retention of explicit choices through reconstruction and reset. */
export function runEntryParameterStateAssertions (assert: typeof StrictAssert): void {
  for (const name of ['args', 'arguments', '$input', '参数']) {
    setActivePinia(createPinia())
    const store = useHeapVizMetaStore()
    const model = entryFrame(name)
    const context = new MemoryViewRenderContext()
    const createFrame = () => new HeapVizStackFrame(model, 0, context)
    const parameter = createFrame().localVariables[0]
    assert.equal(parameter.isExpanded, false, `${name} starts collapsed`)
    assert.match(parameter.render(), /➕/)
    store.setExpandedIdentifier({ identifier: parameter.identifier, e: true })
    assert.equal(createFrame().localVariables[0].isExpanded, true, 'manual expansion survives reconstruction')
    store.setExpandedIdentifier({ identifier: parameter.identifier, e: false })
    assert.equal(createFrame().localVariables[0].isExpanded, false, 'manual collapse survives reconstruction')
    store.reset()
    assert.equal(createFrame().localVariables[0].isExpanded, false, 'a new execution restores the default')
  }

  const frame = entryFrame()
  const cases: { name: string, model: StackFrame, frameNumber: number }[] = [
    { name: 'another method', model: { ...frame, method: 'helper' }, frameNumber: 0 },
    { name: 'overloaded main', model: { ...frame, signature: '([Ljava/lang/Object;)V' }, frameNumber: 0 },
    { name: 'instance main', model: { ...frame, this: { kind: 'ReferenceVal', reference: 1 } }, frameNumber: 0 },
    { name: 'recursive main', model: frame, frameNumber: 1 },
    { name: 'missing names', model: { ...frame, displaySignature: frame.signature }, frameNumber: 0 },
    { name: 'unrelated args', model: { ...frame, displaySignature: 'void main (String[] input)' }, frameNumber: 0 },
    {
      name: 'unrelated primitive', frameNumber: 0,
      model: {
        ...frame,
        localVariables: [{ ...frame.localVariables[0], type: 'int', value: { kind: 'PrimitiveVal', primitiveValue: '2', vizValue: '2', title: undefined } }]
      }
    }
  ]
  for (const example of cases) {
    setActivePinia(createPinia())
    const actual = new HeapVizStackFrame(example.model, example.frameNumber, new MemoryViewRenderContext())
    assert.equal(actual.localVariables[0].isExpanded, true, example.name)
  }

  setActivePinia(createPinia())
  const renamed = entryFrame('input')
  const mixed = new HeapVizStackFrame({
    ...renamed, localVariables: [frame.localVariables[0], ...renamed.localVariables]
  }, 0, new MemoryViewRenderContext())
  assert.equal(mixed.localVariables[0].isExpanded, true, 'an args local beside the renamed parameter stays expanded')
  assert.equal(mixed.localVariables[1].isExpanded, false, 'the actual parameter need not be the first local')
}

/** Exercises the chart's actual DOT output and reachability as the entry reference is toggled. */
export function runEntryParameterReachabilityAssertions (assert: typeof StrictAssert): void {
  for (const [name, hasArguments] of [['args', false], ['args', true], ['arguments', true]] as const) {
    setActivePinia(createPinia())
    const chart = new HeapVizChart()
    const internals = chart as unknown as HeapVizChartInternals
    const base = createProcessedTraceState()
    const args: ProcessedHeapArray = {
      kind: 'HeapArray', id: 4, type: 'java.lang.String[]', faked: false, loadedClass: undefined,
      elements: hasArguments
        ? [{ kind: 'HeapArrayElementVar', arrayId: 4, index: 0, type: 'java.lang.String', changed: false, value: { kind: 'ReferenceVal', reference: 2 } }]
        : []
    }
    const heap = [args, ...base.heapAfterExecution.slice(1).map(item => ({ ...item, faked: false }))]
    const main = entryFrame(name)
    const model: ProcessedTraceState = {
      ...base, heapBeforeExecution: heap, heapAfterExecution: heap,
      stackBeforeExecution: [main], stackAfterExecution: [main]
    }
    // Rebuild as stepping/redrawing does; store choices must survive both before/after frames.
    const render = (state: ProcessedTraceState = model): string => {
      internals.traceState = new HeapVizTraceState(state, internals.renderContext)
      internals.calculateNodeVisibility()
      return chart.render()
    }
    const collapsed = render()
    assert.match(collapsed, /➕/)
    assert.doesNotMatch(collapsed, /o_[234]\[label=/)
    assert.doesNotMatch(collapsed, /-> o_4:heap_object_header/)

    const parameter = internals.traceState.stackAfterExecution[0].localVariables[0]
    const store = useHeapVizMetaStore()
    store.setExpandedIdentifier({ identifier: parameter.identifier, e: true })
    const expanded = render({ ...model, line: 2, stateIndex: 1 })
    assert.match(expanded, new RegExp(`roots:l_0_${name}:e -> o_4:heap_object_header:w`))
    assert.match(expanded, /o_4\[label=/)
    assert.equal(internals.traceState.heapAfterExecution[1].isVisible, hasArguments, 'argument Strings follow array reachability')
    const graphviz = spawnSync('dot', ['-Tsvg'], { input: expanded, encoding: 'utf8' })
    assert.equal(graphviz.status, 0, graphviz.stderr)
    assert.match(graphviz.stdout, /<svg/)

    store.setExpandedIdentifier({ identifier: parameter.identifier, e: false })
    const aliasedFrame = { ...main, localVariables: [...main.localVariables, { ...main.localVariables[0], name: 'alias' }] }
    const aliased = render({ ...model, stackAfterExecution: [aliasedFrame] })
    assert.match(aliased, /roots:l_0_alias:e -> o_4:heap_object_header:w/)
    assert.match(aliased, /o_4\[label=/)
    assert.doesNotMatch(aliased, new RegExp(`roots:l_0_${name}:e ->`))
    store.reset()
    assert.doesNotMatch(render(), /o_[234]\[label=/)
  }
}
