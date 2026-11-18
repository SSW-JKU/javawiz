import type { strict as StrictAssert } from 'node:assert'
import { createPinia, setActivePinia } from 'pinia'
import type {
  LoadedClass,
  LocalVar,
  ProcessedHeapArray,
  ProcessedHeapObject,
  ProcessedHeapString,
  ProcessedTraceState,
  StackFrame,
  StaticVar,
  Val
} from '@/dto/TraceState'
import type { HoverInfo } from '@/hover/types'
import {
  createHoverArrayCell,
  createHoverClass,
  createHoverField,
  createHoverHeapObject,
  createHoverLocal,
  createHoverMethod,
  createHoverStatic,
  createHoverThisVar
} from '@/hover/hoverinfo-builder'
import { HeapVizTraceState } from '@/components/TheHeapVisualization/Types/HeapVizTraceState'
import { collectHoverTargets, hoverInfosForTarget } from '@/components/TheHeapVisualization/hover'
import {
  edgeIdentifier,
  heapArrayElementIdentifier,
  heapItemIdentifier,
  heapObjectFieldIdentifier,
  identifierFromSvgCellIdentifier,
  methodHeaderIdentifier,
  stackLocalIdentifier,
  staticFieldIdentifier,
  SVG_CELL_SUFFIXES,
  svgCellIdentifier
} from '@/identifiers/trace-identifiers'

function primitive (value: string): Val {
  return { kind: 'PrimitiveVal', primitiveValue: value, vizValue: value, title: undefined }
}

function reference (id: number): Val {
  return { kind: 'ReferenceVal', reference: id }
}

function staticField (clazz: string, name: string, type: string, value: Val): StaticVar {
  return { kind: 'Var', name, type, class: clazz, changed: false, value }
}

function loadedClass (clazz: string, staticFields: StaticVar[]): LoadedClass {
  return { kind: 'LoadedClass', class: clazz, staticFields, isHeapTraversalStop: false, isJavaDataStructure: false, hasCollectedFields: true }
}

function node (id: number, next: Val): ProcessedHeapObject {
  return {
    kind: 'HeapObject', id, type: 'Node', faked: false, loadedClass: undefined,
    fields: [
      { kind: 'Var', name: 'value', type: 'int', class: 'Node', heapObjectId: id, changed: false, value: primitive(String(id)) },
      { kind: 'Var', name: 'next', type: 'Node', class: 'Node', heapObjectId: id, changed: false, value: next }
    ]
  }
}

function local (clazz: string, method: string, name: string, type: string, value: Val): LocalVar {
  return { kind: 'Var', name, type, class: clazz, method: `${method}(...)`, changed: false, value }
}

function frame (clazz: string, method: string, localVariables: LocalVar[], thisReference?: number): StackFrame {
  return {
    kind: 'StackFrame',
    class: clazz,
    method,
    signature: '()V',
    displaySignature: `void ${method} ()`,
    displayText: `${clazz}.${method}()`,
    line: 1,
    internal: false,
    conditionValues: [],
    arrayAccessValues: [],
    localVariables,
    ...(thisReference === undefined ? {} : { this: { kind: 'ReferenceVal', reference: thisReference } })
  }
}

/**
 * Two classes with static fields (the second one has `_` in its name), `main` (frame 0) and a call of
 * `Node.visit` (frame 1) with `this`, two linked nodes, a reference array and a String whose `value`
 * field is shown.
 */
function createState (): HeapVizTraceState {
  const stringClass: LoadedClass = { ...loadedClass('java.lang.String', []), isHeapTraversalStop: true, isJavaDataStructure: true }
  const classes = [
    loadedClass('A', [staticField('A', 'count', 'int', primitive('1')), staticField('A', 'head', 'Node', reference(10))]),
    loadedClass('My_Class', [staticField('My_Class', 'total', 'int', primitive('5'))]),
    stringClass
  ]
  const heap: (ProcessedHeapObject | ProcessedHeapArray | ProcessedHeapString)[] = [
    node(10, reference(11)),
    node(11, { kind: 'NullVal' }),
    {
      kind: 'HeapArray', id: 20, type: 'Node[]', faked: false, loadedClass: undefined,
      elements: [10, 11].map((id, index) => ({ kind: 'HeapArrayElementVar', arrayId: 20, index, type: 'Node', changed: false, value: reference(id) }))
    },
    {
      kind: 'HeapString', id: 22, type: 'java.lang.String', faked: false, loadedClass: stringClass, string: 'A', vizString: 'A',
      charArr: { kind: 'Var', name: 'value', type: 'byte[]', class: 'java.lang.String', heapObjectId: 22, changed: false, value: reference(23) }
    },
    {
      kind: 'HeapArray', id: 23, type: 'byte[]', faked: false, loadedClass: undefined,
      elements: [{ kind: 'HeapArrayElementVar', arrayId: 23, index: 0, type: 'byte', changed: false, value: primitive('65') }]
    }
  ]
  const main = frame('Example', 'main', [
    local('Example', 'main', 'nodes', 'Node[]', reference(20)),
    local('Example', 'main', 'text', 'java.lang.String', reference(22)),
    local('Example', 'main', 'i', 'int', primitive('0'))
  ])
  const visit = frame('Node', 'visit', [
    local('Node', 'visit', 'depth', 'int', primitive('1')),
    local('Node', 'visit', 'n', 'Node', reference(11))
  ], 10)
  // The backend lists the innermost frame first; HeapVizTraceState reverses it, so main is frame 0.
  const stack = [visit, main]
  const processed: ProcessedTraceState = {
    kind: 'ProcessedTraceState',
    localUri: '',
    line: 1,
    stateIndex: 0,
    heapBeforeExecution: heap,
    stackBeforeExecution: stack,
    loadedClassesBeforeExecution: classes,
    heapAfterExecution: heap,
    stackAfterExecution: stack,
    loadedClassesAfterExecution: classes
  }
  return new HeapVizTraceState(processed)
}

