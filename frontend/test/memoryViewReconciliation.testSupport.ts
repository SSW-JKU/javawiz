import type { strict as StrictAssert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { createPinia, setActivePinia } from 'pinia'
import type { LoadedClass, ProcessedHeapArray, ProcessedHeapObject, ProcessedHeapString, StackFrame, StaticVar, TraceState } from '@/dto/TraceState'
import {
  DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS,
  shouldShowClassStatics,
  shouldShowObjectFields
} from '@/components/TheHeapVisualization/DataStructureVisibility'
import { MemoryViewRenderContext } from '@/components/TheHeapVisualization/MemoryViewRenderContext'
import { HeapVizHeapArray } from '@/components/TheHeapVisualization/Types/HeapVizHeapArray'
import { HeapVizHeapObject } from '@/components/TheHeapVisualization/Types/HeapVizHeapObject'
import { HeapVizHeapString } from '@/components/TheHeapVisualization/Types/HeapVizHeapString'
import { HeapVizStackFrame } from '@/components/TheHeapVisualization/Types/HeapVizStackFrame'
import { HeapVizTraceState } from '@/components/TheHeapVisualization/Types/HeapVizTraceState'
import { arraySize, STRING_OBJECT_BYTES } from '@/components/TheHeapVisualization/MemorySize'
import sanitizer from '@/helpers/sanitizer'
import {
  heapObjectFieldIdentifier,
  identifierFromSvgCellIdentifier,
  SVG_CELL_SUFFIXES,
  svgCellIdentifier
} from '@/components/TheHeapVisualization/identifiers'

const ordinaryClass: LoadedClass = {
  kind: 'LoadedClass',
  class: 'example.Outer$Inner',
  staticFields: [],
  isHeapTraversalStop: false,
  isJavaDataStructure: false,
  hasCollectedFields: true
}

function field (name: string, reference: number): StaticVar {
  return {
    kind: 'Var',
    name,
    type: 'java.lang.Object',
    value: { kind: 'ReferenceVal', reference },
    changed: false,
    class: ordinaryClass.class
  }
}

export async function runMemoryViewReconciliationAssertions (assert: typeof StrictAssert): Promise<void> {
  setActivePinia(createPinia())

  const fieldIdentifier = heapObjectFieldIdentifier({ id: 1 }, field('child.value', 2))
  const cellIdentifier = svgCellIdentifier(fieldIdentifier, SVG_CELL_SUFFIXES.value)
  assert.equal(fieldIdentifier, 'o_1:child_DOT_CHARACTER_REPLACEMENT_value')
  assert.equal(identifierFromSvgCellIdentifier(cellIdentifier), fieldIdentifier)

  assert.equal(shouldShowObjectFields(ordinaryClass, DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS), true)
  assert.equal(shouldShowClassStatics(ordinaryClass, DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS), true)
  const dataStructureClass: LoadedClass = { ...ordinaryClass, isJavaDataStructure: true }
  assert.equal(shouldShowObjectFields(dataStructureClass, DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS), false)
  assert.equal(shouldShowClassStatics(dataStructureClass, DEFAULT_DATA_STRUCTURE_VISIBILITY_SETTINGS), false)

  const compactContext = new MemoryViewRenderContext()
  const memoryContext = new MemoryViewRenderContext()
  memoryContext.setShowMemory(true)
  const detailedMemoryContext = new MemoryViewRenderContext()
  detailedMemoryContext.setShowMemory(true)
  detailedMemoryContext.setDataStructureVisibilitySettings({
    showDataStructureDetails: true,
    showDataStructureStatics: false,
    showDataStructureFields: true
  })
  const model: ProcessedHeapObject = {
    kind: 'HeapObject',
    id: 1,
    type: ordinaryClass.class,
    faked: false,
    loadedClass: ordinaryClass,
    fields: [field('child.value', 2)]
  }
  const compactObject = new HeapVizHeapObject(model, compactContext)
  const memoryObject = new HeapVizHeapObject(model, memoryContext)
  const assertHeapNode = (name: string, node: string, expectedIdentifier: string, expectedClass: string): void => {
    assert.match(node, new RegExp(`^${expectedIdentifier}\\[label=<<font`), name)
    assert.match(node, /port="heap_object_header"/, name)
    assert.match(node, /id=&quot;[^&]+:header&quot;/, name)
    assert.match(node, new RegExp(`class="${expectedClass}"`), name)
    const graphviz = spawnSync('dot', ['-Tsvg'], {
      input: `digraph { node [shape="plaintext"] ${node} }`,
      encoding: 'utf8'
    })
    assert.equal(graphviz.status, 0, `${name}: ${graphviz.stderr}`)
    assert.match(graphviz.stdout, /<svg/, name)
  }
  assertHeapNode('compact object node', compactObject.renderNode(), 'o_1', 'heapvizheapobject')
  assertHeapNode('memory object node', memoryObject.renderNode(), 'o_1', 'heapvizheapobject')
  assert.doesNotMatch(compactObject.render(), /href=/)
  assert.match(compactObject.render(), /id=&quot;o_1:child_DOT_CHARACTER_REPLACEMENT_value:value&quot;/)
  assert.match(compactObject.edges(), /o_2:heap_object_header:w/)
  assert.doesNotMatch(compactObject.render(), />\d+<\/b><\/td>/)
  assert.match(memoryObject.render(), />16<\/b>/)
  assert.match(memoryObject.render(), /<b>24<\/b>&nbsp;\(\+0\)/)
  assert.match(memoryObject.render(), /<b>24<\/b>/)

  const arrayModel: ProcessedHeapArray = {
    kind: 'HeapArray',
    id: 3,
    type: 'java.lang.Object[]',
    faked: false,
    loadedClass: undefined,
    elements: [{
      kind: 'HeapArrayElementVar',
      arrayId: 3,
      index: 0,
      type: 'java.lang.Object',
      value: { kind: 'ReferenceVal', reference: 2 },
      changed: false
    }]
  }
  const array = new HeapVizHeapArray(arrayModel, compactContext)
  assert.match(array.render(), /o_3:i_0:index/)
  assert.match(array.edges(), /o_3:i_0:e -> o_2:heap_object_header:w/)
  const memoryArray = new HeapVizHeapArray(arrayModel, memoryContext)
  assertHeapNode('compact array node', array.renderNode(), 'o_3', 'heapvizheaparray')
  assertHeapNode('memory array node', memoryArray.renderNode(), 'o_3', 'heapvizheaparray')

  const primitiveArray = new HeapVizHeapArray({
    kind: 'HeapArray',
    id: 4,
    type: 'int[]',
    faked: false,
    loadedClass: undefined,
    elements: [{
      kind: 'HeapArrayElementVar',
      arrayId: 4,
      index: 0,
      type: 'int',
      value: { kind: 'PrimitiveVal', primitiveValue: '1', vizValue: '1', title: undefined },
      changed: false
    }]
  }, memoryContext)
  assert.match(primitiveArray.render(), /<b>16<\/b>[\s\S]*Header[\s\S]*<b>4<\/b>[\s\S]*Length[\s\S]*\[0\]/)

  assert.match(memoryArray.render(), /<b>16<\/b>[\s\S]*Header[\s\S]*<b>4<\/b>[\s\S]*Length[\s\S]*\[0\]/)

  const stackFrame = new HeapVizStackFrame({
    kind: 'StackFrame',
    line: 1,
    class: 'Example',
    method: 'main',
    signature: '()',
    displaySignature: '()',
    localVariables: [],
    conditionValues: [],
    arrayAccessValues: [],
    displayText: 'Example.main()',
    internal: false
  } satisfies StackFrame, 0, memoryContext)

  const stringModel: ProcessedHeapString = {
    kind: 'HeapString',
    id: 5,
    type: 'java.lang.String',
    faked: false,
    loadedClass: undefined,
    string: 'Tony',
    vizString: '',
    charArr: {
      kind: 'Var',
      name: 'value',
      type: 'byte[]',
      value: { kind: 'ReferenceVal', reference: 6 },
      changed: false,
      class: 'java.lang.String'
    }
  }
  const traceState = { heap: [stringModel], loadedClasses: [], stack: [] } as unknown as TraceState
  sanitizer.sanitizeTraceState(traceState)
  assert.equal(stringModel.string, 'Tony')
  const heapString = new HeapVizHeapString(stringModel, memoryContext)
  assertHeapNode('memory string node', heapString.renderNode(), 'o_5', 'heapvizheapstring')
  assert.equal(heapString.getTotalBytes(), STRING_OBJECT_BYTES + arraySize(4, 1))
  assert.match(heapString.render(), /align="right" bgcolor="#ffffff">32<\/td>/)
  const stringBackingArrayModel: ProcessedHeapArray = {
    kind: 'HeapArray',
    id: 6,
    type: 'byte[]',
    faked: false,
    loadedClass: undefined,
    elements: Array.from({ length: 4 }, (_, index) => ({
      kind: 'HeapArrayElementVar' as const,
      arrayId: 6,
      index,
      type: 'byte',
      value: { kind: 'PrimitiveVal' as const, primitiveValue: '0', vizValue: '0', title: undefined },
      changed: false
    }))
  }
  const stringBackingArray = new HeapVizHeapArray(stringBackingArrayModel, memoryContext)
  assert.equal(stringBackingArray.getTotalBytes(), arraySize(4, 1))
  const processedStringState = {
    kind: 'ProcessedTraceState' as const,
    localUri: '',
    line: 1,
    stateIndex: 0,
    heapBeforeExecution: [stringModel, stringBackingArrayModel],
    stackBeforeExecution: [],
    loadedClassesBeforeExecution: [],
    heapAfterExecution: [stringModel, stringBackingArrayModel],
    stackAfterExecution: [],
    loadedClassesAfterExecution: []
  }
  const compactStringTrace = new HeapVizTraceState(processedStringState, memoryContext)
  assert.equal(compactStringTrace.renderDetailsHeap(), `<i>${STRING_OBJECT_BYTES + arraySize(4, 1)} bytes</i>`)
  const detailedString = new HeapVizHeapString(stringModel, detailedMemoryContext)
  assert.equal(detailedString.getTotalBytes(), STRING_OBJECT_BYTES)
  assert.doesNotMatch(detailedString.render(), /Internal fields/)
  const detailedStringTrace = new HeapVizTraceState(processedStringState, detailedMemoryContext)
  assert.equal(detailedStringTrace.renderDetailsHeap(), `<i>${STRING_OBJECT_BYTES + arraySize(4, 1)} bytes</i>`)

  const primitiveFieldObject = new HeapVizHeapObject({
    ...model,
    id: 8,
    fields: [{
      kind: 'Var',
      name: 'count',
      type: 'int',
      value: { kind: 'PrimitiveVal', primitiveValue: '7', vizValue: '7', title: undefined },
      changed: false,
      class: ordinaryClass.class
    }]
  }, memoryContext)
  const hiddenObject = new HeapVizHeapObject({
    ...model,
    id: 9,
    loadedClass: dataStructureClass,
    fields: [field('hidden', 2)]
  }, memoryContext)
  const largeObject = new HeapVizHeapObject({
    ...model,
    id: 10,
    fields: Array.from({ length: 8 }, (_, index) => field(`child${index}`, index + 20))
  }, memoryContext)
  const emptyReferenceArray = new HeapVizHeapArray({ ...arrayModel, id: 11, elements: [] }, memoryContext)
  assert.equal(emptyReferenceArray.isRefArray, true)
  const largeReferenceArray = new HeapVizHeapArray({
    ...arrayModel,
    id: 12,
    elements: Array.from({ length: 6 }, (_, index) => ({
      kind: 'HeapArrayElementVar' as const,
      arrayId: 12,
      index,
      type: 'java.lang.Object',
      value: { kind: 'ReferenceVal' as const, reference: index + 30 },
      changed: false
    }))
  }, memoryContext)
  const largePrimitiveArray = new HeapVizHeapArray({
    kind: 'HeapArray',
    type: 'int[]',
    faked: false,
    loadedClass: undefined,
    id: 13,
    elements: Array.from({ length: 6 }, (_, index) => ({
      kind: 'HeapArrayElementVar' as const,
      arrayId: 13,
      index,
      type: 'int',
      value: { kind: 'PrimitiveVal' as const, primitiveValue: String(index), vizValue: String(index), title: undefined },
      changed: false
    }))
  }, memoryContext)

  const graphvizCases = [
    ['compact object', compactObject.render()],
    ['memory object', memoryObject.render()],
    ['empty object', new HeapVizHeapObject({ ...model, id: 7, fields: [] }, memoryContext).render()],
    ['compact reference array', array.render()],
    ['memory reference array', memoryArray.render()],
    ['memory primitive array', primitiveArray.render()],
    ['memory string', new HeapVizHeapString(stringModel, memoryContext).render()],
    ['memory stack frame', stackFrame.render()],
    ['primitive field object', primitiveFieldObject.render()],
    ['hidden object', hiddenObject.render()],
    ['large object', largeObject.render()],
    ['empty reference array', emptyReferenceArray.render()],
    ['large reference array', largeReferenceArray.render()],
    ['large primitive array', largePrimitiveArray.render()]
  ] as const

  for (const [name, rows] of graphvizCases) {
    const dot = `digraph { node [shape="plaintext"] sample [label=<<table>${rows}</table>>]; }`
    const graphviz = spawnSync('dot', ['-Tsvg'], { input: dot, encoding: 'utf8' })
    assert.equal(graphviz.status, 0, `${name}: ${graphviz.stderr}`)
    assert.match(graphviz.stdout, /<svg/, name)
  }
}
