import type { strict as StrictAssert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { createPinia, setActivePinia } from 'pinia'
import type {
  LoadedClass,
  LocalVar,
  ProcessedHeapArray,
  ProcessedHeapObject,
  ProcessedHeapString,
  ProcessedTraceState,
  StackFrame,
  Val
} from '@/dto/TraceState'
import type { HoverInfo } from '@/hover/types'
import { HeapVizChart } from '@/components/TheHeapVisualization/HeapVizChart'
import { HeapVizTraceState } from '@/components/TheHeapVisualization/Types/HeapVizTraceState'
import { MemoryViewRenderContext } from '@/components/TheHeapVisualization/MemoryViewRenderContext'
import { collectHoverTargets, hoverInfosForTarget } from '@/components/TheHeapVisualization/hover'
import { identifierFromSvgCellIdentifier } from '@/identifiers/trace-identifiers'

interface HeapVizChartInternals {
  readonly renderContext: MemoryViewRenderContext
  traceState: HeapVizTraceState
  calculateNodeVisibility: () => void
}

const HIGHLIGHTED_EDGE_COLOR = '#eda167'

const nodeClass: LoadedClass = {
  kind: 'LoadedClass',
  class: 'Node',
  isHeapTraversalStop: false,
  isJavaDataStructure: false,
  hasCollectedFields: true,
  staticFields: [
    { kind: 'Var', name: 'head', type: 'Node', class: 'Node', changed: true, value: { kind: 'ReferenceVal', reference: 10 } },
    { kind: 'Var', name: 'count', type: 'int', class: 'Node', changed: false, value: primitive('2') }
  ]
}
const stringClass: LoadedClass = {
  kind: 'LoadedClass',
  class: 'java.lang.String',
  staticFields: [],
  isHeapTraversalStop: true,
  isJavaDataStructure: true,
  hasCollectedFields: true
}

function primitive (value: string): Val {
  return { kind: 'PrimitiveVal', primitiveValue: value, vizValue: value, title: undefined }
}

function reference (id: number): Val {
  return { kind: 'ReferenceVal', reference: id }
}

function node (id: number, value: string, next: Val): ProcessedHeapObject {
  return {
    kind: 'HeapObject', id, type: 'Node', faked: false, loadedClass: nodeClass,
    fields: [
      { kind: 'Var', name: 'value', type: 'int', class: 'Node', heapObjectId: id, changed: false, value: primitive(value) },
      { kind: 'Var', name: 'next', type: 'Node', class: 'Node', heapObjectId: id, changed: false, value: next }
    ]
  }
}

/** The backend names a local's method `visit(...)`, while its stack frame and every hover use `visit`. */
function local (method: string, name: string, type: string, value: Val): LocalVar {
  return { kind: 'Var', name, type, class: method === 'main' ? 'Example' : 'Node', method: `${method}(...)`, changed: false, value }
}

function frame (clazz: string, method: string, displayText: string, localVariables: LocalVar[], thisReference?: number): StackFrame {
  return {
    kind: 'StackFrame',
    class: clazz,
    method,
    signature: method === 'main' ? '([Ljava/lang/String;)V' : '()V',
    displaySignature: method === 'main' ? 'void main (String[] args)' : 'void visit (int depth)',
    displayText,
    line: 1,
    internal: false,
    conditionValues: [],
    arrayAccessValues: [],
    localVariables,
    ...(thisReference === undefined ? {} : { this: { kind: 'ReferenceVal', reference: thisReference } })
  }
}

/**
 * Statics, locals, `this`, a recursive method (`visit` in frames 1 and 2), a reference array,
 * a primitive array, a String, and two linked objects. Frame numbers follow the memory view:
 * main is frame 0 and the innermost call has the highest number.
 */
function createProcessedTraceState (): ProcessedTraceState {
  const heap: (ProcessedHeapObject | ProcessedHeapArray | ProcessedHeapString)[] = [
    node(10, '1', reference(11)),
    node(11, '2', { kind: 'NullVal' }),
    {
      kind: 'HeapArray', id: 20, type: 'Node[]', faked: false, loadedClass: undefined,
      elements: [10, 11].map((id, index) => ({
        kind: 'HeapArrayElementVar', arrayId: 20, index, type: 'Node', changed: false, value: reference(id)
      }))
    },
    {
      kind: 'HeapArray', id: 21, type: 'int[]', faked: false, loadedClass: undefined,
      elements: ['3', '4'].map((value, index) => ({
        kind: 'HeapArrayElementVar', arrayId: 21, index, type: 'int', changed: false, value: primitive(value)
      }))
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
  const main = frame('Example', 'main', 'Example.main(String[])', [
    local('main', 'nodes', 'Node[]', reference(20)),
    local('main', 'numbers', 'int[]', reference(21)),
    local('main', 'text', 'java.lang.String', reference(22))
  ])
  const outerVisit = frame('Node', 'visit', 'Node.visit()', [
    local('visit', 'depth', 'int', primitive('2')),
    local('visit', 'n', 'Node', reference(10))
  ], 10)
  const innerVisit = frame('Node', 'visit', 'Node.visit()', [
    local('visit', 'depth', 'int', primitive('1')),
    local('visit', 'n', 'Node', reference(11))
  ], 11)
  // The backend lists the innermost frame first; HeapVizTraceState reverses it.
  const stack = [innerVisit, outerVisit, main]
  return {
    kind: 'ProcessedTraceState',
    localUri: '',
    line: 1,
    stateIndex: 0,
    heapBeforeExecution: heap,
    stackBeforeExecution: stack,
    loadedClassesBeforeExecution: [nodeClass, stringClass],
    heapAfterExecution: heap,
    stackAfterExecution: stack,
    loadedClassesAfterExecution: [nodeClass, stringClass]
  }
}

interface Edge { readonly key: string, readonly attributes: string }

const INJECTED_ID = /\btitle="id=&quot;([^"&]+)&quot;/

function tableCells (dot: string): string[] {
  return Array.from(dot.matchAll(/<td\b[^>]*>/g), match => match[0])
}

function bgColor (cell: string): string | undefined {
  return /\bbgcolor="([^"]*)"/.exec(cell)?.[1]?.toLowerCase()
}