/**
 * The hover infos the memory view sends when the mouse is over the element with id `cellIdentifier`,
 * computed the same way as the chart's mouse-move handler.
 */
function hoverInfosForCell (state: HeapVizTraceState, cellIdentifier: string): HoverInfo[] {
  const target = collectHoverTargets(state).get(identifierFromSvgCellIdentifier(cellIdentifier))
  return target ? hoverInfosForTarget(target, state) : []
}

const value = (record: string) => svgCellIdentifier(record, SVG_CELL_SUFFIXES.value)
const header = (record: string) => svgCellIdentifier(record, SVG_CELL_SUFFIXES.header)

interface HoverTargetExpectation {
  readonly description: string
  /** The element id under the mouse. */
  readonly cell: string
  readonly hoverInfos: HoverInfo[]
}

/** The exact hover lists, in order. Ids are built with the shared helpers, so they follow the identifier format. */
function expectations (): HoverTargetExpectation[] {
  const nodeType = 'Node'
  return [
    {
      description: 'primitive local in main',
      cell: value(stackLocalIdentifier(0, { name: 'i' })),
      hoverInfos: [createHoverLocal('Example', 'main', 'i', -1, 0)]
    },
    {
      description: 'reference local in main',
      cell: value(stackLocalIdentifier(0, { name: 'nodes' })),
      hoverInfos: [createHoverHeapObject(20), createHoverLocal('Example', 'main', 'nodes', 20, 0)]
    },
    {
      description: 'primitive local in a called method',
      cell: value(stackLocalIdentifier(1, { name: 'depth' })),
      hoverInfos: [createHoverLocal('Node', 'visit', 'depth', -1, 1)]
    },
    {
      description: '`this` of a called method',
      cell: value(stackLocalIdentifier(1, { name: 'this' })),
      hoverInfos: [createHoverThisVar(1, 'this', 10), createHoverHeapObject(10)]
    },
    {
      description: 'primitive static of the first class',
      cell: value(staticFieldIdentifier({ class: 'A' }, { name: 'count' })),
      hoverInfos: [createHoverStatic('A', 'count', -1)]
    },
    {
      description: 'reference static of the first class',
      cell: value(staticFieldIdentifier({ class: 'A' }, { name: 'head' })),
      hoverInfos: [createHoverHeapObject(10), createHoverStatic('A', 'head', 10)]
    },
    {
      description: 'static of a class whose name contains `_`',
      cell: value(staticFieldIdentifier({ class: 'My_Class' }, { name: 'total' })),
      hoverInfos: [createHoverStatic('My_Class', 'total', -1)]
    },
    {
      description: 'reference field',
      cell: value(heapObjectFieldIdentifier({ id: 10 }, { name: 'next' })),
      hoverInfos: [createHoverField(10, 'next', 11), createHoverHeapObject(11), createHoverClass(nodeType)]
    },
    {
      description: 'null field',
      cell: value(heapObjectFieldIdentifier({ id: 11 }, { name: 'next' })),
      hoverInfos: [createHoverField(11, 'next', -1), createHoverClass(nodeType)]
    },
    {
      description: 'reference array element',
      cell: value(heapArrayElementIdentifier({ arrayId: 20, index: 1 })),
      hoverInfos: [createHoverArrayCell(20, 1), createHoverHeapObject(11)]
    },
    {
      description: 'object header with every reference to it',
      cell: header(heapItemIdentifier({ id: 11 })),
      hoverInfos: [
        createHoverHeapObject(11),
        createHoverLocal('Node', 'visit', 'n', 11, 1),
        createHoverField(10, 'next', 11),
        createHoverArrayCell(20, 1),
        createHoverClass(nodeType)
      ]
    },
    {
      description: 'array header (no class)',
      cell: header(heapItemIdentifier({ id: 20 })),
      hoverInfos: [createHoverHeapObject(20), createHoverLocal('Example', 'main', 'nodes', 20, 0)]
    },
    {
      description: 'value field of a String: the String itself',
      cell: value(heapObjectFieldIdentifier({ id: 22 }, { name: 'value' })),
      hoverInfos: [createHoverHeapObject(22), createHoverLocal('Example', 'main', 'text', 22, 0), createHoverClass('java.lang.String')]
    },
    {
      description: 'method header',
      cell: methodHeaderIdentifier(1),
      hoverInfos: [createHoverMethod('Node', 'visit')]
    },
    {
      description: 'reference arrow (an edge, not a cell)',
      cell: edgeIdentifier(stackLocalIdentifier(1, { name: 'n' }), heapItemIdentifier({ id: 11 })),
      hoverInfos: []
    }
  ]
}

/** Checks the exact hover list for every kind of element in the memory view. */
export function runHoverTargetAssertions (assert: typeof StrictAssert): void {
  setActivePinia(createPinia())
  const state = createState()

  const failures: string[] = []
  for (const expectation of expectations()) {
    try {
      const actual = hoverInfosForCell(state, expectation.cell)
      if (JSON.stringify(actual) !== JSON.stringify(expectation.hoverInfos))
        failures.push(`${expectation.description} (${expectation.cell}): got ${JSON.stringify(actual)}`)
    } catch (error) {
      failures.push(`${expectation.description} (${expectation.cell}): threw ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  assert.deepEqual(failures, [], `hover lists that differ:\n${failures.join('\n')}`)
}