function edges (dot: string): Edge[] {
  // Edge statements are not always on their own line, so match each statement by its shape.
  return Array.from(dot.matchAll(/([^\s;{}]+):e -> (obj_\d+):heap_object_header:w \[([^\]]*)\]/g), match => ({
    key: `${match[1]} -> ${match[2]}`,
    attributes: match[3]
  }))
}

function isOrange (edge: Edge): boolean {
  return edge.attributes.includes(`color="${HIGHLIGHTED_EDGE_COLOR}"`) && /penwidth="2(\.0)?"/.test(edge.attributes)
}

/** Computes the hover list the same way as the chart's mousemove handler. */
function hoverInfosForCell (internals: HeapVizChartInternals, cellIdentifier: string): HoverInfo[] {
  const target = collectHoverTargets(internals.traceState).get(identifierFromSvgCellIdentifier(cellIdentifier))
  return target ? hoverInfosForTarget(target, internals.traceState) : []
}

interface HoverExpectation {
  /** The SVG cell id under the mouse. */
  readonly cell: string
  /** Edges that must be drawn orange; every other edge keeps its normal style. */
  readonly orangeEdges: readonly string[]
  /** Record identifiers whose cells must keep their normal colors. */
  readonly unchangedRecords?: readonly string[]
  /** Record identifiers whose cells must change color. */
  readonly changedRecords?: readonly string[]
}

const HOVER_EXPECTATIONS: readonly HoverExpectation[] = [
  {
    // A primitive local of the outer recursive call: only the local rule can color it.
    cell: 'local_1_depth--value',
    orangeEdges: [],
    changedRecords: ['local_1_depth'],
    unchangedRecords: ['local_2_depth']
  },
  {
    cell: 'local_1_n--value', // reference local of the outer recursive call
    orangeEdges: ['roots:local_1_n -> obj_10'],
    changedRecords: ['local_1_n'],
    unchangedRecords: ['local_2_n']
  },
  { cell: 'local_0_nodes--value', orangeEdges: ['roots:local_0_nodes -> obj_20'], changedRecords: ['local_0_nodes'] },
  {
    cell: 'local_1_this--value',
    orangeEdges: ['roots:local_1_this -> obj_10'],
    changedRecords: ['local_1_this'],
    unchangedRecords: ['local_2_this']
  },
  { cell: 'static_Node_head--value', orangeEdges: ['roots:static_Node_head -> obj_10'], changedRecords: ['static_Node_head'] },
  { cell: 'obj_10-next--value', orangeEdges: ['obj_10:next -> obj_11'], changedRecords: ['obj_10-next', 'obj_11'] },
  { cell: 'obj_20-0--value', orangeEdges: ['obj_20:0 -> obj_10'], changedRecords: ['obj_20-0', 'obj_10'] },
  {
    cell: 'obj_11--header',
    orangeEdges: ['obj_10:next -> obj_11', 'obj_20:1 -> obj_11', 'roots:local_2_n -> obj_11', 'roots:local_2_this -> obj_11'],
    changedRecords: ['obj_11', 'obj_10-next', 'obj_20-1', 'local_2_n', 'local_2_this']
  },
  { cell: 'obj_20--header', orangeEdges: ['roots:local_0_nodes -> obj_20'], changedRecords: ['obj_20', 'obj_20-0', 'obj_20-1'] },
  { cell: 'obj_21-1--value', orangeEdges: [], changedRecords: ['obj_21-1'] },
  { cell: 'obj_22--header', orangeEdges: ['roots:local_0_text -> obj_22'], changedRecords: ['obj_22'] },
  { cell: 'stackframe_1--method', orangeEdges: [], changedRecords: ['stackframe_1', 'stackframe_2'] }
]

function recordOf (cellId: string): string {
  return identifierFromSvgCellIdentifier(cellId)
}

/**
 * Renders the chart's real DOT once without hover and once per hover kind, and checks that
 * every cell and edge whose style depends on the hover can be found by its SVG id.
 */
export function runHoverCoverageAssertions (assert: typeof StrictAssert, showMemory: boolean): void {
  setActivePinia(createPinia())
  const chart = new HeapVizChart()
  const internals = chart as unknown as HeapVizChartInternals
  internals.renderContext.setShowMemory(showMemory)
  internals.traceState = new HeapVizTraceState(createProcessedTraceState(), internals.renderContext)
  internals.calculateNodeVisibility()

  const render = (hoverInfos: readonly HoverInfo[]): string => {
    internals.renderContext.setHoverInfos(hoverInfos)
    return chart.render()
  }

  const baseline = render([])
  const baselineCells = tableCells(baseline)
  const baselineEdges = edges(baseline)
  const graphviz = spawnSync('dot', ['-Tsvg'], { input: baseline, encoding: 'utf8' })
  assert.equal(graphviz.status, 0, graphviz.stderr)

  // Every edge the fixture draws, so a missing edge cannot hide a missing id.
  assert.deepEqual(baselineEdges.map(edge => edge.key).sort(), [
    'obj_10:next -> obj_11',
    'obj_20:0 -> obj_10',
    'obj_20:1 -> obj_11',
    'roots:local_0_nodes -> obj_20',
    'roots:local_0_numbers -> obj_21',
    'roots:local_0_text -> obj_22',
    'roots:local_1_n -> obj_10',
    'roots:local_1_this -> obj_10',
    'roots:local_2_n -> obj_11',
    'roots:local_2_this -> obj_11',
    'roots:static_Node_head -> obj_10'
  ])
  assert.ok(baselineEdges.every(edge => !isOrange(edge)), 'no edge is orange without hover')
  assert.match(baselineEdges.find(edge => edge.key === 'roots:static_Node_head -> obj_10')!.attributes, /color="red"/,
    'a changed reference is red without hover')

  const edgeIds = baselineEdges.map(edge => /\bid="([^"]+)"/.exec(edge.attributes)?.[1])
  baselineEdges.forEach((edge, index) => assert.ok(edgeIds[index], `edge ${edge.key} has an id`))
  assert.equal(new Set(edgeIds).size, edgeIds.length, 'edge ids are unique')
  // Graphviz writes a DOT edge id onto the edge's <g class="edge">, where recoloring looks it up.
  // It escapes characters such as `-` and `>` as XML entities, which the browser decodes again.
  const svgEdgeIds = new Set(Array.from(graphviz.stdout.matchAll(/<g id="([^"]+)" class="edge">/g), match => decodeXmlEntities(match[1])))
  for (const id of edgeIds)
    assert.ok(svgEdgeIds.has(id!), `SVG contains edge ${id}; found ${[...svgEdgeIds].join(', ')}`)

  for (const expectation of HOVER_EXPECTATIONS) {
    const hoverInfos = hoverInfosForCell(internals, expectation.cell)
    assert.ok(hoverInfos.length > 0, `${expectation.cell} produces hover infos`)
    const hovered = render(hoverInfos)
    const label = `hover on ${expectation.cell}${showMemory ? ' with byte sizes' : ''}`

    const hoveredCells = tableCells(hovered)
    assert.equal(hoveredCells.length, baselineCells.length, `${label} keeps the table layout`)
    const changedCellIds: string[] = []
    hoveredCells.forEach((cell, index) => {
      if (bgColor(cell) === bgColor(baselineCells[index]))
        return
      const id = INJECTED_ID.exec(cell)?.[1]
      assert.ok(id, `${label}: a cell whose color changes has an SVG id: ${cell}`)
      assert.equal(INJECTED_ID.exec(baselineCells[index])?.[1], id, `${label}: the cell keeps its id`)
      changedCellIds.push(id!)
    })
    const changedRecords = new Set(changedCellIds.map(recordOf))
    for (const record of expectation.changedRecords ?? [])
      assert.ok(changedRecords.has(record), `${label} highlights ${record}; changed: ${[...changedRecords].join(', ')}`)
    for (const record of expectation.unchangedRecords ?? [])
      assert.ok(!changedRecords.has(record), `${label} does not highlight ${record}; changed: ${[...changedRecords].join(', ')}`)

    const hoveredEdges = edges(hovered)
    assert.deepEqual(hoveredEdges.map(edge => edge.key), baselineEdges.map(edge => edge.key), `${label} keeps the edges`)
    const orange = hoveredEdges.filter(isOrange).map(edge => edge.key)
      .sort()
    assert.deepEqual(orange, [...expectation.orangeEdges].sort(), `${label} draws exactly these edges orange`)
    hoveredEdges.forEach((edge, index) => {
      if (edge.attributes !== baselineEdges[index].attributes)
        assert.equal(/\bid="([^"]+)"/.exec(edge.attributes)?.[1], edgeIds[index], `${label}: ${edge.key} keeps its id`)
    })
  }

  // Moving the mouse away restores the original DOT, including the red changed edge.
  assert.equal(render([]), baseline)
}

function decodeXmlEntities (value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
}
